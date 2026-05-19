package rfq

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"projectrfqv1/app/controllers/auth"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/mux"
)

// TestDashboardMainActivityGetHandler tests the dashboard endpoint
func TestDashboardMainActivityGetHandler(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	token := makeAccessToken(t, "testuser", "marketing")

	// Test successful fetch
	t.Run("success", func(t *testing.T) {
		masterRows := sqlmock.NewRows([]string{"code_act", "descr"}).
			AddRow("0", "BusinessApproach").
			AddRow("1", "Feasibility Study")

		mock.ExpectQuery("SELECT code_act, descr FROM rfq_activity").
			WillReturnRows(masterRows)

		planRows := sqlmock.NewRows([]string{"id", "rfq_id", "activity_code", "activity_name", "pic_userid", "name", "role", "target_date", "start_date", "end_date", "remarks"}).
			AddRow(int64(10), int64(1), "0", "BusinessApproach", "EMP00123", "Marketing User", "marketing", "2026-02-20", "2026-02-01", "2026-03-15", "ytest")

		mock.ExpectQuery("SELECT p.id, p.rfq_id, p.activity_code, a.descr as activity_name").
			WithArgs(int64(1)).
			WillReturnRows(planRows)

		roleRows := sqlmock.NewRows([]string{"rolename", "rolecode"}).
			AddRow("marketing", "MKT")

		mock.ExpectQuery("SELECT LOWER\\(rolename\\) AS rolename, rolecode FROM rolecode").
			WillReturnRows(roleRows)

		req := httptest.NewRequest("GET", "/api/rfqs/1/dashboard-activity", nil)
		req = mux.SetURLVars(req, map[string]string{"id": "1"})
		req.AddCookie(&http.Cookie{Name: "access_token", Value: token})

		w := httptest.NewRecorder()
		h := auth.ValidateMiddleware(DashboardMainActivityGetHandler)
		h(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected 200, got %d; body=%s", w.Code, w.Body.String())
		}
	})

	// Test invalid RFQ ID
	t.Run("invalid_rfq_id", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/rfqs/invalid/dashboard-activity", nil)
		req = mux.SetURLVars(req, map[string]string{"id": "invalid"})
		req.AddCookie(&http.Cookie{Name: "access_token", Value: token})

		w := httptest.NewRecorder()
		h := auth.ValidateMiddleware(DashboardMainActivityGetHandler)
		h(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected 400, got %d; body=%s", w.Code, w.Body.String())
		}
	})

	// Regression: plan data should still appear when master activity is empty
	t.Run("plan_only_data", func(t *testing.T) {
		masterRows := sqlmock.NewRows([]string{"code_act", "descr"})

		mock.ExpectQuery("SELECT code_act, descr FROM rfq_activity").
			WillReturnRows(masterRows)

		planRows := sqlmock.NewRows([]string{"id", "rfq_id", "activity_code", "activity_name", "pic_userid", "name", "role", "target_date", "start_date", "end_date", "remarks"}).
			AddRow(int64(22), int64(1), "99", "Special Activity", "EMP00234", "Plan User", "marketing", "2026-02-20", "2026-02-01", "2026-03-15", "plan-only")

		mock.ExpectQuery("SELECT p.id, p.rfq_id, p.activity_code, a.descr as activity_name").
			WithArgs(int64(1)).
			WillReturnRows(planRows)

		roleRows := sqlmock.NewRows([]string{"rolename", "rolecode"}).
			AddRow("marketing", "MKT")

		mock.ExpectQuery("SELECT LOWER\\(rolename\\) AS rolename, rolecode FROM rolecode").
			WillReturnRows(roleRows)

		req := httptest.NewRequest("GET", "/api/rfqs/1/dashboard-activity", nil)
		req = mux.SetURLVars(req, map[string]string{"id": "1"})
		req.AddCookie(&http.Cookie{Name: "access_token", Value: token})

		w := httptest.NewRecorder()
		h := auth.ValidateMiddleware(DashboardMainActivityGetHandler)
		h(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected 200, got %d; body=%s", w.Code, w.Body.String())
			return
		}

		var body map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("Failed to parse response body: %v", err)
		}

		data, ok := body["data"].([]interface{})
		if !ok {
			t.Fatalf("Expected data array in response, got: %T", body["data"])
		}

		if len(data) == 0 {
			t.Fatalf("Expected at least one row from plan-only data, got 0")
		}

		first, ok := data[0].(map[string]interface{})
		if !ok {
			t.Fatalf("Expected first row as object, got: %T", data[0])
		}

		if got := first["code_act"]; got != "99" {
			t.Fatalf("Expected code_act=99, got=%v", got)
		}
		if got := first["activity_name"]; got != "Special Activity" {
			t.Fatalf("Expected activity_name=Special Activity, got=%v", got)
		}
	})

	// Regression: numeric code from DB should still map and return row
	t.Run("numeric_activity_code", func(t *testing.T) {
		masterRows := sqlmock.NewRows([]string{"code_act", "descr"}).
			AddRow(1, "Feasibility Study")

		mock.ExpectQuery("SELECT code_act, descr FROM rfq_activity").
			WillReturnRows(masterRows)

		planRows := sqlmock.NewRows([]string{"id", "rfq_id", "activity_code", "activity_name", "pic_userid", "name", "role", "target_date", "start_date", "end_date", "remarks"}).
			AddRow(int64(11), int64(1), 1, "Feasibility Study", "EMP00123", "Marketing User", "marketing", "2026-02-20", "2026-02-01", "2026-03-15", "numeric-code")

		mock.ExpectQuery("SELECT p.id, p.rfq_id, p.activity_code, a.descr as activity_name").
			WithArgs(int64(1)).
			WillReturnRows(planRows)

		roleRows := sqlmock.NewRows([]string{"rolename", "rolecode"}).
			AddRow("marketing", "MKT")

		mock.ExpectQuery("SELECT LOWER\\(rolename\\) AS rolename, rolecode FROM rolecode").
			WillReturnRows(roleRows)

		req := httptest.NewRequest("GET", "/api/rfqs/1/dashboard-activity", nil)
		req = mux.SetURLVars(req, map[string]string{"id": "1"})
		req.AddCookie(&http.Cookie{Name: "access_token", Value: token})

		w := httptest.NewRecorder()
		h := auth.ValidateMiddleware(DashboardMainActivityGetHandler)
		h(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected 200, got %d; body=%s", w.Code, w.Body.String())
			return
		}

		var body map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("Failed to parse response body: %v", err)
		}

		data, ok := body["data"].([]interface{})
		if !ok || len(data) == 0 {
			t.Fatalf("Expected non-empty data array, got: %T len=%d", body["data"], len(data))
		}

		first, ok := data[0].(map[string]interface{})
		if !ok {
			t.Fatalf("Expected first row as object, got: %T", data[0])
		}

		if got := first["code_act"]; got != "1" {
			t.Fatalf("Expected code_act=1, got=%v", got)
		}
	})
}
