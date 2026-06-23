package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"devmeme-hub/backend/internal/auth"
	"devmeme-hub/backend/internal/oauth"

	"github.com/jackc/pgx/v5"
)

// githubStart redirects the browser to GitHub's authorize page. A signed,
// stateless `state` value provides CSRF protection (its HMAC proves we issued
// it), mirroring the previous auth worker.
func (s *Server) githubStart(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.OAuthEnabled() {
		http.Redirect(w, r, s.cfg.FrontendURL+"/login?auth_error=oauth_disabled", http.StatusFound)
		return
	}
	nonce, err := randomHex(16)
	if err != nil {
		http.Redirect(w, r, s.cfg.FrontendURL+"/login?auth_error=auth_link_failed", http.StatusFound)
		return
	}
	state := nonce + "." + oauth.SignState(s.cfg.JWTSecret, nonce)
	client := oauth.NewGitHubClient(s.cfg.GithubClientID, s.cfg.GithubClientSecret, s.cfg.GithubCallbackURL)
	http.Redirect(w, r, client.AuthorizeURL(state), http.StatusFound)
}

func (s *Server) githubCallback(w http.ResponseWriter, r *http.Request) {
	fail := func(code string) {
		http.Redirect(w, r, s.cfg.FrontendURL+"/login?auth_error="+code, http.StatusFound)
	}
	if !s.cfg.OAuthEnabled() {
		fail("oauth_disabled")
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		fail("github_no_code")
		return
	}
	if !oauth.VerifyState(s.cfg.JWTSecret, r.URL.Query().Get("state")) {
		fail("invalid_state")
		return
	}

	client := oauth.NewGitHubClient(s.cfg.GithubClientID, s.cfg.GithubClientSecret, s.cfg.GithubCallbackURL)
	token, err := client.ExchangeCode(r.Context(), code)
	if err != nil || token == "" {
		fail("github_token_failed")
		return
	}

	ghUser, email, err := client.FetchIdentity(r.Context(), token)
	if err != nil {
		fail("github_token_failed")
		return
	}
	if email == "" {
		fail("github_no_email")
		return
	}

	userID, userEmail, err := s.upsertOAuthUser(r.Context(), oauthIdentity{
		provider:       "github",
		providerUserID: fmt.Sprintf("%d", ghUser.ID),
		email:          email,
		login:          ghUser.Login,
		displayName:    ghUser.Name,
		avatarURL:      ghUser.AvatarURL,
	})
	if err != nil {
		fail("auth_link_failed")
		return
	}

	appToken, _, err := auth.IssueToken(s.cfg.JWTSecret, userID, userEmail, s.cfg.AccessTokenTTL)
	if err != nil {
		fail("auth_link_failed")
		return
	}
	// Hand the token to the SPA via the URL fragment so it never hits server
	// logs; the frontend /auth/callback route reads it from location.hash.
	http.Redirect(w, r, s.cfg.FrontendURL+"/auth/callback#token="+url.QueryEscape(appToken), http.StatusFound)
}

// ── user upsert / linking ──

type oauthIdentity struct {
	provider       string
	providerUserID string
	email          string
	login          string
	displayName    string
	avatarURL      string
}

// upsertOAuthUser resolves an OAuth identity to a local user, creating or
// linking as needed, and returns the user's id and email. The OAuth provider
// has already verified the email, so the user is created active and verified.
func (s *Server) upsertOAuthUser(ctx context.Context, id oauthIdentity) (string, string, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback(ctx)

	// 1. Existing identity → that user.
	var userID, email string
	err = tx.QueryRow(ctx, `
		SELECT u.id::text, u.email::text
		FROM auth_identities ai JOIN users u ON u.id = ai.user_id
		WHERE ai.provider = $1 AND ai.provider_user_id = $2
	`, id.provider, id.providerUserID).Scan(&userID, &email)
	if err == nil {
		return userID, email, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", "", err
	}

	// 2. Existing user with the same email → link the identity.
	err = tx.QueryRow(ctx, `SELECT id::text, email::text FROM users WHERE email = $1`, id.email).Scan(&userID, &email)
	if err == nil {
		if err := insertAuthIdentity(ctx, tx, userID, id); err != nil {
			return "", "", err
		}
		_, _ = tx.Exec(ctx, `UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()), status = 'active' WHERE id = $1`, userID)
		return userID, email, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", "", err
	}

	// 3. New user + profile + identity.
	err = tx.QueryRow(ctx, `
		INSERT INTO users (email, status, email_verified_at)
		VALUES ($1, 'active', NOW())
		RETURNING id::text, email::text
	`, id.email).Scan(&userID, &email)
	if err != nil {
		return "", "", err
	}
	username, err := s.uniqueUsername(ctx, tx, id.login, id.email)
	if err != nil {
		return "", "", err
	}
	var displayName, avatar *string
	if d := strings.TrimSpace(id.displayName); d != "" {
		displayName = &d
	}
	if a := strings.TrimSpace(id.avatarURL); a != "" {
		avatar = &a
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO profiles (id, username, display_name, avatar_url)
		VALUES ($1, $2, $3, $4)
	`, userID, username, displayName, avatar); err != nil {
		return "", "", err
	}
	if err := insertAuthIdentity(ctx, tx, userID, id); err != nil {
		return "", "", err
	}
	return userID, email, tx.Commit(ctx)
}

func insertAuthIdentity(ctx context.Context, tx pgx.Tx, userID string, id oauthIdentity) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO auth_identities (user_id, provider, provider_user_id, provider_email)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (provider, provider_user_id) DO NOTHING
	`, userID, id.provider, id.providerUserID, id.email)
	return err
}

// uniqueUsername derives a profile username from the OAuth login (or email
// local part), sanitised to the profiles_username_format, and appends a random
// suffix until it is free.
func (s *Server) uniqueUsername(ctx context.Context, tx pgx.Tx, login, email string) (string, error) {
	base := oauth.SanitizeUsername(login)
	if base == "" {
		base = oauth.SanitizeUsername(strings.SplitN(email, "@", 2)[0])
	}
	if len(base) < 3 {
		base = (base + "dev")
	}
	if len(base) > 24 {
		base = base[:24]
	}

	for attempt := range 8 {
		candidate := base
		if attempt > 0 {
			suffix, err := randomHex(2)
			if err != nil {
				return "", err
			}
			candidate = base + suffix
		}
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM profiles WHERE username = $1)`, candidate).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	suffix, err := randomHex(6)
	if err != nil {
		return "", err
	}
	return base + suffix, nil
}
