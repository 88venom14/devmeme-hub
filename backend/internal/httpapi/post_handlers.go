package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

const defaultLimit = 30
const maxLimit = 100

type createPostRequest struct {
	Title          string          `json:"title"`
	Description    *string         `json:"description"`
	ContentMD      *string         `json:"content_md"`
	ImageURL       *string         `json:"image_url"`
	VideoURL       *string         `json:"video_url"`
	GithubURL      *string         `json:"github_url"`
	GithubRepoJSON json.RawMessage `json:"github_repo_json"`
	Tags           []string        `json:"tags"`
}

func (s *Server) listPosts(w http.ResponseWriter, r *http.Request) {
	posts, err := s.queryPosts(r.Context(), `
		SELECT
			p.id::text, p.user_id::text, p.title, p.description, p.content_md, p.image_url,
			p.video_url, p.github_url, p.github_repo_json, p.created_at, p.updated_at,
			pr.id::text, pr.username::text, pr.display_name, pr.avatar_url, pr.bio, pr.website_url,
			pr.github_url, pr.youtube_url, pr.twitch_url, pr.banner_url, pr.created_at, pr.updated_at,
			(SELECT count(*) FROM stars s WHERE s.post_id = p.id) AS star_count,
			(SELECT count(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
		FROM posts p
		JOIN profiles pr ON pr.id = p.user_id
		ORDER BY p.created_at DESC
		LIMIT $1
	`, limitParam(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list posts")
		return
	}
	writeJSON(w, http.StatusOK, posts)
}

func (s *Server) getPostInteractions(w http.ResponseWriter, r *http.Request) {
	var isStarred bool
	var isSaved bool
	err := s.db.QueryRow(r.Context(), `
		SELECT
			EXISTS(SELECT 1 FROM stars WHERE post_id = $1 AND user_id = $2),
			EXISTS(SELECT 1 FROM saved_posts WHERE post_id = $1 AND user_id = $2)
	`, chi.URLParam(r, "postID"), mustUser(r).ID).Scan(&isStarred, &isSaved)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load post interactions")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"isStarred": isStarred, "isSaved": isSaved})
}

func (s *Server) getPost(w http.ResponseWriter, r *http.Request) {
	posts, err := s.queryPosts(r.Context(), `
		SELECT
			p.id::text, p.user_id::text, p.title, p.description, p.content_md, p.image_url,
			p.video_url, p.github_url, p.github_repo_json, p.created_at, p.updated_at,
			pr.id::text, pr.username::text, pr.display_name, pr.avatar_url, pr.bio, pr.website_url,
			pr.github_url, pr.youtube_url, pr.twitch_url, pr.banner_url, pr.created_at, pr.updated_at,
			(SELECT count(*) FROM stars s WHERE s.post_id = p.id) AS star_count,
			(SELECT count(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
		FROM posts p
		JOIN profiles pr ON pr.id = p.user_id
		WHERE p.id = $1
	`, chi.URLParam(r, "postID"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load post")
		return
	}
	if len(posts) == 0 {
		writeError(w, http.StatusNotFound, "post not found")
		return
	}
	writeJSON(w, http.StatusOK, posts[0])
}

func (s *Server) createPost(w http.ResponseWriter, r *http.Request) {
	var req createPostRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" || len(req.Title) > 150 {
		writeError(w, http.StatusBadRequest, "title must be 1-150 characters")
		return
	}
	if len(req.Tags) > 10 {
		writeError(w, http.StatusBadRequest, "at most 10 tags are allowed")
		return
	}

	user := mustUser(r)
	tx, err := s.db.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	var githubJSON any
	if len(req.GithubRepoJSON) > 0 {
		githubJSON = req.GithubRepoJSON
	}

	var postID string
	err = tx.QueryRow(r.Context(), `
		INSERT INTO posts (user_id, title, description, content_md, image_url, video_url, github_url, github_repo_json)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id::text
	`, user.ID, req.Title, req.Description, req.ContentMD, req.ImageURL, req.VideoURL, req.GithubURL, githubJSON).Scan(&postID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create post")
		return
	}

	for _, rawTag := range req.Tags {
		name := strings.TrimSpace(strings.ToLower(rawTag))
		if name == "" {
			continue
		}
		var tagID string
		err = tx.QueryRow(r.Context(), `
			INSERT INTO tags (name)
			VALUES ($1)
			ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
			RETURNING id::text
		`, name).Scan(&tagID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid tag")
			return
		}
		_, err = tx.Exec(r.Context(), `
			INSERT INTO post_tags (post_id, tag_id)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`, postID, tagID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not link tag")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "could not commit post")
		return
	}

	posts, err := s.queryPosts(r.Context(), postByIDSQL, postID)
	if err != nil || len(posts) == 0 {
		writeError(w, http.StatusInternalServerError, "could not reload post")
		return
	}
	writeJSON(w, http.StatusCreated, posts[0])
}

func (s *Server) deletePost(w http.ResponseWriter, r *http.Request) {
	tag, err := s.db.Exec(r.Context(), `DELETE FROM posts WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "postID"), mustUser(r).ID)
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

func (s *Server) listProfilePosts(w http.ResponseWriter, r *http.Request) {
	profileID := chi.URLParam(r, "profileID")
	visible, err := s.profileVisibleTo(r.Context(), profileID, mustUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list profile posts")
		return
	}
	if !visible {
		writeJSON(w, http.StatusOK, []Post{})
		return
	}
	posts, err := s.queryPosts(r.Context(), postListWhereSQL("p.user_id = $2", "p.created_at DESC"), limitParam(r), profileID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list profile posts")
		return
	}
	writeJSON(w, http.StatusOK, posts)
}

func (s *Server) listProfileLikedPosts(w http.ResponseWriter, r *http.Request) {
	profileID := chi.URLParam(r, "profileID")
	viewer := mustUser(r).ID

	visible, err := s.profileVisibleTo(r.Context(), profileID, viewer)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list liked posts")
		return
	}
	hidden, err := s.likedHiddenFor(r.Context(), profileID, viewer)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list liked posts")
		return
	}
	if !visible || hidden {
		writeJSON(w, http.StatusOK, []Post{})
		return
	}

	posts, err := s.queryPosts(r.Context(), postListWhereSQL(`
		p.id IN (SELECT post_id FROM stars WHERE user_id = $2)
	`, "p.created_at DESC"), limitParam(r), profileID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list liked posts")
		return
	}
	writeJSON(w, http.StatusOK, posts)
}

func (s *Server) listFollowingPosts(w http.ResponseWriter, r *http.Request) {
	posts, err := s.queryPosts(r.Context(), postListWhereSQL(`
		p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $2)
	`, "p.created_at DESC"), limitParam(r), mustUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list following posts")
		return
	}
	writeJSON(w, http.StatusOK, posts)
}

func (s *Server) listSavedPosts(w http.ResponseWriter, r *http.Request) {
	posts, err := s.queryPosts(r.Context(), postListWhereSQL(`
		p.id IN (SELECT post_id FROM saved_posts WHERE user_id = $2)
	`, "p.created_at DESC"), limitParam(r), mustUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list saved posts")
		return
	}
	writeJSON(w, http.StatusOK, posts)
}

func (s *Server) listTagPosts(w http.ResponseWriter, r *http.Request) {
	posts, err := s.queryPosts(r.Context(), postListWhereSQL(`
		p.id IN (
			SELECT pt.post_id FROM post_tags pt
			JOIN tags t ON t.id = pt.tag_id
			WHERE t.name = $2
		)
	`, "p.created_at DESC"), limitParam(r), strings.ToLower(chi.URLParam(r, "name")))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list tag posts")
		return
	}
	writeJSON(w, http.StatusOK, posts)
}

func (s *Server) listTrendingPosts(w http.ResponseWriter, r *http.Request) {
	posts, err := s.queryPosts(r.Context(), postListBaseSQL(`
		ORDER BY (
			(SELECT count(*) FROM stars s WHERE s.post_id = p.id) * 2
			+ (SELECT count(*) FROM comments c WHERE c.post_id = p.id)
		) DESC, p.created_at DESC
		LIMIT $1
	`), limitParam(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list trending posts")
		return
	}
	writeJSON(w, http.StatusOK, posts)
}

func (s *Server) starPost(w http.ResponseWriter, r *http.Request) {
	s.insertUserPostRelation(w, r, "stars")
}

func (s *Server) unstarPost(w http.ResponseWriter, r *http.Request) {
	s.deleteUserPostRelation(w, r, "stars")
}

func (s *Server) savePost(w http.ResponseWriter, r *http.Request) {
	s.insertUserPostRelation(w, r, "saved_posts")
}

func (s *Server) unsavePost(w http.ResponseWriter, r *http.Request) {
	s.deleteUserPostRelation(w, r, "saved_posts")
}

func (s *Server) insertUserPostRelation(w http.ResponseWriter, r *http.Request, table string) {
	_, err := s.db.Exec(r.Context(), `INSERT INTO `+table+` (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, chi.URLParam(r, "postID"), mustUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update post relation")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) deleteUserPostRelation(w http.ResponseWriter, r *http.Request, table string) {
	_, err := s.db.Exec(r.Context(), `DELETE FROM `+table+` WHERE post_id = $1 AND user_id = $2`, chi.URLParam(r, "postID"), mustUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update post relation")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) queryPosts(ctx context.Context, sql string, args ...any) ([]Post, error) {
	rows, err := s.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := make([]Post, 0)
	postIDs := make([]string, 0)
	for rows.Next() {
		var post Post
		var githubJSON []byte
		err := rows.Scan(
			&post.ID, &post.UserID, &post.Title, &post.Description, &post.ContentMD, &post.ImageURL,
			&post.VideoURL, &post.GithubURL, &githubJSON, &post.CreatedAt, &post.UpdatedAt,
			&post.Profile.ID, &post.Profile.Username, &post.Profile.DisplayName, &post.Profile.AvatarURL,
			&post.Profile.Bio, &post.Profile.WebsiteURL, &post.Profile.GithubURL, &post.Profile.YoutubeURL,
			&post.Profile.TwitchURL, &post.Profile.BannerURL, &post.Profile.CreatedAt, &post.Profile.UpdatedAt,
			&post.StarCount, &post.CommentCount,
		)
		if err != nil {
			return nil, err
		}
		if len(githubJSON) > 0 {
			post.GithubRepoJSON = json.RawMessage(githubJSON)
		}
		post.Tags = []Tag{}
		posts = append(posts, post)
		postIDs = append(postIDs, post.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(posts) == 0 {
		return posts, nil
	}
	tagsByPost, err := s.tagsForPosts(ctx, postIDs)
	if err != nil {
		return nil, err
	}
	for i := range posts {
		posts[i].Tags = tagsByPost[posts[i].ID]
		if posts[i].Tags == nil {
			posts[i].Tags = []Tag{}
		}
	}
	return posts, nil
}

func (s *Server) tagsForPosts(ctx context.Context, postIDs []string) (map[string][]Tag, error) {
	rows, err := s.db.Query(ctx, `
		SELECT pt.post_id::text, t.id::text, t.name::text, t.created_at
		FROM post_tags pt
		JOIN tags t ON t.id = pt.tag_id
		WHERE pt.post_id::text = ANY($1)
		ORDER BY t.name ASC
	`, postIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := map[string][]Tag{}
	for rows.Next() {
		var postID string
		var tag Tag
		if err := rows.Scan(&postID, &tag.ID, &tag.Name, &tag.CreatedAt); err != nil {
			return nil, err
		}
		result[postID] = append(result[postID], tag)
	}
	return result, rows.Err()
}

func limitParam(r *http.Request) int {
	limit := defaultLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.Atoi(strings.TrimSpace(raw)); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > maxLimit {
		return maxLimit
	}
	return limit
}

const postByIDSQL = `
	SELECT
		p.id::text, p.user_id::text, p.title, p.description, p.content_md, p.image_url,
		p.video_url, p.github_url, p.github_repo_json, p.created_at, p.updated_at,
		pr.id::text, pr.username::text, pr.display_name, pr.avatar_url, pr.bio, pr.website_url,
		pr.github_url, pr.youtube_url, pr.twitch_url, pr.banner_url, pr.created_at, pr.updated_at,
		(SELECT count(*) FROM stars s WHERE s.post_id = p.id) AS star_count,
		(SELECT count(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
	FROM posts p
	JOIN profiles pr ON pr.id = p.user_id
	WHERE p.id = $1
`

func postListBaseSQL(suffix string) string {
	return `
		SELECT
			p.id::text, p.user_id::text, p.title, p.description, p.content_md, p.image_url,
			p.video_url, p.github_url, p.github_repo_json, p.created_at, p.updated_at,
			pr.id::text, pr.username::text, pr.display_name, pr.avatar_url, pr.bio, pr.website_url,
			pr.github_url, pr.youtube_url, pr.twitch_url, pr.banner_url, pr.created_at, pr.updated_at,
			(SELECT count(*) FROM stars s WHERE s.post_id = p.id) AS star_count,
			(SELECT count(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
		FROM posts p
		JOIN profiles pr ON pr.id = p.user_id
	` + suffix
}

func postListWhereSQL(where, order string) string {
	return postListBaseSQL(" WHERE " + where + " ORDER BY " + order + " LIMIT $1")
}
