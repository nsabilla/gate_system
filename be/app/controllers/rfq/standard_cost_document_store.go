package rfq

import (
	"database/sql"
	"fmt"
	"math"
	"projectrfqv1/app/models"
	"strings"

	"github.com/jinzhu/gorm"
)

func ptrFloat64(v float64) *float64 {
	return &v
}

func scBuildReportNotes() []string {
	return []string{
		"Selected Price: price highlighted in the summary band is the chosen selling price.",
		"GPM = Gross Profit / Selling Price.",
		"UCM = Selling Price - Total Cost per Product.",
	}
}

func scSignatureCell(label string, profile approverProfile) map[string]interface{} {
	name := strings.TrimSpace(profile.Username)
	if name == "" {
		name = "-"
	}

	badge := strings.TrimSpace(profile.BadgeApproval)
	if badge == "" {
		badge = label
	}

	return map[string]interface{}{
		"label": label,
		"name":  name,
		"badge": badge,
	}
}

func scBuildSignatureCells() []map[string]interface{} {
	prepared, _ := loadActiveApproverByRole("engineering", []int{1, 2, 3})
	checked, _ := loadActiveApproverByRole("marketing", []int{2, 1, 3})
	approved1, _ := loadActiveApproverByRole("marketing", []int{3, 2, 1})
	approved2, _ := loadActiveApproverByRole("engineering", []int{3, 2, 1})
	approved3, _ := loadActiveApproverByRole("management", []int{3, 2, 1})

	return []map[string]interface{}{
		scSignatureCell("Approved", approved1),
		scSignatureCell("Approved", approved2),
		scSignatureCell("Approved", approved3),
		scSignatureCell("Checked", checked),
		scSignatureCell("Prepared", prepared),
	}
}

func isIgnorableSchemaErr(err error) bool {
	if err == nil {
		return false
	}
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "duplicate column") ||
		strings.Contains(errStr, "already exists") ||
		strings.Contains(errStr, "duplicate key") ||
		strings.Contains(errStr, "duplicate index") ||
		strings.Contains(errStr, "relation") && strings.Contains(errStr, "already exists")
}

func ensureStandardCostHeaderPFSTypeSchema() error {
	db := models.GetDB()

	if err := db.Exec(`ALTER TABLE standard_cost_header ADD COLUMN pfs_type VARCHAR(20) NOT NULL DEFAULT 'forging'`).Error; err != nil {
		if !isIgnorableSchemaErr(err) {
			return err
		}
	}

	if err := db.Exec(`UPDATE standard_cost_header SET pfs_type = 'forging' WHERE pfs_type IS NULL OR TRIM(COALESCE(pfs_type, '')) = ''`).Error; err != nil {
		return err
	}

	if err := db.Exec(`CREATE INDEX idx_standard_cost_header_rfq_type ON standard_cost_header (rfq_id, pfs_type)`).Error; err != nil {
		if !isIgnorableSchemaErr(err) {
			return err
		}
	}

	return nil
}

