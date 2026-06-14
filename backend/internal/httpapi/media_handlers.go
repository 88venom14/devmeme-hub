package httpapi

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// allowedMediaTypes maps a detected (sniffed) MIME type to the file extension
// we store it under. The extension is derived from the verified content, never
// from the client-supplied filename or Content-Type header.
var allowedMediaTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
	"video/mp4":  ".mp4",
	"video/webm": ".webm",
}

func (s *Server) uploadMedia(w http.ResponseWriter, r *http.Request) {
	// Cap the whole request body for uploads independently of the JSON limit.
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxUploadBytes)
	if err := r.ParseMultipartForm(s.cfg.MaxUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "invalid multipart form or file too large")
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()

	// Sniff the real content type from the file bytes; do not trust the
	// client-declared Content-Type, which is trivially spoofable.
	buffered := bufio.NewReader(file)
	head, err := buffered.Peek(512)
	if err != nil && err != io.EOF && err != bufio.ErrBufferFull {
		writeError(w, http.StatusBadRequest, "could not read uploaded file")
		return
	}
	contentType := http.DetectContentType(head)
	ext, ok := allowedMediaTypes[contentType]
	if !ok {
		writeError(w, http.StatusBadRequest, "unsupported media type")
		return
	}

	userID := mustUser(r).ID
	name, err := randomHex(16)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate media filename")
		return
	}
	relPath := filepath.Join(userID, name+ext)
	dstPath := filepath.Join(s.cfg.MediaDir, relPath)
	if err := os.MkdirAll(filepath.Dir(dstPath), 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create media directory")
		return
	}

	dst, err := os.OpenFile(dstPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create media file")
		return
	}
	defer dst.Close()

	// Copy from the buffered reader so the peeked header bytes are included.
	if _, err := io.Copy(dst, buffered); err != nil {
		_ = os.Remove(dstPath)
		writeError(w, http.StatusInternalServerError, "could not save media file")
		return
	}

	publicPath := strings.ReplaceAll(relPath, string(filepath.Separator), "/")
	writeJSON(w, http.StatusCreated, map[string]string{
		"url": fmt.Sprintf("%s://%s/media/%s", scheme(r), r.Host, publicPath),
	})
}

func randomHex(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func scheme(r *http.Request) string {
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		return proto
	}
	if r.TLS != nil {
		return "https"
	}
	return "http"
}
