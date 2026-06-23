package httpapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"devmeme-hub/backend/internal/auth"

	"github.com/jackc/pgx/v5"
)

type userContextKey struct{}

type currentUser struct {
	ID    string
	Email string
}

func (s *Server) requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := bearerToken(r.Header.Get("Authorization"))
		if raw == "" {
			writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		claims, err := auth.ParseToken(s.cfg.JWTSecret, raw)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid bearer token")
			return
		}
		// The JWT is stateless, so re-check the account on every request: a user
		// suspended or deleted after their token was issued must lose access
		// immediately, not only when the token expires.
		var status string
		var lockedUntil *time.Time
		err = s.db.QueryRow(r.Context(), `SELECT status, locked_until FROM users WHERE id = $1`, claims.UserID).Scan(&status, &lockedUntil)
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "user no longer exists")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not verify account")
			return
		}
		if s.effectiveStatus(r.Context(), claims.UserID, status, lockedUntil) != "active" {
			writeError(w, http.StatusForbidden, "account is not active")
			return
		}
		ctx := context.WithValue(r.Context(), userContextKey{}, currentUser{
			ID:    claims.UserID,
			Email: claims.Email,
		})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// optionalUser attaches the current user to the context when a valid bearer
// token is present, but allows anonymous requests through. Used on public read
// routes that adjust their response based on who (if anyone) is viewing.
func (s *Server) optionalUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if raw := bearerToken(r.Header.Get("Authorization")); raw != "" {
			if claims, err := auth.ParseToken(s.cfg.JWTSecret, raw); err == nil {
				ctx := context.WithValue(r.Context(), userContextKey{}, currentUser{
					ID:    claims.UserID,
					Email: claims.Email,
				})
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// effectiveStatus lazily lifts an expired temporary ban: a 'suspended' account
// whose locked_until has passed is reactivated (and its ban metadata cleared)
// and reported as active. Permanent bans (locked_until NULL) and all other
// statuses are returned unchanged. This is what makes time-limited bans expire
// on their own without a background job.
func (s *Server) effectiveStatus(ctx context.Context, id, status string, lockedUntil *time.Time) string {
	if status == "suspended" && lockedUntil != nil && !lockedUntil.After(time.Now()) {
		_, _ = s.db.Exec(ctx,
			`UPDATE users SET status = 'active', locked_until = NULL, metadata = metadata - 'ban' WHERE id = $1 AND status = 'suspended'`,
			id)
		return "active"
	}
	return status
}

// userRole returns the current DB role for a user. Used by the role-gating
// middleware and by the moderation handlers to enforce the action hierarchy.
func (s *Server) userRole(ctx context.Context, id string) (string, error) {
	var role string
	err := s.db.QueryRow(ctx, `SELECT role FROM users WHERE id = $1`, id).Scan(&role)
	return role, err
}

// requireAdmin must be chained after requireUser. It confirms the current user
// still has the 'admin' role (главный админ) with a fresh DB lookup on every
// request, so a demoted user cannot keep acting as admin with an already-issued
// token (the JWT itself carries no role claim). UI gating is never trusted on
// its own.
func (s *Server) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := userFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		role, err := s.userRole(r.Context(), user.ID)
		if err != nil || role != "admin" {
			writeError(w, http.StatusForbidden, "admin access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requireModerator must be chained after requireUser. It allows both the
// moderator role (the grantable "админ") and the admin role (главный админ);
// the finer per-target rules live in the handlers (see canBan).
func (s *Server) requireModerator(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := userFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		role, err := s.userRole(r.Context(), user.ID)
		if err != nil || (role != "admin" && role != "moderator") {
			writeError(w, http.StatusForbidden, "moderator access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func userFromContext(ctx context.Context) (currentUser, bool) {
	user, ok := ctx.Value(userContextKey{}).(currentUser)
	return user, ok
}

func mustUser(r *http.Request) currentUser {
	user, _ := userFromContext(r.Context())
	return user
}
