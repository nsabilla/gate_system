package models

import "testing"

func TestUserValidate(t *testing.T) {
	u := &User{Name: "", UserID: "", Email: "bad", AuthProvider: "local", Password: ""}
	if _, ok := u.Validate(); ok {
		t.Fatal("expected validation failure")
	}

	u = &User{Name: "A", UserID: "u1", Email: "a@b.com", AuthProvider: "local", Password: "123"}
	if _, ok := u.Validate(); !ok {
		t.Fatal("expected validation success")
	}
}
