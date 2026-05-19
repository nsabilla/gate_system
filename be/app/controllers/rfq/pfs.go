package rfq

import (
	"database/sql"
	"encoding/json"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

// PFS Controller: Manages Product & Factory Specifications for RFQ
// Supports three PFS templates via query parameter: forging (default), jack, toolset
// Each type can extend PFS data through template-specific tables (pfs_jack_*, for example)
//
// Usage: GET/PUT /rfqs/{id}/pfs[?type=forging|jack|toolset]
//
// Tables:
//   - pfs_ov: Overview (rej_fg, eff_fg, line_fg, etc.)
//   - pfs_ts: Technical Spec (prod_w, rm_w, mat_grade, dia, etc.)
//   - pfs_pp: Process Plan (item_type, mat_grade, target_date)
//   - pfs_pe: Process Equipment (machine specs, cycle time, etc.)
//   - pfs_inv: Investments (machine, qty, unit_price, total_inv)
//   - pfs_inv_sum: Investment Summary (tot_support, tot_other, grand_total)
//   - pfs_drawing: Drawings (file upload/download)
//   - pfs_jack_*: Template-Jack specific sections (product_compare, raw_material, etc.)

type pfsOverviewPayload struct {
	RejFG         *float64 `json:"rej_fg"`
	RejMC         *float64 `json:"rej_mc"`
	EffFG         *float64 `json:"eff_fg"`
	EffMC         *float64 `json:"eff_mc"`
	LineFG        *string  `json:"line_fg"`
	TargetPriceFG *float64 `json:"target_price_fg"`
	LineMC        *string  `json:"line_mc"`
	TargetPriceMC *float64 `json:"target_price_mc"`
}

type pfsTechnicalSpecPayload struct {
	ProdW     *float64 `json:"prod_w"`
	RmW       *float64 `json:"rm_w"`
	MatGrade  *string  `json:"mat_grade"`
	Dia       *float64 `json:"dia"`
	LengthMM  *float64 `json:"length_mm"`
	YieldPct  *float64 `json:"yield_pct"`
	CutQty    *int     `json:"cut_qty"`
	RmPlusRem *float64 `json:"rm_plus_rem"`
	Remark    *string  `json:"remark"`
}

type pfsProcessPlanItemPayload struct {
	ItemType   string   `json:"item_type"`
	MatGrade   *string  `json:"mat_grade"`
	Dia        *float64 `json:"dia"`
	TargetDate *string  `json:"target_date"`
	Remark     *string  `json:"remark"`
}

type pfsProcessPlanPayload struct {
	Items []pfsProcessPlanItemPayload `json:"items"`
}

type pfsProcessEquipmentItemPayload struct {
	ProcessName     *string  `json:"process_name"`
	CycleTime       *float64 `json:"cycle_time"`
	MachineExisting *string  `json:"machine_existing"`
	MachineNew      *string  `json:"machine_new"`
	DiesPricePcs    *float64 `json:"dies_price_pcs"`
	LoadCapOld      *float64 `json:"load_cap_old"`
	LoadCapInvest   *float64 `json:"load_cap_invest"`
	LoadCapNew      *float64 `json:"load_cap_new"`
	LoadCapTotal    *float64 `json:"load_cap_total"`
	Remark          *string  `json:"remark"`
}

type pfsProcessEquipmentPayload struct {
	Items []pfsProcessEquipmentItemPayload `json:"items"`
}

type pfsInvestmentItemPayload struct {
	InvType   string   `json:"inv_type"`
	Machine   *string  `json:"machine"`
	Qty       *int     `json:"qty"`
	QtyPack   *int     `json:"qty_pack"`
	UnitPrice *float64 `json:"unit_price"`
	TotalInv  *float64 `json:"total_inv"`
	DeprYear  *int     `json:"depr_year"`
	PowerKwh  *float64 `json:"power_kwh"`
	AreaM2    *float64 `json:"area_m2"`
	Manpower  *int     `json:"manpower"`
	SimLine   *string  `json:"sim_line"`
}

type pfsInvestmentsPayload struct {
	Items []pfsInvestmentItemPayload `json:"items"`
}

type pfsInvestmentSummaryPayload struct {
	TotSupport *float64 `json:"tot_support"`
	TotOther   *float64 `json:"tot_other"`
	GrandTotal *float64 `json:"grand_total"`
}

type pfsTemplateJackProductComparePayload struct {
	NewProduct     map[string]interface{} `json:"new_product"`
	SimilarProduct map[string]interface{} `json:"similar_product"`
}

type pfsTemplateJackBundlePayload struct {
	Header            map[string]interface{}   `json:"header"`
	RawMaterial       []map[string]interface{} `json:"raw_material"`
	ComponentPurchase []map[string]interface{} `json:"component_purchase"`
	ProcessStandard   []map[string]interface{} `json:"process_standard"`
	DiesJig           []map[string]interface{} `json:"dies_jig"`
	DevelopmentCost   []map[string]interface{} `json:"development_cost"`
	Assembling        []map[string]interface{} `json:"assembling"`
	PackingDelivery   []map[string]interface{} `json:"packing_delivery"`
	Timeframe         []map[string]interface{} `json:"timeframe"`
	Result            map[string]interface{}   `json:"result"`
}

// pfsTemplateToolsetBundlePayload represents the Toolset template structure per Excel reference
// Section 1: Product Comparison (new vs similar/minor changed)
// Section 2: Technical Specification (component details with part numbers & costs)
// Section 3: Process & Equipment (in-house processes)
// Section 4: Equipment Out of House (outsource processes)
// Section 5: Purchase Equipment Plan (monthly Gantt schedule K1-K9)
// Section 6: Tooling Breakdown (cost by category)
// Section 7: Packaging & Other (packaging details)
type pfsTemplateToolsetBundlePayload struct {
	Header            map[string]interface{}                `json:"header"`              // PFS metadata
	ProductCompare    *pfsTemplateJackProductComparePayload `json:"product_compare"`     // new_product, similar_product
	TechSpec          []map[string]interface{}              `json:"tech_spec"`           // []{row_no, part_no, component_name, qty, part_no_mtm, part_no_supplier, actual_cost_mar_21, remark}
	TechSpecDetail    []map[string]interface{}              `json:"tech_spec_detail"`    // []{row_no, material, diameter_mm, length_mm, mass_kg, material_cost_country_1, material_cost_rp_kg_1, material_cost_country_2, material_cost_rp_kg_2, cost_finish_country_1, cost_finish_rp_kg_1, cost_finish_country_2, cost_finish_rp_kg_2, mass_product_gr}
	ProcessEquipment  []map[string]interface{}              `json:"process_equipment"`   // []{row_no, process_name, cycle_time_sec, machine_existing, machine_new, remark}
	EquipmentOutHouse []map[string]interface{}              `json:"equipment_out_house"` // []{row_no, process_name, cycle_time_sec, machine_existing, machine_new, remark}
	AssyToolset       []map[string]interface{}              `json:"assy_toolset"`        // []{row_no, process_name, cycle_time_sec, machine_existing, machine_new, remark}
	// EquipmentPlan removed
	PurchaseEquipmentPlan []map[string]interface{} `json:"purchase_equipment_plan"` // []{row_no, item_type, mat_grade, dia, target_date, remark}
	ToolingBreakdown      []map[string]interface{} `json:"tooling_breakdown"`       // []{row_no, tooling_category, cost_idr, opm_total_dep}
	Packaging             []map[string]interface{} `json:"packaging"`               // []{row_no, item_name, price_idr, qty_box, cost_box_idr, remark}
	Summary               map[string]interface{}   `json:"summary"`                 // {total_tooling_cost, total_packaging_cost, total_equipment_investment, grand_total}
}

func rfqStatusByID(rfqID int64) (string, error) {
	var status string
	err := models.GetDB().Raw(
		`SELECT status FROM rfq WHERE id = ? LIMIT 1`,
		rfqID,
	).Row().Scan(&status)
	if err != nil {
		return "", err
	}
	return strings.ToLower(strings.TrimSpace(status)), nil
}

func requireApprovedRFQForPFSWrite(w http.ResponseWriter, rfqID int64) bool {
	status, err := rfqStatusByID(rfqID)
	if err == sql.ErrNoRows {
		u.RespondWithStatus(w, http.StatusNotFound, u.Message(false, "RFQ not found"))
		return false
	}
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate RFQ status"))
		return false
	}

	if status != "approved" {
		u.RespondWithStatus(w, http.StatusConflict, u.Message(false, "PFS can only be created when RFQ status is approved"))
		return false
	}

	return true
}

func rfqCodeActByID(rfqID int64) (string, error) {
	var codeAct sql.NullString
	err := models.GetDB().Raw(models.TranslateSQL(
		`SELECT CAST(statusactivity AS CHAR) AS code_act FROM rfq WHERE id = ? LIMIT 1`),
		rfqID,
	).Row().Scan(&codeAct)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(codeAct.String), nil
}

func hasPFSLevel2Approval(rfqID int64) (bool, error) {
	var total int64
	err := models.GetDB().Raw(`
		SELECT COUNT(*)
		FROM rfq_activity_log
		WHERE rfq_id = ? AND activity_code = 'PFS_L2_APPROVED'
	`, rfqID).Row().Scan(&total)
	if err != nil {
		return false, err
	}
	return total > 0, nil
}

func markPFSApprovalLevel(rfqID int64, level int, userID, remarks string) error {
	activityCode := "PFS_L2_APPROVED"
	activityName := "PFS Approval Level 2"
	if level == 3 {
		activityCode = "PFS_L3_APPROVED"
		activityName = "PFS Approval Level 3"
	}

	return models.GetDB().Exec(`
		INSERT INTO rfq_activity_log (rfq_id, activity_code, activity_name, remarks, created_by)
		VALUES (?, ?, ?, ?, ?)
	`, rfqID, activityCode, activityName, remarks, userID).Error
}

func hasAtLeastOneJackRawMaterialComplete(rfqID int64) (bool, error) {
	var total int64
	err := models.GetDB().Raw(`
		SELECT COUNT(*)
		FROM pfs_jack_raw_material
		WHERE rfq_id = ?
		  AND TRIM(COALESCE(part_name, '')) <> ''
		  AND TRIM(COALESCE(material, '')) <> ''
		  AND qty_unit IS NOT NULL
		  AND qty_pcs IS NOT NULL
		  AND weight_unit_kg IS NOT NULL
	`, rfqID).Row().Scan(&total)
	if err != nil {
		return false, err
	}
	return total > 0, nil
}

func hasAtLeastOneJackProcessStandardComplete(rfqID int64) (bool, error) {
	var total int64
	err := models.GetDB().Raw(`
		SELECT COUNT(*)
		FROM pfs_jack_process_standard
		WHERE rfq_id = ?
		  AND TRIM(COALESCE(process_name, '')) <> ''
		  AND TRIM(COALESCE(line_name, '')) <> ''
		  AND manpower IS NOT NULL
		  AND cycle_time_sec IS NOT NULL
	`, rfqID).Row().Scan(&total)
	if err != nil {
		return false, err
	}
	return total > 0, nil
}

func hasAtLeastOneJackComponentPurchaseComplete(rfqID int64) (bool, error) {
	var total int64
	err := models.GetDB().Raw(`
		SELECT COUNT(*)
		FROM pfs_jack_component_purchase
		WHERE rfq_id = ?
		  AND TRIM(COALESCE(part_name, '')) <> ''
		  AND qty_unit IS NOT NULL
		  AND cost_rate IS NOT NULL
		  AND price_idr IS NOT NULL
	`, rfqID).Row().Scan(&total)
	if err != nil {
		return false, err
	}
	return total > 0, nil
}

func validateJackApprovalReadiness(rfqID int64, req moveActivityRequest) (string, error) {
	if strings.TrimSpace(req.TargetDate) == "" {
		return "Target Tanggal wajib diisi untuk approval Jack", nil
	}
	if _, ok := parseDateOnly(req.TargetDate); !ok {
		return "Target Tanggal tidak valid (format harus YYYY-MM-DD)", nil
	}
	if strings.TrimSpace(req.Remarks) == "" {
		return "Remark wajib diisi untuk approval Jack", nil
	}

	hasRawMaterial, err := hasAtLeastOneJackRawMaterialComplete(rfqID)
	if err != nil {
		return "", err
	}
	if !hasRawMaterial {
		return "Jack approval membutuhkan Raw Material yang terisi lengkap", nil
	}

	hasProcessStandard, err := hasAtLeastOneJackProcessStandardComplete(rfqID)
	if err != nil {
		return "", err
	}
	if !hasProcessStandard {
		return "Jack approval membutuhkan Process Standard yang terisi lengkap", nil
	}

	hasComponentPurchase, err := hasAtLeastOneJackComponentPurchaseComplete(rfqID)
	if err != nil {
		return "", err
	}
	if !hasComponentPurchase {
		return "Jack approval membutuhkan Component Purchase yang terisi lengkap", nil
	}

	return "", nil
}

