package models

import "testing"

func TestSetGetDB(t *testing.T) {
	SetDB(nil)
	if GetDB() != nil {
		t.Fatal("expected nil db")
	}
}
