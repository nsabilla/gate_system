package auth

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLogin_InvalidBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewBufferString("{"))
	res := httptest.NewRecorder()

	Login(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
}

func TestLogin_MissingCredentials(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewBufferString(`{"userid":"","password":""}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()

	Login(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
}

func TestLogout_ClearsCookies(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/logout", nil)
	res := httptest.NewRecorder()

	Logout(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}

	cookies := res.Result().Cookies()
	if len(cookies) < 2 {
		t.Fatalf("expected at least 2 cookies, got %d", len(cookies))
	}
}