func loadPFSOverview(rfqID int64) (map[string]interface{}, error) {
	if err := ensurePFSOverviewColumns(); err != nil {
		return nil, err
	}

	return loadOneByQuery(
		`SELECT rfq_id, rej_fg, rej_mc, eff_fg, eff_mc, line_fg, target_price_fg, line_mc, target_price_mc
		 FROM pfs_ov
		 WHERE rfq_id = ?
		 ORDER BY id DESC
		 LIMIT 1`,
		rfqID,
	)
}

func ensurePFSOverviewColumns() error {
	checks := []struct {
		column string
		alter  string
	}{
		{column: "line_fg", alter: `ALTER TABLE pfs_ov ADD COLUMN line_fg VARCHAR(100) NULL`},
		{column: "target_price_fg", alter: `ALTER TABLE pfs_ov ADD COLUMN target_price_fg DECIMAL(15,4) NULL`},
		{column: "line_mc", alter: `ALTER TABLE pfs_ov ADD COLUMN line_mc VARCHAR(100) NULL`},
		{column: "target_price_mc", alter: `ALTER TABLE pfs_ov ADD COLUMN target_price_mc DECIMAL(15,4) NULL`},
	}

	for _, check := range checks {
		if err := ensureColumnExists("pfs_ov", check.column, check.alter); err != nil {
			return err
		}
	}

	return nil
}

func ensureColumnExists(tableName, columnName, alterStmt string) error {
	db := models.GetDB()

	var total int64
	query := `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`
	if models.GetDBType() == "postgres" {
		query = `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_catalog = current_database() AND table_name = ? AND column_name = ?`
	}

	err := db.Raw(
		query,
		tableName,
		columnName,
	).Row().Scan(&total)
	if err != nil {
		return err
	}
	if total > 0 {
		return nil
	}

	return db.Exec(models.TranslateSQL(alterStmt)).Error
}

func hasColumn(tableName, columnName string) (bool, error) {
	var total int64
	query := `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`
	if models.GetDBType() == "postgres" {
		query = `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE table_catalog = current_database() AND table_name = ? AND column_name = ?`
	}

	err := models.GetDB().Raw(
		query,
		tableName,
		columnName,
	).Row().Scan(&total)
	if err != nil {
		return false, err
	}
	return total > 0, nil
}

