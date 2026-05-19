package rfq

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/mux"

	"projectrfqv1/app/controllers/auth"
)

func TestMasterActivityList_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"

	rows := sqlmock.NewRows([]string{"id", "code_act", "descr"}).
		AddRow(int64(1), "0", "Business Approach")

	mock.ExpectQuery("CALL sp_master_rfq_activity\\(").
		WithArgs("SELECT", nil, "", "", "").
		WillReturnRows(rows)

	req := httptest.NewRequest(http.MethodGet, "/rfq-activities/master", nil)
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(MasterActivityList))
	h(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestMasterActivityCreate_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"

	rows := sqlmock.NewRows([]string{"DebugQuery"}).
		AddRow("INSERT INTO rfq_activity ...")

	mock.ExpectQuery("CALL sp_master_rfq_activity\\(").
		WithArgs("INSERT", nil, "12", "Masspro", userid).
		WillReturnRows(rows)

	body := map[string]any{"code_act": "12", "descr": "Masspro"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/rfq-activities/master", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(MasterActivityCreate))
	h(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestMasterActivityUpdate_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"

	rows := sqlmock.NewRows([]string{"DebugQuery"}).
		AddRow("UPDATE rfq_activity ...")

	mock.ExpectQuery("CALL sp_master_rfq_activity\\(").
		WithArgs("UPDATE", int64(5), "5", "Quotation", userid).
		WillReturnRows(rows)

	body := map[string]any{"code_act": "5", "descr": "Quotation"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, "/rfq-activities/master/5", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "5"})
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(MasterActivityUpdate))
	h(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestMasterActivityDelete_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"

	rows := sqlmock.NewRows([]string{"DebugQuery"}).
		AddRow("DELETE FROM rfq_activity ...")

	mock.ExpectQuery("CALL sp_master_rfq_activity\\(").
		WithArgs("DELETE", int64(7), "", "", userid).
		WillReturnRows(rows)

	req := httptest.NewRequest(http.MethodDelete, "/rfq-activities/master/7", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "7"})
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(MasterActivityDelete))
	h(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}
