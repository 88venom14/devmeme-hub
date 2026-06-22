package httpapi

import (
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
)

// queryGames runs a games query built from gameSelectColumns and hydrates each
// row's tags in a single follow-up query (mirrors queryPosts).
func (s *Server) queryGames(ctx context.Context, sql string, args ...any) ([]Game, error) {
	rows, err := s.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	games := make([]Game, 0)
	ids := make([]string, 0)
	for rows.Next() {
		var g Game
		if err := rows.Scan(
			&g.ID, &g.Slug, &g.AuthorID, &g.Title, &g.Description, &g.ThumbnailURL,
			&g.EntryPath, &g.ArchiveSize, &g.Status, &g.RejectionReason, &g.PlayCount,
			&g.CreatedAt, &g.UpdatedAt,
			&g.Author.ID, &g.Author.Username, &g.Author.DisplayName, &g.Author.AvatarURL,
			&g.Author.Bio, &g.Author.WebsiteURL, &g.Author.GithubURL, &g.Author.YoutubeURL,
			&g.Author.TwitchURL, &g.Author.BannerURL, &g.Author.CreatedAt, &g.Author.UpdatedAt,
		); err != nil {
			return nil, err
		}
		g.Tags = []Tag{}
		games = append(games, g)
		ids = append(ids, g.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(games) == 0 {
		return games, nil
	}

	tagsByGame, err := s.tagsForGames(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range games {
		if t := tagsByGame[games[i].ID]; t != nil {
			games[i].Tags = t
		}
	}
	return games, nil
}

func (s *Server) tagsForGames(ctx context.Context, gameIDs []string) (map[string][]Tag, error) {
	rows, err := s.db.Query(ctx, `
		SELECT gt.game_id::text, t.id::text, t.name::text, t.created_at
		FROM game_tags gt
		JOIN tags t ON t.id = gt.tag_id
		WHERE gt.game_id::text = ANY($1)
		ORDER BY t.name ASC
	`, gameIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := map[string][]Tag{}
	for rows.Next() {
		var gameID string
		var tag Tag
		if err := rows.Scan(&gameID, &tag.ID, &tag.Name, &tag.CreatedAt); err != nil {
			return nil, err
		}
		result[gameID] = append(result[gameID], tag)
	}
	return result, rows.Err()
}

// attachGameTags upserts each tag and links it to the game (mirrors the post
// tag logic). Must run inside the caller's transaction.
func attachGameTags(ctx context.Context, tx pgx.Tx, gameID string, tags []string) error {
	for _, raw := range tags {
		name := strings.TrimSpace(strings.ToLower(raw))
		if name == "" {
			continue
		}
		var tagID string
		if err := tx.QueryRow(ctx, `
			INSERT INTO tags (name) VALUES ($1)
			ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
			RETURNING id::text
		`, name).Scan(&tagID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO game_tags (game_id, tag_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`, gameID, tagID); err != nil {
			return err
		}
	}
	return nil
}

func insertModerationLog(ctx context.Context, tx pgx.Tx, gameID, moderatorID, action string, reason *string) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO game_moderation_log (game_id, moderator_id, action, reason)
		VALUES ($1, $2, $3, $4)
	`, gameID, moderatorID, action, reason)
	return err
}

func (s *Server) writeGameByID(w http.ResponseWriter, ctx context.Context, gameID string, status int) {
	games, err := s.queryGames(ctx,
		`SELECT `+gameSelectColumns+` WHERE g.id = $1`, gameID)
	if err != nil || len(games) == 0 {
		writeError(w, http.StatusInternalServerError, "could not reload game")
		return
	}
	writeJSON(w, status, games[0])
}

// removeGameFiles deletes a game's extracted bundle (and any staging leftover).
// storagePath is the slug-keyed relative directory; it is re-validated against
// the slug pattern before use so it can never escape GamesDir.
func (s *Server) removeGameFiles(storagePath string) {
	if storagePath == "" || !gameSlugPattern.MatchString(storagePath) {
		return
	}
	dir := filepath.Join(s.cfg.GamesDir, storagePath)
	_ = os.RemoveAll(dir)
	_ = os.RemoveAll(dir + ".new")
}

// parseGameUpload reads the multipart upload form shared by create and edit.
// When requireArchive is false (edit), a missing archive is allowed and
// archivePath is returned empty. On any validation failure it writes the error
// response, cleans up its own temp file, and returns ok=false. Otherwise the
// caller must defer the returned cleanup.
func (s *Server) parseGameUpload(w http.ResponseWriter, r *http.Request, requireArchive bool) (
	title string, description *string, thumbnail *string, tags []string,
	archivePath string, archiveSize *int64, cleanup func(), ok bool,
) {
	cleanup = func() {}
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxGameUploadBytes)
	if err := r.ParseMultipartForm(s.cfg.MaxGameUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "invalid multipart form or file too large")
		return
	}

	title = strings.TrimSpace(r.FormValue("title"))
	if title == "" || len(title) > 150 {
		writeError(w, http.StatusBadRequest, "title must be 1-150 characters")
		return
	}
	if d := strings.TrimSpace(r.FormValue("description")); d != "" {
		if len(d) > 2000 {
			writeError(w, http.StatusBadRequest, "description must be at most 2000 characters")
			return
		}
		description = &d
	}
	if t := strings.TrimSpace(r.FormValue("thumbnail_url")); t != "" {
		if len(t) > 1000 {
			writeError(w, http.StatusBadRequest, "thumbnail_url is too long")
			return
		}
		thumbnail = &t
	}

	tags = parseGameTags(r)
	if len(tags) > maxGameTags {
		writeError(w, http.StatusBadRequest, "at most 10 tags are allowed")
		return
	}

	file, _, err := r.FormFile("archive")
	if err != nil {
		if requireArchive {
			writeError(w, http.StatusBadRequest, "a game archive (.zip) is required")
			return
		}
		ok = true // edit without re-upload
		return
	}
	defer file.Close()

	tmp, err := os.CreateTemp("", "game-upload-*.zip")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not buffer upload")
		return
	}
	tmpPath := tmp.Name()
	removeTmp := func() { _ = os.Remove(tmpPath) }

	size, err := io.Copy(tmp, file)
	tmp.Close()
	if err != nil {
		removeTmp()
		writeError(w, http.StatusBadRequest, "could not read uploaded archive")
		return
	}

	archivePath = tmpPath
	archiveSize = &size
	cleanup = removeTmp
	ok = true
	return
}

// parseGameTags collects tags from repeated "tags" form fields and/or a single
// comma-separated value, lowercased and de-duplicated.
func parseGameTags(r *http.Request) []string {
	raw := []string{}
	if r.MultipartForm != nil {
		raw = append(raw, r.MultipartForm.Value["tags"]...)
	}
	seen := map[string]struct{}{}
	out := []string{}
	for _, group := range raw {
		for _, part := range strings.Split(group, ",") {
			name := strings.TrimSpace(strings.ToLower(part))
			if name == "" {
				continue
			}
			if _, dup := seen[name]; dup {
				continue
			}
			seen[name] = struct{}{}
			out = append(out, name)
		}
	}
	return out
}

func generateGameSlug(title string) string {
	base := slugify(title)
	if base == "" {
		base = "game"
	}
	if len(base) > 60 {
		base = strings.Trim(base[:60], "-")
		if base == "" {
			base = "game"
		}
	}
	suffix, err := randomHex(4)
	if err != nil || suffix == "" {
		suffix = "00000000"
	}
	return base + "-" + suffix
}

func slugify(s string) string {
	var b strings.Builder
	lastDash := false
	for _, r := range strings.ToLower(s) {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			b.WriteRune(r)
			lastDash = false
		default:
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}

func validGameStatus(status string) bool {
	switch status {
	case "pending", "approved", "rejected", "removed":
		return true
	}
	return false
}

func moderationTargetStatus(action string) string {
	switch action {
	case "approved":
		return "approved"
	case "rejected":
		return "rejected"
	case "removed":
		return "removed"
	}
	return "pending"
}

func itoa(n int) string { return strconv.Itoa(n) }
