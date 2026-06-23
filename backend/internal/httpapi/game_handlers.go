package httpapi

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

const maxGameTags = 10

// gameSelectColumns is the shared projection for the games list/detail queries,
// joined to the author's profile (same column order the scanner expects).
const gameSelectColumns = `
	g.id::text, g.slug, g.author_id::text, g.title, g.description, g.thumbnail_url,
	g.entry_path, g.archive_size, g.status, g.rejection_reason, g.play_count,
	g.created_at, g.updated_at,
	pr.id::text, pr.username::text, pr.display_name, pr.avatar_url, pr.bio, pr.website_url,
	pr.github_url, pr.youtube_url, pr.twitch_url, pr.banner_url, pr.created_at, pr.updated_at
	FROM games g
	JOIN profiles pr ON pr.id = g.author_id
`

// ── Public / authenticated reads ──────────────────────────────────────────────

func (s *Server) listGames(w http.ResponseWriter, r *http.Request) {
	args := []any{limitParam(r)}
	where := []string{"g.status = 'approved'"}

	if q := strings.TrimSpace(r.URL.Query().Get("q")); q != "" {
		args = append(args, "%"+escapeLike(q)+"%")
		where = append(where, "(g.title ILIKE $"+itoa(len(args))+" OR g.description ILIKE $"+itoa(len(args))+")")
	}
	if tag := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("tag"))); tag != "" {
		args = append(args, tag)
		where = append(where, `g.id IN (
			SELECT gt.game_id FROM game_tags gt
			JOIN tags t ON t.id = gt.tag_id
			WHERE t.name = $`+itoa(len(args))+`
		)`)
	}

	sql := `SELECT ` + gameSelectColumns + ` WHERE ` + strings.Join(where, " AND ") +
		` ORDER BY g.created_at DESC LIMIT $1`
	games, err := s.queryGames(r.Context(), sql, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list games")
		return
	}
	writeJSON(w, http.StatusOK, games)
}

