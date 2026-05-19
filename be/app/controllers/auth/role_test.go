package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequireRole_ForbiddenWhenNoRoleInContext(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	res := httptest.NewRecorder()

	RequireRole("admin")(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestRequireRole_AllowsMatchingRole(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	ctx := context.WithValue(req.Context(), userIDKey, "u1")
	ctx = context.WithValue(ctx, userRoleKey, "admin")
	req = req.WithContext(ctx)
	res := httptest.NewRecorder()

	RequireRole("admin")(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
}
