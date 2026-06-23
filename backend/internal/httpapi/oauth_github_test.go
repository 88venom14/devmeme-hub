package httpapi

import (
	"testing"

	"devmeme-hub/backend/internal/config"
)

// State signing and username sanitisation moved to package oauth and are tested
// there (internal/oauth/oauth_test.go). This keeps the config-level gate test.
func TestOAuthEnabled(t *testing.T) {
	if (config.Config{}).OAuthEnabled() {
		t.Fatal("empty config should not be OAuth-enabled")
	}
	full := config.Config{GithubClientID: "id", GithubClientSecret: "sec", GithubCallbackURL: "https://x/cb"}
	if !full.OAuthEnabled() {
		t.Fatal("fully configured should be OAuth-enabled")
	}
}
