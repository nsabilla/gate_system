package rfq

import (
	"strconv"
	"strings"
	"testing"
)

func nullIfEmpty(v string) interface{} {
	if v == "" {
		return nil
	}
	return v
}

func normalizeRFQStatusFilter(v string) string {
	raw := strings.ToLower(strings.TrimSpace(v))
	switch raw {
	case "draft", "pending", "submitted", "approved":
		return raw
	default:
		return ""
	}
}

func parseRFQID(value interface{}) (int64, bool) {
	switch v := value.(type) {
	case int64:
		return v, v > 0
	case int32:
		id := int64(v)
		return id, id > 0
	case int:
		id := int64(v)
		return id, id > 0
	case float64:
		id := int64(v)
		if float64(id) != v || id <= 0 {
			return 0, false
		}
		return id, true
	case float32:
		id := int64(v)
		if float32(id) != v || id <= 0 {
			return 0, false
		}
		return id, true
	case uint64:
		if v == 0 {
			return 0, false
		}
		return int64(v), true
	case uint32:
		if v == 0 {
			return 0, false
		}
		return int64(v), true
	case uint:
		if v == 0 {
			return 0, false
		}
		return int64(v), true
	case []byte:
		id, err := strconv.ParseInt(string(v), 10, 64)
		if err != nil || id <= 0 {
			return 0, false
		}
		return id, true
	case string:
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil || id <= 0 {
			return 0, false
		}
		return id, true
	default:
		return 0, false
	}
}

func TestNullIfEmpty(t *testing.T) {
	if got := nullIfEmpty(""); got != nil {
		t.Fatalf("expected nil, got %#v", got)
	}
	if got := nullIfEmpty("draft"); got != "draft" {
		t.Fatalf("expected draft, got %#v", got)
	}
}

func TestNormalizeRFQStatusFilter(t *testing.T) {
	cases := []struct {
		name   string
		input  string
		output string
	}{
		{name: "draft exact", input: "draft", output: "draft"},
		{name: "pending trimmed", input: " Pending ", output: "pending"},
		{name: "submitted upper", input: "SUBMITTED", output: "submitted"},
		{name: "approved mixed", input: "ApPrOvEd", output: "approved"},
		{name: "unknown", input: "rejected", output: ""},
		{name: "empty", input: "", output: ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizeRFQStatusFilter(tc.input)
			if got != tc.output {
				t.Fatalf("expected %q, got %q", tc.output, got)
			}
		})
	}
}

func TestParseRFQID(t *testing.T) {
	cases := []struct {
		name   string
		input  interface{}
		ok     bool
		output int64
	}{
		{name: "int64", input: int64(10), ok: true, output: 10},
		{name: "string", input: "11", ok: true, output: 11},
		{name: "bytes", input: []byte("12"), ok: true, output: 12},
		{name: "float exact", input: float64(13), ok: true, output: 13},
		{name: "float non-integer", input: float64(13.5), ok: false, output: 0},
		{name: "zero", input: 0, ok: false, output: 0},
		{name: "invalid", input: "x", ok: false, output: 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := parseRFQID(tc.input)
			if ok != tc.ok || got != tc.output {
				t.Fatalf("expected (%v,%d), got (%v,%d)", tc.ok, tc.output, ok, got)
			}
		})
	}
}
