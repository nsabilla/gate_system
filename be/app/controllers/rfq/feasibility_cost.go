package rfq

import (
	"encoding/json"
	"net/http"
	"strings"

	"projectrfqv1/app/models"
	u "projectrfqv1/utils"

	"strconv"

	"github.com/gorilla/mux"
)

// ─── Payload types ──────────────────────────────────────────────────────────

type feasibilityCostMaterialItem struct {
	Description string  `json:"description"`
	Rate        string  `json:"rate"`
	Amount      string  `json:"amount"`
	UOM         string  `json:"uom"`
	Note        string  `json:"note"`
	Subtotal    float64 `json:"subtotal"`
}

type feasibilityCostPurchasedItem struct {
	Description string  `json:"description"`
	Qty         float64 `json:"qty"`
	Cost        float64 `json:"cost"`
	Subtotal    float64 `json:"subtotal"`
}

type feasibilityCostProcessItem struct {
	Description string  `json:"description"`
	Location    string  `json:"location"`
	CtSec       float64 `json:"ct_sec"`
	Rate        float64 `json:"rate"`
	Subtotal    float64 `json:"subtotal"`
}

type feasibilityCostDiesItem struct {
	Description string  `json:"description"`
	LtVal       float64 `json:"lt_val"`
	CostMio     float64 `json:"cost_mio"`
	Subtotal    float64 `json:"subtotal"`
}

type feasibilityCostOtherItem struct {
	Description string  `json:"description"`
	LtVal       float64 `json:"lt_val"`
	CostVal     float64 `json:"cost_val"`
	Subtotal    float64 `json:"subtotal"`
}

type feasibilityCostPayload struct {
	PFSList        string                         `json:"pfs_list"`
	RawMaterial    string                         `json:"raw_material"`
	Process        string                         `json:"process"`
	ExchangeRate   string                         `json:"exchange_rate"`
	RejectionRate  float64                        `json:"rejection_rate"`
	Materials      []feasibilityCostMaterialItem  `json:"materials"`
	PurchasedItems []feasibilityCostPurchasedItem `json:"purchased_items"`
	ProcessCosts   []feasibilityCostProcessItem   `json:"process_costs"`
	DiesCosts      []feasibilityCostDiesItem      `json:"dies_costs"`
	OtherCosts     []feasibilityCostOtherItem     `json:"other_costs"`
	MfgCost        float64                        `json:"mfg_cost"`
	SellingPrice   float64                        `json:"selling_price"`
	GpmPct         float64                        `json:"gpm_pct"`
	UC             float64                        `json:"uc"`
	UCMPct         float64                        `json:"ucm_pct"`
	Note           string                         `json:"note"`
}

// ─── Schema helpers ─────────────────────────────────────────────────────────

func ensureFeasibilityCostSchema() error {
	db := models.GetDB()

	stmts := []string{
		models.TranslateSQL(`CREATE TABLE IF NOT EXISTS rfq_feasibility_cost (
			id          BIGINT AUTO_INCREMENT PRIMARY KEY,
			rfq_id      BIGINT       NOT NULL,
			cost_type   VARCHAR(10)  NOT NULL DEFAULT 'std',
			pfs_list    VARCHAR(255) NULL,
			raw_material VARCHAR(255) NULL,
			process      VARCHAR(255) NULL,
			exchange_rate VARCHAR(50)  NULL,
			rejection_rate DECIMAL(10,4) NULL DEFAULT 0,
			mfg_cost    DECIMAL(18,4) NULL DEFAULT 0,
			selling_price DECIMAL(18,4) NULL DEFAULT 0,
			gpm_pct     DECIMAL(10,4) NULL DEFAULT 0,
			uc          DECIMAL(18,4) NULL DEFAULT 0,
			ucm_pct     DECIMAL(10,4) NULL DEFAULT 0,
			note        TEXT          NULL,
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
		)`),
		models.TranslateSQL(`CREATE TABLE IF NOT EXISTS rfq_feasibility_cost_material (
			id             BIGINT AUTO_INCREMENT PRIMARY KEY,
			cost_id        BIGINT       NOT NULL,
			row_no         INT          NULL DEFAULT 0,
			description    VARCHAR(255) NULL,
			rate           VARCHAR(50)  NULL,
			amount         VARCHAR(50)  NULL,
			uom            VARCHAR(50)  NULL,
			note           TEXT         NULL,
			subtotal       DECIMAL(18,4) NULL DEFAULT 0
		)`),
		models.TranslateSQL(`CREATE TABLE IF NOT EXISTS rfq_feasibility_cost_purchased (
			id          BIGINT AUTO_INCREMENT PRIMARY KEY,
			cost_id     BIGINT        NOT NULL,
			row_no      INT           NULL DEFAULT 0,
			description VARCHAR(255)  NULL,
			qty         DECIMAL(18,4) NULL DEFAULT 0,
			cost        DECIMAL(18,4) NULL DEFAULT 0,
			subtotal    DECIMAL(18,4) NULL DEFAULT 0
		)`),
		models.TranslateSQL(`CREATE TABLE IF NOT EXISTS rfq_feasibility_cost_process (
			id          BIGINT AUTO_INCREMENT PRIMARY KEY,
			cost_id     BIGINT        NOT NULL,
			row_no      INT           NULL DEFAULT 0,
			description VARCHAR(255)  NULL,
			location    VARCHAR(255)  NULL,
			ct_sec      DECIMAL(18,4) NULL DEFAULT 0,
			rate        DECIMAL(18,4) NULL DEFAULT 0,
			subtotal    DECIMAL(18,4) NULL DEFAULT 0
		)`),
		models.TranslateSQL(`CREATE TABLE IF NOT EXISTS rfq_feasibility_cost_dies (
			id          BIGINT AUTO_INCREMENT PRIMARY KEY,
			cost_id     BIGINT        NOT NULL,
			row_no      INT           NULL DEFAULT 0,
			description VARCHAR(255)  NULL,
			lt_val      DECIMAL(18,4) NULL DEFAULT 0,
			cost_mio    DECIMAL(18,4) NULL DEFAULT 0,
			subtotal    DECIMAL(18,4) NULL DEFAULT 0
		)`),
		models.TranslateSQL(`CREATE TABLE IF NOT EXISTS rfq_feasibility_cost_other (
			id          BIGINT AUTO_INCREMENT PRIMARY KEY,
			cost_id     BIGINT        NOT NULL,
			row_no      INT           NULL DEFAULT 0,
			description VARCHAR(255)  NULL,
			lt_val      DECIMAL(18,4) NULL DEFAULT 0,
			cost_val    DECIMAL(18,4) NULL DEFAULT 0,
			subtotal    DECIMAL(18,4) NULL DEFAULT 0
		)`),
	}

	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			errStr := strings.ToLower(err.Error())
			if !strings.Contains(errStr, "already exists") && !strings.Contains(errStr, "duplicate") {
				return err
			}
		}
	}
	return nil
}

