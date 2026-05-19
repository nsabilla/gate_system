package rfq

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

type rfqActivityCodeRow struct {
	ID      int64  `gorm:"column:id"`
	CodeAct string `gorm:"column:code_act"`
}

type pfsExistRow struct {
	RFQID  int64 `gorm:"column:rfq_id"`
	HasPFS int64 `gorm:"column:has_pfs"`
}

func parseRFQID(value interface{}) (int64, bool) {
	switch v := value.(type) {
	case int64:
		return v, v > 0
	case int32:
		id := int64(v)
		return id, id > 0
	case int:
		id := int64(v)
		return id, id > 0
	case float64:
		id := int64(v)
		if float64(id) != v || id <= 0 {
			return 0, false
		}
		return id, true
	case float32:
		id := int64(v)
		if float32(id) != v || id <= 0 {
			return 0, false
		}
		return id, true
	case uint64:
		if v == 0 {
			return 0, false
		}
		return int64(v), true
	case uint32:
		if v == 0 {
			return 0, false
		}
		return int64(v), true
	case uint:
		if v == 0 {
			return 0, false
		}
		return int64(v), true
	case []byte:
		id, err := strconv.ParseInt(string(v), 10, 64)
		if err != nil || id <= 0 {
			return 0, false
		}
		return id, true
	case string:
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil || id <= 0 {
			return 0, false
		}
		return id, true
	default:
		return 0, false
	}
}

