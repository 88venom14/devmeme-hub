package httpapi

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

// Server-side field limits. The frontend enforces its own (UX) limits; these
// are the authoritative caps so a non-browser client cannot store oversized
// content. They are intentionally a bit more lenient than the UI.
const (
	maxPostDescription = 2000
	maxPostContent     = 20000
	maxURLLen          = 2000
	maxGithubURLLen    = 1000
	maxDisplayName     = 100
	maxBio             = 1000
	maxProfileURLLen   = 500
)

// usernamePattern mirrors the profiles_username_format DB constraint and the
// frontend USERNAME_REGEX: starts alphanumeric, 2–31 chars of [a-z0-9_-].
var usernamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,30}$`)

// optionalTextErr returns a validation message if a non-nil optional string
// exceeds max runes; "" means valid. nil/empty is always allowed.
func optionalTextErr(field string, v *string, max int) string {
	if v == nil {
		return ""
	}
	if len([]rune(*v)) > max {
		return fmt.Sprintf("%s must be at most %d characters", field, max)
	}
	return ""
}

// optionalURLErr validates an optional http(s) URL within a length cap. nil or
// empty is allowed (the field is simply not set / cleared).
func optionalURLErr(field string, v *string, max int) string {
	if v == nil {
		return ""
	}
	trimmed := strings.TrimSpace(*v)
	if trimmed == "" {
		return ""
	}
	if len(trimmed) > max {
		return fmt.Sprintf("%s is too long (max %d characters)", field, max)
	}
	u, err := url.Parse(trimmed)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return fmt.Sprintf("%s must be a valid http(s) URL", field)
	}
	return ""
}

// validateProfileField checks a single PATCH /profiles/me field value
// (already normalized for username). Returns "" when valid.
func validateProfileField(key string, v *string) string {
	switch key {
	case "username":
		if v != nil && !usernamePattern.MatchString(*v) {
			return "username must be 2–31 characters: lowercase letters, digits, - or _, starting with a letter or digit"
		}
	case "display_name":
		return optionalTextErr("display_name", v, maxDisplayName)
	case "bio":
		return optionalTextErr("bio", v, maxBio)
	case "avatar_url", "website_url", "github_url", "youtube_url", "twitch_url", "banner_url":
		return optionalURLErr(key, v, maxProfileURLLen)
	}
	return ""
}

// uuidPattern matches the canonical UUID text form. Used to reject malformed
// ids before they hit a uuid column (which would otherwise 500 on a cast error).
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func isUUID(s string) bool { return uuidPattern.MatchString(s) }

// likeEscaper escapes the LIKE/ILIKE metacharacters so a user-supplied term is
// matched literally (otherwise '%' or '_' in the query act as wildcards). It
// relies on Postgres's default backslash escape character.
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// escapeLike escapes wildcards in a term destined for a LIKE/ILIKE pattern.
func escapeLike(s string) string { return likeEscaper.Replace(s) }

// isConstraintViolation reports whether err is a Postgres CHECK violation
// (23514) or a value-too-long error (22001) — i.e. caused by the client's input
// rather than a server fault, so it should map to 400 not 500.
func isConstraintViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && (pgErr.Code == "23514" || pgErr.Code == "22001")
}
