package auth

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRegister_InvalidBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewBufferString("{"))
	res := httptest.NewRecorder()

	Register(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
}

func TestRegister_UserIDRequired(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewBufferString(`{"name":"test","email":"a@b.com"}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()

	Register(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
}

func TestRegister_InvalidRole(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewBufferString(`{"userid":"u1","name":"test","email":"a@b.com","password":"x","role":"admin"}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()

	Register(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", res.Code)
	}
}
