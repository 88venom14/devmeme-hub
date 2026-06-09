package httpapi

import (
	"context"
	"net/http"

	"devmeme-hub/backend/internal/auth"
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
		ctx := context.WithValue(r.Context(), userContextKey{}, currentUser{
			ID:    claims.UserID,
			Email: claims.Email,
		})
		next.ServeHTTP(w, r.WithContext(ctx))
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
