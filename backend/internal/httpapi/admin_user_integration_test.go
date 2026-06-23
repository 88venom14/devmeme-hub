package httpapi_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"devmeme-hub/backend/internal/db"
)

// expireBan rewinds a user's locked_until into the past so the lazy auto-unban
// in effectiveStatus fires on the next authenticated request.
func expireBan(t *testing.T, email string) {
	t.Helper()
	pool, err := db.Open(context.Background(), os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer pool.Close()
	if _, err := pool.Exec(context.Background(),
		`UPDATE users SET locked_until = NOW() - INTERVAL '1 minute' WHERE email = $1`, email); err != nil {
		t.Fatalf("expire ban: %v", err)
	}
}

// loginStatus returns the HTTP status of a login attempt with the shared test
// password used by registerUser.
func loginStatus(t *testing.T, srv *httptest.Server, email string) int {
	t.Helper()
	st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/auth/login", "", map[string]any{
		"email": email, "password": "password123",
	})
	return st
}

// TestIntegrationAdminUserModeration covers role granting and the ban hierarchy.
// DB-gated like the other integration tests.
func TestIntegrationAdminUserModeration(t *testing.T) {
	srv := newTestServer(t)

	adminToken, adminEmail := registerUser(t, srv)
	promoteAdmin(t, adminEmail)
	adminID := userIDByEmail(t, adminEmail)

	userToken, userEmail := registerUser(t, srv)
	userID := userIDByEmail(t, userEmail)

	_, modEmail := registerUser(t, srv)
	modID := userIDByEmail(t, modEmail)

	// --- Authorization on the listing endpoint ---
	if st, _ := doJSON(t, http.MethodGet, srv.URL+"/api/admin/users", userToken, nil); st != http.StatusForbidden {
		t.Fatalf("non-mod GET /admin/users: expected 403, got %d", st)
	}
	if st, _ := doJSON(t, http.MethodGet, srv.URL+"/api/admin/users", "", nil); st != http.StatusUnauthorized {
		t.Fatalf("anonymous GET /admin/users: expected 401, got %d", st)
	}

	// --- Role granting (admin only) ---
	// A regular user cannot grant roles.
	if st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/admin/users/"+modID+"/role", userToken, map[string]any{"role": "moderator"}); st != http.StatusForbidden {
		t.Fatalf("non-admin set role: expected 403, got %d", st)
	}
	// Admin grants moderator.
	st, body := doJSON(t, http.MethodPost, srv.URL+"/api/admin/users/"+modID+"/role", adminToken, map[string]any{"role": "moderator"})
	if st != http.StatusOK || body["role"] != "moderator" {
		t.Fatalf("admin grant moderator: status %d body %v", st, body)
	}
	// Admin cannot grant the top-level admin role via the API.
	if st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/admin/users/"+userID+"/role", adminToken, map[string]any{"role": "admin"}); st != http.StatusBadRequest {
		t.Fatalf("grant admin role: expected 400, got %d", st)
	}
	// Admin cannot change their own role.
	if st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/admin/users/"+adminID+"/role", adminToken, map[string]any{"role": "user"}); st != http.StatusBadRequest {
		t.Fatalf("admin change own role: expected 400, got %d", st)
	}

	// modTok is now an actual moderator session.
	modTok := loginTok(t, srv, modEmail)

	// --- Ban hierarchy ---
	// Moderator bans a regular user (permanent, with reason).
	st, body = doJSON(t, http.MethodPost, srv.URL+"/api/admin/users/"+userID+"/ban", modTok, map[string]any{"reason": "spam"})
	if st != http.StatusOK || body["status"] != "suspended" || body["ban_reason"] != "spam" {
		t.Fatalf("moderator ban user: status %d body %v", st, body)
	}
	// The banned user loses API access immediately and cannot log in.
	if st, _ := doJSON(t, http.MethodGet, srv.URL+"/api/auth/me", userToken, nil); st != http.StatusForbidden {
		t.Fatalf("banned user /me: expected 403, got %d", st)
	}
	if loginStatus(t, srv, userEmail) != http.StatusForbidden {
		t.Fatalf("banned user login: expected 403")
	}

	// Moderator cannot ban an admin.
	if st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/admin/users/"+adminID+"/ban", modTok, map[string]any{"reason": "x"}); st != http.StatusForbidden {
		t.Fatalf("moderator ban admin: expected 403, got %d", st)
	}

	// Admin can ban a moderator.
	if st, body := doJSON(t, http.MethodPost, srv.URL+"/api/admin/users/"+modID+"/ban", adminToken, map[string]any{"reason": "abuse"}); st != http.StatusOK || body["status"] != "suspended" {
		t.Fatalf("admin ban moderator: status %d body %v", st, body)
	}
	// The just-banned moderator is now blocked from the moderator endpoints.
	if st, _ := doJSON(t, http.MethodGet, srv.URL+"/api/admin/users", modTok, nil); st != http.StatusForbidden {
		t.Fatalf("banned moderator GET /admin/users: expected 403, got %d", st)
	}

	// Admin cannot ban themselves.
	if st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/admin/users/"+adminID+"/ban", adminToken, map[string]any{"reason": "x"}); st != http.StatusBadRequest {
		t.Fatalf("admin self-ban: expected 400, got %d", st)
	}

	// --- Unban restores access ---
	if st, body := doJSON(t, http.MethodPost, srv.URL+"/api/admin/users/"+userID+"/unban", adminToken, nil); st != http.StatusOK || body["status"] != "active" || body["ban_reason"] != nil {
		t.Fatalf("admin unban: status %d body %v", st, body)
	}
	if loginStatus(t, srv, userEmail) != http.StatusOK {
		t.Fatalf("unbanned user should be able to log in again")
	}

	// --- Temporary ban auto-expires ---
	if st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/admin/users/"+userID+"/ban", adminToken, map[string]any{"reason": "cooldown", "duration_days": 7}); st != http.StatusOK {
		t.Fatalf("temporary ban: expected 200, got %d", st)
	}
	if loginStatus(t, srv, userEmail) != http.StatusForbidden {
		t.Fatalf("temporarily banned user should not log in while ban is active")
	}
	expireBan(t, userEmail)
	if loginStatus(t, srv, userEmail) != http.StatusOK {
		t.Fatalf("expired temporary ban should auto-lift on login")
	}
}

// loginTok logs in and returns the bearer token.
func loginTok(t *testing.T, srv *httptest.Server, email string) string {
	t.Helper()
	_, body := doJSON(t, http.MethodPost, srv.URL+"/api/auth/login", "", map[string]any{
		"email": email, "password": "password123",
	})
	tok, _ := body["token"].(string)
	if tok == "" {
		t.Fatalf("login %s: no token", email)
	}
	return tok
}
