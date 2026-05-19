package rfq

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

func rowsToMaps(rows *sql.Rows) ([]map[string]interface{}, error) {
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	out := make([]map[string]interface{}, 0)
	for rows.Next() {
		values := make([]interface{}, len(cols))
		valuePtrs := make([]interface{}, len(cols))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}

		row := make(map[string]interface{}, len(cols))
		for i, col := range cols {
			v := values[i]
			if b, ok := v.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = v
			}
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// sp_mainactivity prints debug queries via SELECT (column name: DebugQuery)
// before executing the real statement. This helper reads the actual data resultset
// when debug output is present, while remaining compatible with sqlmock.
func readDataSkippingDebug(rows *sql.Rows) ([]map[string]interface{}, error) {
	if rows == nil {
		return []map[string]interface{}{}, nil
	}

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	// If the first resultset is debug output, drain it and move to the next.
	if len(cols) == 1 && cols[0] == "DebugQuery" {
		_, _ = rowsToMaps(rows) // drain debug rows
		if rows.NextResultSet() {
			return rowsToMaps(rows)
		}
		// No next resultset; return empty but no error.
		return []map[string]interface{}{}, nil
	}

	return rowsToMaps(rows)
}

// GetMainActivity handles:
// GET /rfqs/mainactivity?id={numericId} OR /rfqs/mainactivity?rfq_no={RFQ-...}
// It calls sp_mainactivity in SELECT mode.
func GetMainActivity(w http.ResponseWriter, r *http.Request) {
	// Auth required
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	q := r.URL.Query()
	rfqNo := q.Get("rfq_no")
	idStr := q.Get("id")

	var rfqID interface{} = nil
	if idStr != "" {
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || id <= 0 {
			u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid id"))
			return
		}
		rfqID = id
	}

	if rfqID == nil && rfqNo == "" {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "id or rfq_no is required"))
		return
	}

	query := `SELECT r.id, r.rfq_no, r.title, r.created_by, r.status, r.statusactivity, a.descr AS activity_desc, r.created_at 
			FROM rfq r LEFT JOIN rfq_activity a ON r.statusactivity = a.code_act WHERE 1=1`
	var args []interface{}
	if rfqID != nil {
		query += " AND r.id = ?"
		args = append(args, rfqID)
	}
	if rfqNo != "" {
		query += " AND r.rfq_no = ?"
		args = append(args, rfqNo)
	}
	rows, err := models.GetDB().Raw(query, args...).Rows()
	if err != nil {
		log.Println("SP MAINACTIVITY SELECT ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load main activity"))
		return
	}
	defer rows.Close()

	data, err := readDataSkippingDebug(rows)
	if err != nil {
		log.Println("MAINACTIVITY READ ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to read main activity"))
		return
	}

	resp := u.Message(true, "Main activity")
	resp["data"] = data
	u.Respond(w, resp)
}

// GetTimeline handles:
// GET /rfqs/{id}/timeline
func GetTimeline(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	query := `SELECT activity_name, remarks, created_by, created_at FROM rfq_activity_log WHERE rfq_id = ? ORDER BY created_at ASC`
	rows, err := models.GetDB().Raw(query, id).Rows()
	if err != nil {
		log.Println("SP MAINACTIVITY TIMELINE ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load timeline"))
		return
	}
	defer rows.Close()

	data, err := readDataSkippingDebug(rows)
	if err != nil {
		log.Println("TIMELINE READ ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to read timeline"))
		return
	}

	resp := u.Message(true, "Timeline")
	resp["data"] = data
	u.Respond(w, resp)
}

type moveActivityRequest struct {
	StatusActivity string `json:"statusactivity"`
	Remarks        string `json:"remarks"`
	TargetDate     string `json:"target_date"`
}

func ParseActivityCodeNumber(code string) (int, bool) {
	v := strings.TrimSpace(code)
	if v == "" {
		return 0, false
	}
	n, err := strconv.Atoi(v)
	if err == nil && n >= 0 {
		return n, true
	}

	digits := make([]rune, 0, len(v))
	for _, ch := range v {
		if ch >= '0' && ch <= '9' {
			digits = append(digits, ch)
		}
	}
	if len(digits) == 0 {
		return 0, false
	}

	n, err = strconv.Atoi(string(digits))
	if err != nil || n < 0 {
		return 0, false
	}
	return n, true
}

func parseDateOnly(value string) (string, bool) {
	v := strings.TrimSpace(value)
	if v == "" {
		return "", false
	}
	t, err := time.Parse("2006-01-02", v)
	if err != nil {
		return "", false
	}
	return t.Format("2006-01-02"), true
}

