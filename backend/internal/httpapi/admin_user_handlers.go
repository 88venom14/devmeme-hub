package httpapi

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

// AdminUser is the user projection for the moderation panel. Ban details are
// surfaced from users.metadata->'ban' (set by adminBanUser); a non-null
// ban_reason/locked_until tells the UI the account is currently banned.
type AdminUser struct {
	ID          string     `json:"id"`
	Email       string     `json:"email"`
	Username    *string    `json:"username"`
	DisplayName *string    `json:"display_name"`
	AvatarURL   *string    `json:"avatar_url"`
	Role        string     `json:"role"`
	Status      string     `json:"status"`
	LockedUntil *time.Time `json:"locked_until"`
	BanReason   *string    `json:"ban_reason"`
	BanBy       *string    `json:"ban_by"`
	CreatedAt   time.Time  `json:"created_at"`
}

// adminUserSelect projects a user joined to its profile, plus ban metadata. It
// is reused for the list and for returning a single user after a mutation.
const adminUserSelect = `
	SELECT u.id::text, u.email::text, u.role, u.status, u.locked_until,
	       u.metadata->'ban'->>'reason', u.metadata->'ban'->>'by_email', u.created_at,
	       p.username::text, p.display_name, p.avatar_url
	FROM users u
	LEFT JOIN profiles p ON p.id = u.id`

func scanAdminUser(row pgx.Row) (AdminUser, error) {
	var u AdminUser
	err := row.Scan(&u.ID, &u.Email, &u.Role, &u.Status, &u.LockedUntil,
		&u.BanReason, &u.BanBy, &u.CreatedAt, &u.Username, &u.DisplayName, &u.AvatarURL)
	return u, err
}

// canBan encodes the moderation hierarchy: an admin (главный админ) may ban
// regular users and moderators; a moderator (the grantable "админ" role) may
// ban only regular users. Nobody may ban an admin.
func canBan(actorRole, targetRole string) bool {
	if targetRole == "admin" {
		return false
	}
	switch actorRole {
	case "admin":
		return true
	case "moderator":
		return targetRole == "user"
	default:
		return false
	}
}

// adminListUsers returns users for the moderation panel, newest first. Available
// to moderators and admins (requireModerator on the route). An optional ?q=
// filters by email or username (case-insensitive).
func (s *Server) adminListUsers(w http.ResponseWriter, r *http.Request) {
	args := []any{limitParam(r)}
	where := ""
	if q := strings.TrimSpace(r.URL.Query().Get("q")); q != "" {
		args = append(args, "%"+q+"%")
		where = " WHERE (u.email::text ILIKE $2 OR p.username::text ILIKE $2)"
	}
	rows, err := s.db.Query(r.Context(), adminUserSelect+where+" ORDER BY u.created_at DESC LIMIT $1", args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list users")
		return
	}
	defer rows.Close()

	users := []AdminUser{}
	for rows.Next() {
		u, err := scanAdminUser(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not read users")
			return
		}
		users = append(users, u)
	}
	if rows.Err() != nil {
		writeError(w, http.StatusInternalServerError, "could not read users")
		return
	}
	writeJSON(w, http.StatusOK, users)
}

type setRoleRequest struct {
	Role string `json:"role"`
}

