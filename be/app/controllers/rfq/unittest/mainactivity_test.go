package rfq

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/mux"

	"projectrfqv1/app/controllers/auth"
)

func TestGetMainActivity_ByRFQNo_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"
	rfqNo := "RFQ-20260215075526"

	rows := sqlmock.NewRows([]string{"id", "rfq_no", "title"}).
		AddRow(int64(1), rfqNo, "Test")

	mock.ExpectQuery("CALL sp_mainactivity\\(").
		WithArgs(
			"SELECT",
			nil,
			rfqNo,
			"",
			"",
			"",
			"",
			"",
		).
		WillReturnRows(rows)

	req := httptest.NewRequest(http.MethodGet, "/rfqs/mainactivity?rfq_no="+rfqNo, nil)
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(GetMainActivity)
	h(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}
	resp := decodeJSONBody(t, rr)
	if ok, _ := resp["status"].(bool); !ok {
		t.Fatalf("expected status=true; resp=%v", resp)
	}
	if _, ok := resp["data"]; !ok {
		t.Fatalf("expected data field; resp=%v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestGetTimeline_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"
	rfqID := int64(1)

	rows := sqlmock.NewRows([]string{"activity_name", "remarks"}).
		AddRow("Created", "-")

	mock.ExpectQuery("CALL sp_mainactivity\\(").
		WithArgs(
			"GET_TIMELINE",
			rfqID,
			"",
			"",
			"",
			"",
			"",
			"",
		).
		WillReturnRows(rows)

	req := httptest.NewRequest(http.MethodGet, "/rfqs/1/timeline", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(GetTimeline)
	h(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestMoveActivity_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"
	rfqID := int64(1)
	statusAct := "3"
	remarks := "ok"
	targetDate := "2026-03-20"

	mock.ExpectQuery("SELECT CAST\\(statusactivity AS CHAR\\) AS code_act FROM rfq WHERE id = \\? LIMIT 1").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"code_act"}).AddRow("2"))

	mock.ExpectQuery("SELECT activity_code, target_date").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"activity_code", "target_date"}).AddRow("2", time.Date(2026, 3, 10, 0, 0, 0, 0, time.Local)))

	// We don't care about the debug result sets; handler drains them.
	rows := sqlmock.NewRows([]string{"DebugQuery"}).AddRow("UPDATE rfq ...")

	mock.ExpectQuery("CALL sp_mainactivity\\(").
		WithArgs(
			"MOVE_ACTIVITY",
			rfqID,
			"",
			"",
			userid,
			"",
			statusAct,
			remarks,
		).
		WillReturnRows(rows)

	mock.ExpectQuery("SELECT id,").
		WithArgs(rfqID, statusAct).
		WillReturnRows(sqlmock.NewRows([]string{"id", "remarks", "target_date", "start_date", "end_date"}).AddRow(
			int64(11),
			"existing plan",
			time.Date(2026, 3, 10, 0, 0, 0, 0, time.Local),
			time.Date(2026, 3, 10, 0, 0, 0, 0, time.Local),
			time.Date(2026, 3, 10, 0, 0, 0, 0, time.Local),
		))

	mock.ExpectExec("UPDATE rfq_activity_plan SET").
		WithArgs(
			userid,
			remarks,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			userid,
			int64(11),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	body := map[string]any{"statusactivity": statusAct, "remarks": remarks, "target_date": targetDate}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/rfqs/1/activity/move", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(MoveActivity))
	h(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestMoveActivity_RejectWhenNextTargetDateNotGreater(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"
	rfqID := int64(1)

	mock.ExpectQuery("SELECT CAST\\(statusactivity AS CHAR\\) AS code_act FROM rfq WHERE id = \\? LIMIT 1").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"code_act"}).AddRow("1"))

	mock.ExpectQuery("SELECT activity_code, target_date").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"activity_code", "target_date"}).AddRow("1", time.Date(2026, 3, 20, 0, 0, 0, 0, time.Local)))

	body := map[string]any{"statusactivity": "2", "remarks": "next", "target_date": "2026-03-20"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/rfqs/1/activity/move", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(MoveActivity))
	h(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestMoveActivity_RejectWhenSkippingOrder(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"
	rfqID := int64(1)

	mock.ExpectQuery("SELECT CAST\\(statusactivity AS CHAR\\) AS code_act FROM rfq WHERE id = \\? LIMIT 1").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"code_act"}).AddRow("1"))

	body := map[string]any{"statusactivity": "3", "remarks": "skip"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/rfqs/1/activity/move", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(MoveActivity))
	h(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestMoveActivity_RejectWhenInitialCodeNotZero(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"
	rfqID := int64(1)

	mock.ExpectQuery("SELECT CAST\\(statusactivity AS CHAR\\) AS code_act FROM rfq WHERE id = \\? LIMIT 1").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"code_act"}).AddRow(""))

	body := map[string]any{"statusactivity": "1", "remarks": "first should be 0", "target_date": "2026-03-10"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/rfqs/1/activity/move", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(MoveActivity))
	h(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestMoveActivity_SameCodeUpdatesPlanOnly(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"
	rfqID := int64(1)
	statusAct := "2"
	remarks := "update-only"

	mock.ExpectQuery("SELECT CAST\\(statusactivity AS CHAR\\) AS code_act FROM rfq WHERE id = \\? LIMIT 1").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"code_act"}).AddRow("2"))

	mock.ExpectQuery("SELECT id,").
		WithArgs(rfqID, statusAct).
		WillReturnRows(sqlmock.NewRows([]string{"id", "remarks", "target_date", "start_date", "end_date"}).AddRow(
			int64(11),
			"existing plan",
			time.Date(2026, 3, 20, 0, 0, 0, 0, time.Local),
			time.Date(2026, 3, 20, 0, 0, 0, 0, time.Local),
			time.Date(2026, 3, 20, 0, 0, 0, 0, time.Local),
		))

	mock.ExpectExec("UPDATE rfq_activity_plan SET").
		WithArgs(
			userid,
			remarks,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			userid,
			int64(11),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	body := map[string]any{"statusactivity": statusAct, "remarks": remarks}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/rfqs/1/activity/move", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(MoveActivity))
	h(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestMoveActivity_RejectWhenMovingToActivity4ButNotApproved(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"
	rfqID := int64(1)

	mock.ExpectQuery("SELECT CAST\\(statusactivity AS CHAR\\) AS code_act FROM rfq WHERE id = \\? LIMIT 1").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"code_act"}).AddRow("3"))

	mock.ExpectQuery("SELECT status FROM rfq WHERE id = \\? LIMIT 1").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("draft"))

	body := map[string]any{"statusactivity": "4", "remarks": "try", "target_date": "2026-03-30"}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/rfqs/1/activity/move", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(MoveActivity))
	h(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d; body=%s", rr.Code, rr.Body.String())
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}