func parseCostType(r *http.Request) string {
	ct := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("cost_type")))
	if ct == "act" || ct == "sim" {
		return ct
	}
	return "std"
}

// ─── GET handler ────────────────────────────────────────────────────────────

func GetFeasibilityCost(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	rfqID, err := strconv.ParseInt(params["id"], 10, 64)
	if err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	costType := parseCostType(r)

	if err := ensureFeasibilityCostSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Schema error"))
		return
	}

	db := models.GetDB()

	// Load header
	header, err := loadOneByQuery(
		`SELECT id, rfq_id, cost_type, pfs_list, raw_material, process, exchange_rate,
		        rejection_rate, mfg_cost, selling_price, gpm_pct, uc, ucm_pct, note
		 FROM rfq_feasibility_cost
		 WHERE rfq_id = ? AND cost_type = ?
		 ORDER BY id DESC LIMIT 1`,
		rfqID, costType,
	)
	if err != nil || header == nil {
		// Return empty structure
		u.Respond(w, map[string]interface{}{"status": true, "data": nil})
		return
	}

	costID := int64(0)
	switch v := header["id"].(type) {
	case int64:
		costID = v
	case []byte:
		costID, _ = strconv.ParseInt(string(v), 10, 64)
	}

	_ = db // db referenced for clarity

	materials, _ := loadListByQuery(
		`SELECT row_no, description, rate, amount, uom, note, subtotal
		 FROM rfq_feasibility_cost_material WHERE cost_id = ? ORDER BY row_no, id`,
		costID)
	purchased, _ := loadListByQuery(
		`SELECT row_no, description, qty, cost, subtotal
		 FROM rfq_feasibility_cost_purchased WHERE cost_id = ? ORDER BY row_no, id`,
		costID)
	process, _ := loadListByQuery(
		`SELECT row_no, description, location, ct_sec, rate, subtotal
		 FROM rfq_feasibility_cost_process WHERE cost_id = ? ORDER BY row_no, id`,
		costID)
	dies, _ := loadListByQuery(
		`SELECT row_no, description, lt_val, cost_mio, subtotal
		 FROM rfq_feasibility_cost_dies WHERE cost_id = ? ORDER BY row_no, id`,
		costID)
	other, _ := loadListByQuery(
		`SELECT row_no, description, lt_val, cost_val, subtotal
		 FROM rfq_feasibility_cost_other WHERE cost_id = ? ORDER BY row_no, id`,
		costID)

	if materials == nil {
		materials = []map[string]interface{}{}
	}
	if purchased == nil {
		purchased = []map[string]interface{}{}
	}
	if process == nil {
		process = []map[string]interface{}{}
	}
	if dies == nil {
		dies = []map[string]interface{}{}
	}
	if other == nil {
		other = []map[string]interface{}{}
	}

	result := map[string]interface{}{
		"id":              header["id"],
		"pfs_list":        header["pfs_list"],
		"raw_material":    header["raw_material"],
		"process":         header["process"],
		"exchange_rate":   header["exchange_rate"],
		"rejection_rate":  header["rejection_rate"],
		"mfg_cost":        header["mfg_cost"],
		"selling_price":   header["selling_price"],
		"gpm_pct":         header["gpm_pct"],
		"uc":              header["uc"],
		"ucm_pct":         header["ucm_pct"],
		"note":            header["note"],
		"materials":       materials,
		"purchased_items": purchased,
		"process_costs":   process,
		"dies_costs":      dies,
		"other_costs":     other,
	}

	resp := u.Message(true, "Feasibility cost loaded")
	resp["data"] = result
	u.Respond(w, resp)

}

