package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "this-is-a-sufficiently-long-test-secret-value"

func TestIssueAndParseToken(t *testing.T) {
	token, expiresAt, err := IssueToken(testSecret, "user-123", "u@example.com", time.Hour)
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}
	if !expiresAt.After(time.Now()) {
		t.Fatalf("expiresAt should be in the future, got %v", expiresAt)
	}

	claims, err := ParseToken(testSecret, token)
	if err != nil {
		t.Fatalf("ParseToken: %v", err)
	}
	if claims.UserID != "user-123" {
		t.Errorf("UserID = %q, want user-123", claims.UserID)
	}
	if claims.Email != "u@example.com" {
		t.Errorf("Email = %q, want u@example.com", claims.Email)
	}
}

func TestParseTokenWrongSecret(t *testing.T) {
	token, _, err := IssueToken(testSecret, "user-123", "u@example.com", time.Hour)
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}
	if _, err := ParseToken("a-different-secret-that-is-also-long-enough", token); err == nil {
		t.Fatal("expected error parsing token signed with a different secret")
	}
}

// A token minted for another service (no matching iss/aud) must be rejected
// even when it is signed with the same secret.
func TestParseTokenRejectsMissingIssuerAudience(t *testing.T) {
	other := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{
		UserID: "user-123",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-123",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	signed, err := other.SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if _, err := ParseToken(testSecret, signed); err == nil {
		t.Fatal("expected error for token without issuer/audience")
	}
}
