package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/jackc/pgx/v5"
)

// defaultSettings is the canonical list of user preference keys with their
// defaults. Only keys present here may be written, and GET always returns the
// full set (stored values overlaid on defaults).
var defaultSettings = map[string]bool{
	"notify_likes":           true,
	"notify_comments":        true,
	"notify_followers":       true,
	"email_digest":           false,
	"push_browser":           false,
	"profile_followers_only": false,
	"hide_liked":             false,
	"two_factor":             false,
}

func mergedSettings(stored map[string]bool) map[string]bool {
	out := make(map[string]bool, len(defaultSettings))
	for k, v := range defaultSettings {
		out[k] = v
	}
	for k, v := range stored {
		if _, ok := defaultSettings[k]; ok {
			out[k] = v
		}
	}
	return out
}

func parseStoredSettings(raw []byte) map[string]bool {
	stored := map[string]bool{}
	if len(raw) > 0 {
		// Ignore any non-boolean / unknown legacy values gracefully.
		_ = json.Unmarshal(raw, &stored)
	}
	return stored
}

func (s *Server) getSettings(w http.ResponseWriter, r *http.Request) {
	var raw []byte
	err := s.db.QueryRow(r.Context(), `SELECT settings FROM users WHERE id = $1`, mustUser(r).ID).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusUnauthorized, "user no longer exists")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load settings")
		return
	}
	writeJSON(w, http.StatusOK, mergedSettings(parseStoredSettings(raw)))
}

func (s *Server) updateSettings(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "could not read request body")
		return
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	patch := make(map[string]bool, len(raw))
	for key, rawVal := range raw {
		if _, ok := defaultSettings[key]; !ok {
			writeError(w, http.StatusBadRequest, "unknown setting: "+key)
			return
		}
		var value bool
		if err := json.Unmarshal(rawVal, &value); err != nil {
			writeError(w, http.StatusBadRequest, "setting must be a boolean: "+key)
			return
		}
		patch[key] = value
	}

	patchJSON, err := json.Marshal(patch)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not encode settings")
		return
	}

	var stored []byte
	err = s.db.QueryRow(r.Context(), `
		UPDATE users SET settings = settings || $2::jsonb
		WHERE id = $1
		RETURNING settings
	`, mustUser(r).ID, patchJSON).Scan(&stored)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusUnauthorized, "user no longer exists")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update settings")
		return
	}
	writeJSON(w, http.StatusOK, mergedSettings(parseStoredSettings(stored)))
}
