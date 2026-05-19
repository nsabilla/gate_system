package rfq

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/mux"

	"projectrfqv1/app/controllers/auth"
)

func TestGetPFSTemplate_UnknownTypeFallsBackToForging(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/rfqs/1/pfs/template?type=unknown", nil)
	rr := httptest.NewRecorder()

	GetPFSTemplate(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown type fallback to forging, got %d; body=%s", rr.Code, rr.Body.String())
	}
}

func TestGetPFSTemplate_ToolsetRequiresAuth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/rfqs/1/pfs/template?type=toolset", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	rr := httptest.NewRecorder()

	GetPFSTemplate(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for toolset without auth, got %d; body=%s", rr.Code, rr.Body.String())
	}
}

func TestGetPFSBundle_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	rfqID := int64(7)
	userid := "u1"

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_ov", "line_fg").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_ov", "target_price_fg").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_ov", "line_mc").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_ov", "target_price_mc").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))

	mock.ExpectQuery("SELECT rfq_id, rej_fg, rej_mc, eff_fg, eff_mc, line_fg, target_price_fg, line_mc, target_price_mc").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"rfq_id", "rej_fg", "rej_mc", "eff_fg", "eff_mc", "line_fg", "target_price_fg", "line_mc", "target_price_mc"}).
			AddRow(rfqID, 1.1, 2.2, 95.5, 93.2, "L1", 1000.0, "L2", 900.0))

	mock.ExpectQuery("SELECT id, rfq_id, item_type, mat_grade, dia,").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "rfq_id", "item_type", "mat_grade", "dia", "target_date", "remark"}).
			AddRow(1, rfqID, "rm", "S45C", 12.5, "2026-03-10", "ok"))

	mock.ExpectExec(`CREATE TABLE IF NOT EXISTS pfs_pe \(`).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_pe", "process_name").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_pe", "cycle_time").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_pe", "machine_existing").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_pe", "machine_new").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_pe", "dies_price_pcs").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_pe", "load_cap_old").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_pe", "load_cap_invest").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_pe", "load_cap_new").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_pe", "load_cap_total").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_pe", "remark").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))

	mock.ExpectQuery("SELECT id, rfq_id, process_name, cycle_time, machine_existing, machine_new,").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "rfq_id", "process_name", "cycle_time", "machine_existing", "machine_new", "dies_price_pcs", "load_cap_old", "load_cap_invest", "load_cap_new", "load_cap_total", "remark"}).
			AddRow(1, rfqID, "Forging", 12.5, "M1", "M2", 100.0, 1.0, 2.0, 3.0, 6.0, "ok"))

	mock.ExpectQuery("SELECT rfq_id, prod_w, rm_w, mat_grade, dia, length_mm, yield_pct, cut_qty, rm_plus_rem, remark").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"rfq_id", "prod_w", "rm_w", "mat_grade", "dia", "length_mm", "yield_pct", "cut_qty", "rm_plus_rem", "remark"}).
			AddRow(rfqID, 100.0, 120.0, "SKD11", 10.0, 500.0, 90.0, 3, 5.0, "test"))

	mock.ExpectQuery("SELECT id, rfq_id, inv_type, machine, qty, qty_pack, unit_price, total_inv,").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "rfq_id", "inv_type", "machine", "qty", "qty_pack", "unit_price", "total_inv", "depr_year", "power_kwh", "area_m2", "manpower", "sim_line"}).
			AddRow(1, rfqID, "support", "Press", 1, 1, 1000, 1000, 5, 10, 20, 2, "A"))

	mock.ExpectQuery("SELECT rfq_id, tot_support, tot_other, grand_total").
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"rfq_id", "tot_support", "tot_other", "grand_total"}).
			AddRow(rfqID, 1000.0, 500.0, 1500.0))

	req := httptest.NewRequest(http.MethodGet, "/rfqs/7/pfs", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "7"})
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	auth.ValidateMiddleware(GetPFSBundle)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	resp := decodeJSONBody(t, rr)
	if ok, _ := resp["status"].(bool); !ok {
		t.Fatalf("expected status=true; resp=%v", resp)
	}
	if _, exists := resp["data"]; !exists {
		t.Fatalf("expected data field; resp=%v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestUpsertPFSOverview_InsertWhenMissing(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	rfqID := int64(7)
	userid := "u1"

	mock.ExpectQuery(`SELECT status FROM rfq WHERE id = \? LIMIT 1`).
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("approved"))

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_ov", "line_fg").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_ov", "target_price_fg").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_ov", "line_mc").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? AND COLUMN_NAME = \?`).
		WithArgs("pfs_ov", "target_price_mc").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))

	mock.ExpectQuery(`SELECT id FROM pfs_ov WHERE rfq_id = \? ORDER BY id DESC LIMIT 1`).
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	mock.ExpectExec(`INSERT INTO pfs_ov \(rfq_id, rej_fg, rej_mc, eff_fg, eff_mc, line_fg, target_price_fg, line_mc, target_price_mc\)`).
		WithArgs(rfqID, 1.5, 2.5, 95.0, 94.0, nil, nil, nil, nil).
		WillReturnResult(sqlmock.NewResult(1, 1))

	body := map[string]any{
		"rej_fg": 1.5,
		"rej_mc": 2.5,
		"eff_fg": 95.0,
		"eff_mc": 94.0,
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, "/rfqs/7/pfs/overview", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "7"})
	withAccessCookie(req, makeAccessToken(t, userid, "engineering"))
	rr := httptest.NewRecorder()

	auth.ValidateMiddleware(UpsertPFSOverview)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	resp := decodeJSONBody(t, rr)
	if ok, _ := resp["status"].(bool); !ok {
		t.Fatalf("expected status=true; resp=%v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestReplacePFSProcessPlan_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	rfqID := int64(9)
	userid := "u2"

	mock.ExpectQuery(`SELECT status FROM rfq WHERE id = \? LIMIT 1`).
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("approved"))

	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM pfs_pp WHERE rfq_id = \?`).
		WithArgs(rfqID).
		WillReturnResult(sqlmock.NewResult(0, 2))

	mock.ExpectExec(`INSERT INTO pfs_pp \(rfq_id, item_type, mat_grade, dia, target_date, remark\)`).
		WithArgs(rfqID, "rm", "S45C", 18.5, "2026-03-31", "raw material").
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectExec(`INSERT INTO pfs_pp \(rfq_id, item_type, mat_grade, dia, target_date, remark\)`).
		WithArgs(rfqID, "die", "DC53", 20.0, driver.Value(nil), "die schedule").
		WillReturnResult(sqlmock.NewResult(2, 1))

	mock.ExpectCommit()

	body := map[string]any{
		"items": []map[string]any{
			{
				"item_type":   "rm",
				"mat_grade":   "S45C",
				"dia":         18.5,
				"target_date": "2026-03-31",
				"remark":      "raw material",
			},
			{
				"item_type": "die",
				"mat_grade": "DC53",
				"dia":       20.0,
				"remark":    "die schedule",
			},
		},
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, "/rfqs/9/pfs/process-plan", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "9"})
	withAccessCookie(req, makeAccessToken(t, userid, "engineering"))
	rr := httptest.NewRecorder()

	auth.ValidateMiddleware(ReplacePFSProcessPlan)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	resp := decodeJSONBody(t, rr)
	if ok, _ := resp["status"].(bool); !ok {
		t.Fatalf("expected status=true; resp=%v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestUpsertPFSOverview_RequiresApprovedStatus(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	rfqID := int64(7)
	userid := "u1"

	mock.ExpectQuery(`SELECT status FROM rfq WHERE id = \? LIMIT 1`).
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("draft"))

	body := map[string]any{
		"rej_fg": 1.5,
		"rej_mc": 2.5,
		"eff_fg": 95.0,
		"eff_mc": 94.0,
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, "/rfqs/7/pfs/overview", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "7"})
	withAccessCookie(req, makeAccessToken(t, userid, "engineering"))
	rr := httptest.NewRecorder()

	auth.ValidateMiddleware(UpsertPFSOverview)(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d; body=%s", rr.Code, rr.Body.String())
	}

	resp := decodeJSONBody(t, rr)
	if ok, _ := resp["status"].(bool); ok {
		t.Fatalf("expected status=false; resp=%v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestUpsertPFSOverview_ForbiddenForNonEngineering(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"

	body := map[string]any{
		"rej_fg": 1.5,
		"rej_mc": 2.5,
		"eff_fg": 95.0,
		"eff_mc": 94.0,
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, "/rfqs/7/pfs/overview", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "7"})
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	auth.ValidateMiddleware(UpsertPFSOverview)(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d; body=%s", rr.Code, rr.Body.String())
	}

	resp := decodeJSONBody(t, rr)
	if ok, _ := resp["status"].(bool); ok {
		t.Fatalf("expected status=false; resp=%v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestUpsertPFSTimeFrame_OK_WhenApproverLevelIs2(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userID := "eng-approve-2"
	rfqID := int64(7)
	expectApproverProfileQuery(mock, userID, "Level2 User", "Approved & Checked", 2, 1, 1)
	mock.ExpectQuery(`SELECT status FROM rfq WHERE id = \? LIMIT 1`).
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("approved"))
	mock.ExpectQuery(`SELECT CAST\(statusactivity AS CHAR\) AS code_act FROM rfq WHERE id = \? LIMIT 1`).
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"code_act"}).AddRow("3"))
	mock.ExpectExec(`INSERT INTO rfq_activity_log`).
		WithArgs(rfqID, "PFS_L2_APPROVED", "PFS Approval Level 2", "", userID).
		WillReturnResult(sqlmock.NewResult(1, 1))

	body := map[string]any{
		"statusactivity": "4",
		"remarks":        "approve step",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, "/rfqs/7/pfs/timeframe", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "7"})
	withAccessCookie(req, makeAccessToken(t, userID, "engineering"))
	rr := httptest.NewRecorder()

	auth.ValidateMiddleware(UpsertPFSTimeFrame)(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}

	resp := decodeJSONBody(t, rr)
	if ok, _ := resp["status"].(bool); !ok {
		t.Fatalf("expected status=true; resp=%v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}