func calculateStandardCost(payload *standardCostDocumentPayload) {
	// 1. Calculate Processing
	var totalMDepr, totalLabor, totalFOHFD, totalFOHFI, totalFOHVD, totalFOHVI float64

	var rejectionRate float64
	if payload.Overview.RejectionRate != nil {
		rejectionRate = *payload.Overview.RejectionRate
	}

	for i := range payload.ProcessingRows {
		row := &payload.ProcessingRows[i]

		var rdMdepr, rdLabor, rdFOHFD, rdFOHFI, rdFOHVD, rdFOHVI float64
		if row.RateDetik.MDepr != nil {
			rdMdepr = *row.RateDetik.MDepr
		}
		if row.RateDetik.Labor != nil {
			rdLabor = *row.RateDetik.Labor
		}
		if row.RateDetik.FOHFD != nil {
			rdFOHFD = *row.RateDetik.FOHFD
		}
		if row.RateDetik.FOHFI != nil {
			rdFOHFI = *row.RateDetik.FOHFI
		}
		if row.RateDetik.FOHVD != nil {
			rdFOHVD = *row.RateDetik.FOHVD
		}
		if row.RateDetik.FOHVI != nil {
			rdFOHVI = *row.RateDetik.FOHVI
		}

		rdTotal := rdMdepr + rdLabor + rdFOHFD + rdFOHFI + rdFOHVD + rdFOHVI
		row.RateDetik.TotalRate = ptrFloat64(rdTotal)

		var ct, qty float64
		if row.CycleTime != nil {
			ct = *row.CycleTime
		}
		if row.QtyReqBJ1FG != nil {
			qty = *row.QtyReqBJ1FG
		}

		mult := ct * qty
		pcsMdepr := math.Round(rdMdepr*mult*100) / 100
		pcsLabor := math.Round(rdLabor*mult*100) / 100
		pcsFOHFD := math.Round(rdFOHFD*mult*100) / 100
		pcsFOHFI := math.Round(rdFOHFI*mult*100) / 100
		pcsFOHVD := math.Round(rdFOHVD*mult*100) / 100
		pcsFOHVI := math.Round(rdFOHVI*mult*100) / 100
		pcsTotal := pcsMdepr + pcsLabor + pcsFOHFD + pcsFOHFI + pcsFOHVD + pcsFOHVI

		row.RatePCS.MDepr = ptrFloat64(pcsMdepr)
		row.RatePCS.Labor = ptrFloat64(pcsLabor)
		row.RatePCS.FOHFD = ptrFloat64(pcsFOHFD)
		row.RatePCS.FOHFI = ptrFloat64(pcsFOHFI)
		row.RatePCS.FOHVD = ptrFloat64(pcsFOHVD)
		row.RatePCS.FOHVI = ptrFloat64(pcsFOHVI)
		row.RatePCS.TotalCost = ptrFloat64(pcsTotal)

		totalMDepr += pcsMdepr
		totalLabor += pcsLabor
		totalFOHFD += pcsFOHFD
		totalFOHFI += pcsFOHFI
		totalFOHVD += pcsFOHVD
		totalFOHVI += pcsFOHVI

	}

	grandTotalProcessing := totalMDepr + totalLabor + totalFOHFD + totalFOHFI + totalFOHVD + totalFOHVI
	payload.TotalProcessing.MDepr = ptrFloat64(totalMDepr)
	payload.TotalProcessing.Labor = ptrFloat64(totalLabor)
	payload.TotalProcessing.FOHFD = ptrFloat64(totalFOHFD)
	payload.TotalProcessing.FOHFI = ptrFloat64(totalFOHFI)
	payload.TotalProcessing.FOHVD = ptrFloat64(totalFOHVD)
	payload.TotalProcessing.FOHVI = ptrFloat64(totalFOHVI)
	payload.TotalProcessing.TotalCost = ptrFloat64(grandTotalProcessing)

	var sales float64
	if payload.DirectSummary.Sales != nil {
		sales = *payload.DirectSummary.Sales
	}

	calcPct := func(val float64) *float64 {
		if sales > 0 {
			return ptrFloat64((val / sales) * 100)
		}
		return nil
	}

	payload.PercentageSale.MDepr = calcPct(totalMDepr)
	payload.PercentageSale.Labor = calcPct(totalLabor)
	payload.PercentageSale.FOHFD = calcPct(totalFOHFD)
	payload.PercentageSale.FOHFI = calcPct(totalFOHFI)
	payload.PercentageSale.FOHVD = calcPct(totalFOHVD)
	payload.PercentageSale.FOHVI = calcPct(totalFOHVI)
	payload.PercentageSale.TotalCost = calcPct(grandTotalProcessing)

	// 2. Calculate Material
	var totalMaterial float64
	for i := range payload.MaterialRows {
		row := &payload.MaterialRows[i]

		var qtyPerParent float64
		if row.QtyPerParent != nil {
			qtyPerParent = *row.QtyPerParent
		}

		// qty_req_by_parent = 1 + (Rejection Rate / 100)
		qtyReqByParent := 1 + (rejectionRate / 100)
		row.QtyReqByParent = ptrFloat64(qtyReqByParent)

		// qty_req_bj_1_fg = qty_per_parent * qty_req_by_parent
		qtyReqBJ1FG := qtyPerParent * qtyReqByParent
		row.QtyReqBJ1FG = ptrFloat64(qtyReqBJ1FG)

		var rpUom, qty, exRate float64
		if row.RpUOMMaterial != nil {
			rpUom = *row.RpUOMMaterial
		}
		if row.QtyReqBJ1FG != nil {
			qty = *row.QtyReqBJ1FG
		}
		if row.ExchangeRate != nil {
			exRate = *row.ExchangeRate
		}

		if exRate == 0 {
			exRate = 1
		}

		costPcsFg := rpUom * qty * exRate
		row.CostPcsFG = ptrFloat64(costPcsFg)
		totalMaterial += costPcsFg
	}
	payload.MaterialSummary.TotalRowMaterial = ptrFloat64(totalMaterial)
	payload.MaterialSummary.PresentaseTerhadapSale = calcPct(totalMaterial)

	// 3. Calculate Direct Cost
	var totalDirect float64
	for i := range payload.DirectRows {
		row := &payload.DirectRows[i]
		var valAmt, qtyPerMonth, lifetimeMonth float64
		if row.ValueAmount != nil {
			valAmt = *row.ValueAmount
		}
		if row.QtyPerMonth != nil {
			qtyPerMonth = *row.QtyPerMonth
		}
		if row.LifetimeMonth != nil {
			lifetimeMonth = *row.LifetimeMonth
		}

		// lifetime = qty_per_month * lifetime_month
		lifetime := qtyPerMonth * lifetimeMonth
		row.Lifetime = ptrFloat64(lifetime)

		// cost_pcs_fg = value_amount / lifetime
		var costPcsFg float64
		if lifetime != 0 {
			costPcsFg = valAmt / lifetime
		}
		row.CostPcsFG = ptrFloat64(costPcsFg)
		totalDirect += costPcsFg
	}
	payload.DirectSummary.TotalDirectCostToProduct = ptrFloat64(totalDirect)
	payload.DirectSummary.PresentaseTerhadapSale = calcPct(totalDirect)

	// 4. Calculate Final Summary
	totalCostPerProduct := grandTotalProcessing + totalMaterial + totalDirect
	payload.DirectSummary.TotalCostPerProduct = ptrFloat64(totalCostPerProduct)

	ucm := sales - totalCostPerProduct
	payload.DirectSummary.UnitContributionMargin = ptrFloat64(ucm)
	payload.DirectSummary.UnitContributionMarginPct = calcPct(ucm)

	payload.DirectSummary.GrossProfit = ptrFloat64(ucm)
	payload.DirectSummary.GrossProfitPct = calcPct(ucm)
}

