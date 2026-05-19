package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
)

func makeAccessTokenForTest(t *testing.T, userid, role string) string {
	t.Helper()
	secret, err := jwtSecretBytes()
	if err != nil {
		t.Fatalf("secret: %v", err)
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userid": userid,
		"role":   role,
		"type":   "access",
		"exp":    time.Now().Add(10 * time.Minute).Unix(),
	}).SignedString(secret)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return token
}

func TestValidateMiddleware_UnauthorizedWhenCookieMissing(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	res := httptest.NewRecorder()

	ValidateMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestValidateMiddleware_PassesContextWhenTokenValid(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: makeAccessTokenForTest(t, "u1", "marketing")})
	res := httptest.NewRecorder()

	called := false
	ValidateMiddleware(func(w http.ResponseWriter, r *http.Request) {
		called = true
		uid, ok := GetUserID(r)
		if !ok || uid != "u1" {
			t.Fatalf("unexpected userid: %q, ok=%v", uid, ok)
		}
		role, ok := GetUserRole(r)
		if !ok || role != "marketing" {
			t.Fatalf("unexpected role: %q, ok=%v", role, ok)
		}
		w.WriteHeader(http.StatusOK)
	})(res, req)

	if !called {
		t.Fatal("next handler was not called")
	}
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
}
