package oauth

import "testing"

func TestSanitizeUsername(t *testing.T) {
	cases := map[string]string{
		"Octocat":        "octocat",
		"my-cool.name":   "mycoolname",
		"__weird__":      "weird",
		"Ünîcødé99":      "ncd99", // non-ASCII dropped, ASCII letters/digits kept
		"a.b_c-d":        "ab_cd",
		"UPPER_lower_42": "upper_lower_42",
	}
	for in, want := range cases {
		if got := SanitizeUsername(in); got != want {
			t.Errorf("SanitizeUsername(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestStateSignVerify(t *testing.T) {
	const secret = "test-secret-at-least-32-characters-long"
	state := "abc123." + SignState(secret, "abc123")
	if !VerifyState(secret, state) {
		t.Fatal("valid state should verify")
	}
	if VerifyState(secret, "abc123.tampered") {
		t.Fatal("tampered signature must not verify")
	}
	if VerifyState(secret, "abc123") {
		t.Fatal("state without signature must not verify")
	}
	if VerifyState(secret, "") {
		t.Fatal("empty state must not verify")
	}
	// A signature for a different nonce must not validate.
	if VerifyState(secret, "xyz."+SignState(secret, "abc123")) {
		t.Fatal("signature bound to a different nonce must not verify")
	}
}