func scNormalizeRowNo(rowNo, idx int) int {
	if rowNo > 0 {
		return rowNo
	}
	return idx + 1
}

func scHeaderIDByRFQType(rfqID int64, pfsType string) (int64, error) {
	var id int64
	err := models.GetDB().Raw(
		`SELECT id FROM standard_cost_header WHERE rfq_id = ? AND pfs_type = ? LIMIT 1`,
		rfqID,
		pfsType,
	).Row().Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func scUpsertHeader(tx *gorm.DB, rfqID int64, pfsType string, payload standardCostDocumentPayload, userID string) (int64, error) {
	var existingID int64
	err := tx.Raw(
		`SELECT id FROM standard_cost_header WHERE rfq_id = ? AND pfs_type = ? LIMIT 1`,
		rfqID,
		pfsType,
	).Row().Scan(&existingID)

	if err == nil {
		execErr := tx.Exec(`
			UPDATE standard_cost_header
			SET company_name = ?, part_number = ?, part_name = ?, customer = ?, rejection_rate = ?,
			    similar_product = ?, updated_by = ?
			WHERE id = ?
		`,
			ptrValue(payload.Overview.CompanyName),
			ptrValue(payload.Overview.PartNumber),
			ptrValue(payload.Overview.PartName),
			ptrValue(payload.Overview.Customer),
			ptrValue(payload.Overview.RejectionRate),
			ptrValue(payload.Overview.SimilarProduct),
			userID,
			existingID,
		).Error
		if execErr != nil {
			return 0, execErr
		}
		return existingID, nil
	}

	if err != sql.ErrNoRows {
		return 0, err
	}

	result := tx.Exec(`
		INSERT INTO standard_cost_header
		(rfq_id, pfs_type, company_name, part_number, part_name, customer, rejection_rate, similar_product, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		rfqID,
		pfsType,
		ptrValue(payload.Overview.CompanyName),
		ptrValue(payload.Overview.PartNumber),
		ptrValue(payload.Overview.PartName),
		ptrValue(payload.Overview.Customer),
		ptrValue(payload.Overview.RejectionRate),
		ptrValue(payload.Overview.SimilarProduct),
		userID,
		userID,
	)
	if result.Error != nil {
		return 0, result.Error
	}

	var newID int64
	if models.GetDBType() == "postgres" {
		if scanErr := tx.Raw(`SELECT currval(pg_get_serial_sequence('standard_cost_header', 'id'))`).Row().Scan(&newID); scanErr != nil {
			return 0, scanErr
		}
	} else {
		if scanErr := tx.Raw(`SELECT LAST_INSERT_ID()`).Row().Scan(&newID); scanErr != nil {
			return 0, scanErr
		}
	}
	return newID, nil
}

func scReplaceProcessingRows(tx *gorm.DB, headerID int64, rows []standardCostProcessingItemPayload) error {
	if err := tx.Exec(`DELETE FROM standard_cost_processing WHERE header_id = ?`, headerID).Error; err != nil {
		return err
	}
	for idx, row := range rows {
		if err := tx.Exec(`
			INSERT INTO standard_cost_processing
			(header_id, row_no, wc, ops_no, part_number, start_factor, percent_ng, processing, product,
			 qty_per_parent, qty_req_bj_1_fg, cycle_time, standard_cost_master_id, labor, mdepr, fd, fi, vd, vi,
			 rate_detik_mdepr, rate_detik_labor, rate_detik_fohfd, rate_detik_fohfi, rate_detik_fohvd, rate_detik_fohvi, rate_detik_total_rate,
			 rate_pcs_mdepr, rate_pcs_labor, rate_pcs_fohfd, rate_pcs_fohfi, rate_pcs_fohvd, rate_pcs_fohvi, rate_pcs_total_cost)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			headerID,
			scNormalizeRowNo(row.RowNo, idx),
			ptrValue(row.WC),
			ptrValue(row.OpsNo),
			ptrValue(row.PartNumber),
			ptrValue(row.StartFactor),
			ptrValue(row.PercentNG),
			ptrValue(row.Processing),
			ptrValue(row.Product),
			ptrValue(row.QtyPerParent),
			ptrValue(row.QtyReqBJ1FG),
			ptrValue(row.CycleTime),
			ptrValue(row.StandardCostMasterID),
			ptrValue(row.Labor),
			ptrValue(row.MDepr),
			ptrValue(row.FD),
			ptrValue(row.FI),
			ptrValue(row.VD),
			ptrValue(row.VI),
			ptrValue(row.RateDetik.MDepr),
			ptrValue(row.RateDetik.Labor),
			ptrValue(row.RateDetik.FOHFD),
			ptrValue(row.RateDetik.FOHFI),
			ptrValue(row.RateDetik.FOHVD),
			ptrValue(row.RateDetik.FOHVI),
			ptrValue(row.RateDetik.TotalRate),
			ptrValue(row.RatePCS.MDepr),
			ptrValue(row.RatePCS.Labor),
			ptrValue(row.RatePCS.FOHFD),
			ptrValue(row.RatePCS.FOHFI),
			ptrValue(row.RatePCS.FOHVD),
			ptrValue(row.RatePCS.FOHVI),
			ptrValue(row.RatePCS.TotalCost),
		).Error; err != nil {
			return err
		}
	}
	return nil
}

