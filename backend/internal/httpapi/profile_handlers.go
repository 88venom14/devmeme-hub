package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

// updatableProfileField describes a column that can be patched via
// PATCH /profiles/me. nullable reports whether an explicit JSON null is allowed
// (used to clear a field). The column name is a fixed identifier, never taken
// from user input, so it is safe to interpolate into SQL.
type updatableProfileField struct {
	column   string
	nullable bool
}

var updatableProfileFields = map[string]updatableProfileField{
	"username":     {"username", false},
	"display_name": {"display_name", true},
	"avatar_url":   {"avatar_url", true},
	"bio":          {"bio", true},
	"website_url":  {"website_url", true},
	"github_url":   {"github_url", true},
	"youtube_url":  {"youtube_url", true},
	"twitch_url":   {"twitch_url", true},
	"banner_url":   {"banner_url", true},
}

func (s *Server) myProfile(w http.ResponseWriter, r *http.Request) {
	profile, err := s.loadProfileByID(r.Context(), mustUser(r).ID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "profile not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (s *Server) getProfileByID(w http.ResponseWriter, r *http.Request) {
	profile, err := s.loadProfileByID(r.Context(), chi.URLParam(r, "profileID"))
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "profile not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	s.respondProfile(w, r, profile)
}

func (s *Server) getProfileByUsername(w http.ResponseWriter, r *http.Request) {
	profile, err := s.loadProfileByUsername(r.Context(), strings.ToLower(chi.URLParam(r, "username")))
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "profile not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	s.respondProfile(w, r, profile)
}

// respondProfile applies followers-only privacy: if the profile is restricted
// and the viewer is not the owner or a follower, only minimal identity is
// returned with is_private set, so the UI can show a "followers only" notice.
func (s *Server) respondProfile(w http.ResponseWriter, r *http.Request, profile Profile) {
	viewerID := mustUser(r).ID
	// Moderators/admins see role + ban state on every profile, even ones that
	// are otherwise followers-only private.
	moderation, err := s.moderationInfoFor(r.Context(), viewerID, profile.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	visible, err := s.profileVisibleTo(r.Context(), profile.ID, viewerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	if !visible {
		writeJSON(w, http.StatusOK, Profile{
			ID:          profile.ID,
			Username:    profile.Username,
			DisplayName: profile.DisplayName,
			AvatarURL:   profile.AvatarURL,
			BannerURL:   profile.BannerURL,
			CreatedAt:   profile.CreatedAt,
			UpdatedAt:   profile.UpdatedAt,
			IsPrivate:   true,
			Moderation:  moderation,
		})
		return
	}
	hidden, err := s.likedHiddenFor(r.Context(), profile.ID, viewerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	profile.LikedHidden = hidden
	profile.Moderation = moderation
	writeJSON(w, http.StatusOK, profile)
}

// moderationInfoFor returns the role/ban state of targetID, but only when the
// viewer is a moderator or admin. Anonymous or regular viewers get nil (the
// field is then omitted from the response). The status is run through
// effectiveStatus so an expired temporary ban shows as active.
func (s *Server) moderationInfoFor(ctx context.Context, viewerID, targetID string) (*ProfileModeration, error) {
	if viewerID == "" {
		return nil, nil
	}
	viewerRole, err := s.userRole(ctx, viewerID)
	if err != nil {
		return nil, err
	}
	if viewerRole != "admin" && viewerRole != "moderator" {
		return nil, nil
	}
	var m ProfileModeration
	err = s.db.QueryRow(ctx,
		`SELECT role, status, locked_until, metadata->'ban'->>'reason' FROM users WHERE id = $1`,
		targetID).Scan(&m.Role, &m.Status, &m.LockedUntil, &m.BanReason)
	if err != nil {
		return nil, err
	}
	m.Status = s.effectiveStatus(ctx, targetID, m.Status, m.LockedUntil)
	if m.Status != "suspended" {
		m.BanReason = nil
		m.LockedUntil = nil
	}
	return &m, nil
}

// likedHiddenFor reports whether the target's liked posts should be hidden from
// the viewer. The owner always sees their own; others are subject to the
// owner's hide_liked setting.
func (s *Server) likedHiddenFor(ctx context.Context, targetID, viewerID string) (bool, error) {
	if viewerID == targetID {
		return false, nil
	}
	var hide bool
	err := s.db.QueryRow(ctx, `
		SELECT COALESCE((settings->>'hide_liked')::boolean, false)
		FROM users WHERE id = $1
	`, targetID).Scan(&hide)
	return hide, err
}

// profileVisibleTo reports whether viewerID may see the full profile of
// targetID. A profile is visible unless its owner enabled
// profile_followers_only, in which case only the owner and followers qualify.
func (s *Server) profileVisibleTo(ctx context.Context, targetID, viewerID string) (bool, error) {
	var followersOnly bool
	err := s.db.QueryRow(ctx, `
		SELECT COALESCE((settings->>'profile_followers_only')::boolean, false)
		FROM users WHERE id = $1
	`, targetID).Scan(&followersOnly)
	if err != nil {
		return false, err
	}
	if !followersOnly {
		return true, nil
	}
	if viewerID == "" {
		return false, nil
	}
	if viewerID == targetID {
		return true, nil
	}
	var isFollower bool
	err = s.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2)
	`, viewerID, targetID).Scan(&isFollower)
	return isFollower, err
}

func (s *Server) getProfileStats(w http.ResponseWriter, r *http.Request) {
	profileID := chi.URLParam(r, "profileID")
	// Respect followers-only privacy: hide counts from viewers who can't see the
	// profile (matches respondProfile / listProfilePosts behavior).
	visible, err := s.profileVisibleTo(r.Context(), profileID, mustUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile stats")
		return
	}
	if !visible {
		writeJSON(w, http.StatusOK, map[string]int64{"followers": 0, "following": 0})
		return
	}

	var followers int64
	var following int64
	err = s.db.QueryRow(r.Context(), `
		SELECT
			(SELECT count(*) FROM follows WHERE following_id = $1),
			(SELECT count(*) FROM follows WHERE follower_id = $1)
	`, profileID).Scan(&followers, &following)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile stats")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"followers": followers, "following": following})
}

func (s *Server) getFollowStatus(w http.ResponseWriter, r *http.Request) {
	var following bool
	err := s.db.QueryRow(r.Context(), `
		SELECT EXISTS(
			SELECT 1 FROM follows
			WHERE follower_id = $1 AND following_id = $2
		)
	`, mustUser(r).ID, chi.URLParam(r, "profileID")).Scan(&following)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load follow status")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"isFollowing": following})
}

func (s *Server) updateMyProfile(w http.ResponseWriter, r *http.Request) {
	user := mustUser(r)

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "could not read request body")
		return
	}
	// Decode into a map of raw values so we can tell "field omitted" (leave as
	// is) apart from "field set to null" (clear it) — COALESCE could not.
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	setClauses := make([]string, 0, len(raw))
	args := []any{user.ID}
	for key, rawVal := range raw {
		field, ok := updatableProfileFields[key]
		if !ok {
			writeError(w, http.StatusBadRequest, "unknown field: "+key)
			return
		}
		var value *string
		if err := json.Unmarshal(rawVal, &value); err != nil {
			writeError(w, http.StatusBadRequest, "invalid value for "+key)
			return
		}
		if value == nil && !field.nullable {
			writeError(w, http.StatusBadRequest, key+" cannot be null")
			return
		}
		if value != nil && key == "username" {
			normalized := strings.TrimSpace(strings.ToLower(*value))
			value = &normalized
		}
		if msg := validateProfileField(key, value); msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		args = append(args, value)
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", field.column, len(args)))
	}

	if len(setClauses) == 0 {
		profile, err := s.loadProfileByID(r.Context(), user.ID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "profile not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load profile")
			return
		}
		writeJSON(w, http.StatusOK, profile)
		return
	}

	query := `UPDATE profiles SET ` + strings.Join(setClauses, ", ") + `
		WHERE id = $1
		RETURNING id::text, username::text, display_name, avatar_url, bio, website_url,
			github_url, youtube_url, twitch_url, banner_url, created_at, updated_at`

	var profile Profile
	err = s.db.QueryRow(r.Context(), query, args...).Scan(
		&profile.ID, &profile.Username, &profile.DisplayName, &profile.AvatarURL, &profile.Bio,
		&profile.WebsiteURL, &profile.GithubURL, &profile.YoutubeURL, &profile.TwitchURL,
		&profile.BannerURL, &profile.CreatedAt, &profile.UpdatedAt,
	)
	if isUniqueViolation(err) {
		writeError(w, http.StatusConflict, "username is already taken")
		return
	}
	if isConstraintViolation(err) {
		writeError(w, http.StatusBadRequest, "one or more fields have an invalid value")
		return
	}
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "profile not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update profile")
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (s *Server) loadProfileByID(ctx context.Context, id string) (Profile, error) {
	var profile Profile
	err := s.db.QueryRow(ctx, `
		SELECT id::text, username::text, display_name, avatar_url, bio, website_url,
			github_url, youtube_url, twitch_url, banner_url, created_at, updated_at
		FROM profiles
		WHERE id = $1
	`, id).Scan(
		&profile.ID, &profile.Username, &profile.DisplayName, &profile.AvatarURL, &profile.Bio,
		&profile.WebsiteURL, &profile.GithubURL, &profile.YoutubeURL, &profile.TwitchURL,
		&profile.BannerURL, &profile.CreatedAt, &profile.UpdatedAt,
	)
	return profile, err
}

func (s *Server) loadProfileByUsername(ctx context.Context, username string) (Profile, error) {
	var profile Profile
	err := s.db.QueryRow(ctx, `
		SELECT id::text, username::text, display_name, avatar_url, bio, website_url,
			github_url, youtube_url, twitch_url, banner_url, created_at, updated_at
		FROM profiles
		WHERE username = $1
	`, username).Scan(
		&profile.ID, &profile.Username, &profile.DisplayName, &profile.AvatarURL, &profile.Bio,
		&profile.WebsiteURL, &profile.GithubURL, &profile.YoutubeURL, &profile.TwitchURL,
		&profile.BannerURL, &profile.CreatedAt, &profile.UpdatedAt,
	)
	return profile, err
}
