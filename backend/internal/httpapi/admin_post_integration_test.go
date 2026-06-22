package httpapi_test

import (
	"net/http"
	"net/http/httptest"
	neturl "net/url"
	"testing"
)

// TestIntegrationAdminPostModeration covers the admin post-moderation flow and,
// most importantly, its authorization: only an admin may list/delete arbitrary
// users' posts. DB-gated (skips without TEST_DATABASE_URL), like the other
// integration tests.
func TestIntegrationAdminPostModeration(t *testing.T) {
	srv := newTestServer(t)

	// A normal user creates a post.
	authorToken, _ := registerUser(t, srv)
	status, post := doJSON(t, http.MethodPost, srv.URL+"/api/posts", authorToken, map[string]any{
		"title": "Moderate me please",
	})
	if status != http.StatusCreated {
		t.Fatalf("create post: status %d body %v", status, post)
	}
	postID, _ := post["id"].(string)
	if postID == "" {
		t.Fatalf("create post: no id in %v", post)
	}

	// Authorization: a non-admin (even the author) is forbidden from the admin
	// endpoints, and an anonymous request is unauthorized.
	if st, _ := doJSON(t, http.MethodGet, srv.URL+"/api/admin/posts", authorToken, nil); st != http.StatusForbidden {
		t.Fatalf("non-admin GET /admin/posts: expected 403, got %d", st)
	}
	if st, _ := doJSON(t, http.MethodDelete, srv.URL+"/api/admin/posts/"+postID, authorToken, nil); st != http.StatusForbidden {
		t.Fatalf("non-admin DELETE /admin/posts: expected 403, got %d", st)
	}
	if st, _ := doJSON(t, http.MethodGet, srv.URL+"/api/admin/posts", "", nil); st != http.StatusUnauthorized {
		t.Fatalf("anonymous GET /admin/posts: expected 401, got %d", st)
	}

	// The author's post must still exist (the forbidden delete was a no-op).
	if st, _ := doJSON(t, http.MethodGet, srv.URL+"/api/posts/"+postID, "", nil); st != http.StatusOK {
		t.Fatalf("post should still exist after forbidden delete, got %d", st)
	}

	// Promote a second user to admin.
	adminToken, adminEmail := registerUser(t, srv)
	promoteAdmin(t, adminEmail)

	// Admin sees the post, and search works by title substring.
	if !adminPostsContain(t, srv, adminToken, "", postID) {
		t.Fatalf("admin list should contain the post")
	}
	if !adminPostsContain(t, srv, adminToken, "Moderate", postID) {
		t.Fatalf("admin search q=Moderate should find the post")
	}
	if adminPostsContain(t, srv, adminToken, "zzz-no-such-post-xyz", postID) {
		t.Fatalf("admin search for nonsense should not find the post")
	}

	// Admin deletes another user's post.
	if st, _ := doJSON(t, http.MethodDelete, srv.URL+"/api/admin/posts/"+postID, adminToken, nil); st != http.StatusNoContent {
		t.Fatalf("admin DELETE: expected 204, got %d", st)
	}
	// Idempotency: deleting again is 404, and it's gone from the list.
	if st, _ := doJSON(t, http.MethodDelete, srv.URL+"/api/admin/posts/"+postID, adminToken, nil); st != http.StatusNotFound {
		t.Fatalf("admin DELETE missing: expected 404, got %d", st)
	}
	if adminPostsContain(t, srv, adminToken, "", postID) {
		t.Fatalf("deleted post should be gone from the admin list")
	}
}

func adminPostsContain(t *testing.T, srv *httptest.Server, token, q, postID string) bool {
	t.Helper()
	url := srv.URL + "/api/admin/posts?limit=100"
	if q != "" {
		url += "&q=" + neturl.QueryEscape(q)
	}
	_, raw := doRaw(t, http.MethodGet, url, token, nil)
	for _, p := range decodeArray(t, raw) {
		if p["id"] == postID {
			return true
		}
	}
	return false
}