func scReplaceMaterialRows(tx *gorm.DB, headerID int64, rows []standardCostMaterialItemPayload) error {
	if err := tx.Exec(`DELETE FROM standard_cost_material WHERE header_id = ?`, headerID).Error; err != nil {
		return err
	}
	for idx, row := range rows {
		if err := tx.Exec(`
			INSERT INTO standard_cost_material
			(header_id, row_no, raw_material, top_value, material_code, product, process,
			 qty_per_parent, uom, qty_req_by_parent, qty_req_bj_1_fg, top_imp_loc, import_flag,
			 currency, exchange_rate, rp_uom_material, cost_pcs_fg)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			headerID,
			scNormalizeRowNo(row.RowNo, idx),
			ptrValue(row.RawMaterial),
			ptrValue(row.TopValue),
			ptrValue(row.MaterialCode),
			ptrValue(row.Product),
			ptrValue(row.Process),
			ptrValue(row.QtyPerParent),
			ptrValue(row.UOM),
			ptrValue(row.QtyReqByParent),
			ptrValue(row.QtyReqBJ1FG),
			ptrValue(row.TopImpLoc),
			ptrValue(row.ImportFlag),
			ptrValue(row.Currency),
			ptrValue(row.ExchangeRate),
			ptrValue(row.RpUOMMaterial),
			ptrValue(row.CostPcsFG),
		).Error; err != nil {
			return err
		}
	}
	return nil
}

func scReplaceDirectRows(tx *gorm.DB, headerID int64, rows []standardCostDirectItemPayload) error {
	if err := tx.Exec(`DELETE FROM standard_cost_direct WHERE header_id = ?`, headerID).Error; err != nil {
		return err
	}
	for idx, row := range rows {
		if err := tx.Exec(`
			INSERT INTO standard_cost_direct
			(header_id, row_no, direct_cost_name, kode_ce, used_in_process_wc, qty_req_bj_1_fg, value_amount, qty_per_month, lifetime_month, lifetime, cost_pcs_fg)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			headerID,
			scNormalizeRowNo(row.RowNo, idx),
			ptrValue(row.DirectCostName),
			ptrValue(row.KodeCE),
			ptrValue(row.UsedInProcessWC),
			ptrValue(row.QtyReqBJ1FG),
			ptrValue(row.ValueAmount),
			ptrValue(row.QtyPerMonth),
			ptrValue(row.LifetimeMonth),
			ptrValue(row.Lifetime),
			ptrValue(row.CostPcsFG),
		).Error; err != nil {
			return err
		}
	}
	return nil
}

