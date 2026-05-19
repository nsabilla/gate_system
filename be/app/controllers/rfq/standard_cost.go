package rfq

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

func allowStandardCostRole(role string) bool {
	normalized := strings.ToLower(strings.TrimSpace(role))
	return normalized == "admin" || normalized == "purchasing" || normalized == "accounting" || normalized == "engineering" || normalized == "marketing"
}

func allowStandardCostCrudRole(role string) bool {
	normalized := strings.ToLower(strings.TrimSpace(role))
	return normalized == "accounting" || normalized == "admin"
}

func allowStandardCostWriteRole(role string) bool {
	normalized := strings.ToLower(strings.TrimSpace(role))
	return normalized == "admin" || normalized == "accounting" || normalized == "purchasing"
}

func allowStandardCostInvestmentReadRole(role string) bool {
	normalized := strings.ToLower(strings.TrimSpace(role))
	return normalized == "admin" || normalized == "accounting" || normalized == "marketing" || normalized == "purchasing" || normalized == "engineering"
}

func requireAccountingOrAdminForStandardCostInvestmentUpload(w http.ResponseWriter, r *http.Request) bool {
	role, ok := auth.GetUserRole(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return false
	}

	normalized := strings.ToLower(strings.TrimSpace(role))
	if normalized != "accounting" && normalized != "admin" {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden: only accounting or admin can upload feasibility study"))
		return false
	}

	return true
}

func ensureStandardCostInvestmentAttachmentSchema() error {
	db := models.GetDB()
	query := `CREATE TABLE IF NOT EXISTS standard_cost_investment_attachment (
		id INT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		pfs_type VARCHAR(20) NOT NULL DEFAULT 'forging',
		file_name VARCHAR(255) NOT NULL,
		file_path VARCHAR(255) NOT NULL,
		file_type VARCHAR(20) NOT NULL,
		uploaded_by VARCHAR(50),
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`
	if err := db.Exec(models.TranslateSQL(query)).Error; err != nil {
		return err
	}

	if err := db.Exec(`ALTER TABLE standard_cost_investment_attachment ADD COLUMN pfs_type VARCHAR(20) NOT NULL DEFAULT 'forging'`).Error; err != nil {
		errStr := strings.ToLower(err.Error())
		if !strings.Contains(errStr, "duplicate column") && !strings.Contains(errStr, "already exists") {
			return err
		}
	}

	return nil
}

func isAllowedStandardCostInvestmentFile(filename string) bool {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(filename)))
	return ext == ".xls" || ext == ".xlsx"
}

func moveUploadedFileToStandardCostFolder(originalPath, pfsType string) (string, error) {
	cleanType := strings.TrimSpace(strings.ToLower(pfsType))
	if cleanType != "jack" && cleanType != "toolset" && cleanType != "forging" {
		cleanType = "forging"
	}

	targetDir := filepath.ToSlash(filepath.Join("uploads", "standard_cost", cleanType))
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return "", err
	}

	baseName := filepath.Base(originalPath)
	targetPath := filepath.ToSlash(filepath.Join(targetDir, baseName))
	if originalPath == targetPath {
		return targetPath, nil
	}

	if err := os.Rename(originalPath, targetPath); err != nil {
		return "", err
	}

	return targetPath, nil
}

// ListStandardCostMaster returns active rows from standard_cost table.
// Optional query params: cost_center, wc, current_valid
func ListStandardCostMaster(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	role, ok := auth.GetUserRole(r)
	if !ok || !allowStandardCostRole(role) {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden"))
		return
	}

	costCenter := strings.TrimSpace(r.URL.Query().Get("cost_center"))
	wc := strings.TrimSpace(r.URL.Query().Get("wc"))
	currentValid := strings.TrimSpace(r.URL.Query().Get("current_valid"))

	query := `
		SELECT id, cost_center, wc, labor, mdepr, fd, fi, vd, vi, valid_from, valid_to, is_active
		FROM standard_cost
		WHERE is_active IN (1, true)
	`
	if models.GetDBType() == "postgres" {
		query = `
			SELECT id, cost_center, wc, labor, mdepr, fd, fi, vd, vi, valid_from, valid_to, is_active
			FROM standard_cost
			WHERE is_active = true
		`
	}
	args := make([]interface{}, 0, 2)

	if costCenter != "" {
		query += ` AND LOWER(TRIM(cost_center)) = LOWER(TRIM(?))`
		args = append(args, costCenter)
	}
	if wc != "" {
		query += ` AND LOWER(TRIM(wc)) = LOWER(TRIM(?))`
		args = append(args, wc)
	}
	if currentValid == "true" || currentValid == "1" {
		query += ` AND (valid_from IS NULL OR valid_from <= CURRENT_DATE) AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)`
	}

	query += ` ORDER BY cost_center ASC, wc ASC`

	rows, err := models.GetDB().Raw(query, args...).Rows()
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load standard cost master"))
		return
	}
	defer rows.Close()

	items, err := rowsToMaps(rows)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to read standard cost master"))
		return
	}
	if items == nil {
		items = []map[string]interface{}{}
	}

	resp := u.Message(true, "Standard cost master loaded")
	resp["data"] = items
	u.Respond(w, resp)
}

func GetStandardCostInvestmentAttachments(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	role, ok := auth.GetUserRole(r)
	if !ok || !allowStandardCostInvestmentReadRole(role) {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden"))
		return
	}

	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	pfsType := parsePFSType(r)

	if err := ensureStandardCostInvestmentAttachmentSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure investment attachment schema"))
		return
	}

	items, err := loadListByQuery(
		`SELECT id, rfq_id, pfs_type, file_name, file_path, file_type, uploaded_by, created_at
		 FROM standard_cost_investment_attachment
		 WHERE rfq_id = ? AND pfs_type = ? ORDER BY id ASC`,
		rfqID, pfsType,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load investment attachments"))
		return
	}

	resp := u.Message(true, "Standard cost investment attachments loaded")
	resp["data"] = items
	u.Respond(w, resp)
}

func UploadStandardCostInvestmentAttachment(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}
	if !requireAccountingOrAdminForStandardCostInvestmentUpload(w, r) {
		return
	}

	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	pfsType := parsePFSType(r)

	if err := ensureStandardCostInvestmentAttachmentSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure investment attachment schema"))
		return
	}

	_ = r.ParseMultipartForm(20 << 20)

	pth, name, _, _, err := uploadFileFromForm(r, "file")
	if err != nil || pth == nil || name == nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "File is required"))
		return
	}

	if !isAllowedStandardCostInvestmentFile(*name) {
		_ = os.Remove(*pth)
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid file type. Allowed: .xls, .xlsx"))
		return
	}

	storedPath, err := moveUploadedFileToStandardCostFolder(*pth, pfsType)
	if err != nil {
		_ = os.Remove(*pth)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to organize feasibility study file by type"))
		return
	}

	userID, _ := auth.GetUserID(r)
	fileExt := strings.TrimPrefix(strings.ToLower(filepath.Ext(*name)), ".")

	if err := models.GetDB().Exec(
		`INSERT INTO standard_cost_investment_attachment (rfq_id, pfs_type, file_name, file_path, file_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)`,
		rfqID, pfsType, *name, storedPath, fileExt, userID,
	).Error; err != nil {
		_ = os.Remove(storedPath)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save feasibility study attachment"))
		return
	}

	resp := u.Message(true, "Feasibility study uploaded")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID}
	u.Respond(w, resp)
}
