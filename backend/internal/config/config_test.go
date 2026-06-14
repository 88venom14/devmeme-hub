package config

import "testing"

func TestLoadRejectsWeakJWTSecret(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost:5432/db")
	t.Setenv("JWT_SECRET", "change-this-to-at-least-32-characters")

	if _, err := Load(); err == nil {
		t.Fatal("expected Load to reject the known placeholder JWT secret")
	}
}

func TestLoadRejectsShortJWTSecret(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost:5432/db")
	t.Setenv("JWT_SECRET", "too-short")

	if _, err := Load(); err == nil {
		t.Fatal("expected Load to reject a short JWT secret")
	}
}

func TestLoadAcceptsStrongSecretAndClampsUpload(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost:5432/db")
	t.Setenv("JWT_SECRET", "a-unique-strong-secret-that-is-long-enough-123")
	t.Setenv("MAX_REQUEST_BYTES", "1000")
	t.Setenv("MAX_UPLOAD_BYTES", "5000")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.MaxUploadBytes > cfg.MaxRequestBytes {
		t.Errorf("MaxUploadBytes (%d) must be clamped to MaxRequestBytes (%d)", cfg.MaxUploadBytes, cfg.MaxRequestBytes)
	}
}
