package rfq

import (
	"net/http"
	"net/http/httptest"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"

	"projectrfqv1/app/controllers/auth"
)

func TestListActivityCodes_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"

	rows := sqlmock.NewRows([]string{"code_act", "descr"}).
		AddRow("0", "Business Approach")

	mock.ExpectQuery("SELECT\\s+code_act,\\s+descr\\s+FROM\\s+rfq_activity").
		WillReturnRows(rows)

	req := httptest.NewRequest(http.MethodGet, "/rfq-activities", nil)
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(ListActivityCodes)
	h(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}
