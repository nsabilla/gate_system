package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
)

func makeRefreshTokenForTest(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	secret, err := jwtSecretBytes()
	if err != nil {
		t.Fatalf("secret: %v", err)
	}
	if _, ok := claims["exp"]; !ok {
		claims["exp"] = time.Now().Add(10 * time.Minute).Unix()
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return token
}

func TestRefresh_MissingCookie(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/refresh", nil)
	res := httptest.NewRecorder()

	Refresh(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
}

func TestRefresh_InvalidTokenType(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/refresh", nil)
	token := makeRefreshTokenForTest(t, jwt.MapClaims{
		"userid": "u1",
		"type":   "access",
	})
	req.AddCookie(&http.Cookie{Name: "refresh_token", Value: token})
	res := httptest.NewRecorder()

	Refresh(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
}