func scUpsertMaterialSummary(tx *gorm.DB, headerID int64, summary standardCostMaterialSummaryPayload) error {
	query := `
		INSERT INTO standard_cost_material_summary (header_id, total_row_material, presentase_terhadap_sale)
		VALUES (?, ?, ?)
		ON DUPLICATE KEY UPDATE
			total_row_material = VALUES(total_row_material),
			presentase_terhadap_sale = VALUES(presentase_terhadap_sale)
	`
	if models.GetDBType() == "postgres" {
		query = `
			INSERT INTO standard_cost_material_summary (header_id, total_row_material, presentase_terhadap_sale)
			VALUES (?, ?, ?)
			ON CONFLICT (header_id) DO UPDATE SET
				total_row_material = EXCLUDED.total_row_material,
				presentase_terhadap_sale = EXCLUDED.presentase_terhadap_sale
		`
	}

	return tx.Exec(query,
		headerID,
		ptrValue(summary.TotalRowMaterial),
		ptrValue(summary.PresentaseTerhadapSale),
	).Error
}

func scUpsertDirectSummary(tx *gorm.DB, headerID int64, summary standardCostDirectSummaryPayload) error {
	query := `
		INSERT INTO standard_cost_direct_summary
		(header_id, total_direct_cost_to_product, presentase_terhadap_sale, summary_title,
		 total_cost_per_product, sales, unit_contribution_margin, unit_contribution_margin_pct,
		 gross_profit, gross_profit_pct, remark)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			total_direct_cost_to_product = VALUES(total_direct_cost_to_product),
			presentase_terhadap_sale = VALUES(presentase_terhadap_sale),
			summary_title = VALUES(summary_title),
			total_cost_per_product = VALUES(total_cost_per_product),
			sales = VALUES(sales),
			unit_contribution_margin = VALUES(unit_contribution_margin),
			unit_contribution_margin_pct = VALUES(unit_contribution_margin_pct),
			gross_profit = VALUES(gross_profit),
			gross_profit_pct = VALUES(gross_profit_pct),
			remark = VALUES(remark)
	`
	if models.GetDBType() == "postgres" {
		query = `
			INSERT INTO standard_cost_direct_summary
			(header_id, total_direct_cost_to_product, presentase_terhadap_sale, summary_title,
			 total_cost_per_product, sales, unit_contribution_margin, unit_contribution_margin_pct,
			 gross_profit, gross_profit_pct, remark)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (header_id) DO UPDATE SET
				total_direct_cost_to_product = EXCLUDED.total_direct_cost_to_product,
				presentase_terhadap_sale = EXCLUDED.presentase_terhadap_sale,
				summary_title = EXCLUDED.summary_title,
				total_cost_per_product = EXCLUDED.total_cost_per_product,
				sales = EXCLUDED.sales,
				unit_contribution_margin = EXCLUDED.unit_contribution_margin,
				unit_contribution_margin_pct = EXCLUDED.unit_contribution_margin_pct,
				gross_profit = EXCLUDED.gross_profit,
				gross_profit_pct = EXCLUDED.gross_profit_pct,
				remark = EXCLUDED.remark
		`
	}

	return tx.Exec(query,
		headerID,
		ptrValue(summary.TotalDirectCostToProduct),
		ptrValue(summary.PresentaseTerhadapSale),
		ptrValue(summary.SummaryTitle),
		ptrValue(summary.TotalCostPerProduct),
		ptrValue(summary.Sales),
		ptrValue(summary.UnitContributionMargin),
		ptrValue(summary.UnitContributionMarginPct),
		ptrValue(summary.GrossProfit),
		ptrValue(summary.GrossProfitPct),
		ptrValue(summary.Remark),
	).Error
}

