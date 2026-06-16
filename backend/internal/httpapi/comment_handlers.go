package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type createCommentRequest struct {
	PostID   string  `json:"post_id"`
	ParentID *string `json:"parent_id"`
	Text     string  `json:"text"`
}

func (s *Server) listComments(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `
		SELECT
			c.id::text, c.post_id::text, c.user_id::text, c.parent_id::text, c.text, c.created_at, c.updated_at,
			pr.id::text, pr.username::text, pr.display_name, pr.avatar_url, pr.bio, pr.website_url,
			pr.github_url, pr.youtube_url, pr.twitch_url, pr.banner_url, pr.created_at, pr.updated_at
		FROM comments c
		JOIN profiles pr ON pr.id = c.user_id
		WHERE c.post_id = $1
		ORDER BY c.created_at ASC
	`, chi.URLParam(r, "postID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list comments")
		return
	}
	defer rows.Close()

	comments := make([]Comment, 0)
	for rows.Next() {
		var comment Comment
		err := rows.Scan(
			&comment.ID, &comment.PostID, &comment.UserID, &comment.ParentID, &comment.Text, &comment.CreatedAt, &comment.UpdatedAt,
			&comment.Profile.ID, &comment.Profile.Username, &comment.Profile.DisplayName, &comment.Profile.AvatarURL,
			&comment.Profile.Bio, &comment.Profile.WebsiteURL, &comment.Profile.GithubURL, &comment.Profile.YoutubeURL,
			&comment.Profile.TwitchURL, &comment.Profile.BannerURL, &comment.Profile.CreatedAt, &comment.Profile.UpdatedAt,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not scan comment")
			return
		}
		comments = append(comments, comment)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not list comments")
		return
	}
	writeJSON(w, http.StatusOK, comments)
}

func (s *Server) createComment(w http.ResponseWriter, r *http.Request) {
	var req createCommentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	if req.PostID == "" || req.Text == "" {
		writeError(w, http.StatusBadRequest, "post_id and text are required")
		return
	}
	if len(req.Text) > 5000 {
		writeError(w, http.StatusBadRequest, "comment must be at most 5000 characters")
		return
	}

	var comment Comment
	err := s.db.QueryRow(r.Context(), `
		WITH inserted AS (
			INSERT INTO comments (post_id, user_id, parent_id, text)
			VALUES ($1, $2, $3, $4)
			RETURNING id, post_id, user_id, parent_id, text, created_at, updated_at
		)
		SELECT
			c.id::text, c.post_id::text, c.user_id::text, c.parent_id::text, c.text, c.created_at, c.updated_at,
			pr.id::text, pr.username::text, pr.display_name, pr.avatar_url, pr.bio, pr.website_url,
			pr.github_url, pr.youtube_url, pr.twitch_url, pr.banner_url, pr.created_at, pr.updated_at
		FROM inserted c
		JOIN profiles pr ON pr.id = c.user_id
	`, req.PostID, mustUser(r).ID, req.ParentID, req.Text).Scan(
		&comment.ID, &comment.PostID, &comment.UserID, &comment.ParentID, &comment.Text, &comment.CreatedAt, &comment.UpdatedAt,
		&comment.Profile.ID, &comment.Profile.Username, &comment.Profile.DisplayName, &comment.Profile.AvatarURL,
		&comment.Profile.Bio, &comment.Profile.WebsiteURL, &comment.Profile.GithubURL, &comment.Profile.YoutubeURL,
		&comment.Profile.TwitchURL, &comment.Profile.BannerURL, &comment.Profile.CreatedAt, &comment.Profile.UpdatedAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create comment")
		return
	}
	writeJSON(w, http.StatusCreated, comment)
}

func (s *Server) deleteComment(w http.ResponseWriter, r *http.Request) {
	tag, err := s.db.Exec(r.Context(), `DELETE FROM comments WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "commentID"), mustUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete comment")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "comment not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) followProfile(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "profileID")
	user := mustUser(r)
	if target == user.ID {
		writeError(w, http.StatusBadRequest, "cannot follow yourself")
		return
	}
	_, err := s.db.Exec(r.Context(), `
		INSERT INTO follows (follower_id, following_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, user.ID, target)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not follow profile")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) unfollowProfile(w http.ResponseWriter, r *http.Request) {
	_, err := s.db.Exec(r.Context(), `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`, mustUser(r).ID, chi.URLParam(r, "profileID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not unfollow profile")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listTopTags(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `
		SELECT t.id::text, t.name::text, t.created_at, count(pt.post_id) AS post_count
		FROM tags t
		LEFT JOIN post_tags pt ON pt.tag_id = t.id
		GROUP BY t.id
		ORDER BY post_count DESC, t.name ASC
		LIMIT $1
	`, limitParam(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list tags")
		return
	}
	defer rows.Close()

	type tagWithCount struct {
		Tag
		PostCount int64 `json:"post_count"`
	}
	tags := make([]tagWithCount, 0)
	for rows.Next() {
		var item tagWithCount
		if err := rows.Scan(&item.ID, &item.Name, &item.CreatedAt, &item.PostCount); err != nil {
			writeError(w, http.StatusInternalServerError, "could not scan tag")
			return
		}
		tags = append(tags, item)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not list tags")
		return
	}
	writeJSON(w, http.StatusOK, tags)
}

func notFoundOrServer(w http.ResponseWriter, err error, notFoundMessage, serverMessage string) bool {
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, notFoundMessage)
		return true
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, serverMessage)
		return true
	}
	return false
}
