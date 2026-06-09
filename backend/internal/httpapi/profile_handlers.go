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
	writeJSON(w, http.StatusOK, profile)
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
	writeJSON(w, http.StatusOK, profile)
}

func (s *Server) getProfileStats(w http.ResponseWriter, r *http.Request) {
	var followers int64
	var following int64
	err := s.db.QueryRow(r.Context(), `
		SELECT
			(SELECT count(*) FROM follows WHERE following_id = $1),
			(SELECT count(*) FROM follows WHERE follower_id = $1)
	`, chi.URLParam(r, "profileID")).Scan(&followers, &following)
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
