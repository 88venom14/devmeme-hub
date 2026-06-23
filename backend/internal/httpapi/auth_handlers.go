package httpapi

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"devmeme-hub/backend/internal/auth"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

// dummyBcryptHash is a valid hash compared against during login when the email
// has no account, so the response time of a missing user matches a real one.
var dummyBcryptHash, _ = bcrypt.GenerateFromPassword([]byte("timing-equalizer-not-a-real-password"), bcrypt.DefaultCost)

type authRequest struct {
	Email       string  `json:"email"`
	Password    string  `json:"password"`
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
}

type authResponse struct {
	Token     string  `json:"token"`
	ExpiresAt string  `json:"expires_at"`
	User      User    `json:"user"`
	Profile   Profile `json:"profile"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Username = strings.TrimSpace(strings.ToLower(req.Username))
	// bcrypt only uses (and accepts) the first 72 bytes, so cap the password
	// there: longer inputs would otherwise fail hashing with a 500.
	if req.Email == "" || req.Username == "" || len(req.Password) < 8 || len(req.Password) > 72 {
		writeError(w, http.StatusBadRequest, "email, username and password (8–72 characters) are required")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not hash password")
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	// When email verification is active, the account starts 'pending' (and so
	// cannot log in until verified); otherwise it is instantly 'active'.
	newStatus := "active"
	if s.emailVerificationActive() {
		newStatus = "pending"
	}

	var user User
	err = tx.QueryRow(r.Context(), `
		INSERT INTO users (email, password_hash, status, email_verified_at)
		VALUES ($1, $2, $3, CASE WHEN $3 = 'active' THEN NOW() ELSE NULL END)
		RETURNING id::text, email::text, role, status, metadata, created_at, updated_at
	`, req.Email, string(hash), newStatus).Scan(
		&user.ID, &user.Email, &user.Role, &user.Status, &user.Metadata, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "email is already registered")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not create user")
		return
	}

	var profile Profile
	err = tx.QueryRow(r.Context(), `
		INSERT INTO profiles (id, username, display_name)
		VALUES ($1, $2, $3)
		RETURNING id::text, username::text, display_name, avatar_url, bio, website_url,
			github_url, youtube_url, twitch_url, banner_url, created_at, updated_at
	`, user.ID, req.Username, req.DisplayName).Scan(
		&profile.ID, &profile.Username, &profile.DisplayName, &profile.AvatarURL, &profile.Bio,
		&profile.WebsiteURL, &profile.GithubURL, &profile.YoutubeURL, &profile.TwitchURL,
		&profile.BannerURL, &profile.CreatedAt, &profile.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "username is already taken")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not create profile")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "could not commit registration")
		return
	}

	// Verification flow: don't log the user in. Send the link and tell the
	// client to prompt the user to check their inbox.
	if newStatus == "pending" {
		if err := s.sendVerificationEmail(r.Context(), user.ID, user.Email); err != nil {
			// The account exists; surface a soft error so the user can retry
			// via "resend" rather than being stuck.
			writeJSON(w, http.StatusCreated, map[string]any{
				"status": "verification_pending", "email": user.Email,
				"warning": "could not send verification email; use resend",
			})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"status": "verification_sent", "email": user.Email,
		})
		return
	}

	token, expiresAt, err := auth.IssueToken(s.cfg.JWTSecret, user.ID, user.Email, s.cfg.AccessTokenTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not issue token")
		return
	}
	writeJSON(w, http.StatusCreated, authResponse{
		Token: token, ExpiresAt: expiresAt.Format("2006-01-02T15:04:05Z07:00"), User: user, Profile: profile,
	})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	var user User
	var passwordHash string
	var lockedUntil *time.Time
	err := s.db.QueryRow(r.Context(), `
		SELECT id::text, email::text, role, status, metadata, created_at, updated_at, COALESCE(password_hash, ''), locked_until
		FROM users
		WHERE email = $1
	`, req.Email).Scan(
		&user.ID, &user.Email, &user.Role, &user.Status, &user.Metadata, &user.CreatedAt, &user.UpdatedAt, &passwordHash, &lockedUntil,
	)
	// Distinguish a real DB error (500) from "no such user" (401) before doing
	// the password check — the previous combined condition masked DB errors as
	// 401 and skipped the 500 branch entirely.
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusInternalServerError, "could not load user")
		return
	}
	if errors.Is(err, pgx.ErrNoRows) {
		// Compare against a dummy hash so a missing account costs roughly the same
		// as a real one, flattening the email-enumeration timing side channel.
		_ = bcrypt.CompareHashAndPassword(dummyBcryptHash, []byte(req.Password))
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if s.effectiveStatus(r.Context(), user.ID, user.Status, lockedUntil) != "active" {
		writeError(w, http.StatusForbidden, "user is not active")
		return
	}

	_, _ = s.db.Exec(r.Context(), `UPDATE users SET last_login_at = NOW() WHERE id = $1`, user.ID)
	profile, err := s.loadProfileByID(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	token, expiresAt, err := auth.IssueToken(s.cfg.JWTSecret, user.ID, user.Email, s.cfg.AccessTokenTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not issue token")
		return
	}
	writeJSON(w, http.StatusOK, authResponse{
		Token: token, ExpiresAt: expiresAt.Format("2006-01-02T15:04:05Z07:00"), User: user, Profile: profile,
	})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	userCtx := mustUser(r)
	var user User
	err := s.db.QueryRow(r.Context(), `
		SELECT id::text, email::text, role, status, metadata, created_at, updated_at
		FROM users
		WHERE id = $1
	`, userCtx.ID).Scan(
		&user.ID, &user.Email, &user.Role, &user.Status, &user.Metadata, &user.CreatedAt, &user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusUnauthorized, "user no longer exists")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load user")
		return
	}
	profile, err := s.loadProfileByID(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user, "profile": profile})
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
