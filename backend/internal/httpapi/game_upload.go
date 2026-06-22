package httpapi

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// A mini-game is uploaded as a self-contained .zip whose root holds an
// index.html plus static assets. The archive is untrusted: it is validated
// fully before a single byte is written to disk, and never executed on the
// server.

const (
	// gameEntryFile is the required root entry point of every bundle.
	gameEntryFile = "index.html"
	// maxGameUncompressedBytes caps the total extracted size, guarding against
	// zip bombs whose compressed size passes the archive limit.
	maxGameUncompressedBytes int64 = 100 << 20 // 100 MB
	// maxGameFiles caps the number of entries to bound extraction work.
	maxGameFiles = 4000
)

// allowedGameExtensions is the closed set of asset types a bundle may contain.
// Anything else (including extensionless files and server-side scripts) is
// rejected outright.
var allowedGameExtensions = map[string]struct{}{
	".html": {}, ".css": {}, ".js": {}, ".json": {},
	".png": {}, ".jpg": {}, ".jpeg": {}, ".gif": {}, ".webp": {}, ".svg": {},
	".mp3": {}, ".ogg": {}, ".wav": {},
	".woff": {}, ".woff2": {}, ".ttf": {},
}

// errGameValidation marks a rejection caused by the uploaded content rather than
// a server fault, so callers can map it to a 400.
type gameValidationError struct{ msg string }

func (e gameValidationError) Error() string { return e.msg }

func invalidGame(format string, args ...any) error {
	return gameValidationError{msg: fmt.Sprintf(format, args...)}
}

func isGameValidationError(err error) bool {
	var v gameValidationError
	return errors.As(err, &v)
}

// validateGameArchive checks every entry of the archive without extracting it.
// It enforces the extension allowlist, rejects path traversal / absolute paths
// / symlinks / non-regular files, caps total size and file count, and requires a
// root index.html. It returns nil only if the bundle is safe to extract.
func validateGameArchive(zr *zip.Reader) error {
	if len(zr.File) == 0 {
		return invalidGame("archive is empty")
	}
	if len(zr.File) > maxGameFiles {
		return invalidGame("archive contains too many files (max %d)", maxGameFiles)
	}

	var total int64
	foundEntry := false
	for _, f := range zr.File {
		name := f.Name
		if name == "" {
			return invalidGame("archive contains an entry with an empty name")
		}
		// A backslash is never a valid zip separator; treat it as a traversal /
		// absolute-path attempt (e.g. a Windows-style "..\\..\\x").
		if strings.ContainsRune(name, '\\') {
			return invalidGame("illegal path in archive: %q", name)
		}
		if path.IsAbs(name) || strings.HasPrefix(name, "/") {
			return invalidGame("absolute paths are not allowed: %q", name)
		}

		mode := f.Mode()
		if mode&fs.ModeSymlink != 0 {
			return invalidGame("symlinks are not allowed: %q", name)
		}

		// Directories carry no payload; they're created on demand at extraction.
		if f.FileInfo().IsDir() || strings.HasSuffix(name, "/") {
			continue
		}
		if !mode.IsRegular() {
			return invalidGame("only regular files are allowed: %q", name)
		}

		clean := path.Clean(name)
		if clean == ".." || strings.HasPrefix(clean, "../") || clean == "." {
			return invalidGame("path traversal is not allowed: %q", name)
		}

		ext := strings.ToLower(path.Ext(clean))
		if _, ok := allowedGameExtensions[ext]; !ok {
			return invalidGame("file type not allowed: %q", name)
		}

		total += int64(f.UncompressedSize64)
		if total > maxGameUncompressedBytes {
			return invalidGame("archive is too large when extracted (max %d MB)", maxGameUncompressedBytes>>20)
		}

		if clean == gameEntryFile {
			foundEntry = true
		}
	}

	if !foundEntry {
		return invalidGame("archive must contain a root %s", gameEntryFile)
	}
	return nil
}

// extractGameArchive validates the archive at zipPath, then extracts it into
// destDir (which must not yet exist). On any failure it removes any partial
// output so a rejected upload never leaves files behind.
func extractGameArchive(zipPath, destDir string) error {
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return invalidGame("could not read zip archive")
	}
	defer zr.Close()

	if err := validateGameArchive(&zr.Reader); err != nil {
		return err
	}

	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return err
	}
	if err := writeGameFiles(&zr.Reader, destDir); err != nil {
		_ = os.RemoveAll(destDir)
		return err
	}
	return nil
}

func writeGameFiles(zr *zip.Reader, destDir string) error {
	for _, f := range zr.File {
		if f.FileInfo().IsDir() || strings.HasSuffix(f.Name, "/") {
			continue
		}
		clean := path.Clean(f.Name)
		dstPath := filepath.Join(destDir, filepath.FromSlash(clean))

		// Defense in depth: confirm the resolved path stays inside destDir even
		// after Join, regardless of the validation above.
		rel, err := filepath.Rel(destDir, dstPath)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			return invalidGame("path traversal is not allowed: %q", f.Name)
		}

		if err := os.MkdirAll(filepath.Dir(dstPath), 0o755); err != nil {
			return err
		}
		if err := copyZipEntry(f, dstPath); err != nil {
			return err
		}
	}
	return nil
}

func copyZipEntry(f *zip.File, dstPath string) error {
	src, err := f.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.OpenFile(dstPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return err
	}
	defer dst.Close()

	// Bound the copy independently of the declared uncompressed size.
	limited := io.LimitReader(src, maxGameUncompressedBytes+1)
	if _, err := io.Copy(dst, limited); err != nil {
		return err
	}
	return nil
}