func ensurePFSToolsetSchema() error {
	db := models.GetDB()

	createHeaderTable := `CREATE TABLE IF NOT EXISTS pfs_toolset_header (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		doc_no VARCHAR(100) NULL,
		doc_date DATE NULL,
		page_label VARCHAR(100) NULL,
		rev_label VARCHAR(100) NULL,
		prepared_by VARCHAR(100) NULL,
		prepared_title VARCHAR(100) NULL,
		checked_by VARCHAR(100) NULL,
		checked_title VARCHAR(100) NULL,
		approved_by VARCHAR(100) NULL,
		approved_title VARCHAR(100) NULL,
		created_by BIGINT NULL,
		updated_by BIGINT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createHeaderTable)).Error; err != nil {
		return err
	}

	createProductCompareTable := `CREATE TABLE IF NOT EXISTS pfs_toolset_product_compare (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		compare_type ENUM('new_product','similar_product') NULL,
		customer VARCHAR(255) NULL,
		part_number VARCHAR(255) NULL,
		product_name VARCHAR(255) NULL,
		qty_per_month DECIMAL(15,4) NULL,
		qty_unit VARCHAR(50) NULL,
		rejection_rate_pct DECIMAL(15,4) NULL,
		efficiency_pct DECIMAL(15,4) NULL,
		line_name VARCHAR(255) NULL,
		target_price DECIMAL(15,4) NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createProductCompareTable)).Error; err != nil {
		return err
	}

	createTechSpecTable := `CREATE TABLE IF NOT EXISTS pfs_toolset_tech_spec (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		part_no VARCHAR(255) NULL,
		component_name VARCHAR(255) NULL,
		qty DECIMAL(15,4) NULL,
		part_no_mtm VARCHAR(255) NULL,
		part_no_supplier VARCHAR(255) NULL,
		actual_cost_idr DECIMAL(15,2) NULL,
		remark TEXT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createTechSpecTable)).Error; err != nil {
		return err
	}

	createProcessTable := `CREATE TABLE IF NOT EXISTS pfs_toolset_process (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		process_name VARCHAR(255) NULL,
		cycle_time_sec DECIMAL(15,4) NULL,
		machine_existing VARCHAR(255) NULL,
		machine_new VARCHAR(255) NULL,
		remark TEXT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createProcessTable)).Error; err != nil {
		return err
	}

	createOutsourceTable := `CREATE TABLE IF NOT EXISTS pfs_toolset_equipment_outsource (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		process_name VARCHAR(255) NULL,
		cost_idr DECIMAL(15,2) NULL,
		cycle_time_sec DECIMAL(15,4) NULL,
		machine_existing VARCHAR(255) NULL,
		machine_new VARCHAR(255) NULL,
		remark TEXT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createOutsourceTable)).Error; err != nil {
		return err
	}

	createAssyTable := `CREATE TABLE IF NOT EXISTS pfs_toolset_assy (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		process_name VARCHAR(255) NULL,
		cycle_time_sec DECIMAL(15,4) NULL,
		machine_existing VARCHAR(255) NULL,
		machine_new VARCHAR(255) NULL,
		remark TEXT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createAssyTable)).Error; err != nil {
		return err
	}

	createPackagingTable := `CREATE TABLE IF NOT EXISTS pfs_toolset_packaging (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		item_name VARCHAR(255) NULL,
		price_idr DECIMAL(15,2) NULL,
		qty_per_box DECIMAL(15,2) NULL,
		cost_per_box_idr DECIMAL(15,2) NULL,
		remark TEXT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createPackagingTable)).Error; err != nil {
		return err
	}

	createSummaryTable := `CREATE TABLE IF NOT EXISTS pfs_toolset_summary (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		total_tooling_cost DECIMAL(15,2) NULL,
		total_packaging_cost DECIMAL(15,2) NULL,
		total_equipment_investment DECIMAL(15,2) NULL,
		grand_total DECIMAL(15,2) NULL,
		tooling_month INT NULL,
		tooling_qty_per_month DECIMAL(15,2) NULL,
		tooling_total_dep DECIMAL(15,2) NULL, 
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createSummaryTable)).Error; err != nil {
		return err
	}

	// Auto-add new columns if missing
	for _, col := range []struct{ name, ddl string }{
		{"tooling_month", "ALTER TABLE pfs_toolset_summary ADD COLUMN tooling_month INT NULL"},
		{"tooling_qty_per_month", "ALTER TABLE pfs_toolset_summary ADD COLUMN tooling_qty_per_month DECIMAL(15,2) NULL"},
		{"tooling_total_dep", "ALTER TABLE pfs_toolset_summary ADD COLUMN tooling_total_dep DECIMAL(15,2) NULL"},
	} {
		_ = db.Exec(col.ddl).Error // ignore if already exists
	}

	createDetailTable := `CREATE TABLE IF NOT EXISTS pfs_toolset_tech_spec_detail (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		tech_spec_id BIGINT NOT NULL,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		material VARCHAR(255) NULL,
		diameter_mm DECIMAL(15,4) NULL,
		length_mm DECIMAL(15,4) NULL,
		mass_kg DECIMAL(15,4) NULL,
		material_cost_country_1 VARCHAR(100) NULL,
		material_cost_rp_kg_1 DECIMAL(15,2) NULL,
		material_cost_country_2 VARCHAR(100) NULL,
		material_cost_rp_kg_2 DECIMAL(15,2) NULL,
		cost_finish_country_1 VARCHAR(100) NULL,
		cost_finish_rp_kg_1 DECIMAL(15,2) NULL,
		cost_finish_country_2 VARCHAR(100) NULL,
		cost_finish_rp_kg_2 DECIMAL(15,2) NULL,
		mass_product_gr DECIMAL(15,4) NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_tech_spec_id (tech_spec_id),
		KEY idx_rfq_id (rfq_id),
		KEY idx_row_no (row_no)
	)`
	if err := db.Exec(models.TranslateSQL(createDetailTable)).Error; err != nil {
		return err
	}

	createToolingTable := `CREATE TABLE IF NOT EXISTS pfs_toolset_tooling (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		tooling_category VARCHAR(255) NULL,
		cost_idr DECIMAL(15,2) NULL,
		opm_total_dep DECIMAL(15,2) NULL,
		remark TEXT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id),
		KEY idx_row_no (row_no)
	)`
	if err := db.Exec(models.TranslateSQL(createToolingTable)).Error; err != nil {
		return err
	}

	checks := []struct {
		table  string
		column string
		alter  string
	}{
		{table: "pfs_toolset_product_compare", column: "compare_type", alter: `ALTER TABLE pfs_toolset_product_compare ADD COLUMN compare_type ENUM('new_product','similar_product') NULL`},
		{table: "pfs_toolset_tech_spec", column: "actual_cost_idr", alter: `ALTER TABLE pfs_toolset_tech_spec ADD COLUMN actual_cost_idr DECIMAL(15,2) NULL`},
		{table: "pfs_toolset_packaging", column: "qty_per_box", alter: `ALTER TABLE pfs_toolset_packaging ADD COLUMN qty_per_box DECIMAL(15,2) NULL`},
		{table: "pfs_toolset_packaging", column: "cost_per_box_idr", alter: `ALTER TABLE pfs_toolset_packaging ADD COLUMN cost_per_box_idr DECIMAL(15,2) NULL`},
		{table: "pfs_toolset_equipment_outsource", column: "cost_idr", alter: `ALTER TABLE pfs_toolset_equipment_outsource ADD COLUMN cost_idr DECIMAL(15,2) NULL AFTER process_name`},
		{table: "pfs_toolset_tooling", column: "remark", alter: `ALTER TABLE pfs_toolset_tooling ADD COLUMN remark TEXT NULL`},
		{table: "pfs_toolset_header", column: "doc_no", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN doc_no VARCHAR(100) NULL`},
		{table: "pfs_toolset_header", column: "doc_date", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN doc_date DATE NULL`},
		{table: "pfs_toolset_header", column: "page_label", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN page_label VARCHAR(100) NULL`},
		{table: "pfs_toolset_header", column: "rev_label", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN rev_label VARCHAR(100) NULL`},
		{table: "pfs_toolset_header", column: "prepared_by", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN prepared_by VARCHAR(100) NULL`},
		{table: "pfs_toolset_header", column: "prepared_title", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN prepared_title VARCHAR(100) NULL`},
		{table: "pfs_toolset_header", column: "checked_by", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN checked_by VARCHAR(100) NULL`},
		{table: "pfs_toolset_header", column: "checked_title", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN checked_title VARCHAR(100) NULL`},
		{table: "pfs_toolset_header", column: "approved_by", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN approved_by VARCHAR(100) NULL`},
		{table: "pfs_toolset_header", column: "approved_title", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN approved_title VARCHAR(100) NULL`},
		{table: "pfs_toolset_header", column: "created_by", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN created_by BIGINT NULL`},
		{table: "pfs_toolset_header", column: "updated_by", alter: `ALTER TABLE pfs_toolset_header ADD COLUMN updated_by BIGINT NULL`},
	}

	for _, check := range checks {
		if err := ensureColumnExists(check.table, check.column, check.alter); err != nil {
			return err
		}
	}

	hasLegacyType, err := hasColumn("pfs_toolset_product_compare", "type")
	if err != nil {
		return err
	}
	if hasLegacyType {
		if err := db.Exec(`
			UPDATE pfs_toolset_product_compare
			SET compare_type = ` + "`type`" + `
			WHERE (compare_type IS NULL OR compare_type = '') AND ` + "`type`" + ` IS NOT NULL
		`).Error; err != nil {
			return err
		}
	}

	hasLegacyActualCost, err := hasColumn("pfs_toolset_tech_spec", "actual_cost_mar_21")
	if err != nil {
		return err
	}
	if hasLegacyActualCost {
		if err := db.Exec(`
			UPDATE pfs_toolset_tech_spec
			SET actual_cost_idr = actual_cost_mar_21
			WHERE actual_cost_idr IS NULL AND actual_cost_mar_21 IS NOT NULL
		`).Error; err != nil {
			return err
		}
	}

	hasLegacyQtyBox, err := hasColumn("pfs_toolset_packaging", "qty_box")
	if err != nil {
		return err
	}
	if hasLegacyQtyBox {
		if err := db.Exec(`
			UPDATE pfs_toolset_packaging
			SET qty_per_box = qty_box
			WHERE qty_per_box IS NULL AND qty_box IS NOT NULL
		`).Error; err != nil {
			return err
		}
	}

	hasLegacyCostBox, err := hasColumn("pfs_toolset_packaging", "cost_box_idr")
	if err != nil {
		return err
	}
	if hasLegacyCostBox {
		if err := db.Exec(`
			UPDATE pfs_toolset_packaging
			SET cost_per_box_idr = cost_box_idr
			WHERE cost_per_box_idr IS NULL AND cost_box_idr IS NOT NULL
		`).Error; err != nil {
			return err
		}
	}

	createProcessPlanTable := `CREATE TABLE IF NOT EXISTS pfs_toolset_process_plan (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		item_type VARCHAR(50) NULL,
		specification VARCHAR(255) NULL,
		dia DECIMAL(15,4) NULL,
		target_date DATE NULL,
		remark TEXT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id),
		KEY idx_row_no (row_no)
	)`
	if err := db.Exec(models.TranslateSQL(createProcessPlanTable)).Error; err != nil {
		return err
	}

	return nil
}

func ensurePFSProcessEquipmentSchema() error {
	db := models.GetDB()

	createStmt := `CREATE TABLE IF NOT EXISTS pfs_pe (
		id INT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		process_name VARCHAR(255),
		cycle_time FLOAT,
		machine_existing VARCHAR(255),
		machine_new VARCHAR(255),
		dies_price_pcs FLOAT,
		load_cap_old FLOAT,
		load_cap_invest FLOAT,
		load_cap_new FLOAT,
		load_cap_total FLOAT,
		remark VARCHAR(255)
	)`

	if err := db.Exec(models.TranslateSQL(createStmt)).Error; err != nil {
		return err
	}

	checks := []struct {
		column string
		alter  string
	}{
		{column: "process_name", alter: `ALTER TABLE pfs_pe ADD COLUMN process_name VARCHAR(255) NULL`},
		{column: "cycle_time", alter: `ALTER TABLE pfs_pe ADD COLUMN cycle_time FLOAT NULL`},
		{column: "machine_existing", alter: `ALTER TABLE pfs_pe ADD COLUMN machine_existing VARCHAR(255) NULL`},
		{column: "machine_new", alter: `ALTER TABLE pfs_pe ADD COLUMN machine_new VARCHAR(255) NULL`},
		{column: "dies_price_pcs", alter: `ALTER TABLE pfs_pe ADD COLUMN dies_price_pcs FLOAT NULL`},
		{column: "load_cap_old", alter: `ALTER TABLE pfs_pe ADD COLUMN load_cap_old FLOAT NULL`},
		{column: "load_cap_invest", alter: `ALTER TABLE pfs_pe ADD COLUMN load_cap_invest FLOAT NULL`},
		{column: "load_cap_new", alter: `ALTER TABLE pfs_pe ADD COLUMN load_cap_new FLOAT NULL`},
		{column: "load_cap_total", alter: `ALTER TABLE pfs_pe ADD COLUMN load_cap_total FLOAT NULL`},
		{column: "remark", alter: `ALTER TABLE pfs_pe ADD COLUMN remark VARCHAR(255) NULL`},
	}

	for _, check := range checks {
		if err := ensureColumnExists("pfs_pe", check.column, check.alter); err != nil {
			return err
		}
	}

	return nil
}

func ensurePFSJackSchema() error {
	db := models.GetDB()

	createHeaderTable := `CREATE TABLE IF NOT EXISTS pfs_jack_header (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		doc_no VARCHAR(100) NULL,
		doc_date DATE NULL,
		page_label VARCHAR(100) NULL,
		rev_label VARCHAR(100) NULL,
		prepared_by VARCHAR(100) NULL,
		prepared_title VARCHAR(100) NULL,
		checked_by VARCHAR(100) NULL,
		checked_title VARCHAR(100) NULL,
		approved_by VARCHAR(100) NULL,
		approved_title VARCHAR(100) NULL,
		created_by BIGINT NULL,
		updated_by BIGINT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(createHeaderTable).Error; err != nil {
		return err
	}

	createRawMaterialTable := `CREATE TABLE IF NOT EXISTS pfs_jack_raw_material (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		part_name VARCHAR(255) NULL,
		material VARCHAR(255) NULL,
		size_t_mm DECIMAL(15,4) NULL,
		size_l_mm DECIMAL(15,4) NULL,
		size_w_mm DECIMAL(15,4) NULL,
		qty_unit DECIMAL(15,4) NULL,
		qty_pcs DECIMAL(15,4) NULL,
		weight_unit_kg DECIMAL(15,4) NULL,
		total_wt_unit_kg DECIMAL(15,4) NULL,
		remarks TEXT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(createRawMaterialTable).Error; err != nil {
		return err
	}

	createComponentPurchaseTable := `CREATE TABLE IF NOT EXISTS pfs_jack_component_purchase (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		part_name VARCHAR(255) NULL,
		material VARCHAR(255) NULL,
		qty_unit DECIMAL(15,4) NULL,
		part_no_mtm VARCHAR(255) NULL,
		part_no_supplier VARCHAR(255) NULL,
		price_idr DECIMAL(15,4) NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createComponentPurchaseTable)).Error; err != nil {
		return err
	}
	_ = db.Exec(`ALTER TABLE pfs_jack_component_purchase ADD COLUMN part_no_mtm VARCHAR(255) NULL`).Error
	_ = db.Exec(`ALTER TABLE pfs_jack_component_purchase ADD COLUMN part_no_supplier VARCHAR(255) NULL`).Error

	createProcessStandardTable := `CREATE TABLE IF NOT EXISTS pfs_jack_process_standard (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		process_name VARCHAR(255) NULL,
		line_name VARCHAR(255) NULL,
		manpower DECIMAL(15,4) NULL,
		cycle_time_sec DECIMAL(15,4) NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createProcessStandardTable)).Error; err != nil {
		return err
	}

	createAssemblingTable := `CREATE TABLE IF NOT EXISTS pfs_jack_assembling (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		process_name VARCHAR(255) NULL,
		line_name VARCHAR(255) NULL,
		manpower DECIMAL(15,4) NULL,
		cycle_time_sec DECIMAL(15,4) NULL,
		rate DECIMAL(15,4) NULL,
		cost_idr DECIMAL(15,4) NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createAssemblingTable)).Error; err != nil {
		return err
	}

	createPackingDeliveryTable := `CREATE TABLE IF NOT EXISTS pfs_jack_packing_delivery (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		item_name VARCHAR(255) NULL,
		price_idr DECIMAL(15,4) NULL,
		qty_per_box DECIMAL(15,4) NULL,
		cost_per_pcs_idr DECIMAL(15,4) NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createPackingDeliveryTable)).Error; err != nil {
		return err
	}

	createDiesJigTable := `CREATE TABLE IF NOT EXISTS pfs_jack_dies_jig (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		part_name VARCHAR(255) NULL,
		value_a DECIMAL(15,4) NULL,
		stroke_b DECIMAL(15,4) NULL,
		consumable VARCHAR(255) NULL,
		value_c DECIMAL(15,4) NULL,
		stroke_d DECIMAL(15,4) NULL,
		formula_type VARCHAR(50) NULL,
		cost_per_pcs DECIMAL(15,4) NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createDiesJigTable)).Error; err != nil {
		return err
	}

	createDevelopmentCostTable := `CREATE TABLE IF NOT EXISTS pfs_jack_development_cost (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		cost_name VARCHAR(255) NULL,
		amount_idr DECIMAL(15,4) NULL,
		note TEXT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createDevelopmentCostTable)).Error; err != nil {
		return err
	}

	createTimeframeTable := `CREATE TABLE IF NOT EXISTS pfs_jack_timeframe (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		rfq_id BIGINT NOT NULL,
		row_no INT NULL,
		main_activity VARCHAR(255) NULL,
		pic_userid VARCHAR(50) NULL,
		due_text VARCHAR(100) NULL,
		start_month_no INT NULL,
		end_month_no INT NULL,
		remark TEXT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_rfq_id (rfq_id)
	)`
	if err := db.Exec(models.TranslateSQL(createTimeframeTable)).Error; err != nil {
		return err
	}

	return nil
}

func loadPFSTechnicalSpec(rfqID int64) (map[string]interface{}, error) {
	return loadOneByQuery(
		`SELECT rfq_id, prod_w, rm_w, mat_grade, dia, length_mm, yield_pct, cut_qty, rm_plus_rem, remark
		 FROM pfs_ts
		 WHERE rfq_id = ?
		 ORDER BY id DESC
		 LIMIT 1`,
		rfqID,
	)
}

func loadPFSProcessEquipment(rfqID int64) ([]map[string]interface{}, error) {
	if err := ensurePFSProcessEquipmentSchema(); err != nil {
		return nil, err
	}

	return loadListByQuery(
		`SELECT id, rfq_id, process_name, cycle_time, machine_existing, machine_new, dies_price_pcs,
		        load_cap_old, load_cap_invest, load_cap_new, load_cap_total, remark
		 FROM pfs_pe
		 WHERE rfq_id = ?
		 ORDER BY id ASC`,
		rfqID,
	)
}

func loadPFSProcessPlan(rfqID int64) ([]map[string]interface{}, error) {
	return loadListByQuery(
		models.TranslateSQL(`SELECT id, rfq_id, item_type, mat_grade, dia,
		        DATE_FORMAT(target_date, '%Y-%m-%d') AS target_date,
		        remark
		 FROM pfs_pp
		 WHERE rfq_id = ?
		 ORDER BY id ASC`),
		rfqID,
	)
}

func loadPFSInvestments(rfqID int64) ([]map[string]interface{}, error) {
	return loadListByQuery(
		`SELECT id, rfq_id, inv_type, machine, qty, qty_pack, unit_price, total_inv,
		        depr_year, power_kwh, area_m2, manpower, sim_line
		 FROM pfs_inv
		 WHERE rfq_id = ?
		 ORDER BY id ASC`,
		rfqID,
	)
}

func loadPFSInvestmentSummary(rfqID int64) (map[string]interface{}, error) {
	return loadOneByQuery(
		`SELECT rfq_id, tot_support, tot_other, grand_total
		 FROM pfs_inv_sum
		 WHERE rfq_id = ?
		 ORDER BY id DESC
		 LIMIT 1`,
		rfqID,
	)
}

func GetPFSBundle(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}

	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	overview, err := loadPFSOverview(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS overview"))
		return
	}

	processPlan, err := loadPFSProcessPlan(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS process plan"))
		return
	}

	processEquipment, err := loadPFSProcessEquipment(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS process equipment"))
		return
	}

	technicalSpec, err := loadPFSTechnicalSpec(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS technical spec"))
		return
	}

	investments, err := loadPFSInvestments(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS investments"))
		return
	}

	investmentSummary, err := loadPFSInvestmentSummary(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS investment summary"))
		return
	}

	rfqDetails, _ := loadListByQuery(`
		SELECT product_type, customer, part_name, part_no, model, volume_month, material, product_weight
		FROM rfq_detail
		WHERE rfq_id = ?
	`, rfqID)

	var newProd, simProd interface{}
	for _, row := range rfqDetails {
		pt := strings.ToUpper(strings.TrimSpace(row["product_type"].(string)))
		if pt == "NEW" {
			newProd = row
		} else if pt == "SIMILAR" {
			simProd = row
		}
	}

	resp := u.Message(true, "PFS data")
	resp["data"] = map[string]interface{}{
		"overview":           overview,
		"process_plan":       processPlan,
		"process_equipment":  processEquipment,
		"technical_spec":     technicalSpec,
		"investments":        investments,
		"investment_summary": investmentSummary,
		"new_product":        newProd,
		"similar_product":    simProd,
	}
	u.Respond(w, resp)
}

func GetPFSOverview(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	data, err := loadPFSOverview(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS overview"))
		return
	}
	resp := u.Message(true, "PFS overview")
	resp["data"] = data
	u.Respond(w, resp)
}

func GetPFSProcessPlan(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	data, err := loadPFSProcessPlan(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS process plan"))
		return
	}
	resp := u.Message(true, "PFS process plan")
	resp["data"] = data
	u.Respond(w, resp)
}

func ListMasterForgingProcesses(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}

	processes, err := loadListByQuery(`
		SELECT id, process_name
		FROM master_pfs_forging_process
		WHERE is_active = TRUE
		ORDER BY id ASC
	`)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load master forging processes"))
		return
	}

	resp := u.Message(true, "Master forging processes")
	resp["data"] = processes
	u.Respond(w, resp)
}

func GetPFSProcessEquipment(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	data, err := loadPFSProcessEquipment(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS process equipment"))
		return
	}
	resp := u.Message(true, "PFS process equipment")
	resp["data"] = data
	u.Respond(w, resp)
}

func GetPFSTechnicalSpec(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	data, err := loadPFSTechnicalSpec(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS technical spec"))
		return
	}
	resp := u.Message(true, "PFS technical spec")
	resp["data"] = data
	u.Respond(w, resp)
}

func GetPFSInvestments(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	data, err := loadPFSInvestments(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS investments"))
		return
	}
	resp := u.Message(true, "PFS investments")
	resp["data"] = data
	u.Respond(w, resp)
}

func GetPFSInvestmentSummary(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	data, err := loadPFSInvestmentSummary(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load PFS investment summary"))
		return
	}
	resp := u.Message(true, "PFS investment summary")
	resp["data"] = data
	u.Respond(w, resp)
}

func UpsertPFSOverview(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringForPFSWrite(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	if !requireApprovedRFQForPFSWrite(w, rfqID) {
		return
	}
	if err := ensurePFSOverviewColumns(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure PFS overview schema"))
		return
	}

	var payload pfsOverviewPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	db := models.GetDB()
	var existingID int64
	err := db.Raw(
		`SELECT id FROM pfs_ov WHERE rfq_id = ? ORDER BY id DESC LIMIT 1`,
		rfqID,
	).Row().Scan(&existingID)

	if err == nil {
		execErr := db.Exec(
			`UPDATE pfs_ov
			 SET rej_fg = ?, rej_mc = ?, eff_fg = ?, eff_mc = ?,
			     line_fg = ?, target_price_fg = ?, line_mc = ?, target_price_mc = ?
			 WHERE id = ?`,
			ptrValue(payload.RejFG),
			ptrValue(payload.RejMC),
			ptrValue(payload.EffFG),
			ptrValue(payload.EffMC),
			ptrValue(payload.LineFG),
			ptrValue(payload.TargetPriceFG),
			ptrValue(payload.LineMC),
			ptrValue(payload.TargetPriceMC),
			existingID,
		).Error
		if execErr != nil {
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS overview"))
			return
		}
	} else if err == sql.ErrNoRows {
		execErr := db.Exec(
			`INSERT INTO pfs_ov (rfq_id, rej_fg, rej_mc, eff_fg, eff_mc, line_fg, target_price_fg, line_mc, target_price_mc)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			rfqID,
			ptrValue(payload.RejFG),
			ptrValue(payload.RejMC),
			ptrValue(payload.EffFG),
			ptrValue(payload.EffMC),
			ptrValue(payload.LineFG),
			ptrValue(payload.TargetPriceFG),
			ptrValue(payload.LineMC),
			ptrValue(payload.TargetPriceMC),
		).Error
		if execErr != nil {
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS overview"))
			return
		}
	} else {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS overview"))
		return
	}

	resp := u.Message(true, "PFS overview saved")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID}
	u.Respond(w, resp)
}

