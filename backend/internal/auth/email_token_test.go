package auth

import (
	"testing"
	"time"
)

func TestEmailVerifyTokenRoundTrip(t *testing.T) {
	secret := "test-secret-at-least-32-characters-long"
	id, err := IssueEmailVerifyToken(secret, "user-123", time.Hour)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	got, err := ParseEmailVerifyToken(secret, id)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if got != "user-123" {
		t.Fatalf("subject = %q, want user-123", got)
	}
}

func TestEmailVerifyTokenRejectsExpired(t *testing.T) {
	secret := "test-secret-at-least-32-characters-long"
	tok, err := IssueEmailVerifyToken(secret, "user-1", -time.Minute)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if _, err := ParseEmailVerifyToken(secret, tok); err == nil {
		t.Fatal("expected expired token to be rejected")
	}
}

func TestEmailVerifyTokenRejectsWrongSecret(t *testing.T) {
	tok, _ := IssueEmailVerifyToken("secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "u", time.Hour)
	if _, err := ParseEmailVerifyToken("secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", tok); err == nil {
		t.Fatal("expected wrong-secret token to be rejected")
	}
}

// An access token must not be usable as an email-verification token (different
// audience), even though both are signed with the same secret.
func TestAccessTokenIsNotAVerifyToken(t *testing.T) {
	secret := "test-secret-at-least-32-characters-long"
	access, _, err := IssueToken(secret, "user-1", "u@example.com", time.Hour)
	if err != nil {
		t.Fatalf("issue access: %v", err)
	}
	if _, err := ParseEmailVerifyToken(secret, access); err == nil {
		t.Fatal("access token must not parse as a verify token")
	}
	// And vice versa.
	verify, _ := IssueEmailVerifyToken(secret, "user-1", time.Hour)
	if _, err := ParseToken(secret, verify); err == nil {
		t.Fatal("verify token must not parse as an access token")
	}
}
