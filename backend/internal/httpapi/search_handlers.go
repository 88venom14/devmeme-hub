package httpapi

import (
	"net/http"
	"strings"
)

type searchResult struct {
	Tags     []Tag              `json:"tags"`
	Profiles []profileSearchHit `json:"profiles"`
	Posts    []postSearchHit    `json:"posts"`
}

type profileSearchHit struct {
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
}

type postSearchHit struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

func (s *Server) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("q")))
	if q == "" {
		writeJSON(w, http.StatusOK, searchResult{
			Tags:     []Tag{},
			Profiles: []profileSearchHit{},
			Posts:    []postSearchHit{},
		})
		return
	}

	if rest, ok := strings.CutPrefix(q, "#"); ok {
		q = rest
		tags, err := s.searchTags(r, q)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not search tags")
			return
		}
		writeJSON(w, http.StatusOK, searchResult{Tags: tags, Profiles: []profileSearchHit{}, Posts: []postSearchHit{}})
		return
	}

	profiles, err := s.searchProfiles(r, q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not search profiles")
		return
	}
	posts, err := s.searchPosts(r, q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not search posts")
		return
	}
	writeJSON(w, http.StatusOK, searchResult{Tags: []Tag{}, Profiles: profiles, Posts: posts})
}

func (s *Server) searchTags(r *http.Request, q string) ([]Tag, error) {
	rows, err := s.db.Query(r.Context(), `
		SELECT id::text, name::text, created_at
		FROM tags
		WHERE name ILIKE $1
		ORDER BY name ASC
		LIMIT 8
	`, escapeLike(q)+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Tag, 0)
	for rows.Next() {
		var item Tag
		if err := rows.Scan(&item.ID, &item.Name, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Server) searchProfiles(r *http.Request, q string) ([]profileSearchHit, error) {
	rows, err := s.db.Query(r.Context(), `
		SELECT username::text, display_name
		FROM profiles
		WHERE username ILIKE $1 OR display_name ILIKE $1
		ORDER BY username ASC
		LIMIT 3
	`, "%"+escapeLike(q)+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]profileSearchHit, 0)
	for rows.Next() {
		var item profileSearchHit
		if err := rows.Scan(&item.Username, &item.DisplayName); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Server) searchPosts(r *http.Request, q string) ([]postSearchHit, error) {
	rows, err := s.db.Query(r.Context(), `
		SELECT id::text, title::text
		FROM posts
		WHERE title ILIKE $1
		ORDER BY created_at DESC
		LIMIT 5
	`, "%"+escapeLike(q)+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]postSearchHit, 0)
	for rows.Next() {
		var item postSearchHit
		if err := rows.Scan(&item.ID, &item.Title); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