func ReplacePFSProcessPlan(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringForPFSWrite(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	if !requireApprovedRFQForPFSWrite(w, rfqID) {
		return
	}

	var payload pfsProcessPlanPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	for _, item := range payload.Items {
		t := strings.ToLower(strings.TrimSpace(item.ItemType))
		if t != "rm" && t != "die" {
			u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "item_type must be rm or die"))
			return
		}
	}

	tx := models.GetDB().Begin()
	if tx.Error != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS process plan"))
		return
	}

	if err := tx.Exec(`DELETE FROM pfs_pp WHERE rfq_id = ?`, rfqID).Error; err != nil {
		tx.Rollback()
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS process plan"))
		return
	}

	for _, item := range payload.Items {
		targetDate, err := parseNullableDate(item.TargetDate)
		if err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "target_date must use YYYY-MM-DD"))
			return
		}

		if err := tx.Exec(
			`INSERT INTO pfs_pp (rfq_id, item_type, mat_grade, dia, target_date, remark)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			rfqID,
			strings.ToLower(strings.TrimSpace(item.ItemType)),
			ptrValue(item.MatGrade),
			ptrValue(item.Dia),
			targetDate,
			ptrValue(item.Remark),
		).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS process plan"))
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS process plan"))
		return
	}

	resp := u.Message(true, "PFS process plan saved")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID, "total_items": len(payload.Items)}
	u.Respond(w, resp)
}

func ReplacePFSProcessEquipment(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringForPFSWrite(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	if !requireApprovedRFQForPFSWrite(w, rfqID) {
		return
	}
	if err := ensurePFSProcessEquipmentSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure PFS process equipment schema"))
		return
	}

	var payload pfsProcessEquipmentPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	tx := models.GetDB().Begin()
	if tx.Error != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS process equipment"))
		return
	}

	if err := tx.Exec(`DELETE FROM pfs_pe WHERE rfq_id = ?`, rfqID).Error; err != nil {
		tx.Rollback()
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS process equipment"))
		return
	}

	for _, item := range payload.Items {
		if err := tx.Exec(
			`INSERT INTO pfs_pe (rfq_id, process_name, cycle_time, machine_existing, machine_new,
			                     dies_price_pcs, load_cap_old, load_cap_invest, load_cap_new, load_cap_total, remark)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			rfqID,
			ptrValue(item.ProcessName),
			ptrValue(item.CycleTime),
			ptrValue(item.MachineExisting),
			ptrValue(item.MachineNew),
			ptrValue(item.DiesPricePcs),
			ptrValue(item.LoadCapOld),
			ptrValue(item.LoadCapInvest),
			ptrValue(item.LoadCapNew),
			ptrValue(item.LoadCapTotal),
			ptrValue(item.Remark),
		).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS process equipment"))
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS process equipment"))
		return
	}

	resp := u.Message(true, "PFS process equipment saved")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID, "total_items": len(payload.Items)}
	u.Respond(w, resp)
}

func UpsertPFSTechnicalSpec(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringForPFSWrite(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	if !requireApprovedRFQForPFSWrite(w, rfqID) {
		return
	}

	var payload pfsTechnicalSpecPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	db := models.GetDB()
	var existingID int64
	err := db.Raw(
		`SELECT id FROM pfs_ts WHERE rfq_id = ? ORDER BY id DESC LIMIT 1`,
		rfqID,
	).Row().Scan(&existingID)

	if err == nil {
		execErr := db.Exec(
			`UPDATE pfs_ts
			 SET prod_w = ?, rm_w = ?, mat_grade = ?, dia = ?, length_mm = ?, yield_pct = ?,
			     cut_qty = ?, rm_plus_rem = ?, remark = ?
			 WHERE id = ?`,
			ptrValue(payload.ProdW),
			ptrValue(payload.RmW),
			ptrValue(payload.MatGrade),
			ptrValue(payload.Dia),
			ptrValue(payload.LengthMM),
			ptrValue(payload.YieldPct),
			ptrValue(payload.CutQty),
			ptrValue(payload.RmPlusRem),
			ptrValue(payload.Remark),
			existingID,
		).Error
		if execErr != nil {
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS technical spec"))
			return
		}
	} else if err == sql.ErrNoRows {
		execErr := db.Exec(
			`INSERT INTO pfs_ts (rfq_id, prod_w, rm_w, mat_grade, dia, length_mm, yield_pct, cut_qty, rm_plus_rem, remark)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			rfqID,
			ptrValue(payload.ProdW),
			ptrValue(payload.RmW),
			ptrValue(payload.MatGrade),
			ptrValue(payload.Dia),
			ptrValue(payload.LengthMM),
			ptrValue(payload.YieldPct),
			ptrValue(payload.CutQty),
			ptrValue(payload.RmPlusRem),
			ptrValue(payload.Remark),
		).Error
		if execErr != nil {
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS technical spec"))
			return
		}
	} else {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS technical spec"))
		return
	}

	resp := u.Message(true, "PFS technical spec saved")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID}
	u.Respond(w, resp)
}

func ReplacePFSInvestments(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringForPFSWrite(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	if !requireApprovedRFQForPFSWrite(w, rfqID) {
		return
	}

	var payload pfsInvestmentsPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	for _, item := range payload.Items {
		t := strings.ToLower(strings.TrimSpace(item.InvType))
		if t != "support" && t != "other" {
			u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "inv_type must be support or other"))
			return
		}
	}

	tx := models.GetDB().Begin()
	if tx.Error != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS investments"))
		return
	}

	if err := tx.Exec(`DELETE FROM pfs_inv WHERE rfq_id = ?`, rfqID).Error; err != nil {
		tx.Rollback()
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS investments"))
		return
	}

	for _, item := range payload.Items {
		totalInv := item.TotalInv
		if totalInv == nil && item.Qty != nil && item.UnitPrice != nil {
			v := float64(*item.Qty) * (*item.UnitPrice)
			totalInv = &v
		}

		if err := tx.Exec(
			`INSERT INTO pfs_inv
			 (rfq_id, inv_type, machine, qty, qty_pack, unit_price, total_inv, depr_year, power_kwh, area_m2, manpower, sim_line)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			rfqID,
			strings.ToLower(strings.TrimSpace(item.InvType)),
			ptrValue(item.Machine),
			ptrValue(item.Qty),
			ptrValue(item.QtyPack),
			ptrValue(item.UnitPrice),
			ptrValue(totalInv),
			ptrValue(item.DeprYear),
			ptrValue(item.PowerKwh),
			ptrValue(item.AreaM2),
			ptrValue(item.Manpower),
			ptrValue(item.SimLine),
		).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS investments"))
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS investments"))
		return
	}

	resp := u.Message(true, "PFS investments saved")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID, "total_items": len(payload.Items)}
	u.Respond(w, resp)
}

func UpsertPFSInvestmentSummary(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringForPFSWrite(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	if !requireApprovedRFQForPFSWrite(w, rfqID) {
		return
	}

	var payload pfsInvestmentSummaryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	db := models.GetDB()
	var supportTotal sql.NullFloat64
	var otherTotal sql.NullFloat64
	if err := db.Raw(models.TranslateSQL(
		`SELECT
		  SUM(CASE WHEN inv_type = 'support' THEN COALESCE(total_inv, 0) ELSE 0 END) AS tot_support,
		  SUM(CASE WHEN inv_type = 'other' THEN COALESCE(total_inv, 0) ELSE 0 END) AS tot_other
		 FROM pfs_inv
		 WHERE rfq_id = ?`),
		rfqID,
	).Row().Scan(&supportTotal, &otherTotal); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to calculate PFS investment totals"))
		return
	}

	support := 0.0
	if supportTotal.Valid {
		support = supportTotal.Float64
	}
	other := 0.0
	if otherTotal.Valid {
		other = otherTotal.Float64
	}
	grand := support + other

	if payload.TotSupport == nil {
		payload.TotSupport = &support
	}
	if payload.TotOther == nil {
		payload.TotOther = &other
	}
	if payload.GrandTotal == nil {
		payload.GrandTotal = &grand
	} else {
		// Ensure total remains consistent with support/out totals when at least one source is calculated.
		calculatedGrand := float64Value(payload.TotSupport) + float64Value(payload.TotOther)
		payload.GrandTotal = &calculatedGrand
	}

	var existingID int64
	err := db.Raw(
		`SELECT id FROM pfs_inv_sum WHERE rfq_id = ? ORDER BY id DESC LIMIT 1`,
		rfqID,
	).Row().Scan(&existingID)

	if err == nil {
		execErr := db.Exec(
			`UPDATE pfs_inv_sum
			 SET tot_support = ?, tot_other = ?, grand_total = ?
			 WHERE id = ?`,
			ptrValue(payload.TotSupport),
			ptrValue(payload.TotOther),
			ptrValue(payload.GrandTotal),
			existingID,
		).Error
		if execErr != nil {
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS investment summary"))
			return
		}
	} else if err == sql.ErrNoRows {
		execErr := db.Exec(
			`INSERT INTO pfs_inv_sum (rfq_id, tot_support, tot_other, grand_total)
			 VALUES (?, ?, ?, ?)`,
			rfqID,
			ptrValue(payload.TotSupport),
			ptrValue(payload.TotOther),
			ptrValue(payload.GrandTotal),
		).Error
		if execErr != nil {
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS investment summary"))
			return
		}
	} else {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS investment summary"))
		return
	}

	resp := u.Message(true, "PFS investment summary saved")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID}
	u.Respond(w, resp)
}

