package auth

import (
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	_ = os.Setenv("JWT_SECRET", "unit-test-secret")
	os.Exit(m.Run())
}