func scUpsertTotalProcessing(tx *gorm.DB, headerID int64, data standardCostTotalProcessingPayload) error {
	query := `
		INSERT INTO standard_cost_total_processing (header_id, mdepr, labor, fohfd, fohfi, fohvd, fohvi, total_cost)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			mdepr = VALUES(mdepr),
			labor = VALUES(labor),
			fohfd = VALUES(fohfd),
			fohfi = VALUES(fohfi),
			fohvd = VALUES(fohvd),
			fohvi = VALUES(fohvi),
			total_cost = VALUES(total_cost)
	`
	if models.GetDBType() == "postgres" {
		query = `
			INSERT INTO standard_cost_total_processing (header_id, mdepr, labor, fohfd, fohfi, fohvd, fohvi, total_cost)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (header_id) DO UPDATE SET
				mdepr = EXCLUDED.mdepr,
				labor = EXCLUDED.labor,
				fohfd = EXCLUDED.fohfd,
				fohfi = EXCLUDED.fohfi,
				fohvd = EXCLUDED.fohvd,
				fohvi = EXCLUDED.fohvi,
				total_cost = EXCLUDED.total_cost
		`
	}

	return tx.Exec(query,
		headerID,
		ptrValue(data.MDepr),
		ptrValue(data.Labor),
		ptrValue(data.FOHFD),
		ptrValue(data.FOHFI),
		ptrValue(data.FOHVD),
		ptrValue(data.FOHVI),
		ptrValue(data.TotalCost),
	).Error
}

func scUpsertPercentageSale(tx *gorm.DB, headerID int64, data standardCostPercentageSalePayload) error {
	query := `
		INSERT INTO standard_cost_percentage_sale (header_id, mdepr, labor, fohfd, fohfi, fohvd, fohvi, total_cost)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			mdepr = VALUES(mdepr),
			labor = VALUES(labor),
			fohfd = VALUES(fohfd),
			fohfi = VALUES(fohfi),
			fohvd = VALUES(fohvd),
			fohvi = VALUES(fohvi),
			total_cost = VALUES(total_cost)
	`
	if models.GetDBType() == "postgres" {
		query = `
			INSERT INTO standard_cost_percentage_sale (header_id, mdepr, labor, fohfd, fohfi, fohvd, fohvi, total_cost)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (header_id) DO UPDATE SET
				mdepr = EXCLUDED.mdepr,
				labor = EXCLUDED.labor,
				fohfd = EXCLUDED.fohfd,
				fohfi = EXCLUDED.fohfi,
				fohvd = EXCLUDED.fohvd,
				fohvi = EXCLUDED.fohvi,
				total_cost = EXCLUDED.total_cost
		`
	}

	return tx.Exec(query,
		headerID,
		ptrValue(data.MDepr),
		ptrValue(data.Labor),
		ptrValue(data.FOHFD),
		ptrValue(data.FOHFI),
		ptrValue(data.FOHVD),
		ptrValue(data.FOHVI),
		ptrValue(data.TotalCost),
	).Error
}

