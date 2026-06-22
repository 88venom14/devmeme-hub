package config

import (
	"bufio"
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr        string
	DatabaseURL     string
	JWTSecret       string
	AccessTokenTTL  time.Duration
	AllowedOrigins  []string
	MaxRequestBytes int64
	MaxUploadBytes  int64
	MediaDir        string
	// GamesDir is where uploaded mini-game bundles are extracted, one
	// subdirectory per game slug.
	GamesDir string
	// MaxGameUploadBytes caps the size of an uploaded game archive (.zip).
	MaxGameUploadBytes int64
}

// knownWeakSecrets are placeholder values shipped in example/config files.
// They must never be accepted in a running server, otherwise anyone can forge
// JWTs because the signing key is publicly known.
var knownWeakSecrets = map[string]struct{}{
	"change-this-to-at-least-32-characters":   {},
	"change-me-change-me-change-me-32chars!!": {},
	"changemechangemechangemechangeme":        {},
}

func Load() (Config, error) {
	loadDotEnv()

	cfg := Config{
		HTTPAddr:        env("HTTP_ADDR", ":8080"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		JWTSecret:       os.Getenv("JWT_SECRET"),
		AccessTokenTTL:  durationEnv("ACCESS_TOKEN_TTL", 24*time.Hour),
		AllowedOrigins:  csvEnv("ALLOWED_ORIGINS", []string{"http://localhost:5173"}),
		MaxRequestBytes: int64Env("MAX_REQUEST_BYTES", 64<<20),
		MaxUploadBytes:  int64Env("MAX_UPLOAD_BYTES", 50<<20),
		MediaDir:        env("MEDIA_DIR", "media"),
		GamesDir:        env("GAMES_DIR", "games"),
		// 25 MB per the mini-game upload spec; a zip bundle of static assets.
		MaxGameUploadBytes: int64Env("MAX_GAME_UPLOAD_BYTES", 25<<20),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if len(cfg.JWTSecret) < 32 {
		return Config{}, errors.New("JWT_SECRET must be at least 32 characters")
	}
	if _, weak := knownWeakSecrets[cfg.JWTSecret]; weak {
		return Config{}, errors.New("JWT_SECRET is a known placeholder value; set a unique secret")
	}
	if cfg.MaxUploadBytes > cfg.MaxRequestBytes {
		cfg.MaxUploadBytes = cfg.MaxRequestBytes
	}
	return cfg, nil
}

func DatabaseURL() (string, error) {
	loadDotEnv()

	databaseURL := os.Getenv("DATABASE_URL")
	if strings.TrimSpace(databaseURL) == "" {
		return "", errors.New("DATABASE_URL is required")
	}
	return databaseURL, nil
}

func loadDotEnv() {
	file, err := os.Open(".env")
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key == "" || os.Getenv(key) != "" {
			continue
		}
		_ = os.Setenv(key, value)
	}
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func csvEnv(key string, fallback []string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		if item := strings.TrimSpace(part); item != "" {
			values = append(values, item)
		}
	}
	if len(values) == 0 {
		return fallback
	}
	return values
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		return fallback
	}
	return value
}

func int64Env(key string, fallback int64) int64 {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
