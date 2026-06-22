package httpapi

import (
	"archive/zip"
	"bytes"
	"io/fs"
	"strings"
	"testing"
)

// buildZip builds an in-memory zip from name->content entries.
func buildZip(t *testing.T, files map[string]string) *zip.Reader {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("create zip entry %q: %v", name, err)
		}
		if _, err := w.Write([]byte(content)); err != nil {
			t.Fatalf("write zip entry %q: %v", name, err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("open zip reader: %v", err)
	}
	return zr
}

func TestValidateGameArchive_Valid(t *testing.T) {
	zr := buildZip(t, map[string]string{
		"index.html":      "<html><body>hi</body></html>",
		"game.js":         "console.log('hi')",
		"assets/logo.png": "fakepng",
		"styles/main.css": "body{}",
	})
	if err := validateGameArchive(zr); err != nil {
		t.Fatalf("expected valid archive, got: %v", err)
	}
}

func TestValidateGameArchive_MissingIndex(t *testing.T) {
	zr := buildZip(t, map[string]string{"main.js": "x"})
	err := validateGameArchive(zr)
	if err == nil || !strings.Contains(err.Error(), "index.html") {
		t.Fatalf("expected missing index.html error, got: %v", err)
	}
	if !isGameValidationError(err) {
		t.Fatalf("expected a validation error type")
	}
}

func TestValidateGameArchive_DisallowedExtension(t *testing.T) {
	zr := buildZip(t, map[string]string{
		"index.html": "x",
		"evil.php":   "<?php ?>",
	})
	if err := validateGameArchive(zr); err == nil || !strings.Contains(err.Error(), "not allowed") {
		t.Fatalf("expected disallowed extension error, got: %v", err)
	}
}

func TestValidateGameArchive_ExtensionlessRejected(t *testing.T) {
	zr := buildZip(t, map[string]string{
		"index.html": "x",
		"Makefile":   "all:",
	})
	if err := validateGameArchive(zr); err == nil {
		t.Fatalf("expected extensionless file to be rejected")
	}
}

func TestValidateGameArchive_ZipSlip(t *testing.T) {
	zr := buildZip(t, map[string]string{
		"index.html":     "x",
		"../escape.js":   "x",
	})
	if err := validateGameArchive(zr); err == nil || !strings.Contains(err.Error(), "traversal") {
		t.Fatalf("expected zip-slip traversal rejection, got: %v", err)
	}
}

func TestValidateGameArchive_AbsolutePath(t *testing.T) {
	zr := buildZip(t, map[string]string{
		"index.html":      "x",
		"/etc/cron.d/x.js": "x",
	})
	if err := validateGameArchive(zr); err == nil || !strings.Contains(err.Error(), "absolute") {
		t.Fatalf("expected absolute path rejection, got: %v", err)
	}
}

func TestValidateGameArchive_BackslashPath(t *testing.T) {
	zr := buildZip(t, map[string]string{
		"index.html":      "x",
		`..\\windows\\x.js`: "x",
	})
	if err := validateGameArchive(zr); err == nil || !strings.Contains(err.Error(), "illegal path") {
		t.Fatalf("expected backslash path rejection, got: %v", err)
	}
}

func TestValidateGameArchive_Symlink(t *testing.T) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	// index.html so the only failure is the symlink.
	idx, _ := zw.Create("index.html")
	_, _ = idx.Write([]byte("x"))

	hdr := &zip.FileHeader{Name: "link.js"}
	hdr.SetMode(fs.ModeSymlink | 0o777)
	w, err := zw.CreateHeader(hdr)
	if err != nil {
		t.Fatalf("create symlink header: %v", err)
	}
	_, _ = w.Write([]byte("/etc/passwd"))
	if err := zw.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}

	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("open zip: %v", err)
	}
	if err := validateGameArchive(zr); err == nil || !strings.Contains(err.Error(), "symlink") {
		t.Fatalf("expected symlink rejection, got: %v", err)
	}
}

func TestValidateGameArchive_Empty(t *testing.T) {
	zr := buildZip(t, map[string]string{})
	if err := validateGameArchive(zr); err == nil {
		t.Fatalf("expected empty archive rejection")
	}
}

func TestGenerateGameSlug(t *testing.T) {
	cases := map[string]string{
		"Hello World!":   "hello-world",
		"  Spaces  Here": "spaces-here",
		"Привет":         "game", // non-latin collapses to empty base -> fallback
		"a/b\\c":         "a-b-c",
	}
	for title, wantBase := range cases {
		slug := generateGameSlug(title)
		base := slug[:strings.LastIndex(slug, "-")]
		if base != wantBase {
			t.Errorf("generateGameSlug(%q): base = %q, want %q (full %q)", title, base, wantBase, slug)
		}
		if !gameSlugPattern.MatchString(slug) {
			t.Errorf("generateGameSlug(%q) = %q does not match slug pattern", title, slug)
		}
	}
}

func TestModerationTargetStatus(t *testing.T) {
	for action, want := range map[string]string{
		"approved": "approved",
		"rejected": "rejected",
		"removed":  "removed",
	} {
		if got := moderationTargetStatus(action); got != want {
			t.Errorf("moderationTargetStatus(%q) = %q, want %q", action, got, want)
		}
	}
}