func UpsertPFSTimeFrame(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringForPFSWrite(w, r) {
		return
	}

	userID, ok := auth.GetUserID(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	approver, err := loadApproverProfile(userID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate approver"))
		return
	}
	if !approver.HasApproval || !approver.IsActive {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden: approver is not active"))
		return
	}
	if approver.Level != 2 && approver.Level != 3 {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden: only level 2 or 3 approver can approve PFS"))
		return
	}

	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	if !requireApprovedRFQForPFSWrite(w, rfqID) {
		return
	}
	pfsType := parsePFSType(r)

	var req moveActivityRequest
	reqParsed := false
	if pfsType == "jack" {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
			return
		}
		reqParsed = true
		if strings.TrimSpace(req.StatusActivity) == "" {
			u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "statusactivity is required"))
			return
		}
		validationMessage, validationErr := validateJackApprovalReadiness(rfqID, req)
		if validationErr != nil {
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate Jack approval readiness"))
			return
		}
		if validationMessage != "" {
			u.RespondWithStatus(w, http.StatusConflict, u.Message(false, validationMessage))
			return
		}
	}

	currentCodeAct, err := rfqCodeActByID(rfqID)
	if err == sql.ErrNoRows {
		u.RespondWithStatus(w, http.StatusNotFound, u.Message(false, "RFQ not found"))
		return
	}
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate RFQ status"))
		return
	}
	codeActNum, ok := ParseActivityCodeNumber(currentCodeAct)
	if !ok || codeActNum != 3 {
		u.RespondWithStatus(w, http.StatusConflict, u.Message(false, "PFS can only be approved when code_act is 3"))
		return
	}

	if approver.Level == 2 {
		if err := markPFSApprovalLevel(rfqID, 2, userID, ""); err != nil {
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to record PFS level 2 approval"))
			return
		}
		resp := u.Message(true, "PFS approved by level 2")
		resp["data"] = map[string]interface{}{"rfq_id": rfqID}
		u.Respond(w, resp)
		return
	}

	approvedByL2, err := hasPFSLevel2Approval(rfqID)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate PFS approval flow"))
		return
	}
	if !approvedByL2 {
		u.RespondWithStatus(w, http.StatusConflict, u.Message(false, "PFS must be approved by level 2 before level 3"))
		return
	}

	if !reqParsed {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
			return
		}
	}
	if strings.TrimSpace(req.StatusActivity) == "" {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "statusactivity is required"))
		return
	}

	rows, err := models.GetDB().Raw(
		`CALL sp_mainactivity(?,?,?,?,?,?,?,?)`,
		"MOVE_ACTIVITY",
		rfqID,
		"",
		"",
		userID,
		"",
		req.StatusActivity,
		req.Remarks,
	).Rows()
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save PFS timeframe"))
		return
	}

	for {
		_, _ = rowsToMaps(rows)
		if !rows.NextResultSet() {
			break
		}
	}
	_ = rows.Close()

	if err := SyncDashboardActivityPlan(rfqID, req.StatusActivity, userID, req.Remarks, req.TargetDate); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to sync PFS timeframe"))
		return
	}

	if err := markPFSApprovalLevel(rfqID, 3, userID, req.Remarks); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to record PFS level 3 approval"))
		return
	}

	resp := u.Message(true, "PFS timeframe saved")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID}
	u.Respond(w, resp)
}

// GetPFSTimeFrame handles GET /rfqs/{id}/pfs/timeframe
// Returns timeframe rows depending on PFS template type (jack/toolset/forging)
func GetPFSTimeFrame(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}

	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	pfsType := parsePFSType(r)

	var timeframe []map[string]interface{}
	var err error

	switch pfsType {
	case "jack":
		timeframe, err = loadListByQuery(
			`SELECT row_no, main_activity, pic_userid, due_text, start_month_no, end_month_no, remark
			 FROM pfs_jack_timeframe WHERE rfq_id = ? ORDER BY row_no ASC, id ASC`,
			rfqID,
		)
	case "toolset":
		// Toolset timeframe stored under purchase equipment plan (useful mapping)
		timeframe, err = loadListByQuery(
			`SELECT row_no, item_type AS main_activity, NULL AS pic_userid, DATE_FORMAT(target_date, '%Y-%m-%d') AS due_text, NULL AS start_month_no, NULL AS end_month_no, remark
			 FROM pfs_toolset_purchase_equipment_plan WHERE rfq_id = ? ORDER BY row_no ASC, id ASC`,
			rfqID,
		)
	default:
		// Forging / default: no dedicated timeframe table, return rfq_activity_plan overlay
		timeframe, err = loadListByQuery(
			`SELECT p.activity_code AS row_no, a.descr AS main_activity, p.pic_userid, DATE_FORMAT(p.target_date, '%Y-%m-%d') AS due_text, NULL AS start_month_no, NULL AS end_month_no, p.remarks AS remark
			 FROM rfq_activity_plan p LEFT JOIN rfq_activity a ON p.activity_code = a.code_act WHERE p.rfq_id = ? ORDER BY p.id ASC`,
			rfqID,
		)
	}

	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load timeframe"))
		return
	}

	resp := u.Message(true, "PFS timeframe")
	resp["data"] = timeframe
	u.Respond(w, resp)
}

// Jack template handlers removed. Jack template & base-data functionality
// has been deprecated/removed from the backend. Toolset and other PFS
// template handlers remain available.

// GetPFSTemplateToolsetBundle loads all toolset sections for a given RFQ
func GetPFSTemplateToolsetBundle(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}

	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	if err := ensurePFSToolsetSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure template-toolset schema"))
		return
	}

	header, err := loadOneByQuery(
		`SELECT rfq_id, doc_no, DATE_FORMAT(doc_date, '%Y-%m-%d') AS doc_date, page_label, rev_label,
		        prepared_by, prepared_title, checked_by, checked_title, approved_by, approved_title,
		        created_by, updated_by, created_at, updated_at
		 FROM pfs_toolset_header
		 WHERE rfq_id = ?
		 ORDER BY id DESC
		 LIMIT 1`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load template-toolset header"))
		return
	}

	productRows, err := loadListByQuery(
		`SELECT id, rfq_id, compare_type, customer, part_number, product_name, qty_per_month, qty_unit,
		        rejection_rate_pct, efficiency_pct, line_name, target_price, created_at, updated_at
		 FROM pfs_toolset_product_compare
		 WHERE rfq_id = ?
		 ORDER BY id ASC`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load template-toolset product compare"))
		return
	}

	productCompare := map[string]interface{}{
		"new_product":     map[string]interface{}{},
		"similar_product": map[string]interface{}{},
	}
	for _, row := range productRows {
		compareType := strings.ToLower(strings.TrimSpace(toInputString(row["compare_type"])))
		if compareType == "new_product" {
			productCompare["new_product"] = row
		} else if compareType == "similar_product" {
			productCompare["similar_product"] = row
		}
	}

	techSpec, err := loadListByQuery(
		`SELECT id, rfq_id, row_no, part_no, component_name, qty, part_no_mtm, part_no_supplier, actual_cost_idr, remark, created_at, updated_at
		 FROM pfs_toolset_tech_spec
		 WHERE rfq_id = ?
		 ORDER BY row_no ASC, id ASC`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load template-toolset technical spec"))
		return
	}

	techSpecDetail, err := loadListByQuery(
		`SELECT id, tech_spec_id, rfq_id, row_no, material, diameter_mm, length_mm, mass_kg,
		        material_cost_country_1, material_cost_rp_kg_1, material_cost_country_2, material_cost_rp_kg_2,
		        cost_finish_country_1, cost_finish_rp_kg_1, cost_finish_country_2, cost_finish_rp_kg_2,
		        mass_product_gr, created_at, updated_at
		 FROM pfs_toolset_tech_spec_detail
		 WHERE rfq_id = ?
		 ORDER BY tech_spec_id ASC, row_no ASC, id ASC`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load template-toolset technical spec detail"))
		return
	}

	processEquipment, err := loadListByQuery(
		`SELECT id, rfq_id, row_no, process_name, cycle_time_sec, machine_existing, machine_new, remark, created_at, updated_at
		 FROM pfs_toolset_process
		 WHERE rfq_id = ?
		 ORDER BY row_no ASC, id ASC`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load template-toolset process equipment"))
		return
	}

	equipmentOutHouse, err := loadListByQuery(
		`SELECT id, rfq_id, row_no, process_name, cost_idr, cycle_time_sec, machine_existing, machine_new, remark, created_at, updated_at
		 FROM pfs_toolset_equipment_outsource
		 WHERE rfq_id = ?
		 ORDER BY row_no ASC, id ASC`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load template-toolset equipment out house"))
		return
	}

	// equipment_plan removed

	assyToolset, err := loadListByQuery(
		`SELECT id, rfq_id, row_no, process_name, cycle_time_sec, machine_existing, machine_new, remark, created_at, updated_at
		 FROM pfs_toolset_assy
		 WHERE rfq_id = ?
		 ORDER BY row_no ASC, id ASC`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load template-toolset assy"))
		return
	}

	toolingBreakdown, err := loadListByQuery(
		`SELECT id, rfq_id, row_no, tooling_category, cost_idr, opm_total_dep, remark, created_at, updated_at
		 FROM pfs_toolset_tooling
		 WHERE rfq_id = ?
		 ORDER BY row_no ASC, id ASC`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load template-toolset tooling breakdown"))
		return
	}

	packaging, err := loadListByQuery(
		`SELECT id, rfq_id, row_no, item_name, price_idr, qty_per_box, cost_per_box_idr, remark, created_at, updated_at
		 FROM pfs_toolset_packaging
		 WHERE rfq_id = ?
		 ORDER BY row_no ASC, id ASC`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load template-toolset packaging"))
		return
	}

	purchaseEquipmentPlan, err := loadListByQuery(
		`SELECT id, rfq_id, row_no, item_type, specification, dia,
		        DATE_FORMAT(target_date, '%Y-%m-%d') AS target_date,
		        remark, created_at, updated_at
		 FROM pfs_toolset_process_plan
		 WHERE rfq_id = ?
		 ORDER BY row_no ASC, id ASC`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load template-toolset purchase equipment plan"))
		return
	}

	summary, err := loadOneByQuery(
		`SELECT rfq_id, total_tooling_cost, total_packaging_cost, total_equipment_investment, grand_total, created_at, updated_at
		 FROM pfs_toolset_summary
		 WHERE rfq_id = ?
		 ORDER BY id DESC
		 LIMIT 1`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load template-toolset summary"))
		return
	}
	if len(summary) == 0 {
		summary = map[string]interface{}{}
		for _, key := range []string{"total_tooling_cost", "total_packaging_cost", "total_equipment_investment", "grand_total"} {
			if val, ok := header[key]; ok && val != nil && toInputString(val) != "" {
				summary[key] = val
			}
		}
	}

	resp := u.Message(true, "PFS template-toolset data")
	resp["data"] = map[string]interface{}{
		"header":                  header,
		"product_compare":         productCompare,
		"tech_spec":               techSpec,
		"tech_spec_detail":        techSpecDetail,
		"process_equipment":       processEquipment,
		"equipment_out_house":     equipmentOutHouse,
		"assy_toolset":            assyToolset,
		"purchase_equipment_plan": purchaseEquipmentPlan,
		"tooling_breakdown":       toolingBreakdown,
		"packaging":               packaging,
		"summary":                 summary,
	}
	u.Respond(w, resp)
}