func scLoadDocumentByRFQType(rfqID int64, pfsType string) (map[string]interface{}, error) {
	if err := ensureStandardCostHeaderPFSTypeSchema(); err != nil {
		return nil, err
	}

	headerID, err := scHeaderIDByRFQType(rfqID, pfsType)
	if err == sql.ErrNoRows {
		return map[string]interface{}{
			"report_code":      "",
			"report_notes":     scBuildReportNotes(),
			"signature_cells":  scBuildSignatureCells(),
			"overview":         map[string]interface{}{},
			"processing_rows":  []map[string]interface{}{},
			"material_rows":    []map[string]interface{}{},
			"material_summary": map[string]interface{}{},
			"direct_rows":      []map[string]interface{}{},
			"direct_summary":   map[string]interface{}{},
			"total_processing": map[string]interface{}{},
			"percentage_sale":  map[string]interface{}{},
		}, nil
	}
	if err != nil {
		return nil, err
	}

	reportCode := fmt.Sprintf("PR4-FRM-%05d", headerID)

	overview, err := loadOneByQuery(`
		SELECT company_name, part_number, part_name, customer, rejection_rate, similar_product
		FROM standard_cost_header
		WHERE id = ?
		LIMIT 1
	`, headerID)
	if err != nil {
		return nil, err
	}

	processingRows, err := loadListByQuery(`
		SELECT row_no, wc, ops_no, part_number, start_factor, percent_ng, processing, product,
		       qty_per_parent, qty_req_bj_1_fg, cycle_time,
		       standard_cost_master_id, labor, mdepr, fd, fi, vd, vi,
		       rate_detik_mdepr as 'rate_detik.mdepr', rate_detik_labor as 'rate_detik.labor', 
		       rate_detik_fohfd as 'rate_detik.fohfd', rate_detik_fohfi as 'rate_detik.fohfi',
		       rate_detik_fohvd as 'rate_detik.fohvd', rate_detik_fohvi as 'rate_detik.fohvi',
		       rate_detik_total_rate as 'rate_detik.total_rate',
		       rate_pcs_mdepr as 'rate_pcs.mdepr', rate_pcs_labor as 'rate_pcs.labor',
		       rate_pcs_fohfd as 'rate_pcs.fohfd', rate_pcs_fohfi as 'rate_pcs.fohfi',
		       rate_pcs_fohvd as 'rate_pcs.fohvd', rate_pcs_fohvi as 'rate_pcs.fohvi',
		       rate_pcs_total_cost as 'rate_pcs.total_cost'
		FROM standard_cost_processing
		WHERE header_id = ?
		ORDER BY row_no ASC, id ASC
	`, headerID)
	if err != nil {
		return nil, err
	}

	materialRows, err := loadListByQuery(`
		SELECT row_no, raw_material, top_value, material_code, product, process,
		       qty_per_parent, uom, qty_req_by_parent, qty_req_bj_1_fg, top_imp_loc, import_flag,
		       currency, exchange_rate, rp_uom_material, cost_pcs_fg
		FROM standard_cost_material
		WHERE header_id = ?
		ORDER BY row_no ASC, id ASC
	`, headerID)
	if err != nil {
		return nil, err
	}

	materialSummary, err := loadOneByQuery(`
		SELECT total_row_material, presentase_terhadap_sale
		FROM standard_cost_material_summary
		WHERE header_id = ?
		LIMIT 1
	`, headerID)
	if err != nil {
		return nil, err
	}

	directRows, err := loadListByQuery(`
		SELECT row_no, direct_cost_name, kode_ce, used_in_process_wc, qty_req_bj_1_fg, value_amount, qty_per_month, lifetime_month, lifetime, cost_pcs_fg
		FROM standard_cost_direct
		WHERE header_id = ?
		ORDER BY row_no ASC, id ASC
	`, headerID)
	if err != nil {
		return nil, err
	}

	directSummary, err := loadOneByQuery(`
		SELECT total_direct_cost_to_product, presentase_terhadap_sale, summary_title,
		       total_cost_per_product, sales, unit_contribution_margin, unit_contribution_margin_pct,
		       gross_profit, gross_profit_pct, remark
		FROM standard_cost_direct_summary
		WHERE header_id = ?
		LIMIT 1
	`, headerID)
	if err != nil {
		return nil, err
	}

	totalProcessing, err := loadOneByQuery(`
		SELECT mdepr, labor, fohfd, fohfi, fohvd, fohvi, total_cost
		FROM standard_cost_total_processing
		WHERE header_id = ?
		LIMIT 1
	`, headerID)
	if err != nil {
		return nil, err
	}

	percentageSale, err := loadOneByQuery(`
		SELECT mdepr, labor, fohfd, fohfi, fohvd, fohvi, total_cost
		FROM standard_cost_percentage_sale
		WHERE header_id = ?
		LIMIT 1
	`, headerID)
	if err != nil {
		return nil, err
	}

	if overview == nil {
		overview = map[string]interface{}{}
	}
	if processingRows == nil {
		processingRows = []map[string]interface{}{}
	}
	if materialRows == nil {
		materialRows = []map[string]interface{}{}
	}
	if materialSummary == nil {
		materialSummary = map[string]interface{}{}
	}
	if directRows == nil {
		directRows = []map[string]interface{}{}
	}
	if directSummary == nil {
		directSummary = map[string]interface{}{}
	}
	if totalProcessing == nil {
		totalProcessing = map[string]interface{}{}
	}
	if percentageSale == nil {
		percentageSale = map[string]interface{}{}
	}

	return map[string]interface{}{
		"report_code":      reportCode,
		"report_notes":     scBuildReportNotes(),
		"signature_cells":  scBuildSignatureCells(),
		"overview":         overview,
		"processing_rows":  processingRows,
		"material_rows":    materialRows,
		"material_summary": materialSummary,
		"direct_rows":      directRows,
		"direct_summary":   directSummary,
		"total_processing": totalProcessing,
		"percentage_sale":  percentageSale,
	}, nil
}

