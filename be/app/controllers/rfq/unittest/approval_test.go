package rfq

import (
	"net/http"
	"net/http/httptest"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/mux"

	"projectrfqv1/app/controllers/auth"
)

func expectActiveApproverQuery(mock sqlmock.Sqlmock, userID string, total int64) {
	hasApproval := int64(0)
	if total > 0 {
		hasApproval = 1
	}
	mock.ExpectQuery(`SELECT.*COALESCE\(NULLIF\(TRIM\(u.userid\), ''\), TRIM\(\?\)\).*FROM users u.*LEFT JOIN rfq_approve a`).
		WithArgs(userID, userID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"userid", "approver_username", "badge_approval", "approver_level", "has_approval_row", "is_active"}).
			AddRow(userID, "Approver User", "Approved & Checked", 2, hasApproval, hasApproval))
}

func expectApproverProfileQuery(mock sqlmock.Sqlmock, userID, username, badge string, level int64, hasApproval, isActive int64) {
	mock.ExpectQuery(`SELECT.*COALESCE\(NULLIF\(TRIM\(u.userid\), ''\), TRIM\(\?\)\).*FROM users u.*LEFT JOIN rfq_approve a`).
		WithArgs(userID, userID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"userid", "approver_username", "badge_approval", "approver_level", "has_approval_row", "is_active"}).
			AddRow(userID, username, badge, level, hasApproval, isActive))
}

func TestApproveRFQ_OK_WhenCodeActIs3(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userID := "approver01"
	rfqID := int64(11)

	expectActiveApproverQuery(mock, userID, 1)
	mock.ExpectQuery(`SELECT status, CAST\(statusactivity AS CHAR\) AS code_act`).
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"status", "code_act"}).AddRow("submitted", "3"))

	req := httptest.NewRequest(http.MethodPost, "/rfqs/11/approve", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "11"})
	withAccessCookie(req, makeAccessToken(t, userID, "marketing"))
	res := httptest.NewRecorder()

	auth.ValidateMiddleware(ApproveRFQ)(res, req)

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

func TestApproveRFQ_Conflict_WhenLevel3BeforeLevel2(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userID := "approver03"
	rfqID := int64(11)

	expectApproverProfileQuery(mock, userID, "Level3 User", "Acknowledge", 3, 1, 1)
	mock.ExpectQuery(`SELECT status, CAST\(statusactivity AS CHAR\) AS code_act`).
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"status", "code_act"}).AddRow("submitted", "3"))

	req := httptest.NewRequest(http.MethodPost, "/rfqs/11/approve", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "11"})
	withAccessCookie(req, makeAccessToken(t, userID, "marketing"))
	res := httptest.NewRecorder()

	auth.ValidateMiddleware(ApproveRFQ)(res, req)

	if res.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d; body=%s", res.Code, res.Body.String())
	}

	resp := decodeJSONBody(t, res)
	if ok, _ := resp["status"].(bool); ok {
		t.Fatalf("expected status=false; resp=%v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestApproveRFQ_Conflict_WhenCodeActNot3(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userID := "approver01"
	rfqID := int64(12)

	expectActiveApproverQuery(mock, userID, 1)
	mock.ExpectQuery(`SELECT status, CAST\(statusactivity AS CHAR\) AS code_act`).
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"status", "code_act"}).AddRow("submitted", "2"))

	req := httptest.NewRequest(http.MethodPost, "/rfqs/12/approve", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "12"})
	withAccessCookie(req, makeAccessToken(t, userID, "marketing"))
	res := httptest.NewRecorder()

	auth.ValidateMiddleware(ApproveRFQ)(res, req)

	if res.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d; body=%s", res.Code, res.Body.String())
	}

	resp := decodeJSONBody(t, res)
	if ok, _ := resp["status"].(bool); ok {
		t.Fatalf("expected status=false; resp=%v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestApproveRFQ_AlreadyApproved(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userID := "approver01"
	rfqID := int64(13)

	expectActiveApproverQuery(mock, userID, 1)
	mock.ExpectQuery(`SELECT status, CAST\(statusactivity AS CHAR\) AS code_act`).
		WithArgs(rfqID).
		WillReturnRows(sqlmock.NewRows([]string{"status", "code_act"}).AddRow("approved", "3"))

	req := httptest.NewRequest(http.MethodPost, "/rfqs/13/approve", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "13"})
	withAccessCookie(req, makeAccessToken(t, userID, "marketing"))
	res := httptest.NewRecorder()

	auth.ValidateMiddleware(ApproveRFQ)(res, req)

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
