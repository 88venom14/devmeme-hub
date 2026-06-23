// Package email sends transactional email via the Resend HTTP API.
package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Sender sends a single transactional email.
type Sender interface {
	Send(ctx context.Context, to, subject, html string) error
}

// Resend sends via https://resend.com. When APIKey is empty it is effectively
// disabled and Send returns ErrNotConfigured so callers can decide what to do.
type Resend struct {
	APIKey string
	From   string
	client *http.Client
}

// ErrNotConfigured is returned by Send when no API key is set.
var ErrNotConfigured = fmt.Errorf("email sender is not configured")

func NewResend(apiKey, from string) *Resend {
	return &Resend{
		APIKey: apiKey,
		From:   from,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// Configured reports whether an API key is present.
func (r *Resend) Configured() bool { return r != nil && r.APIKey != "" }

func (r *Resend) Send(ctx context.Context, to, subject, html string) error {
	if !r.Configured() {
		return ErrNotConfigured
	}
	payload, err := json.Marshal(map[string]any{
		"from":    r.From,
		"to":      []string{to},
		"subject": subject,
		"html":    html,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.APIKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 200 && res.StatusCode < 300 {
		return nil
	}
	body, _ := io.ReadAll(io.LimitReader(res.Body, 2048))
	return fmt.Errorf("resend send failed: status %d: %s", res.StatusCode, string(body))
}