func scUpsertDocumentByRFQType(rfqID int64, pfsType string, payload standardCostDocumentPayload, userID string) error {
	if err := ensureStandardCostHeaderPFSTypeSchema(); err != nil {
		return err
	}

	calculateStandardCost(&payload)

	tx := models.GetDB().Begin()
	if tx.Error != nil {
		return tx.Error
	}

	headerID, err := scUpsertHeader(tx, rfqID, pfsType, payload, userID)
	if err != nil {
		tx.Rollback()
		return err
	}

	steps := []struct {
		name string
		run  func() error
	}{
		{name: "processing", run: func() error { return scReplaceProcessingRows(tx, headerID, payload.ProcessingRows) }},
		{name: "material", run: func() error { return scReplaceMaterialRows(tx, headerID, payload.MaterialRows) }},
		{name: "direct", run: func() error { return scReplaceDirectRows(tx, headerID, payload.DirectRows) }},
		{name: "material_summary", run: func() error { return scUpsertMaterialSummary(tx, headerID, payload.MaterialSummary) }},
		{name: "direct_summary", run: func() error { return scUpsertDirectSummary(tx, headerID, payload.DirectSummary) }},
		{name: "total_processing", run: func() error { return scUpsertTotalProcessing(tx, headerID, payload.TotalProcessing) }},
		{name: "percentage_sale", run: func() error { return scUpsertPercentageSale(tx, headerID, payload.PercentageSale) }},
	}

	for _, step := range steps {
		if runErr := step.run(); runErr != nil {
			tx.Rollback()
			return fmt.Errorf("failed to save %s: %w", step.name, runErr)
		}
	}

	return tx.Commit().Error
}