// UpsertPFSTemplateToolsetBundle saves all toolset sections for a given RFQ
func UpsertPFSTemplateToolsetBundle(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringForPFSWrite(w, r) {
		return
	}

	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	if !requireApprovedRFQForPFSWrite(w, rfqID) {
		return
	}

	if err := ensurePFSToolsetSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure template-toolset schema"))
		return
	}

	var payload pfsTemplateToolsetBundlePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	userID, _ := auth.GetUserID(r)
	tx := models.GetDB().Begin()
	if tx.Error != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset data"))
		return
	}

	if payload.Header != nil {
		if err := deleteByRFQIfProvided(tx, "pfs_toolset_header", true, rfqID); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset header"))
			return
		}

		if mapHasMeaningfulValue(payload.Header) {
			if err := tx.Exec(
				`INSERT INTO pfs_toolset_header
				 (rfq_id, doc_no, doc_date, page_label, rev_label,
				  prepared_by, prepared_title, checked_by, checked_title, approved_by, approved_title,
				  created_by, updated_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				rfqID,
				ptrValue(mapGetString(payload.Header, "doc_no")),
				mapGetDateSQL(payload.Header, "doc_date"),
				ptrValue(mapGetString(payload.Header, "page_label")),
				ptrValue(mapGetString(payload.Header, "rev_label")),
				ptrValue(mapGetString(payload.Header, "prepared_by")),
				ptrValue(mapGetString(payload.Header, "prepared_title")),
				ptrValue(mapGetString(payload.Header, "checked_by")),
				ptrValue(mapGetString(payload.Header, "checked_title")),
				ptrValue(mapGetString(payload.Header, "approved_by")),
				ptrValue(mapGetString(payload.Header, "approved_title")),
				userID,
				userID,
			).Error; err != nil {
				tx.Rollback()
				u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset header"))
				return
			}
		}
	}

	if payload.ProductCompare != nil {
		if err := deleteByRFQIfProvided(tx, "pfs_toolset_product_compare", true, rfqID); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset product compare"))
			return
		}

		insertCompare := func(compareType string, row map[string]interface{}) error {
			if !mapHasMeaningfulValue(row) {
				return nil
			}
			return tx.Exec(
				`INSERT INTO pfs_toolset_product_compare
				 (rfq_id, compare_type, customer, part_number, product_name, qty_per_month, qty_unit,
				  rejection_rate_pct, efficiency_pct, line_name, target_price)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				rfqID,
				compareType,
				ptrValue(mapGetString(row, "customer")),
				ptrValue(mapGetString(row, "part_number")),
				ptrValue(mapGetString(row, "product_name")),
				ptrValue(mapGetFloat(row, "qty_per_month")),
				ptrValue(mapGetString(row, "qty_unit")),
				ptrValue(mapGetFloat(row, "rejection_rate_pct")),
				ptrValue(mapGetFloat(row, "efficiency_pct")),
				ptrValue(mapGetString(row, "line_name")),
				ptrValue(mapGetFloat(row, "target_price")),
			).Error
		}

		if err := insertCompare("new_product", payload.ProductCompare.NewProduct); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset product compare"))
			return
		}
		if err := insertCompare("similar_product", payload.ProductCompare.SimilarProduct); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset product compare"))
			return
		}
	}

	if payload.TechSpec != nil {
		if err := deleteByRFQIfProvided(tx, "pfs_toolset_tech_spec", true, rfqID); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset technical spec"))
			return
		}
		for idx, row := range payload.TechSpec {
			if err := tx.Exec(
				`INSERT INTO pfs_toolset_tech_spec
				 (rfq_id, row_no, part_no, component_name, qty, part_no_mtm, part_no_supplier, actual_cost_idr, remark)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				rfqID,
				mapGetRowNo(row, idx),
				ptrValue(mapGetString(row, "part_no")),
				ptrValue(mapGetString(row, "component_name")),
				ptrValue(mapGetFloat(row, "qty")),
				ptrValue(mapGetString(row, "part_no_mtm")),
				ptrValue(mapGetString(row, "part_no_supplier")),
				ptrValue(mapGetFloat(row, "actual_cost_idr")),
				ptrValue(mapGetString(row, "remark")),
			).Error; err != nil {
				tx.Rollback()
				u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset technical spec"))
				return
			}
		}
	}

	if payload.TechSpecDetail != nil {
		for idx := range payload.TechSpecDetail {
			normalizeToolsetTechSpecDetailRow(payload.TechSpecDetail[idx])
		}
		if err := deleteByRFQIfProvided(tx, "pfs_toolset_tech_spec_detail", true, rfqID); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset technical spec detail"))
			return
		}
		for idx, row := range payload.TechSpecDetail {
			techSpecID := mapGetInt(row, "tech_spec_id")
			var techSpecIDVal int64
			if techSpecID != nil {
				techSpecIDVal = int64(*techSpecID)
			}

			// Use tech_spec_row_no to link to the parent row by row_no instead of id
			techSpecRowNo := mapGetInt(row, "tech_spec_row_no")
			if techSpecIDVal == 0 && techSpecRowNo != nil {
				// Look up the actual tech_spec id by rfq_id + row_no
				var foundID int64
				err := tx.Raw(
					`SELECT id FROM pfs_toolset_tech_spec WHERE rfq_id = ? AND row_no = ? ORDER BY id ASC LIMIT 1`,
					rfqID, *techSpecRowNo,
				).Row().Scan(&foundID)
				if err == nil && foundID > 0 {
					techSpecIDVal = foundID
				}
			}

			if err := tx.Exec(
				`INSERT INTO pfs_toolset_tech_spec_detail
				 (tech_spec_id, rfq_id, row_no, material, diameter_mm, length_mm, mass_kg,
				  material_cost_country_1, material_cost_rp_kg_1, material_cost_country_2, material_cost_rp_kg_2,
				  cost_finish_country_1, cost_finish_rp_kg_1, cost_finish_country_2, cost_finish_rp_kg_2,
				  mass_product_gr)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				techSpecIDVal,
				rfqID,
				mapGetRowNo(row, idx),
				ptrValue(mapGetString(row, "material")),
				ptrValue(mapGetFloat(row, "diameter_mm")),
				ptrValue(mapGetFloat(row, "length_mm")),
				ptrValue(mapGetFloat(row, "mass_kg")),
				ptrValue(mapGetString(row, "material_cost_country_1")),
				ptrValue(mapGetFloat(row, "material_cost_rp_kg_1")),
				ptrValue(mapGetString(row, "material_cost_country_2")),
				ptrValue(mapGetFloat(row, "material_cost_rp_kg_2")),
				ptrValue(mapGetString(row, "cost_finish_country_1")),
				ptrValue(mapGetFloat(row, "cost_finish_rp_kg_1")),
				ptrValue(mapGetString(row, "cost_finish_country_2")),
				ptrValue(mapGetFloat(row, "cost_finish_rp_kg_2")),
				ptrValue(mapGetFloat(row, "mass_product_gr")),
			).Error; err != nil {
				tx.Rollback()
				u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset technical spec detail"))
				return
			}
		}
	}

	if payload.ProcessEquipment != nil {
		if err := deleteByRFQIfProvided(tx, "pfs_toolset_process", true, rfqID); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset process equipment"))
			return
		}
		for idx, row := range payload.ProcessEquipment {
			if err := tx.Exec(
				`INSERT INTO pfs_toolset_process
				 (rfq_id, row_no, process_name, cycle_time_sec, machine_existing, machine_new, remark)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				rfqID,
				mapGetRowNo(row, idx),
				ptrValue(mapGetString(row, "process_name")),
				ptrValue(mapGetFloat(row, "cycle_time_sec")),
				ptrValue(mapGetString(row, "machine_existing")),
				ptrValue(mapGetString(row, "machine_new")),
				ptrValue(mapGetString(row, "remark")),
			).Error; err != nil {
				tx.Rollback()
				u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset process equipment"))
				return
			}
		}
	}

	if payload.EquipmentOutHouse != nil {
		if err := deleteByRFQIfProvided(tx, "pfs_toolset_equipment_outsource", true, rfqID); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset equipment out house"))
			return
		}
		for idx, row := range payload.EquipmentOutHouse {
			if err := tx.Exec(
				`INSERT INTO pfs_toolset_equipment_outsource
				 (rfq_id, row_no, process_name, cost_idr, cycle_time_sec, machine_existing, machine_new, remark)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				rfqID,
				mapGetRowNo(row, idx),
				ptrValue(mapGetString(row, "process_name")),
				ptrValue(mapGetFloat(row, "cost_idr")),
				ptrValue(mapGetFloat(row, "cycle_time_sec")),
				ptrValue(mapGetString(row, "machine_existing")),
				ptrValue(mapGetString(row, "machine_new")),
				ptrValue(mapGetString(row, "remark")),
			).Error; err != nil {
				tx.Rollback()
				u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset equipment out house"))
				return
			}
		}
	}

	// equipment_plan upsert removed

	if payload.AssyToolset != nil {
		if err := deleteByRFQIfProvided(tx, "pfs_toolset_assy", true, rfqID); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset assy"))
			return
		}
		for idx, row := range payload.AssyToolset {
			if err := tx.Exec(
				`INSERT INTO pfs_toolset_assy
				 (rfq_id, row_no, process_name, cycle_time_sec, machine_existing, machine_new, remark)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				rfqID,
				mapGetRowNo(row, idx),
				ptrValue(mapGetString(row, "process_name")),
				ptrValue(mapGetFloat(row, "cycle_time_sec")),
				ptrValue(mapGetString(row, "machine_existing")),
				ptrValue(mapGetString(row, "machine_new")),
				ptrValue(mapGetString(row, "remark")),
			).Error; err != nil {
				tx.Rollback()
				u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset assy"))
				return
			}
		}
	}

	if payload.ToolingBreakdown != nil {
		if err := deleteByRFQIfProvided(tx, "pfs_toolset_tooling", true, rfqID); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset tooling breakdown"))
			return
		}
		for idx, row := range payload.ToolingBreakdown {
			if err := tx.Exec(
				`INSERT INTO pfs_toolset_tooling
				 (rfq_id, row_no, tooling_category, cost_idr, opm_total_dep, remark)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				rfqID,
				mapGetRowNo(row, idx),
				ptrValue(mapGetString(row, "tooling_category")),
				ptrValue(mapGetFloat(row, "cost_idr")),
				ptrValue(mapGetFloat(row, "opm_total_dep")),
				ptrValue(mapGetString(row, "remark")),
			).Error; err != nil {
				tx.Rollback()
				u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset tooling breakdown"))
				return
			}
		}
	}

	if payload.Packaging != nil {
		if err := deleteByRFQIfProvided(tx, "pfs_toolset_packaging", true, rfqID); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset packaging"))
			return
		}
		for idx, row := range payload.Packaging {
			if err := tx.Exec(
				`INSERT INTO pfs_toolset_packaging
				 (rfq_id, row_no, item_name, price_idr, qty_per_box, cost_per_box_idr, remark)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				rfqID,
				mapGetRowNo(row, idx),
				ptrValue(mapGetString(row, "item_name")),
				ptrValue(mapGetFloat(row, "price_idr")),
				ptrValue(mapGetFloat(row, "qty_per_box")),
				ptrValue(mapGetFloat(row, "cost_per_box_idr")),
				ptrValue(mapGetString(row, "remark")),
			).Error; err != nil {
				tx.Rollback()
				u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset packaging"))
				return
			}
		}
	}

	if payload.PurchaseEquipmentPlan != nil {
		if err := deleteByRFQIfProvided(tx, "pfs_toolset_process_plan", true, rfqID); err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset purchase equipment plan"))
			return
		}
		for idx, row := range payload.PurchaseEquipmentPlan {
			if err := tx.Exec(
				`INSERT INTO pfs_toolset_process_plan
				 (rfq_id, row_no, item_type, specification, dia, target_date, remark)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				rfqID,
				mapGetRowNo(row, idx),
				ptrValue(mapGetString(row, "item_type")),
				ptrValue(mapGetString(row, "specification")),
				ptrValue(mapGetFloat(row, "dia")),
				mapGetDateSQL(row, "target_date"),
				ptrValue(mapGetString(row, "remark")),
			).Error; err != nil {
				tx.Rollback()
				u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset purchase equipment plan"))
				return
			}
		}
	}

	if payload.Summary == nil {
		payload.Summary = map[string]interface{}{}
	}
	computedSummary := computeToolsetSummaryValues(&payload)
	payload.Summary["total_tooling_cost"] = computedSummary["total_tooling_cost"]
	payload.Summary["total_packaging_cost"] = computedSummary["total_packaging_cost"]
	payload.Summary["total_equipment_investment"] = computedSummary["total_equipment_investment"]
	payload.Summary["grand_total"] = computedSummary["grand_total"]

	if err := deleteByRFQIfProvided(tx, "pfs_toolset_summary", true, rfqID); err != nil {
		tx.Rollback()
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset summary"))
		return
	}

	if mapHasMeaningfulValue(payload.Summary) {
		if err := tx.Exec(
			`INSERT INTO pfs_toolset_summary (rfq_id, total_tooling_cost, total_packaging_cost, total_equipment_investment, grand_total, tooling_month, tooling_qty_per_month, tooling_total_dep)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			rfqID,
			ptrValue(mapGetFloat(payload.Summary, "total_tooling_cost")),
			ptrValue(mapGetFloat(payload.Summary, "total_packaging_cost")),
			ptrValue(mapGetFloat(payload.Summary, "total_equipment_investment")),
			ptrValue(mapGetFloat(payload.Summary, "grand_total")),
			ptrValue(mapGetFloat(payload.Summary, "tooling_month")),
			ptrValue(mapGetFloat(payload.Summary, "tooling_qty_per_month")),
			ptrValue(mapGetFloat(payload.Summary, "tooling_total_dep")),
		).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset summary"))
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-toolset data"))
		return
	}

	resp := u.Message(true, "PFS template-toolset saved")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID}
	u.Respond(w, resp)
}

func toInputString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case []byte:
		return string(t)
	default:
		return ""
	}
}

func float64Value(v *float64) float64 {
	if v == nil {
		return 0
	}
	return *v
}

func normalizeToolsetTechSpecDetailRow(row map[string]interface{}) {
	// Auto-fill mass and finish values from diameter, length, and material finish costs.
	if mapGetFloat(row, "mass_kg") == nil {
		dia := mapGetFloat(row, "diameter_mm")
		length := mapGetFloat(row, "length_mm")
		if dia != nil && length != nil {
			row["mass_kg"] = math.Round(float64Value(dia)*float64Value(length)*0.0000061625*1000) / 1000
		}
	}

	mass := mapGetFloat(row, "mass_kg")
	if mass != nil {
		if costRp1 := mapGetFloat(row, "material_cost_rp_kg_1"); costRp1 != nil {
			row["cost_finish_rp_kg_1"] = math.Round(float64Value(mass)*float64Value(costRp1)*1000) / 1000
		}
		if costRp2 := mapGetFloat(row, "material_cost_rp_kg_2"); costRp2 != nil {
			row["cost_finish_rp_kg_2"] = math.Round(float64Value(mass)*float64Value(costRp2)*1000) / 1000
		}
	}
}

func computeToolsetSummaryValues(payload *pfsTemplateToolsetBundlePayload) map[string]float64 {
	totalToolingCost := 0.0
	for _, row := range payload.ToolingBreakdown {
		totalToolingCost += float64Value(mapGetFloat(row, "cost_idr")) + float64Value(mapGetFloat(row, "opm_total_dep"))
	}

	totalPackagingCost := 0.0
	for _, row := range payload.Packaging {
		costPerBox := float64Value(mapGetFloat(row, "cost_per_box_idr"))
		price := float64Value(mapGetFloat(row, "price_idr"))
		qtyPerBox := float64Value(mapGetFloat(row, "qty_per_box"))
		if costPerBox > 0 {
			totalPackagingCost += costPerBox
		} else if price > 0 && qtyPerBox > 0 {
			totalPackagingCost += price * qtyPerBox
		}
	}

	totalEquipmentInvestment := 0.0
	for _, row := range payload.EquipmentOutHouse {
		totalEquipmentInvestment += float64Value(mapGetFloat(row, "cost_idr"))
	}

	return map[string]float64{
		"total_tooling_cost":         math.Round(totalToolingCost*100) / 100,
		"total_packaging_cost":       math.Round(totalPackagingCost*100) / 100,
		"total_equipment_investment": math.Round(totalEquipmentInvestment*100) / 100,
		"grand_total":                math.Round((totalToolingCost+totalPackagingCost+totalEquipmentInvestment)*100) / 100,
	}
}

// Unified PFS Template handlers (dispatch by type parameter)

// GetPFSTemplate is a unified handler that dispatches to type-specific GET handlers based on query parameter
func GetPFSTemplate(w http.ResponseWriter, r *http.Request) {
	pfsType := parsePFSType(r)
	switch pfsType {
	case "toolset", "TLS":
		GetPFSTemplateToolsetBundle(w, r)
	case "jack", "JCK":
		GetPFSTemplateJackBundle(w, r)
	default:
		// For now, return error since forging template is not implemented yet
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Forging template not yet implemented via unified endpoint"))
	}
}

// GetPFSTemplateJackBundle loads all jack sections for a given RFQ
func GetPFSTemplateJackBundle(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}

	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	if err := ensurePFSJackSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure template-jack schema"))
		return
	}

	header, _ := loadOneByQuery(
		`SELECT rfq_id, doc_no, DATE_FORMAT(doc_date, '%Y-%m-%d') AS doc_date, page_label, rev_label,
		        prepared_by, prepared_title, checked_by, checked_title, approved_by, approved_title
		 FROM pfs_jack_header WHERE rfq_id = ? ORDER BY id DESC LIMIT 1`,
		rfqID,
	)

	rawMaterial, _ := loadListByQuery(
		`SELECT row_no, part_name, material, size_t_mm, size_l_mm, size_w_mm, qty_unit, qty_pcs, weight_unit_kg, total_wt_unit_kg, remarks
		 FROM pfs_jack_raw_material WHERE rfq_id = ? ORDER BY row_no ASC, id ASC`,
		rfqID,
	)

	componentPurchase, _ := loadListByQuery(
		`SELECT row_no, part_name, material, qty_unit, part_no_mtm, part_no_supplier, price_idr
		 FROM pfs_jack_component_purchase WHERE rfq_id = ? ORDER BY row_no ASC, id ASC`,
		rfqID,
	)

	processStandard, _ := loadListByQuery(
		`SELECT row_no, process_name, line_name, manpower, cycle_time_sec
		 FROM pfs_jack_process_standard WHERE rfq_id = ? ORDER BY row_no ASC, id ASC`,
		rfqID,
	)

	assembling, _ := loadListByQuery(
		`SELECT row_no, process_name, line_name, manpower, cycle_time_sec, rate, cost_idr
		 FROM pfs_jack_assembling WHERE rfq_id = ? ORDER BY row_no ASC, id ASC`,
		rfqID,
	)

	packingDelivery, _ := loadListByQuery(
		`SELECT row_no, item_name, price_idr, qty_per_box, cost_per_pcs_idr
		 FROM pfs_jack_packing_delivery WHERE rfq_id = ? ORDER BY row_no ASC, id ASC`,
		rfqID,
	)

	diesJig, _ := loadListByQuery(
		`SELECT row_no, part_name, value_a, stroke_b, consumable, value_c, stroke_d, formula_type, cost_per_pcs
		 FROM pfs_jack_dies_jig WHERE rfq_id = ? ORDER BY row_no ASC, id ASC`,
		rfqID,
	)

	developmentCost, _ := loadListByQuery(
		`SELECT row_no, cost_name, amount_idr, note
		 FROM pfs_jack_development_cost WHERE rfq_id = ? ORDER BY row_no ASC, id ASC`,
		rfqID,
	)

	timeframe, _ := loadListByQuery(
		`SELECT row_no, main_activity, pic_userid, due_text, start_month_no, end_month_no, remark
		 FROM pfs_jack_timeframe WHERE rfq_id = ? ORDER BY row_no ASC, id ASC`,
		rfqID,
	)

	resp := u.Message(true, "PFS template-jack data")
	resp["data"] = map[string]interface{}{
		"header":             header,
		"raw_material":       rawMaterial,
		"component_purchase": componentPurchase,
		"process_standard":   processStandard,
		"assembling":         assembling,
		"packing_delivery":   packingDelivery,
		"dies_jig":           diesJig,
		"development_cost":   developmentCost,
		"timeframe":          timeframe,
		"result":             map[string]interface{}{},
	}
	u.Respond(w, resp)
}

// UpsertPFSTemplate is a unified handler that dispatches to type-specific PUT handlers based on query parameter
func UpsertPFSTemplate(w http.ResponseWriter, r *http.Request) {
	pfsType := parsePFSType(r)
	switch pfsType {
	case "toolset", "TLS":
		UpsertPFSTemplateToolsetBundle(w, r)
	case "jack", "JCK":
		UpsertPFSTemplateJackBundle(w, r)
	default:
		// For now, return error since forging template is not implemented yet
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Forging template not yet implemented via unified endpoint"))
	}
}

// UpsertPFSTemplateJackBundle saves all jack sections for a given RFQ
func UpsertPFSTemplateJackBundle(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringForPFSWrite(w, r) {
		return
	}

	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	if !requireApprovedRFQForPFSWrite(w, rfqID) {
		return
	}

	if err := ensurePFSJackSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure template-jack schema"))
		return
	}

	var payload pfsTemplateJackBundlePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	userID, _ := auth.GetUserID(r)
	tx := models.GetDB().Begin()
	if tx.Error != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save template-jack data"))
		return
	}

	// 1. Header
	if payload.Header != nil {
		_ = deleteByRFQIfProvided(tx, "pfs_jack_header", true, rfqID)
		if mapHasMeaningfulValue(payload.Header) {
			_ = tx.Exec(
				`INSERT INTO pfs_jack_header (rfq_id, doc_no, doc_date, page_label, rev_label, prepared_by, prepared_title, checked_by, checked_title, approved_by, approved_title, created_by, updated_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				rfqID, ptrValue(mapGetString(payload.Header, "doc_no")), mapGetDateSQL(payload.Header, "doc_date"), ptrValue(mapGetString(payload.Header, "page_label")), ptrValue(mapGetString(payload.Header, "rev_label")),
				ptrValue(mapGetString(payload.Header, "prepared_by")), ptrValue(mapGetString(payload.Header, "prepared_title")), ptrValue(mapGetString(payload.Header, "checked_by")), ptrValue(mapGetString(payload.Header, "checked_title")),
				ptrValue(mapGetString(payload.Header, "approved_by")), ptrValue(mapGetString(payload.Header, "approved_title")), userID, userID,
			)
		}
	}

	// 2. Raw Material
	if payload.RawMaterial != nil {
		_ = deleteByRFQIfProvided(tx, "pfs_jack_raw_material", true, rfqID)
		for _, row := range payload.RawMaterial {
			_ = tx.Exec(
				`INSERT INTO pfs_jack_raw_material (rfq_id, row_no, part_name, material, size_t_mm, size_l_mm, size_w_mm, qty_unit, qty_pcs, weight_unit_kg, total_wt_unit_kg, remarks)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				rfqID, mapGetInt(row, "row_no"), ptrValue(mapGetString(row, "part_name")), ptrValue(mapGetString(row, "material")), ptrValue(mapGetFloat(row, "size_t_mm")), ptrValue(mapGetFloat(row, "size_l_mm")),
				ptrValue(mapGetFloat(row, "size_w_mm")), ptrValue(mapGetFloat(row, "qty_unit")), ptrValue(mapGetFloat(row, "qty_pcs")), ptrValue(mapGetFloat(row, "weight_unit_kg")), ptrValue(mapGetFloat(row, "total_wt_unit_kg")), ptrValue(mapGetString(row, "remarks")),
			)
		}
	}

	// 3. Component Purchase
	if payload.ComponentPurchase != nil {
		_ = deleteByRFQIfProvided(tx, "pfs_jack_component_purchase", true, rfqID)
		for _, row := range payload.ComponentPurchase {
			_ = tx.Exec(
				`INSERT INTO pfs_jack_component_purchase (rfq_id, row_no, part_name, material, qty_unit, part_no_mtm, part_no_supplier, price_idr)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				rfqID, mapGetInt(row, "row_no"), ptrValue(mapGetString(row, "part_name")), ptrValue(mapGetString(row, "material")), ptrValue(mapGetFloat(row, "qty_unit")), ptrValue(mapGetString(row, "part_no_mtm")), ptrValue(mapGetString(row, "part_no_supplier")), ptrValue(mapGetFloat(row, "price_idr")),
			)
		}
	}

	// 4. Process Standard
	if payload.ProcessStandard != nil {
		_ = deleteByRFQIfProvided(tx, "pfs_jack_process_standard", true, rfqID)
		for _, row := range payload.ProcessStandard {
			_ = tx.Exec(
				`INSERT INTO pfs_jack_process_standard (rfq_id, row_no, process_name, line_name, manpower, cycle_time_sec)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				rfqID, mapGetInt(row, "row_no"), ptrValue(mapGetString(row, "process_name")), ptrValue(mapGetString(row, "line_name")), ptrValue(mapGetFloat(row, "manpower")), ptrValue(mapGetFloat(row, "cycle_time_sec")),
			)
		}
	}

	// 5. Assembling
	if payload.Assembling != nil {
		_ = deleteByRFQIfProvided(tx, "pfs_jack_assembling", true, rfqID)
		for _, row := range payload.Assembling {
			_ = tx.Exec(
				`INSERT INTO pfs_jack_assembling (rfq_id, row_no, process_name, line_name, manpower, cycle_time_sec, rate, cost_idr)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				rfqID, mapGetInt(row, "row_no"), ptrValue(mapGetString(row, "process_name")), ptrValue(mapGetString(row, "line_name")), ptrValue(mapGetFloat(row, "manpower")), ptrValue(mapGetFloat(row, "cycle_time_sec")), ptrValue(mapGetFloat(row, "rate")), ptrValue(mapGetFloat(row, "cost_idr")),
			)
		}
	}

	// 6. Packing Delivery
	if payload.PackingDelivery != nil {
		_ = deleteByRFQIfProvided(tx, "pfs_jack_packing_delivery", true, rfqID)
		for _, row := range payload.PackingDelivery {
			_ = tx.Exec(
				`INSERT INTO pfs_jack_packing_delivery (rfq_id, row_no, item_name, price_idr, qty_per_box, cost_per_pcs_idr)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				rfqID, mapGetInt(row, "row_no"), ptrValue(mapGetString(row, "item_name")), ptrValue(mapGetFloat(row, "price_idr")), ptrValue(mapGetFloat(row, "qty_per_box")), ptrValue(mapGetFloat(row, "cost_per_pcs_idr")),
			)
		}
	}

	// 7. Dies Jig
	if payload.DiesJig != nil {
		_ = deleteByRFQIfProvided(tx, "pfs_jack_dies_jig", true, rfqID)
		for _, row := range payload.DiesJig {
			_ = tx.Exec(
				`INSERT INTO pfs_jack_dies_jig (rfq_id, row_no, part_name, value_a, stroke_b, consumable, value_c, stroke_d, formula_type, cost_per_pcs)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				rfqID, mapGetInt(row, "row_no"), ptrValue(mapGetString(row, "part_name")), ptrValue(mapGetFloat(row, "value_a")), ptrValue(mapGetFloat(row, "stroke_b")), ptrValue(mapGetString(row, "consumable")), ptrValue(mapGetFloat(row, "value_c")), ptrValue(mapGetFloat(row, "stroke_d")), ptrValue(mapGetString(row, "formula_type")), ptrValue(mapGetFloat(row, "cost_per_pcs")),
			)
		}
	}

	// 8. Development Cost
	if payload.DevelopmentCost != nil {
		_ = deleteByRFQIfProvided(tx, "pfs_jack_development_cost", true, rfqID)
		for _, row := range payload.DevelopmentCost {
			_ = tx.Exec(
				`INSERT INTO pfs_jack_development_cost (rfq_id, row_no, cost_name, amount_idr, note)
				 VALUES (?, ?, ?, ?, ?)`,
				rfqID, mapGetInt(row, "row_no"), ptrValue(mapGetString(row, "cost_name")), ptrValue(mapGetFloat(row, "amount_idr")), ptrValue(mapGetString(row, "note")),
			)
		}
	}

	// 9. Timeframe
	if payload.Timeframe != nil {
		_ = deleteByRFQIfProvided(tx, "pfs_jack_timeframe", true, rfqID)
		for _, row := range payload.Timeframe {
			_ = tx.Exec(
				`INSERT INTO pfs_jack_timeframe (rfq_id, row_no, main_activity, pic_userid, due_text, start_month_no, end_month_no, remark)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				rfqID, mapGetInt(row, "row_no"), ptrValue(mapGetString(row, "main_activity")), ptrValue(mapGetString(row, "pic_userid")), ptrValue(mapGetString(row, "due_text")), ptrValue(mapGetInt(row, "start_month_no")), ptrValue(mapGetInt(row, "end_month_no")), ptrValue(mapGetString(row, "remark")),
			)
		}
	}

	if err := tx.Commit().Error; err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to commit template-jack data"))
		return
	}

	u.Respond(w, u.Message(true, "Template jack saved successfully"))
}

// ─── PFS Drawing ────────────────────────────────────────────

func ensurePFSDrawingSchema() error {
	db := models.GetDB()
	if err := db.Exec(models.TranslateSQL(`CREATE TABLE IF NOT EXISTS pfs_drawing (
		id          INT AUTO_INCREMENT PRIMARY KEY,
		rfq_id      BIGINT       NOT NULL,
		pfs_type    VARCHAR(20)  NOT NULL DEFAULT 'forging',
		file_name   VARCHAR(255) NOT NULL,
		file_path   VARCHAR(255) NOT NULL,
		uploaded_by VARCHAR(50),
		created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)).Error; err != nil {
		return err
	}

	// Backward-compatible migration for existing table versions.
	if err := db.Exec(`ALTER TABLE pfs_drawing ADD COLUMN pfs_type VARCHAR(20) NOT NULL DEFAULT 'forging'`).Error; err != nil {
		errStr := strings.ToLower(err.Error())
		if !strings.Contains(errStr, "duplicate column") && !strings.Contains(errStr, "already exists") {
			return err
		}
	}

	return nil
}

func GetPFSDrawings(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	pfsType := parsePFSType(r)
	if err := ensurePFSDrawingSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure drawing schema"))
		return
	}

	drawings, err := loadListByQuery(
		`SELECT id, rfq_id, pfs_type, file_name, file_path, uploaded_by, created_at
		 FROM pfs_drawing WHERE rfq_id = ? AND pfs_type = ? ORDER BY id ASC`, rfqID, pfsType)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load drawings"))
		return
	}
	resp := u.Message(true, "PFS drawings")
	resp["data"] = drawings
	u.Respond(w, resp)
}

