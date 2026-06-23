package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// emailVerifyAudience pins email-verification tokens to a distinct audience so
// an access token can never be replayed as a verification token (and vice
// versa), even though both are signed with the same secret.
const emailVerifyAudience = "devmeme-hub-email-verify"

type emailVerifyClaims struct {
	jwt.RegisteredClaims
}

// IssueEmailVerifyToken mints a short-lived, single-purpose token that proves
// the holder controls the email tied to userID.
func IssueEmailVerifyToken(secret, userID string, ttl time.Duration) (string, error) {
	now := time.Now().UTC()
	claims := emailVerifyClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    TokenIssuer,
			Audience:  jwt.ClaimStrings{emailVerifyAudience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseEmailVerifyToken validates an email-verification token and returns the
// user ID it was issued for.
func ParseEmailVerifyToken(secret, raw string) (string, error) {
	claims := emailVerifyClaims{}
	token, err := jwt.ParseWithClaims(raw, &claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected token signing method")
		}
		return []byte(secret), nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(TokenIssuer),
		jwt.WithAudience(emailVerifyAudience),
	)
	if err != nil {
		return "", err
	}
	if !token.Valid || claims.Subject == "" {
		return "", errors.New("invalid email verification token")
	}
	return claims.Subject, nil
}
