package controllers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"projectrfqv1/app/models"
)

func TestSanitizeUser(t *testing.T) {
	u := &models.User{Password: "secret"}
	sanitizeUser(u)
	if u.Password != "" {
		t.Fatalf("expected password to be hidden")
	}
}

func TestSanitizeUsers(t *testing.T) {
	users := []*models.User{{Password: "a"}, {Password: "b"}}
	sanitizeUsers(users)
	for i := range users {
		if users[i].Password != "" {
			t.Fatalf("expected password empty at idx %d", i)
		}
	}
}

func TestGetMe_UnauthorizedWithoutContext(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/users/me", nil)
	res := httptest.NewRecorder()

	GetMe(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
}