func UploadPFSDrawing(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringForPFSWrite(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	pfsType := parsePFSType(r)
	if !requireApprovedRFQForPFSWrite(w, rfqID) {
		return
	}
	if err := ensurePFSDrawingSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure drawing schema"))
		return
	}

	_ = r.ParseMultipartForm(20 << 20) // 20 MB

	pth, name, _, _, err := uploadFileFromForm(r, "file")
	if err != nil || pth == nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "File is required"))
		return
	}

	storedPath, err := moveUploadedFileToPFSTypeFolder(*pth, pfsType)
	if err != nil {
		_ = os.Remove(*pth)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to organize drawing file by type"))
		return
	}

	userID, _ := auth.GetUserID(r)

	if err := models.GetDB().Exec(
		`INSERT INTO pfs_drawing (rfq_id, pfs_type, file_name, file_path, uploaded_by) VALUES (?, ?, ?, ?, ?)`,
		rfqID, pfsType, *name, storedPath, userID,
	).Error; err != nil {
		_ = os.Remove(storedPath)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save drawing"))
		return
	}

	resp := u.Message(true, "Drawing uploaded")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID}
	u.Respond(w, resp)
}

func DeletePFSDrawing(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringForPFSWrite(w, r) {
		return
	}

	vars := mux.Vars(r)
	fileID, err := strconv.ParseInt(vars["file_id"], 10, 64)
	if err != nil || fileID <= 0 {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid file ID"))
		return
	}
	pfsType := parsePFSType(r)

	result := models.GetDB().Exec(`DELETE FROM pfs_drawing WHERE id = ? AND pfs_type = ?`, fileID, pfsType)
	if result.Error != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to delete drawing"))
		return
	}
	if result.RowsAffected == 0 {
		u.RespondWithStatus(w, http.StatusNotFound, u.Message(false, "Drawing not found"))
		return
	}
	u.Respond(w, u.Message(true, "Drawing deleted"))
}

