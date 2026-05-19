package utils

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMessage(t *testing.T) {
	msg := Message(true, "ok")
	if msg["status"] != true || msg["message"] != "ok" {
		t.Fatalf("unexpected message map: %#v", msg)
	}
}

func TestRespondWithStatus(t *testing.T) {
	rr := httptest.NewRecorder()
	RespondWithStatus(rr, http.StatusCreated, Message(true, "created"))

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr.Code)
	}
	if got := rr.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("unexpected content type: %q", got)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if payload["message"] != "created" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}
