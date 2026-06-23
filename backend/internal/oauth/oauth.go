// Package oauth holds the provider-agnostic pieces of third-party login:
// stateless CSRF state signing, username sanitisation, and the GitHub HTTP
// client (authorize URL, code exchange, identity fetch). The HTTP handlers and
// the database upsert that wire these together live in package httpapi.
package oauth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ── state signing (stateless CSRF) ──

// SignState returns the base64 HMAC of value keyed by secret. The caller sends
// "<nonce>.<SignState(secret,nonce)>" as the OAuth state; VerifyState proves we
// issued it without any server-side storage.
func SignState(secret, value string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("oauth-state:" + value))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// VerifyState reports whether state is a well-formed "<value>.<sig>" pair whose
// signature matches SignState(secret, value).
func VerifyState(secret, state string) bool {
	value, sig, ok := strings.Cut(state, ".")
	if !ok || value == "" {
		return false
	}
	return hmac.Equal([]byte(sig), []byte(SignState(secret, value)))
}

// SanitizeUsername lowercases and keeps only [a-z0-9_], matching the username
// constraint's character class, then trims leading/trailing underscores.
func SanitizeUsername(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			b.WriteRune(r)
		}
	}
	return strings.Trim(b.String(), "_")
}

// ── GitHub API ──

// GitHubUser is the subset of GitHub's /user response we consume.
type GitHubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	Email     string `json:"email"`
}

// GitHubClient performs the GitHub OAuth web flow for a single app credential.
type GitHubClient struct {
	ClientID     string
	ClientSecret string
	CallbackURL  string
	HTTP         *http.Client
}

var defaultHTTP = &http.Client{Timeout: 12 * time.Second}

// NewGitHubClient builds a client with the shared default HTTP client.
func NewGitHubClient(clientID, clientSecret, callbackURL string) *GitHubClient {
	return &GitHubClient{ClientID: clientID, ClientSecret: clientSecret, CallbackURL: callbackURL, HTTP: defaultHTTP}
}

func (c *GitHubClient) httpClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return defaultHTTP
}

// AuthorizeURL is the GitHub page the browser is redirected to, carrying the
// signed CSRF state.
func (c *GitHubClient) AuthorizeURL(state string) string {
	params := url.Values{
		"client_id":    {c.ClientID},
		"redirect_uri": {c.CallbackURL},
		"scope":        {"read:user user:email"},
		"state":        {state},
	}
	return "https://github.com/login/oauth/authorize?" + params.Encode()
}

// ExchangeCode trades an authorization code for a GitHub access token.
func (c *GitHubClient) ExchangeCode(ctx context.Context, code string) (string, error) {
	body, _ := json.Marshal(map[string]string{
		"client_id":     c.ClientID,
		"client_secret": c.ClientSecret,
		"code":          code,
		"redirect_uri":  c.CallbackURL,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://github.com/login/oauth/access_token", strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient().Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	var out struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<16)).Decode(&out); err != nil {
		return "", err
	}
	return out.AccessToken, nil
}

// FetchIdentity returns the authenticated GitHub user and their verified
// primary email (falling back to any verified email), lowercased and trimmed.
func (c *GitHubClient) FetchIdentity(ctx context.Context, token string) (GitHubUser, string, error) {
	var user GitHubUser
	if err := c.get(ctx, "https://api.github.com/user", token, &user); err != nil {
		return GitHubUser{}, "", err
	}
	if user.ID == 0 {
		return GitHubUser{}, "", errors.New("github returned no user")
	}

	email := strings.TrimSpace(user.Email)
	if email == "" {
		var emails []struct {
			Email    string `json:"email"`
			Primary  bool   `json:"primary"`
			Verified bool   `json:"verified"`
		}
		if err := c.get(ctx, "https://api.github.com/user/emails", token, &emails); err == nil {
			for _, e := range emails {
				if e.Primary && e.Verified {
					email = e.Email
					break
				}
			}
			if email == "" {
				for _, e := range emails {
					if e.Verified {
						email = e.Email
						break
					}
				}
			}
		}
	}
	return user, strings.ToLower(strings.TrimSpace(email)), nil
}

func (c *GitHubClient) get(ctx context.Context, endpoint, token string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("User-Agent", "devmeme-hub")
	req.Header.Set("Accept", "application/vnd.github+json")
	res, err := c.httpClient().Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("github GET %s: status %d", endpoint, res.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(res.Body, 1<<18)).Decode(dst)
}