// PFS Out House Purchasing Attachments

func requireEngineeringOrPurchasingForOutHouseAttachmentWrite(w http.ResponseWriter, r *http.Request) bool {
	role, ok := auth.GetUserRole(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return false
	}

	normalizedRole := strings.ToLower(strings.TrimSpace(role))
	if normalizedRole != "engineering" && normalizedRole != "purchasing" {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden: only engineering or purchasing can upload out house attachment"))
		return false
	}

	return true
}

func ensurePFSOutHouseAttachmentSchema() error {
	db := models.GetDB()
	if err := db.Exec(models.TranslateSQL(`CREATE TABLE IF NOT EXISTS pfs_out_house_attachment (
		id          INT AUTO_INCREMENT PRIMARY KEY,
		rfq_id      BIGINT       NOT NULL,
		pfs_type    VARCHAR(20)  NOT NULL DEFAULT 'forging',
		file_name   VARCHAR(255) NOT NULL,
		file_path   VARCHAR(255) NOT NULL,
		file_type   VARCHAR(20)  NOT NULL,
		uploaded_by VARCHAR(50),
		created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)).Error; err != nil {
		return err
	}

	// Backward-compatible migration for existing table versions.
	if err := db.Exec(`ALTER TABLE pfs_out_house_attachment ADD COLUMN pfs_type VARCHAR(20) NOT NULL DEFAULT 'forging'`).Error; err != nil {
		errStr := strings.ToLower(err.Error())
		if !strings.Contains(errStr, "duplicate column") && !strings.Contains(errStr, "already exists") {
			return err
		}
	}

	return nil
}

func isAllowedOutHouseAttachment(filename string) bool {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(filename)))
	switch ext {
	case ".xls", ".xlsx", ".doc", ".docx":
		return true
	default:
		return false
	}
}

func moveUploadedFileToPFSTypeFolder(originalPath, pfsType string) (string, error) {
	cleanOriginal := strings.TrimSpace(originalPath)
	if cleanOriginal == "" {
		return "", os.ErrInvalid
	}

	cleanType := strings.ToLower(strings.TrimSpace(pfsType))
	if cleanType != "jack" && cleanType != "toolset" {
		cleanType = "forging"
	}

	targetDir := filepath.ToSlash(filepath.Join("uploads", "technical", cleanType))
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return "", err
	}

	baseName := filepath.Base(cleanOriginal)
	targetPath := filepath.ToSlash(filepath.Join(targetDir, baseName))
	if cleanOriginal == targetPath {
		return targetPath, nil
	}

	if err := os.Rename(cleanOriginal, targetPath); err != nil {
		return "", err
	}

	return targetPath, nil
}

func GetPFSOutHouseAttachments(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	pfsType := parsePFSType(r)
	if err := ensurePFSOutHouseAttachmentSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure out house attachment schema"))
		return
	}

	items, err := loadListByQuery(
		`SELECT id, rfq_id, pfs_type, file_name, file_path, file_type, uploaded_by, created_at
		 FROM pfs_out_house_attachment WHERE rfq_id = ? AND pfs_type = ? ORDER BY id ASC`, rfqID, pfsType)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load out house purchasing attachments"))
		return
	}

	resp := u.Message(true, "PFS out house purchasing attachments")
	resp["data"] = items
	u.Respond(w, resp)
}

func UploadPFSOutHouseAttachment(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringOrPurchasingForOutHouseAttachmentWrite(w, r) {
		return
	}
	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	pfsType := parsePFSType(r)
	if !requireApprovedRFQForPFSWrite(w, rfqID) {
		return
	}
	if err := ensurePFSOutHouseAttachmentSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure out house attachment schema"))
		return
	}

	_ = r.ParseMultipartForm(20 << 20) // 20 MB

	pth, name, _, _, err := uploadFileFromForm(r, "file")
	if err != nil || pth == nil || name == nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "File is required"))
		return
	}

	if !isAllowedOutHouseAttachment(*name) {
		_ = os.Remove(*pth)
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid file type. Allowed: .xls, .xlsx, .doc, .docx"))
		return
	}

	storedPath, err := moveUploadedFileToPFSTypeFolder(*pth, pfsType)
	if err != nil {
		_ = os.Remove(*pth)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to organize out house attachment by type"))
		return
	}

	userID, _ := auth.GetUserID(r)
	fileExt := strings.TrimPrefix(strings.ToLower(filepath.Ext(*name)), ".")

	if err := models.GetDB().Exec(
		`INSERT INTO pfs_out_house_attachment (rfq_id, pfs_type, file_name, file_path, file_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)`,
		rfqID, pfsType, *name, storedPath, fileExt, userID,
	).Error; err != nil {
		_ = os.Remove(storedPath)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save out house purchasing attachment"))
		return
	}

	resp := u.Message(true, "Out house purchasing attachment uploaded")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID}
	u.Respond(w, resp)
}

func DeletePFSOutHouseAttachment(w http.ResponseWriter, r *http.Request) {
	if !requireAuthForPFS(w, r) {
		return
	}
	if !requireEngineeringOrPurchasingForOutHouseAttachmentWrite(w, r) {
		return
	}

	vars := mux.Vars(r)
	fileID, err := strconv.ParseInt(vars["file_id"], 10, 64)
	if err != nil || fileID <= 0 {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid file ID"))
		return
	}
	pfsType := parsePFSType(r)

	if err := ensurePFSOutHouseAttachmentSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to ensure out house attachment schema"))
		return
	}

	var filePath sql.NullString
	if err := models.GetDB().Raw(`SELECT file_path FROM pfs_out_house_attachment WHERE id = ? AND pfs_type = ? LIMIT 1`, fileID, pfsType).Row().Scan(&filePath); err != nil {
		if err == sql.ErrNoRows {
			u.RespondWithStatus(w, http.StatusNotFound, u.Message(false, "File not found"))
			return
		}
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load out house purchasing attachment"))
		return
	}

	if err := models.GetDB().Exec(`DELETE FROM pfs_out_house_attachment WHERE id = ? AND pfs_type = ?`, fileID, pfsType).Error; err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to delete out house purchasing attachment"))
		return
	}

	if filePath.Valid && strings.TrimSpace(filePath.String) != "" {
		_ = os.Remove(filePath.String)
	}

	u.Respond(w, u.Message(true, "Out house purchasing attachment deleted"))
}