// ─── PUT handler ────────────────────────────────────────────────────────────

func UpsertFeasibilityCost(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	rfqID, err := strconv.ParseInt(params["id"], 10, 64)
	if err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	costType := parseCostType(r)

	var payload feasibilityCostPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	if err := ensureFeasibilityCostSchema(); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Schema error"))
		return
	}

	db := models.GetDB()
	tx := db.Begin()
	if tx.Error != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Transaction error"))
		return
	}

	// Upsert header
	var existingCostID int64
	tx.Raw(
		`SELECT id FROM rfq_feasibility_cost WHERE rfq_id = ? AND cost_type = ? LIMIT 1`,
		rfqID, costType,
	).Row().Scan(&existingCostID)

	if existingCostID > 0 {
		if err := tx.Exec(`
			UPDATE rfq_feasibility_cost
			SET pfs_list=?, raw_material=?, process=?, exchange_rate=?,
			    rejection_rate=?, mfg_cost=?, selling_price=?, gpm_pct=?,
			    uc=?, ucm_pct=?, note=?, updated_at=NOW()
			WHERE id=?`,
			payload.PFSList, payload.RawMaterial, payload.Process, payload.ExchangeRate,
			payload.RejectionRate, payload.MfgCost, payload.SellingPrice, payload.GpmPct,
			payload.UC, payload.UCMPct, payload.Note,
			existingCostID,
		).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to update header: "+err.Error()))
			return
		}
	} else {
		if err := tx.Exec(`
			INSERT INTO rfq_feasibility_cost
			(rfq_id, cost_type, pfs_list, raw_material, process, exchange_rate,
			 rejection_rate, mfg_cost, selling_price, gpm_pct, uc, ucm_pct, note)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			rfqID, costType, payload.PFSList, payload.RawMaterial, payload.Process, payload.ExchangeRate,
			payload.RejectionRate, payload.MfgCost, payload.SellingPrice, payload.GpmPct,
			payload.UC, payload.UCMPct, payload.Note,
		).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to insert header: "+err.Error()))
			return
		}
		if models.GetDBType() == "postgres" {
			tx.Raw(`SELECT currval(pg_get_serial_sequence('rfq_feasibility_cost', 'id'))`).Row().Scan(&existingCostID)
		} else {
			tx.Raw(`SELECT LAST_INSERT_ID()`).Row().Scan(&existingCostID)
		}
	}

	costID := existingCostID

	// Replace child rows
	childTables := []string{
		"rfq_feasibility_cost_material",
		"rfq_feasibility_cost_purchased",
		"rfq_feasibility_cost_process",
		"rfq_feasibility_cost_dies",
		"rfq_feasibility_cost_other",
	}
	for _, tbl := range childTables {
		if err := tx.Exec(`DELETE FROM `+tbl+` WHERE cost_id = ?`, costID).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to clear "+tbl))
			return
		}
	}

	for i, m := range payload.Materials {
		if err := tx.Exec(
			`INSERT INTO rfq_feasibility_cost_material (cost_id, row_no, description, rate, amount, uom, note, subtotal)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			costID, i+1, m.Description, m.Rate, m.Amount, m.UOM, m.Note, m.Subtotal,
		).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save material row"))
			return
		}
	}

	for i, p := range payload.PurchasedItems {
		if err := tx.Exec(
			`INSERT INTO rfq_feasibility_cost_purchased (cost_id, row_no, description, qty, cost, subtotal)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			costID, i+1, p.Description, p.Qty, p.Cost, p.Subtotal,
		).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save purchased row"))
			return
		}
	}

	for i, p := range payload.ProcessCosts {
		if err := tx.Exec(
			`INSERT INTO rfq_feasibility_cost_process (cost_id, row_no, description, location, ct_sec, rate, subtotal)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			costID, i+1, p.Description, p.Location, p.CtSec, p.Rate, p.Subtotal,
		).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save process row"))
			return
		}
	}

	for i, d := range payload.DiesCosts {
		if err := tx.Exec(
			`INSERT INTO rfq_feasibility_cost_dies (cost_id, row_no, description, lt_val, cost_mio, subtotal)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			costID, i+1, d.Description, d.LtVal, d.CostMio, d.Subtotal,
		).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save dies row"))
			return
		}
	}

	for i, o := range payload.OtherCosts {
		if err := tx.Exec(
			`INSERT INTO rfq_feasibility_cost_other (cost_id, row_no, description, lt_val, cost_val, subtotal)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			costID, i+1, o.Description, o.LtVal, o.CostVal, o.Subtotal,
		).Error; err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save other row"))
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to commit: "+err.Error()))
		return
	}

	resp := u.Message(true, "Feasibility cost saved")
	resp["data"] = map[string]interface{}{"rfq_id": rfqID, "cost_type": costType}
	u.Respond(w, resp)
}
