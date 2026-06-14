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

func userFromContext(ctx context.Context) (currentUser, bool) {
	user, ok := ctx.Value(userContextKey{}).(currentUser)
	return user, ok
}

func mustUser(r *http.Request) currentUser {
	user, _ := userFromContext(r.Context())
	return user
}
