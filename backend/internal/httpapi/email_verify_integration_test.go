package httpapi_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"devmeme-hub/backend/internal/auth"
	"devmeme-hub/backend/internal/config"
	"devmeme-hub/backend/internal/db"
	"devmeme-hub/backend/internal/httpapi"
)

const emailVerifyJWTSecret = "integration-test-secret-at-least-32-chars"

// newVerifyServer builds a server with email verification turned on. A dummy
// Resend key makes emailVerificationActive() true; we never actually read the
// emailed link — the test mints the verification token directly.
func newVerifyServer(t *testing.T) *httptest.Server {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
	}
	pool, err := db.Open(context.Background(), dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(pool.Close)

	cfg := config.Config{
		JWTSecret:         emailVerifyJWTSecret,
		AccessTokenTTL:    time.Hour,
		AllowedOrigins:    []string{"http://localhost:5173"},
		MaxRequestBytes:   8 << 20,
		MaxUploadBytes:    8 << 20,
		MediaDir:          t.TempDir(),
		GamesDir:          t.TempDir(),
		FrontendURL:       "http://localhost:5173",
		EmailVerification: true,
		ResendAPIKey:      "test-key-not-used", // makes the sender "configured"
		EmailFrom:         "DevMeme <test@example.com>",
		EmailVerifyTTL:    time.Hour,
	}
	srv := httptest.NewServer(httpapi.NewServer(cfg, pool).Routes())
	t.Cleanup(srv.Close)
	return srv
}

func TestIntegrationEmailVerificationFlow(t *testing.T) {
	srv := newVerifyServer(t)

	token, email := registerPending(t, srv)
	if token != "" {
		t.Fatalf("verification sign-up must NOT return an access token, got %q", token)
	}

	// Cannot log in before verifying.
	if st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/auth/login", "", map[string]any{
		"email": email, "password": "password123",
	}); st != http.StatusForbidden {
		t.Fatalf("login before verify: expected 403, got %d", st)
	}

	// Mint the verification token the way the email would carry it.
	userID := userIDByEmail(t, email)
	verifyToken, err := auth.IssueEmailVerifyToken(emailVerifyJWTSecret, userID, time.Hour)
	if err != nil {
		t.Fatalf("issue verify token: %v", err)
	}

	// A bogus token is rejected.
	if st, _ := doJSON(t, http.MethodGet, srv.URL+"/api/auth/verify?token=not-a-real-token", "", nil); st != http.StatusBadRequest {
		t.Fatalf("bogus verify token: expected 400, got %d", st)
	}
	// The real token verifies.
	if st, _ := doJSON(t, http.MethodGet, srv.URL+"/api/auth/verify?token="+verifyToken, "", nil); st != http.StatusOK {
		t.Fatalf("verify: expected 200, got %d", st)
	}

	// Now login works and returns a token.
	st, body := doJSON(t, http.MethodPost, srv.URL+"/api/auth/login", "", map[string]any{
		"email": email, "password": "password123",
	})
	if st != http.StatusOK {
		t.Fatalf("login after verify: expected 200, got %d (%v)", st, body)
	}
	if tok, _ := body["token"].(string); tok == "" {
		t.Fatalf("login after verify should return a token, got %v", body)
	}
}

// registerPending registers a fresh account in verification mode. Unlike
// registerUser it does NOT require a token in the response (there isn't one
// until the email is verified).
func registerPending(t *testing.T, srv *httptest.Server) (token, email string) {
	t.Helper()
	uniq := fmt.Sprintf("%x%d", time.Now().UnixNano(), gameTestSeq.Add(1))
	email = "vtest_" + uniq + "@example.com"
	username := "v" + uniq
	status, body := doJSON(t, http.MethodPost, srv.URL+"/api/auth/register", "", map[string]any{
		"email": email, "password": "password123", "username": username,
	})
	if status != http.StatusCreated {
		t.Fatalf("register (pending): status %d body %v", status, body)
	}
	if s, _ := body["status"].(string); s != "verification_sent" && s != "verification_pending" {
		t.Fatalf("register (pending): unexpected status field %v", body)
	}
	tok, _ := body["token"].(string)
	return tok, email
}

func userIDByEmail(t *testing.T, email string) string {
	t.Helper()
	pool, err := db.Open(context.Background(), os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer pool.Close()
	var id string
	if err := pool.QueryRow(context.Background(), `SELECT id::text FROM users WHERE email = $1`, email).Scan(&id); err != nil {
		t.Fatalf("lookup user id: %v", err)
	}
	return id
}
