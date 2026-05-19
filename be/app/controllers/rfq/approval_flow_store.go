package rfq

import (
	"database/sql"
	"log"
	"strings"

	"projectrfqv1/app/models"
)

type approvalFlowRow struct {
	RFQID int64 `gorm:"column:rfq_id"`
	Level int   `gorm:"column:level"`
}

func ensureApprovalFlowStore() error {
	createTableQuery := `
		CREATE TABLE IF NOT EXISTS rfq_approval_flow (
			id BIGINT NOT NULL AUTO_INCREMENT,
			rfq_id BIGINT NOT NULL,
			flow_type VARCHAR(20) NOT NULL,
			level INT NOT NULL,
			approved_by VARCHAR(50) NOT NULL,
			approved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY uq_rfq_flow_level (rfq_id, flow_type, level)
		)
	`
	if models.GetDBType() == "postgres" {
		createTableQuery = `
			CREATE TABLE IF NOT EXISTS rfq_approval_flow (
				id BIGSERIAL PRIMARY KEY,
				rfq_id BIGINT NOT NULL,
				flow_type VARCHAR(20) NOT NULL,
				level INT NOT NULL,
				approved_by VARCHAR(50) NOT NULL,
				approved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT uq_rfq_flow_level UNIQUE (rfq_id, flow_type, level)
			)
		`
	}
	return models.GetDB().Exec(createTableQuery).Error
}

func markRFQFlowLevel(rfqID int64, level int, userID string) {
	if err := ensureApprovalFlowStore(); err == nil {
		query := `
			INSERT INTO rfq_approval_flow (rfq_id, flow_type, level, approved_by)
			VALUES (?, 'rfq', ?, ?)
			ON DUPLICATE KEY UPDATE approved_by = VALUES(approved_by), approved_at = CURRENT_TIMESTAMP
		`
		if models.GetDBType() == "postgres" {
			query = `
				INSERT INTO rfq_approval_flow (rfq_id, flow_type, level, approved_by)
				VALUES (?, 'rfq', ?, ?)
				ON CONFLICT (rfq_id, flow_type, level) DO UPDATE SET 
					approved_by = EXCLUDED.approved_by, 
					approved_at = CURRENT_TIMESTAMP
			`
		}
		err = models.GetDB().Exec(query, rfqID, level, userID).Error
		if err == nil {
			return
		}
		log.Println("RFQ FLOW STORE WRITE ERROR:", err)
	} else {
		log.Println("RFQ FLOW STORE INIT ERROR:", err)
	}

	// Fallback marker for environments where custom table cannot be created/used.
	code := "RFQ_L2_APPROVED"
	name := "RFQ Approval Level 2"
	if level == 3 {
		code = "RFQ_L3_APPROVED"
		name = "RFQ Approval Level 3"
	}
	if err := models.GetDB().Exec(`
		INSERT INTO rfq_activity_log (rfq_id, activity_code, activity_name, remarks, created_by)
		VALUES (?, ?, ?, ?, ?)
	`, rfqID, code, name, "", userID).Error; err != nil {
		log.Println("RFQ FLOW FALLBACK LOG WRITE ERROR:", err)
	}
}

func getRFQFlowState(rfqID int64) (bool, bool) {
	l2 := false
	l3 := false

	if err := ensureApprovalFlowStore(); err == nil {
		rows := make([]approvalFlowRow, 0)
		if err := models.GetDB().Raw(`
			SELECT rfq_id, level
			FROM rfq_approval_flow
			WHERE rfq_id = ? AND flow_type = 'rfq' AND level IN (2,3)
		`, rfqID).Scan(&rows).Error; err == nil {
			for _, row := range rows {
				if row.Level == 2 {
					l2 = true
				}
				if row.Level == 3 {
					l3 = true
				}
			}
		}
	}

	var l2Count int64
	_ = models.GetDB().Raw(`
		SELECT COUNT(*)
		FROM rfq_activity_log
		WHERE rfq_id = ? AND activity_code = 'RFQ_L2_APPROVED'
	`, rfqID).Row().Scan(&l2Count)
	if l2Count > 0 {
		l2 = true
	}

	var l3Count int64
	_ = models.GetDB().Raw(`
		SELECT COUNT(*)
		FROM rfq_activity_log
		WHERE rfq_id = ? AND activity_code = 'RFQ_L3_APPROVED'
	`, rfqID).Row().Scan(&l3Count)
	if l3Count > 0 {
		l3 = true
		l2 = true
	}

	var status sql.NullString
	_ = models.GetDB().Raw(`SELECT status FROM rfq WHERE id = ? LIMIT 1`, rfqID).Row().Scan(&status)
	if strings.EqualFold(strings.TrimSpace(status.String), "approved") {
		l2 = true
		l3 = true
	}

	return l2, l3
}

func loadRFQFlowStateByIDs(rfqIDs []int64) map[int64]map[int]bool {
	state := make(map[int64]map[int]bool)
	if len(rfqIDs) == 0 {
		return state
	}

	for _, id := range rfqIDs {
		l2, l3 := getRFQFlowState(id)
		state[id] = map[int]bool{2: l2, 3: l3}
	}
	return state
}
