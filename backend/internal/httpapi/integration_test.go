package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"devmeme-hub/backend/internal/config"
	"devmeme-hub/backend/internal/db"
	"devmeme-hub/backend/internal/httpapi"
)

// These tests run against a real PostgreSQL instance. Set TEST_DATABASE_URL to
// a migrated, disposable database to enable them; otherwise they are skipped.
//
//	TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/devmeme_hub?sslmode=disable \
//	    go test ./internal/httpapi -run Integration
func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
	}

	ctx := context.Background()
	pool, err := db.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(pool.Close)

	cfg := config.Config{
		JWTSecret:       "integration-test-secret-at-least-32-chars",
		AccessTokenTTL:  time.Hour,
		AllowedOrigins:  []string{"http://localhost:5173"},
		MaxRequestBytes:    8 << 20,
		MaxUploadBytes:     8 << 20,
		MediaDir:           t.TempDir(),
		GamesDir:           t.TempDir(),
		MaxGameUploadBytes: 8 << 20,
	}
	srv := httptest.NewServer(httpapi.NewServer(cfg, pool).Routes())
	t.Cleanup(srv.Close)
	return srv
}

func doJSON(t *testing.T, method, url, token string, body any) (int, map[string]any) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	defer res.Body.Close()
	var out map[string]any
	data, _ := io.ReadAll(res.Body)
	if len(data) > 0 {
		_ = json.Unmarshal(data, &out)
	}
	return res.StatusCode, out
}

func TestIntegrationAuthAndPostFlow(t *testing.T) {
	srv := newTestServer(t)
	suffix := fmt.Sprintf("%d%d", time.Now().UnixNano(), rand.Intn(1000))
	email := "itest_" + suffix + "@example.com"
	username := "itest" + suffix[:8]

	// Register.
	status, reg := doJSON(t, http.MethodPost, srv.URL+"/api/auth/register", "", map[string]any{
		"email": email, "password": "supersecret123", "username": username,
	})
	if status != http.StatusCreated {
		t.Fatalf("register status = %d, want 201 (%v)", status, reg)
	}
	token, _ := reg["token"].(string)
	if token == "" {
		t.Fatal("register returned no token")
	}

	// Wrong password is rejected.
	if status, _ := doJSON(t, http.MethodPost, srv.URL+"/api/auth/login", "", map[string]any{
		"email": email, "password": "nope",
	}); status != http.StatusUnauthorized {
		t.Errorf("bad login status = %d, want 401", status)
	}

	// me requires a token.
	if status, _ := doJSON(t, http.MethodGet, srv.URL+"/api/auth/me", "", nil); status != http.StatusUnauthorized {
		t.Errorf("me without token status = %d, want 401", status)
	}

	// Create a post.
	status, post := doJSON(t, http.MethodPost, srv.URL+"/api/posts", token, map[string]any{
		"title": "integration post", "content_md": "# hi", "tags": []string{"itag" + suffix[:6]},
	})
	if status != http.StatusCreated {
		t.Fatalf("create post status = %d, want 201 (%v)", status, post)
	}
	postID, _ := post["id"].(string)
	if postID == "" {
		t.Fatal("created post has no id")
	}

	// Fetch it back.
	if status, got := doJSON(t, http.MethodGet, srv.URL+"/api/posts/"+postID, "", nil); status != http.StatusOK || got["title"] != "integration post" {
		t.Errorf("get post status = %d title = %v", status, got["title"])
	}

	// Clearing bio with explicit null must succeed (regression test for the
	// COALESCE fix).
	if status, prof := doJSON(t, http.MethodPatch, srv.URL+"/api/profiles/me", token, map[string]any{
		"bio": "temp",
	}); status != http.StatusOK || prof["bio"] != "temp" {
		t.Errorf("set bio status = %d bio = %v", status, prof["bio"])
	}
	if status, prof := doJSON(t, http.MethodPatch, srv.URL+"/api/profiles/me", token, map[string]any{
		"bio": nil,
	}); status != http.StatusOK || prof["bio"] != nil {
		t.Errorf("clear bio status = %d bio = %v (want null)", status, prof["bio"])
	}

	// Settings: defaults, update, and persistence.
	if status, st := doJSON(t, http.MethodGet, srv.URL+"/api/settings", token, nil); status != http.StatusOK || st["notify_likes"] != true || st["two_factor"] != false {
		t.Errorf("get settings status = %d defaults = %v", status, st)
	}
	if status, st := doJSON(t, http.MethodPut, srv.URL+"/api/settings", token, map[string]any{"two_factor": true}); status != http.StatusOK || st["two_factor"] != true {
		t.Errorf("update settings status = %d two_factor = %v", status, st["two_factor"])
	}
	if status, st := doJSON(t, http.MethodGet, srv.URL+"/api/settings", token, nil); status != http.StatusOK || st["two_factor"] != true {
		t.Errorf("settings did not persist: status = %d two_factor = %v", status, st["two_factor"])
	}
	if status, _ := doJSON(t, http.MethodPut, srv.URL+"/api/settings", token, map[string]any{"bogus": true}); status != http.StatusBadRequest {
		t.Errorf("unknown setting status = %d, want 400", status)
	}

	// Delete the post.
	req, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/posts/"+postID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusNoContent {
		t.Errorf("delete post status = %d, want 204", res.StatusCode)
	}
}