func getLatestTargetDateByActivityNumber(rfqID int64, activityNum int) (*time.Time, error) {
	rows, err := models.GetDB().Raw(`
		SELECT activity_code, target_date
		FROM rfq_activity_plan
		WHERE rfq_id = ? AND target_date IS NOT NULL
		ORDER BY id DESC
	`, rfqID).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var activityCode sql.NullString
		var targetDate sql.NullTime
		if err := rows.Scan(&activityCode, &targetDate); err != nil {
			return nil, err
		}
		if !targetDate.Valid {
			continue
		}

		codeNum, ok := ParseActivityCodeNumber(activityCode.String)
		if !ok || codeNum != activityNum {
			continue
		}

		t := time.Date(
			targetDate.Time.Year(),
			targetDate.Time.Month(),
			targetDate.Time.Day(),
			0,
			0,
			0,
			0,
			time.Local,
		)
		return &t, nil
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return nil, nil
}

func SyncDashboardActivityPlan(rfqID int64, activityCode, userID, remarks, requestedTargetDate string) error {
	today := time.Now().Format("2006-01-02")
	toDateValue := func(value string) interface{} {
		parsed, ok := parseDateOnly(value)
		if !ok {
			return nil
		}

		t, err := time.ParseInLocation("2006-01-02", parsed, time.Local)
		if err != nil {
			return nil
		}

		return t
	}

	var existingID int64
	var existingRemarks sql.NullString
	var existingTargetDate sql.NullString
	var existingStartDate sql.NullString
	var existingEndDate sql.NullString

	err := models.GetDB().Raw(
		models.TranslateSQL(`SELECT id,
		        remarks,
		        DATE_FORMAT(target_date, '%Y-%m-%d') AS target_date,
		        DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
		        DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date
		 FROM rfq_activity_plan
		 WHERE rfq_id = ? AND activity_code = ?
		 ORDER BY id DESC
		 LIMIT 1`),
		rfqID,
		activityCode,
	).Row().Scan(&existingID, &existingRemarks, &existingTargetDate, &existingStartDate, &existingEndDate)

	if err != nil && err != sql.ErrNoRows {
		return err
	}

	finalRemarks := strings.TrimSpace(remarks)
	if finalRemarks == "" {
		if existingRemarks.Valid {
			finalRemarks = existingRemarks.String
		} else {
			finalRemarks = "Moved from Manage RFQ"
		}
	}

	targetDate := today
	if parsed, ok := parseDateOnly(requestedTargetDate); ok {
		targetDate = parsed
	} else if existingTargetDate.Valid && strings.TrimSpace(existingTargetDate.String) != "" {
		targetDate = existingTargetDate.String
	}

	startDate := targetDate
	if existingStartDate.Valid && strings.TrimSpace(existingStartDate.String) != "" {
		startDate = existingStartDate.String
	}

	endDate := targetDate
	if existingEndDate.Valid && strings.TrimSpace(existingEndDate.String) != "" {
		endDate = existingEndDate.String
	}

	// Use direct SQL instead of stored procedure for better PostgreSQL compatibility
	if err == nil && existingID > 0 {
		// UPDATE existing record
		updateErr := models.GetDB().Exec(
			`UPDATE rfq_activity_plan SET
				pic_userid = ?,
				remarks = ?,
				target_date = ?,
				start_date = ?,
				end_date = ?,
				updated_at = NOW(),
				updateby = ?
			WHERE id = ?`,
			userID,
			finalRemarks,
			toDateValue(targetDate),
			toDateValue(startDate),
			toDateValue(endDate),
			userID,
			existingID,
		).Error
		if updateErr != nil {
			return updateErr
		}
	} else {
		// Check for UPSERT: existing record by rfq_id + activity_code
		var count int64
		models.GetDB().Raw(
			`SELECT COUNT(*) FROM rfq_activity_plan WHERE rfq_id = ? AND activity_code = ?`,
			rfqID, activityCode,
		).Count(&count)

		if count > 0 {
			updateErr := models.GetDB().Exec(
				`UPDATE rfq_activity_plan SET
					pic_userid = ?,
					remarks = ?,
					target_date = ?,
					start_date = ?,
					end_date = ?,
					updated_at = NOW(),
					updateby = ?
				WHERE rfq_id = ? AND activity_code = ?`,
				userID,
				finalRemarks,
				toDateValue(targetDate),
				toDateValue(startDate),
				toDateValue(endDate),
				userID,
				rfqID,
				activityCode,
			).Error
			if updateErr != nil {
				return updateErr
			}
		} else {
			insertErr := models.GetDB().Exec(
				`INSERT INTO rfq_activity_plan (
					rfq_id, activity_code, pic_userid, remarks,
					target_date, start_date, end_date,
					created_at, addby
				) VALUES (
					?, ?, ?, ?,
					?, ?, ?,
					NOW(), ?
				)`,
				rfqID,
				activityCode,
				userID,
				finalRemarks,
				toDateValue(targetDate),
				toDateValue(startDate),
				toDateValue(endDate),
				userID,
			).Error
			if insertErr != nil {
				return insertErr
			}
		}
	}

	return nil
}

