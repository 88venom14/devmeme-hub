package httpapi

import (
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
)

// gameSlugPattern mirrors the games_slug_format DB constraint. Validating the
// slug before touching the filesystem keeps it out of path construction unless
// it is a known-safe token.
var gameSlugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,79}$`)

// serveGameStatic serves a game's extracted files from inside its own directory.
//
// These files are arbitrary, untrusted HTML/JS. The defenses here are:
//   - the slug is validated and the resolved path is confined to the game dir
//     (no traversal can escape into other games or the host filesystem);
//   - a strict CSP plus a sandboxed iframe on the client (see GameFrame)
//     prevent the game from reaching the network or being framed by other sites;
//   - X-Content-Type-Options: nosniff stops MIME confusion.
//
// Recommended hardening: serve this route from a dedicated origin (a separate
// subdomain) so a game can never share an origin with the main app even if a
// sandbox flag regresses. See backend/README.md.
func (s *Server) serveGameStatic(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if !gameSlugPattern.MatchString(slug) {
		http.NotFound(w, r)
		return
	}

	rest := chi.URLParam(r, "*")
	// Clean against an absolute root so any "../" is neutralised, then strip the
	// leading slash to make it relative to the game directory.
	clean := strings.TrimPrefix(path.Clean("/"+rest), "/")
	if clean == "" {
		clean = gameEntryFile
	}

	baseDir := filepath.Join(s.cfg.GamesDir, slug)
	fsPath := filepath.Join(baseDir, filepath.FromSlash(clean))

	// Defense in depth: the resolved path must stay within the game directory.
	rel, err := filepath.Rel(baseDir, fsPath)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		http.NotFound(w, r)
		return
	}

	info, err := os.Stat(fsPath)
	if err != nil || info.IsDir() {
		http.NotFound(w, r)
		return
	}

	file, err := os.Open(fsPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer file.Close()

	s.setGameSecurityHeaders(w)
	if ctype := mime.TypeByExtension(filepath.Ext(fsPath)); ctype != "" {
		w.Header().Set("Content-Type", ctype)
	}
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}

// setGameSecurityHeaders applies the isolation headers shared by every game
// asset response.
func (s *Server) setGameSecurityHeaders(w http.ResponseWriter) {
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	// Allow the (cross-origin) frontend to embed these assets in its iframe.
	h.Set("Cross-Origin-Resource-Policy", "cross-origin")

	// Only our own app origins may frame a game; the game itself gets no network
	// reach (connect-src 'none') so its JS cannot phone home or exfiltrate data.
	frameAncestors := "'self'"
	if len(s.cfg.AllowedOrigins) > 0 {
		frameAncestors += " " + strings.Join(s.cfg.AllowedOrigins, " ")
	}
	h.Set("Content-Security-Policy", strings.Join([]string{
		"default-src 'none'",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"media-src 'self' data: blob:",
		"font-src 'self' data:",
		"connect-src 'none'",
		"base-uri 'none'",
		"form-action 'none'",
		"frame-ancestors " + frameAncestors,
	}, "; "))
}
