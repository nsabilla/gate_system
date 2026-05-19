package rfq

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"github.com/jinzhu/gorm"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
)

func TestMain(m *testing.M) {
	_ = os.Setenv("JWT_SECRET", "unit-test-secret")
	os.Exit(m.Run())
}

func makeAccessToken(t *testing.T, userid, role string) string {
	t.Helper()
	secret := []byte(os.Getenv("JWT_SECRET"))
	if len(secret) == 0 {
		t.Fatalf("JWT_SECRET not set")
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userid": userid,
		"role":   role,
		"type":   "access",
		"exp":    time.Now().Add(10 * time.Minute).Unix(),
	}).SignedString(secret)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return token
}

func withAccessCookie(r *http.Request, token string) {
	r.AddCookie(&http.Cookie{Name: "access_token", Value: token})
}

func setupMockGorm(t *testing.T) (*gorm.DB, sqlmock.Sqlmock, func()) {
	t.Helper()

	sqldb, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}

	gdb, err := gorm.Open("mysql", sqldb)
	if err != nil {
		_ = sqldb.Close()
		t.Fatalf("gorm.Open: %v", err)
	}
	gdb.LogMode(false)
	models.SetDB(gdb)

	cleanup := func() {
		gdb.Close()
		_ = sqldb.Close()
	}
	return gdb, mock, cleanup
}

func decodeJSONBody(t *testing.T, rr *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var got map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("invalid json response: %v; body=%s", err, rr.Body.String())
	}
	return got
}

func TestGetRFQDetail_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	rows := sqlmock.NewRows([]string{"rfq_id", "rfq_no", "status", "created_by", "product_id", "product_type"}).
		AddRow(int64(1), "RFQ-1", "draft", "u1", int64(10), "NEW")

	mock.ExpectQuery("CALL sp_rfq_crud\\(").
		WithArgs(int64(1)).
		WillReturnRows(rows)

	req := httptest.NewRequest(http.MethodGet, "/rfqs/1", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	rr := httptest.NewRecorder()

	GetRFQDetail(rr, req)
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

func TestUpdateRFQProduct_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	productID := int64(10)
	userid := "u1"

	mock.ExpectQuery("SELECT r\\.created_by").
		WithArgs(productID).
		WillReturnRows(sqlmock.NewRows([]string{"created_by"}).AddRow(userid))

	// Load existing technical document fields (should be preserved if client doesn't send them)
	mock.ExpectQuery("SELECT\\s+technical_document_forg").
		WithArgs(productID).
		WillReturnRows(sqlmock.NewRows([]string{
			"technical_document_forg",
			"technical_document_comp",
			"technical_document_mach",
			"technical_document_asse",
			"technical_document_doc",
			"technical_document_name",
			"technical_document_type",
			"technical_document_size",
		}).AddRow(nil, nil, nil, nil, nil, nil, nil, nil))

	// UPDATE call has 23 args: product_id + product_type + 21 fields
	mock.ExpectExec("CALL sp_rfq_crud\\(").
		WithArgs(
			productID,
			"NEW",
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	body := map[string]any{
		"product_id":   productID,
		"product_type": "new",
		"part_name":    "Part A",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, "/rfqs/products", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(UpdateRFQProduct))
	h(rr, req)

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

func TestUpdateRFQProduct_InvalidProductType(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	productID := int64(10)
	userid := "u1"

	body := map[string]any{
		"product_id":   productID,
		"product_type": "INVALID",
		"part_name":    "Part A",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, "/rfqs/products", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(UpdateRFQProduct))
	h(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d; body=%s", rr.Code, rr.Body.String())
	}

	// No DB calls expected
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}

func TestDeleteRFQProduct_OK(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	productID := int64(10)
	userid := "u1"

	mock.ExpectQuery("SELECT r\\.created_by").
		WithArgs(productID).
		WillReturnRows(sqlmock.NewRows([]string{"created_by"}).AddRow(userid))

	mock.ExpectExec("CALL sp_rfq_crud\\(").
		WithArgs(productID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	body := map[string]any{"product_id": productID}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodDelete, "/rfqs/products", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(DeleteRFQProduct))
	h(rr, req)

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

func TestCreateRFQ_OK_NewProductOnly(t *testing.T) {
	_, mock, cleanup := setupMockGorm(t)
	defer cleanup()

	userid := "u1"

	mock.ExpectBegin()

	rows := sqlmock.NewRows([]string{"rfq_id"}).AddRow(int64(100))

	// CREATE call has 26 args: action + rfq_id + created_by + product_id + product_type + 21 fields
	mock.ExpectQuery("CALL sp_rfq_crud\\(").
		WithArgs(
			"CREATE",
			nil,
			userid,
			nil,
			"NEW",
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnRows(rows)

	mock.ExpectCommit()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	_ = writer.WriteField("np_part_name", "Part A")
	_ = writer.WriteField("np_customer", "Customer X")
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/rfqs", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	withAccessCookie(req, makeAccessToken(t, userid, "marketing"))
	rr := httptest.NewRecorder()

	h := auth.ValidateMiddleware(auth.RequireRole("marketing")(CreateRFQ))
	h(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body=%s", rr.Code, rr.Body.String())
	}
	resp := decodeJSONBody(t, rr)
	if ok, _ := resp["status"].(bool); !ok {
		t.Fatalf("expected status=true; resp=%v", resp)
	}
	if resp["rfq_id"] == nil {
		t.Fatalf("expected rfq_id in response; resp=%v", resp)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("db expectations: %v", err)
	}
}