func (s *Server) getGame(w http.ResponseWriter, r *http.Request) {
	games, err := s.queryGames(r.Context(),
		`SELECT `+gameSelectColumns+` WHERE g.slug = $1`, chi.URLParam(r, "slug"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load game")
		return
	}
	if len(games) == 0 {
		writeError(w, http.StatusNotFound, "game not found")
		return
	}
	game := games[0]
	// Only approved games are public; the author may still fetch their own
	// (e.g. to preview a pending submission). Admins use the admin endpoints.
	if game.Status != "approved" {
		viewer, _ := userFromContext(r.Context())
		if viewer.ID == "" || viewer.ID != game.AuthorID {
			writeError(w, http.StatusNotFound, "game not found")
			return
		}
	}
	writeJSON(w, http.StatusOK, game)
}

func (s *Server) playGame(w http.ResponseWriter, r *http.Request) {
	tag, err := s.db.Exec(r.Context(),
		`UPDATE games SET play_count = play_count + 1 WHERE slug = $1 AND status = 'approved'`,
		chi.URLParam(r, "slug"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not record play")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "game not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listMyGames(w http.ResponseWriter, r *http.Request) {
	games, err := s.queryGames(r.Context(),
		`SELECT `+gameSelectColumns+` WHERE g.author_id = $1 ORDER BY g.created_at DESC`,
		mustUser(r).ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list your games")
		return
	}
	writeJSON(w, http.StatusOK, games)
}

// ── Author writes ─────────────────────────────────────────────────────────────

func (s *Server) createGame(w http.ResponseWriter, r *http.Request) {
	title, description, thumbnail, tags, archivePath, archiveSize, cleanup, ok := s.parseGameUpload(w, r, true)
	if !ok {
		return
	}
	defer cleanup()

	user := mustUser(r)
	slug := generateGameSlug(title)
	destDir := filepath.Join(s.cfg.GamesDir, slug)

	if err := extractGameArchive(archivePath, destDir); err != nil {
		if isGameValidationError(err) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "could not process game archive")
		return
	}

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		_ = os.RemoveAll(destDir)
		writeError(w, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	var gameID string
	err = tx.QueryRow(r.Context(), `
		INSERT INTO games (slug, author_id, title, description, thumbnail_url, storage_path, archive_size)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id::text
	`, slug, user.ID, title, description, thumbnail, slug, archiveSize).Scan(&gameID)
	if err != nil {
		_ = os.RemoveAll(destDir)
		writeError(w, http.StatusInternalServerError, "could not create game")
		return
	}
	if err := attachGameTags(r.Context(), tx, gameID, tags); err != nil {
		_ = os.RemoveAll(destDir)
		writeError(w, http.StatusBadRequest, "invalid tag")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		_ = os.RemoveAll(destDir)
		writeError(w, http.StatusInternalServerError, "could not commit game")
		return
	}

	s.writeGameByID(w, r.Context(), gameID, http.StatusCreated)
}

func (s *Server) updateGame(w http.ResponseWriter, r *http.Request) {
	user := mustUser(r)
	slug := chi.URLParam(r, "slug")

	var gameID, storagePath string
	err := s.db.QueryRow(r.Context(),
		`SELECT id::text, storage_path FROM games WHERE slug = $1 AND author_id = $2`,
		slug, user.ID).Scan(&gameID, &storagePath)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "game not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load game")
		return
	}

	title, description, thumbnail, tags, archivePath, archiveSize, cleanup, ok := s.parseGameUpload(w, r, false)
	if !ok {
		return
	}
	defer cleanup()

	destDir := filepath.Join(s.cfg.GamesDir, storagePath)
	// Re-uploaded bundle (optional on edit): extract+validate into a sibling
	// staging dir now, but swap it in only AFTER the DB commit below. That keeps
	// the database (the source of truth) from ever describing files that were
	// never written. If anything fails before the swap, the staging dir is
	// removed and the live files are left untouched.
	stagingDir := ""
	if archivePath != "" {
		stagingDir = destDir + ".new"
		_ = os.RemoveAll(stagingDir)
		if err := extractGameArchive(archivePath, stagingDir); err != nil {
			if isGameValidationError(err) {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			writeError(w, http.StatusInternalServerError, "could not process game archive")
			return
		}
	}
	// Clean up the staging dir on any early return; cleared to "" once swapped in.
	defer func() {
		if stagingDir != "" {
			_ = os.RemoveAll(stagingDir)
		}
	}()

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	// Editing resets the game to the moderation queue and clears any prior
	// rejection reason; the resubmission is recorded in the audit log.
	if archiveSize != nil {
		_, err = tx.Exec(r.Context(), `
			UPDATE games
			SET title = $2, description = $3, thumbnail_url = $4,
			    archive_size = $5, status = 'pending', rejection_reason = NULL
			WHERE id = $1
		`, gameID, title, description, thumbnail, *archiveSize)
	} else {
		_, err = tx.Exec(r.Context(), `
			UPDATE games
			SET title = $2, description = $3, thumbnail_url = $4,
			    status = 'pending', rejection_reason = NULL
			WHERE id = $1
		`, gameID, title, description, thumbnail)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update game")
		return
	}
	if _, err := tx.Exec(r.Context(), `DELETE FROM game_tags WHERE game_id = $1`, gameID); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update tags")
		return
	}
	if err := attachGameTags(r.Context(), tx, gameID, tags); err != nil {
		writeError(w, http.StatusBadRequest, "invalid tag")
		return
	}
	if err := insertModerationLog(r.Context(), tx, gameID, user.ID, "resubmitted", nil); err != nil {
		writeError(w, http.StatusInternalServerError, "could not record resubmission")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "could not commit game")
		return
	}

	// DB committed — now swap the validated bundle in. Done after commit so a
	// filesystem failure can't leave the DB describing files that don't exist.
	if stagingDir != "" {
		if err := os.RemoveAll(destDir); err != nil {
			writeError(w, http.StatusInternalServerError, "could not replace game files")
			return
		}
		if err := os.Rename(stagingDir, destDir); err != nil {
			writeError(w, http.StatusInternalServerError, "could not replace game files")
			return
		}
		stagingDir = "" // swapped in; disable the cleanup defer
	}

	s.writeGameByID(w, r.Context(), gameID, http.StatusOK)
}

func (s *Server) deleteGame(w http.ResponseWriter, r *http.Request) {
	user := mustUser(r)
	var storagePath string
	err := s.db.QueryRow(r.Context(),
		`DELETE FROM games WHERE slug = $1 AND author_id = $2 RETURNING storage_path`,
		chi.URLParam(r, "slug"), user.ID).Scan(&storagePath)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "game not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete game")
		return
	}
	s.removeGameFiles(storagePath)
	w.WriteHeader(http.StatusNoContent)
}

