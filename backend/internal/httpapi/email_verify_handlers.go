package httpapi

import (
	"context"
	"errors"
	"fmt"
	"html"
	"net/http"
	"net/url"
	"strings"

	"devmeme-hub/backend/internal/auth"
)

// verifyEmail consumes a verification token (from the emailed link) and marks
// the account active. Called by the frontend /verify-email page via fetch.
func (s *Server) verifyEmail(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		writeError(w, http.StatusBadRequest, "verification token is required")
		return
	}
	userID, err := auth.ParseEmailVerifyToken(s.cfg.JWTSecret, token)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid or expired verification link")
		return
	}
	tag, err := s.db.Exec(r.Context(), `
		UPDATE users
		SET email_verified_at = COALESCE(email_verified_at, NOW()),
		    status = CASE WHEN status = 'pending' THEN 'active' ELSE status END
		WHERE id = $1
	`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not verify email")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "verified"})
}

// resendVerification re-sends the verification email for a pending account.
// Always responds 200 so it can't be used to probe which emails are registered.
func (s *Server) resendVerification(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	email := strings.TrimSpace(strings.ToLower(req.Email))

	var userID, status string
	err := s.db.QueryRow(r.Context(),
		`SELECT id::text, status FROM users WHERE email = $1`, email).Scan(&userID, &status)
	if err == nil && status == "pending" {
		_ = s.sendVerificationEmail(r.Context(), userID, email)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// emailVerificationActive reports whether new sign-ups must verify their email.
// Requires both the feature flag and a configured sender.
func (s *Server) emailVerificationActive() bool {
	return s.cfg.EmailVerification && s.emailer.Configured()
}

// sendVerificationEmail mints a verification token and emails the link. Errors
// are returned for logging but are not surfaced to the client (to avoid email
// enumeration / leaking provider state).
func (s *Server) sendVerificationEmail(ctx context.Context, userID, email string) error {
	if !s.emailer.Configured() {
		return errors.New("email sender not configured")
	}
	token, err := auth.IssueEmailVerifyToken(s.cfg.JWTSecret, userID, s.cfg.EmailVerifyTTL)
	if err != nil {
		return err
	}
	link := s.cfg.FrontendURL + "/verify-email?token=" + url.QueryEscape(token)
	subject := "Подтвердите email — DevMeme Hub"
	body := verificationEmailHTML(link)
	return s.emailer.Send(ctx, email, subject, body)
}

func verificationEmailHTML(link string) string {
	safe := html.EscapeString(link)
	return fmt.Sprintf(`<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#0f0f12;color:#e8e8ea;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#17171b;border:1px solid #2a2a30;border-radius:14px;padding:28px">
    <h1 style="color:#ff6b00;font-size:22px;margin:0 0 12px">DevMeme Hub</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px">Спасибо за регистрацию! Подтвердите свой email, чтобы активировать аккаунт.</p>
    <a href="%s" style="display:inline-block;background:#ff6b00;color:#111;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:8px;font-size:14px">Подтвердить email</a>
    <p style="font-size:12px;color:#9a9aa2;line-height:1.5;margin:20px 0 0">Если кнопка не работает, откройте ссылку: <br><a href="%s" style="color:#ff8a3d;word-break:break-all">%s</a></p>
    <p style="font-size:12px;color:#9a9aa2;margin:16px 0 0">Ссылка действительна 24 часа. Если вы не регистрировались — просто игнорируйте это письмо.</p>
  </div>
</body></html>`, safe, safe, safe)
}
