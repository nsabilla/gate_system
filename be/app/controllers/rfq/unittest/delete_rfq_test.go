package rfq

import (
	"net/http"
	"net/http/httptest"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/mux"

	"projectrfqv1/app/controllers/auth"
)

func TestDeleteRFQ_UnauthorizedWhenNoToken(t *testing.T) {
	req := httptest.NewRequest(http.MethodDelete, "/rfqs/1", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	res := httptest.NewRecorder()

	DeleteRFQ(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestDeleteRFQ_InvalidID(t *testing.T) {
	req := httptest.NewRequest(http.MethodDelete, "/rfqs/x", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "x"})
	withAccessCookie(req, makeAccessToken(t, "u1", "marketing"))
	res := httptest.NewRecorder()

	auth.ValidateMiddleware(DeleteRFQ)(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", res.Code)
	}
}

func TestDeleteRFQ_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	rfqID := int64(17)

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM rfq_detail WHERE rfq_id = \?`).
		WithArgs(rfqID).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec(`DELETE FROM rfq_activity_log WHERE rfq_id = \?`).
		WithArgs(rfqID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`DELETE FROM rfq_activity_log WHERE TRIM\(CAST\(rfq_id AS CHAR\)\) = \?`).
		WithArgs("17").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM rfq_activity_log WHERE TRIM\(CAST\(rfq_id AS CHAR\)\) = \?`).
		WithArgs("17").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectExec(`DELETE FROM rfq WHERE id = \?`).
		WithArgs(rfqID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	req := httptest.NewRequest(http.MethodDelete, "/rfqs/17", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "17"})
	withAccessCookie(req, makeAccessToken(t, "u1", "marketing"))
	res := httptest.NewRecorder()

	auth.ValidateMiddleware(DeleteRFQ)(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", res.Code, res.Body.String())
	}

	resp := decodeJSONBody(t, res)
	if ok, _ := resp["status"].(bool); !ok {
		t.Fatalf("expected status=true; resp=%v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}
