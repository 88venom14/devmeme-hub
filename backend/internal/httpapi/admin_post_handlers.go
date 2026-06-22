package httpapi

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

// adminListPosts returns posts for the moderation panel, newest first. Unlike
// the public feed this is admin-only and meant for moderation; it reuses the
// same post projection so the frontend can render full PostCards. An optional
// ?q= filters by post title/description or author username (case-insensitive).
func (s *Server) adminListPosts(w http.ResponseWriter, r *http.Request) {
	args := []any{limitParam(r)}
	where := ""
	if q := strings.TrimSpace(r.URL.Query().Get("q")); q != "" {
		args = append(args, "%"+q+"%")
		where = " WHERE (p.title ILIKE $2 OR p.description ILIKE $2 OR pr.username::text ILIKE $2)"
	}
	posts, err := s.queryPosts(r.Context(),
		postListBaseSQL(where+" ORDER BY p.created_at DESC LIMIT $1"), args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list posts")
		return
	}
	writeJSON(w, http.StatusOK, posts)
}

// adminDeletePost lets an admin delete ANY user's post (the public
// DELETE /posts/{id} only deletes the caller's own). Admin is enforced by the
// requireAdmin middleware on the route.
func (s *Server) adminDeletePost(w http.ResponseWriter, r *http.Request) {
	tag, err := s.db.Exec(r.Context(), `DELETE FROM posts WHERE id = $1`, chi.URLParam(r, "postID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete post")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "post not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
