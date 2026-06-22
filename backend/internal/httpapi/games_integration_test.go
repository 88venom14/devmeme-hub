package httpapi_test

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"devmeme-hub/backend/internal/db"
)

// doRaw issues a request and returns the status and raw response body, for
// endpoints that return JSON arrays (doJSON only decodes objects).
func doRaw(t *testing.T, method, url, token string, body any) (int, []byte) {
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
	data, _ := io.ReadAll(res.Body)
	return res.StatusCode, data
}

func decodeObject(t *testing.T, raw []byte) map[string]any {
	t.Helper()
	var out map[string]any
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	return out
}

func decodeArray(t *testing.T, raw []byte) []map[string]any {
	t.Helper()
	var out []map[string]any
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	return out
}

// These tests share the TEST_DATABASE_URL convention with integration_test.go
// and are skipped when it is unset.

// gameTestSeq guarantees unique identifiers even when Windows' coarse clock
// returns identical timestamps for rapid successive registrations.
var gameTestSeq atomic.Int64

func registerUser(t *testing.T, srv *httptest.Server) (token, email string) {
	t.Helper()
	uniq := fmt.Sprintf("%x%d", time.Now().UnixNano(), gameTestSeq.Add(1))
	email = "gtest_" + uniq + "@example.com"
	username := "g" + uniq
	status, body := doJSON(t, http.MethodPost, srv.URL+"/api/auth/register", "", map[string]any{
		"email": email, "password": "password123", "username": username,
	})
	if status != http.StatusCreated {
		t.Fatalf("register: status %d body %v", status, body)
	}
	tok, _ := body["token"].(string)
	if tok == "" {
		t.Fatalf("register: no token in %v", body)
	}
	return tok, email
}

func sampleGameZip(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	idx, _ := zw.Create("index.html")
	_, _ = idx.Write([]byte("<!doctype html><title>g</title><body>game</body>"))
	js, _ := zw.Create("game.js")
	_, _ = js.Write([]byte("console.log('play')"))
	if err := zw.Close(); err != nil {
		t.Fatalf("zip: %v", err)
	}
	return buf.Bytes()
}

func uploadGame(t *testing.T, srv *httptest.Server, token, title string) (status int, slug string) {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	_ = mw.WriteField("title", title)
	_ = mw.WriteField("tags", "arcade, test")
	fw, _ := mw.CreateFormFile("archive", "game.zip")
	_, _ = fw.Write(sampleGameZip(t))
	_ = mw.Close()

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/games", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	out := decodeObject(t, raw)
	if s, ok := out["slug"].(string); ok {
		slug = s
	}
	return res.StatusCode, slug
}

func promoteAdmin(t *testing.T, email string) {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	pool, err := db.Open(context.Background(), dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer pool.Close()
	if _, err := pool.Exec(context.Background(),
		`UPDATE users SET role = 'admin' WHERE email = $1`, email); err != nil {
		t.Fatalf("promote admin: %v", err)
	}
}

func TestIntegrationGameModerationFlow(t *testing.T) {
	srv := newTestServer(t)

	authorToken, _ := registerUser(t, srv)

	// 1. Upload starts pending and is not publicly listed.
	status, slug := uploadGame(t, srv, authorToken, "Pong Clone")
	if status != http.StatusCreated || slug == "" {
		t.Fatalf("upload: status %d slug %q", status, slug)
	}
	if listContainsSlug(t, srv, "", slug) {
		t.Fatalf("pending game must not appear in public list")
	}

	// 2. A non-admin is forbidden from the admin endpoints, even with a token.
	viewerToken, viewerEmail := registerUser(t, srv)
	if st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/admin/games/"+slug+"/approve", viewerToken, nil); st != http.StatusForbidden {
		t.Fatalf("non-admin approve: expected 403, got %d", st)
	}
	if st, _ := doJSON(t, http.MethodGet, srv.URL+"/api/admin/games", viewerToken, nil); st != http.StatusForbidden {
		t.Fatalf("non-admin list: expected 403, got %d", st)
	}

	// 3. Promote the viewer to admin and approve.
	promoteAdmin(t, viewerEmail)
	if st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/admin/games/"+slug+"/approve", viewerToken, nil); st != http.StatusOK {
		t.Fatalf("admin approve: expected 200, got %d", st)
	}
	if !listContainsSlug(t, srv, "", slug) {
		t.Fatalf("approved game must appear in public list")
	}

	// 4. Reject requires a reason.
	st2, slug2 := uploadGame(t, srv, authorToken, "Buggy Game")
	if st2 != http.StatusCreated {
		t.Fatalf("second upload failed: %d", st2)
	}
	if st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/admin/games/"+slug2+"/reject", viewerToken, map[string]any{"reason": ""}); st != http.StatusBadRequest {
		t.Fatalf("reject without reason: expected 400, got %d", st)
	}
	if st, _ := doJSON(t, http.MethodPost, srv.URL+"/api/admin/games/"+slug2+"/reject", viewerToken, map[string]any{"reason": "broken controls"}); st != http.StatusOK {
		t.Fatalf("reject with reason: expected 200, got %d", st)
	}

	// 5. The author sees the rejection reason on their own submissions.
	if reason := myGameRejectionReason(t, srv, authorToken, slug2); reason != "broken controls" {
		t.Fatalf("author rejection reason = %q, want %q", reason, "broken controls")
	}
}

func listContainsSlug(t *testing.T, srv *httptest.Server, token, slug string) bool {
	t.Helper()
	_, raw := doRaw(t, http.MethodGet, srv.URL+"/api/games", token, nil)
	for _, g := range decodeArray(t, raw) {
		if g["slug"] == slug {
			return true
		}
	}
	return false
}

func myGameRejectionReason(t *testing.T, srv *httptest.Server, token, slug string) string {
	t.Helper()
	_, raw := doRaw(t, http.MethodGet, srv.URL+"/api/me/games", token, nil)
	for _, g := range decodeArray(t, raw) {
		if g["slug"] == slug {
			if r, ok := g["rejection_reason"].(string); ok {
				return r
			}
		}
	}
	return ""
}