func GetRFQList(w http.ResponseWriter, r *http.Request) {

	// ===== AUTH =====
	userID, ok := auth.GetUserID(r)
	if !ok {
		u.Respond(w, u.Message(false, "Unauthorized"))
		return
	}

	role, ok := auth.GetUserRole(r)
	if !ok {
		u.Respond(w, u.Message(false, "Unauthorized"))
		return
	}

	status := r.URL.Query().Get("status")
	keyword := r.URL.Query().Get("q")
	statusFilter := normalizeRFQStatusFilter(status)
	statusParam := nullIfEmpty(statusFilter)

	log.Println("[RFQ LIST]",
		"userID:", userID,
		"role:", role,
		"status:", statusFilter,
		"keyword:", keyword,
	)

	currentApprover, err := loadApproverProfile(userID)
	if err != nil {
		log.Println("RFQ APPROVER PROFILE ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate approver"))
		return
	}

	normalizedRole := strings.ToLower(strings.TrimSpace(role))
	canApprove := (normalizedRole == "marketing" || normalizedRole == "management") &&
		currentApprover.HasApproval && currentApprover.IsActive &&
		(currentApprover.Level == 2 || currentApprover.Level == 3)

	// sp_rfq_list limits marketing to own RFQs. For active marketing approvers,
	// use non-marketing role key so they can review and approve all RFQs.
	effectiveRole := role
	if (normalizedRole == "marketing" || normalizedRole == "management") && canApprove {
		effectiveRole = "management"
	}

	// ===== DIRECT QUERY (PostgreSQL-safe) =====
	rows, err := models.GetDB().Raw(models.TranslateSQL(`
		SELECT
			r.id,
			r.rfq_no,
			r.status,
			r.pfs_type,
			r.created_by,
			r.created_at,
			MAX(CASE WHEN LOWER(TRIM(p.product_type)) = 'new' THEN p.part_name END) AS new_part_name,
			MAX(CASE WHEN LOWER(TRIM(p.product_type)) = 'similar' THEN p.part_name END) AS similar_part_name
		FROM rfq r
		LEFT JOIN rfq_detail p
			ON p.rfq_id = r.id
		WHERE
			(
				LOWER(TRIM(COALESCE(?, ''))) <> 'marketing'
				OR r.created_by = ?
			)
			AND (
				NULLIF(TRIM(COALESCE(?, '')), '') IS NULL
				OR (
					LOWER(TRIM(COALESCE(?, ''))) = 'pending'
					AND LOWER(TRIM(r.status)) IN ('pending', 'submitted')
				)
				OR (
					LOWER(TRIM(COALESCE(?, ''))) <> 'pending'
					AND LOWER(TRIM(r.status)) = LOWER(TRIM(COALESCE(?, '')))
				)
			)
			AND (
				NULLIF(TRIM(COALESCE(?, '')), '') IS NULL
				OR r.rfq_no ILIKE '%' || ? || '%'
				OR EXISTS (
					SELECT 1
					FROM rfq_detail px
					WHERE px.rfq_id = r.id
					  AND px.part_name ILIKE '%' || ? || '%'
				)
			)
		GROUP BY r.id, r.rfq_no, r.status, r.pfs_type, r.created_by, r.created_at
		ORDER BY r.created_at DESC
	`),
		effectiveRole,
		userID,
		statusParam,
		statusParam,
		statusParam,
		statusParam,
		nullIfEmpty(keyword),
		nullIfEmpty(keyword),
		nullIfEmpty(keyword),
	).Rows()

	if err != nil {
		log.Println("SP RFQ LIST ERROR:", err)
		u.Respond(w, u.Message(false, "Failed to load RFQ list"))
		return
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		log.Println("COLUMN ERROR:", err)
		u.Respond(w, u.Message(false, "Failed to read RFQ list"))
		return
	}

	results := make([]map[string]interface{}, 0)

	for rows.Next() {
		// prepare value holders
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))

		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			log.Println("ROW SCAN ERROR:", err)
			continue
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}

		results = append(results, row)
	}

	if canApprove {
		extraRows := make([]map[string]interface{}, 0)
		err = models.GetDB().Raw(models.TranslateSQL(`
			SELECT
				r.id,
				r.rfq_no,
				r.status,
				r.pfs_type,
				r.created_by,
				r.created_at,
				MAX(CASE WHEN LOWER(TRIM(d.product_type)) = 'new' THEN d.part_name END) AS new_part_name,
				MAX(CASE WHEN LOWER(TRIM(d.product_type)) = 'similar' THEN d.part_name END) AS similar_part_name
			FROM rfq r
			LEFT JOIN rfq_detail d
				ON d.rfq_id = r.id
			WHERE
				(r.statusactivity = '3' OR r.statusactivity LIKE '%-3' OR r.statusactivity LIKE '%03')
				AND (
					CAST(? AS VARCHAR) IS NULL
					OR (
						LOWER(TRIM(CAST(? AS VARCHAR))) = 'pending'
						AND LOWER(TRIM(r.status)) IN ('pending', 'submitted')
					)
					OR (
						LOWER(TRIM(CAST(? AS VARCHAR))) <> 'pending'
						AND LOWER(TRIM(r.status)) = LOWER(TRIM(CAST(? AS VARCHAR)))
					)
				)
				AND (
					CAST(? AS VARCHAR) IS NULL
					OR r.rfq_no LIKE CONCAT('%', CAST(? AS VARCHAR), '%')
					OR EXISTS (
						SELECT 1
						FROM rfq_detail dx
						WHERE dx.rfq_id = r.id
						  AND dx.part_name LIKE CONCAT('%', CAST(? AS VARCHAR), '%')
					)
				)
			GROUP BY r.id, r.rfq_no, r.status, r.pfs_type, r.created_by, r.created_at
			ORDER BY r.created_at DESC
		`), statusParam, statusParam, statusParam, statusParam, nullIfEmpty(keyword), nullIfEmpty(keyword), nullIfEmpty(keyword)).Scan(&extraRows).Error
		if err != nil {
			log.Println("RFQ APPROVER EXTRA LIST ERROR:", err)
		} else {
			seen := make(map[int64]struct{}, len(results))
			for _, row := range results {
				id, ok := parseRFQID(row["id"])
				if !ok {
					continue
				}
				seen[id] = struct{}{}
			}
			for _, row := range extraRows {
				id, ok := parseRFQID(row["id"])
				if !ok {
					continue
				}
				if _, exists := seen[id]; exists {
					continue
				}
				results = append(results, row)
				seen[id] = struct{}{}
			}
		}
	}

	rfqIDs := make([]int64, 0, len(results))
	seenID := make(map[int64]struct{}, len(results))
	for _, row := range results {
		id, ok := parseRFQID(row["id"])
		if !ok {
			continue
		}
		if _, exists := seenID[id]; exists {
			continue
		}
		seenID[id] = struct{}{}
		rfqIDs = append(rfqIDs, id)
	}

	if len(rfqIDs) > 0 {
		activityRows := make([]rfqActivityCodeRow, 0, len(rfqIDs))
		if err := models.GetDB().Raw(models.TranslateSQL(`
			SELECT id, CAST(statusactivity AS CHAR) AS code_act
			FROM rfq
			WHERE id IN (?)
		`), rfqIDs).Scan(&activityRows).Error; err != nil {
			log.Println("RFQ ACTIVITY CODE LOAD ERROR:", err)
		} else {
			codeByID := make(map[int64]string, len(activityRows))
			for _, item := range activityRows {
				codeByID[item.ID] = item.CodeAct
			}

			for i := range results {
				id, ok := parseRFQID(results[i]["id"])
				if !ok {
					continue
				}
				if code, exists := codeByID[id]; exists {
					results[i]["code_act"] = code
					results[i]["statusactivity"] = code
				}
			}
		}
	}

	rfqApprovalState := loadRFQFlowStateByIDs(rfqIDs)

	pfsCreatedByRFQID := make(map[int64]bool, len(rfqIDs))
	if len(rfqIDs) > 0 {
		pfsRows := make([]pfsExistRow, 0, len(rfqIDs))
		err := models.GetDB().Raw(`
			SELECT
				r.id AS rfq_id,
				CASE
					WHEN EXISTS (SELECT 1 FROM pfs_ov po WHERE po.rfq_id = r.id)
						OR EXISTS (SELECT 1 FROM pfs_pp pp WHERE pp.rfq_id = r.id)
						OR EXISTS (SELECT 1 FROM pfs_ts pt WHERE pt.rfq_id = r.id)
						OR EXISTS (SELECT 1 FROM pfs_inv pi WHERE pi.rfq_id = r.id)
						OR EXISTS (SELECT 1 FROM pfs_inv_sum ps WHERE ps.rfq_id = r.id)
					THEN 1
					ELSE 0
				END AS has_pfs
			FROM rfq r
			WHERE r.id IN (?)
		`, rfqIDs).Scan(&pfsRows).Error
		if err != nil {
			log.Println("RFQ PFS EXISTS LOAD ERROR:", err)
		} else {
			for _, row := range pfsRows {
				pfsCreatedByRFQID[row.RFQID] = row.HasPFS > 0
			}
		}
	}

	rfqApprover, err := loadActiveApproverByRole("marketing", []int{2, 1})
	if err != nil {
		log.Println("RFQ APPROVER MARKETING LOAD ERROR:", err)
	}
	pfsApprover, err := loadActiveApproverByRole("engineering", []int{3, 2, 1})
	if err != nil {
		log.Println("RFQ APPROVER ENGINEERING LOAD ERROR:", err)
	}
	rfqPrepared, err := loadActiveApproverByRole("marketing", []int{1, 2, 3})
	if err != nil {
		log.Println("RFQ PREPARED MARKETING LOAD ERROR:", err)
	}
	rfqL2, err := loadActiveApproverByRole("marketing", []int{2, 3, 1})
	if err != nil {
		log.Println("RFQ L2 MARKETING LOAD ERROR:", err)
	}
	rfqL3, err := loadActiveApproverByRole("marketing", []int{3, 2, 1})
	if err != nil {
		log.Println("RFQ L3 MARKETING LOAD ERROR:", err)
	}
	pfsPrepared, err := loadActiveApproverByRole("engineering", []int{1, 2, 3})
	if err != nil {
		log.Println("PFS PREPARED ENGINEERING LOAD ERROR:", err)
	}
	pfsL2, err := loadActiveApproverByRole("engineering", []int{2, 3, 1})
	if err != nil {
		log.Println("PFS L2 ENGINEERING LOAD ERROR:", err)
	}
	pfsL3, err := loadActiveApproverByRole("engineering", []int{3, 2, 1})
	if err != nil {
		log.Println("PFS L3 ENGINEERING LOAD ERROR:", err)
	}
	for i := range results {
		id, ok := parseRFQID(results[i]["id"])
		hasPFS := false
		if ok {
			hasPFS = pfsCreatedByRFQID[id]
			results[i]["pfs_created"] = hasPFS

			state := rfqApprovalState[id]
			l2Done := state != nil && state[2]
			l3Done := state != nil && state[3]
			results[i]["rfq_l2_approved"] = l2Done
			results[i]["rfq_l3_approved"] = l3Done

			statusText := strings.ToLower(strings.TrimSpace(stringValue(results[i]["status"])))
			codeActText := strings.TrimSpace(stringValue(results[i]["code_act"]))
			if codeActText == "" {
				codeActText = strings.TrimSpace(stringValue(results[i]["statusactivity"]))
			}
			codeActNum, codeActOK := ParseActivityCodeNumber(codeActText)

			canApproveAction := false
			if canApprove && codeActOK && codeActNum == 3 {
				if currentApprover.Level == 2 {
					canApproveAction = statusText != "approved" && !l2Done && !l3Done
				}
				if currentApprover.Level == 3 {
					canApproveAction = l2Done && !l3Done
				}
			}
			results[i]["can_approve_action"] = canApproveAction
		}
		results[i]["rfq_prepared_username"] = rfqPrepared.Username
		results[i]["rfq_prepared_badge"] = rfqPrepared.BadgeApproval
		results[i]["rfq_l2_username"] = rfqL2.Username
		results[i]["rfq_l2_badge"] = rfqL2.BadgeApproval
		results[i]["rfq_l3_username"] = rfqL3.Username
		results[i]["rfq_l3_badge"] = rfqL3.BadgeApproval
		if hasPFS {
			results[i]["pfs_prepared_username"] = pfsPrepared.Username
			results[i]["pfs_prepared_badge"] = pfsPrepared.BadgeApproval
			results[i]["pfs_l2_username"] = pfsL2.Username
			results[i]["pfs_l2_badge"] = pfsL2.BadgeApproval
			results[i]["pfs_l3_username"] = pfsL3.Username
			results[i]["pfs_l3_badge"] = pfsL3.BadgeApproval
		} else {
			results[i]["pfs_prepared_username"] = ""
			results[i]["pfs_prepared_badge"] = ""
			results[i]["pfs_l2_username"] = ""
			results[i]["pfs_l2_badge"] = ""
			results[i]["pfs_l3_username"] = ""
			results[i]["pfs_l3_badge"] = ""
		}
		results[i]["rfq_approver_username"] = rfqApprover.Username
		results[i]["rfq_approver_badge"] = rfqApprover.BadgeApproval
		results[i]["pfs_approver_username"] = pfsApprover.Username
		results[i]["pfs_approver_badge"] = pfsApprover.BadgeApproval
	}

	resp := u.Message(true, "RFQ list")
	resp["data"] = results
	resp["can_approve"] = canApprove
	resp["approver_level"] = currentApprover.Level
	u.Respond(w, resp)
}

func nullIfEmpty(v string) interface{} {
	if v == "" {
		return nil
	}
	return v
}

func normalizeRFQStatusFilter(v string) string {
	raw := strings.ToLower(strings.TrimSpace(v))
	switch raw {
	case "draft", "pending", "submitted", "approved":
		return raw
	default:
		return ""
	}
}

func stringValue(v interface{}) string {
	if v == nil {
		return ""
	}
	if b, ok := v.([]byte); ok {
		return string(b)
	}
	return fmt.Sprint(v)
}