// ── Admin moderation ──────────────────────────────────────────────────────────

func (s *Server) adminListGames(w http.ResponseWriter, r *http.Request) {
	args := []any{limitParam(r)}
	where := ""
	if status := strings.TrimSpace(r.URL.Query().Get("status")); status != "" {
		if !validGameStatus(status) {
			writeError(w, http.StatusBadRequest, "invalid status filter")
			return
		}
		args = append(args, status)
		where = " WHERE g.status = $2"
	}
	sql := `SELECT ` + gameSelectColumns + where +
		` ORDER BY CASE g.status WHEN 'pending' THEN 0 ELSE 1 END, g.created_at DESC LIMIT $1`
	games, err := s.queryGames(r.Context(), sql, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list games")
		return
	}

	counts := map[string]int64{}
	rows, err := s.db.Query(r.Context(), `SELECT status, count(*) FROM games GROUP BY status`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var status string
			var count int64
			if err := rows.Scan(&status, &count); err == nil {
				counts[status] = count
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"games": games, "counts": counts})
}

func (s *Server) adminApproveGame(w http.ResponseWriter, r *http.Request) {
	s.moderateGame(w, r, "approved", nil)
}

type reasonRequest struct {
	Reason string `json:"reason"`
}

func (s *Server) adminRejectGame(w http.ResponseWriter, r *http.Request) {
	var req reasonRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" || len(reason) > 1000 {
		writeError(w, http.StatusBadRequest, "a rejection reason (1-1000 characters) is required")
		return
	}
	s.moderateGame(w, r, "rejected", &reason)
}

func (s *Server) adminRemoveGame(w http.ResponseWriter, r *http.Request) {
	var req reasonRequest
	// Reason is optional for a takedown.
	_ = decodeJSON(r, &req)
	var reason *string
	if trimmed := strings.TrimSpace(req.Reason); trimmed != "" {
		if len(trimmed) > 1000 {
			writeError(w, http.StatusBadRequest, "reason too long")
			return
		}
		reason = &trimmed
	}
	s.moderateGame(w, r, "removed", reason)
}

// moderateGame applies a status transition and writes the matching audit-log row
// in the same transaction, so the recorded history can never drift from the
// game's actual status.
func (s *Server) moderateGame(w http.ResponseWriter, r *http.Request, action string, reason *string) {
	moderator := mustUser(r)
	slug := chi.URLParam(r, "slug")

	tx, err := s.db.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	var gameID, storagePath string
	err = tx.QueryRow(r.Context(),
		`SELECT id::text, storage_path FROM games WHERE slug = $1 FOR UPDATE`, slug).Scan(&gameID, &storagePath)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "game not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load game")
		return
	}

	status := moderationTargetStatus(action)
	_, err = tx.Exec(r.Context(),
		`UPDATE games SET status = $2, rejection_reason = $3 WHERE id = $1`, gameID, status, reason)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update game status")
		return
	}
	if err := insertModerationLog(r.Context(), tx, gameID, moderator.ID, action, reason); err != nil {
		writeError(w, http.StatusInternalServerError, "could not record moderation action")
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "could not commit moderation action")
		return
	}

	// A removed game's bundle is deleted from disk so it can no longer be
	// served, even by direct URL. The DB row (and its audit log) is retained.
	if action == "removed" {
		s.removeGameFiles(storagePath)
	}
	s.writeGameByID(w, r.Context(), gameID, http.StatusOK)
}

func (s *Server) adminGameLog(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `
		SELECT l.id::text, l.game_id::text, l.moderator_id::text, l.action, l.reason, l.created_at
		FROM game_moderation_log l
		JOIN games g ON g.id = l.game_id
		WHERE g.slug = $1
		ORDER BY l.created_at DESC
	`, chi.URLParam(r, "slug"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load moderation log")
		return
	}
	defer rows.Close()

	entries := make([]GameModerationLogEntry, 0)
	for rows.Next() {
		var e GameModerationLogEntry
		if err := rows.Scan(&e.ID, &e.GameID, &e.ModeratorID, &e.Action, &e.Reason, &e.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read moderation log")
			return
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not read moderation log")
		return
	}
	writeJSON(w, http.StatusOK, entries)
}