// adminSetUserRole grants or revokes the moderator role. Admin-only
// (requireAdmin on the route): only the главный админ manages roles. The
// top-level 'admin' role is intentionally NOT grantable here — it is
// bootstrapped out-of-band (see docs/DEPLOY.md §5).
func (s *Server) adminSetUserRole(w http.ResponseWriter, r *http.Request) {
	actor := mustUser(r)
	targetID := chi.URLParam(r, "userID")

	var req setRoleRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Role = strings.TrimSpace(req.Role)
	if req.Role != "user" && req.Role != "moderator" {
		writeError(w, http.StatusBadRequest, "role must be 'user' or 'moderator'")
		return
	}
	if targetID == actor.ID {
		writeError(w, http.StatusBadRequest, "cannot change your own role")
		return
	}

	var currentRole string
	err := s.db.QueryRow(r.Context(), `SELECT role FROM users WHERE id = $1`, targetID).Scan(&currentRole)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load user")
		return
	}
	if currentRole == "admin" {
		writeError(w, http.StatusForbidden, "cannot change the role of an admin")
		return
	}

	if _, err := s.db.Exec(r.Context(), `UPDATE users SET role = $2 WHERE id = $1`, targetID, req.Role); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update role")
		return
	}
	u, err := scanAdminUser(s.db.QueryRow(r.Context(), adminUserSelect+` WHERE u.id = $1`, targetID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load user")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

type banRequest struct {
	Reason       string `json:"reason"`
	DurationDays int    `json:"duration_days"`
}

// adminBanUser suspends a user. Available to moderators and admins; the
// per-target hierarchy is enforced by canBan. duration_days == 0 means a
// permanent ban; a positive value sets locked_until and the ban auto-expires
// (lifted lazily in effectiveStatus).
func (s *Server) adminBanUser(w http.ResponseWriter, r *http.Request) {
	actor := mustUser(r)
	targetID := chi.URLParam(r, "userID")

	var req banRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Reason = strings.TrimSpace(req.Reason)
	if len(req.Reason) > 500 {
		writeError(w, http.StatusBadRequest, "reason is too long (max 500 characters)")
		return
	}
	if req.DurationDays < 0 || req.DurationDays > 3650 {
		writeError(w, http.StatusBadRequest, "duration_days must be between 0 and 3650")
		return
	}
	if targetID == actor.ID {
		writeError(w, http.StatusBadRequest, "cannot ban yourself")
		return
	}

	actorRole, targetRole, err := s.actorAndTargetRole(r, actor.ID, targetID)
	if err != nil {
		s.writeRoleLookupError(w, err)
		return
	}
	if !canBan(actorRole, targetRole) {
		writeError(w, http.StatusForbidden, "you are not allowed to ban this user")
		return
	}

	var lockedUntil *time.Time
	if req.DurationDays > 0 {
		t := time.Now().Add(time.Duration(req.DurationDays) * 24 * time.Hour)
		lockedUntil = &t
	}

	_, err = s.db.Exec(r.Context(), `
		UPDATE users
		SET status = 'suspended', locked_until = $2,
		    metadata = metadata || jsonb_build_object('ban', jsonb_build_object(
		        'reason', $3::text, 'by_id', $4::text, 'by_email', $5::text,
		        'at', to_jsonb(now()), 'until', to_jsonb($2::timestamptz)))
		WHERE id = $1`,
		targetID, lockedUntil, req.Reason, actor.ID, actor.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not ban user")
		return
	}
	u, err := scanAdminUser(s.db.QueryRow(r.Context(), adminUserSelect+` WHERE u.id = $1`, targetID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load user")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// adminUnbanUser reactivates a user and clears their ban metadata. Same actor
// hierarchy as banning (canBan).
func (s *Server) adminUnbanUser(w http.ResponseWriter, r *http.Request) {
	actor := mustUser(r)
	targetID := chi.URLParam(r, "userID")

	actorRole, targetRole, err := s.actorAndTargetRole(r, actor.ID, targetID)
	if err != nil {
		s.writeRoleLookupError(w, err)
		return
	}
	if !canBan(actorRole, targetRole) {
		writeError(w, http.StatusForbidden, "you are not allowed to unban this user")
		return
	}

	_, err = s.db.Exec(r.Context(),
		`UPDATE users SET status = 'active', locked_until = NULL, metadata = metadata - 'ban' WHERE id = $1`,
		targetID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not unban user")
		return
	}
	u, err := scanAdminUser(s.db.QueryRow(r.Context(), adminUserSelect+` WHERE u.id = $1`, targetID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load user")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// actorAndTargetRole loads both the actor's and the target's current roles, and
// reports a missing target via pgx.ErrNoRows so callers can map it to a 404.
func (s *Server) actorAndTargetRole(r *http.Request, actorID, targetID string) (actorRole, targetRole string, err error) {
	actorRole, err = s.userRole(r.Context(), actorID)
	if err != nil {
		return "", "", err
	}
	targetRole, err = s.userRole(r.Context(), targetID)
	if err != nil {
		return "", "", err
	}
	return actorRole, targetRole, nil
}

func (s *Server) writeRoleLookupError(w http.ResponseWriter, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeError(w, http.StatusInternalServerError, "could not verify permissions")
}