// MoveActivity handles:
// POST /rfqs/{id}/activity/move
func MoveActivity(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	var req moveActivityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}
	if req.StatusActivity == "" {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "statusactivity is required"))
		return
	}

	requestedCode := strings.TrimSpace(req.StatusActivity)
	requestedNum, ok := ParseActivityCodeNumber(requestedCode)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "statusactivity must be numeric"))
		return
	}

	var currentCode sql.NullString
	err = models.GetDB().Raw(models.TranslateSQL(
		`SELECT CAST(statusactivity AS CHAR) AS code_act FROM rfq WHERE id = ? LIMIT 1`),
		id,
	).Row().Scan(&currentCode)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			u.RespondWithStatus(w, http.StatusNotFound, u.Message(false, "RFQ not found"))
			return
		}
		log.Println("MOVE ACTIVITY CURRENT CODE ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate current activity"))
		return
	}

	currentCodeText := strings.TrimSpace(currentCode.String)
	if currentCodeText == "" {
		if requestedNum != 0 {
			u.RespondWithStatus(w, http.StatusConflict, u.Message(false, "Initial activity must be code 0"))
			return
		}
	} else {
		currentNum, ok := ParseActivityCodeNumber(currentCodeText)
		if ok {
			if requestedNum < currentNum {
				u.RespondWithStatus(w, http.StatusConflict, u.Message(false, "Activity cannot move backward"))
				return
			}
			if requestedNum > currentNum+1 {
				u.RespondWithStatus(w, http.StatusConflict, u.Message(false, "Activity must move sequentially"))
				return
			}

			if requestedNum == currentNum+1 {
				if requestedNum == 4 {
					var rfqStatus sql.NullString
					err := models.GetDB().Raw(
						`SELECT status FROM rfq WHERE id = ? LIMIT 1`,
						id,
					).Row().Scan(&rfqStatus)
					if err != nil {
						if errors.Is(err, sql.ErrNoRows) {
							u.RespondWithStatus(w, http.StatusNotFound, u.Message(false, "RFQ not found"))
							return
						}
						log.Println("MOVE ACTIVITY APPROVAL STATUS ERROR:", err)
						u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate RFQ approval status"))
						return
					}

					if !strings.EqualFold(strings.TrimSpace(rfqStatus.String), "approved") {
						u.RespondWithStatus(w, http.StatusConflict, u.Message(false, "Activity 4 is disabled until RFQ is approved"))
						return
					}
				}

				nextTargetDateText, ok := parseDateOnly(req.TargetDate)
				if !ok {
					u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "target_date is required when moving to next activity"))
					return
				}

				nextTargetDate, _ := time.ParseInLocation("2006-01-02", nextTargetDateText, time.Local)
				nextTargetDate = time.Date(
					nextTargetDate.Year(),
					nextTargetDate.Month(),
					nextTargetDate.Day(),
					0,
					0,
					0,
					0,
					time.Local,
				)
				prevTargetDate, err := getLatestTargetDateByActivityNumber(id, currentNum)
				if err != nil {
					log.Println("MOVE ACTIVITY TARGET DATE VALIDATION ERROR:", err)
					u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate previous target date"))
					return
				}

				if prevTargetDate != nil && !nextTargetDate.After(*prevTargetDate) {
					u.RespondWithStatus(w, http.StatusConflict, u.Message(false, "Target date for next activity must be greater than previous activity target date"))
					return
				}
			}

			if requestedNum == currentNum {
				if err := SyncDashboardActivityPlan(id, requestedCode, userID, req.Remarks, req.TargetDate); err != nil {
					log.Println("SYNC DASHBOARD ACTIVITY PLAN ERROR:", err)
					u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to update activity plan"))
					return
				}

				u.Respond(w, u.Message(true, "Activity updated"))
				return
			}
		}
	}

	// Use Query (Rows) and drain result sets to avoid MySQL "commands out of sync".
	rows, err := models.GetDB().Raw(
		`CALL sp_mainactivity(?,?,?,?,?,?,?,?)`,
		"MOVE_ACTIVITY",
		id,
		"",
		"",
		userID,
		"",
		requestedCode,
		req.Remarks,
	).Rows()
	if err != nil {
		log.Println("SP MAINACTIVITY MOVE ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to move activity"))
		return
	}
	// Drain all resultsets (debug selects / OK packets)
	for {
		_, _ = rowsToMaps(rows)
		if !rows.NextResultSet() {
			break
		}
	}
	_ = rows.Close()

	if err := SyncDashboardActivityPlan(id, requestedCode, userID, req.Remarks, req.TargetDate); err != nil {
		log.Println("SYNC DASHBOARD ACTIVITY PLAN ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Activity moved but failed to sync dashboard activity"))
		return
	}

	u.Respond(w, u.Message(true, "Activity moved"))
}
