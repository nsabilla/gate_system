package rfq

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"

	"github.com/gorilla/mux"
)

// DashboardMainActivityGetHandler handles GET /rfqs/{id}/dashboard-activity
// It builds dashboard rows from activity master + rfq activity plan.
func DashboardMainActivityGetHandler(w http.ResponseWriter, r *http.Request) {
	// Auth required
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	vars := mux.Vars(r)
	rfqIdStr := vars["id"]

	rfqId, err := strconv.ParseInt(rfqIdStr, 10, 64)
	if err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	activityRows, err := models.GetDB().Raw(
		"SELECT code_act, descr FROM rfq_activity ORDER BY CAST(code_act AS INTEGER)",
	).Rows()
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load activity master"))
		return
	}
	defer activityRows.Close()

	activities, err := rowsToMaps(activityRows)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to read activity master"))
		return
	}

	planQuery := `SELECT p.id, p.rfq_id, p.activity_code, a.descr as activity_name, 
			p.pic_userid, u.name, u.role, 
			p.target_date, p.start_date, p.end_date, p.remarks 
		 FROM rfq_activity_plan p
		 LEFT JOIN rfq_activity a ON p.activity_code = a.code_act
		 LEFT JOIN users u ON p.pic_userid = u.userid
		 WHERE p.rfq_id = ?`

	planRows, err := models.GetDB().Raw(planQuery, rfqId).Rows()
	if err != nil {
		fmt.Println("ACTIVITY PLAN QUERY ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load activity plan"))
		return
	}
	defer planRows.Close()

	planData, err := readDataSkippingDebug(planRows)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to read activity plan"))
		return
	}

	roleCodeByRoleName, err := getRoleCodeMap()
	if err != nil {
		// Non-fatal: rolecode table may not exist; continue with empty map
		fmt.Println("WARNING: rolecode query failed (non-fatal):", err)
		roleCodeByRoleName = map[string]string{}
	}

	monthCols, monthStarts := rollingMonths()

	planByCode := map[string]map[string]interface{}{}
	for _, item := range planData {
		code := normalizeActivityCode(item["activity_code"])
		if code == "" {
			continue
		}
		planByCode[code] = item
	}

	activeCode := ""
	if len(planByCode) == 0 {
		var currentActivityCode sql.NullString
		if err := models.GetDB().Raw(
			`SELECT CAST(statusactivity AS CHAR) AS code_act FROM rfq WHERE id = ? LIMIT 1`,
			rfqId,
		).Row().Scan(&currentActivityCode); err != nil && err != sql.ErrNoRows {
			fmt.Println("WARNING: current activity lookup failed:", err)
		}
		activeCode = normalizeActivityCode(currentActivityCode.String)
		if activeCode != "" {
			now := time.Now().Format("2006-01-02")
			planByCode[activeCode] = map[string]interface{}{
				"activity_code": activeCode,
				"target_date":   now,
				"start_date":    now,
				"end_date":      now,
				"remarks":       "Current activity",
			}
		}
	}

	orderedCodes := make([]string, 0, len(activities)+len(planData))
	activityNameByCode := make(map[string]string, len(activities)+len(planData))
	seenCodes := make(map[string]struct{}, len(activities)+len(planData))

	for _, act := range activities {
		code := normalizeActivityCode(act["code_act"])
		if code == "" {
			continue
		}
		if _, exists := seenCodes[code]; !exists {
			orderedCodes = append(orderedCodes, code)
			seenCodes[code] = struct{}{}
		}
		if name := toString(act["descr"]); name != "" {
			activityNameByCode[code] = name
		}
	}

	for _, item := range planData {
		code := normalizeActivityCode(item["activity_code"])
		if code == "" {
			continue
		}
		if _, exists := seenCodes[code]; !exists {
			orderedCodes = append(orderedCodes, code)
			seenCodes[code] = struct{}{}
		}
		if _, exists := activityNameByCode[code]; !exists {
			if name := toString(item["activity_name"]); name != "" {
				activityNameByCode[code] = name
			}
		}
	}

	result := make([]map[string]interface{}, 0, len(orderedCodes))
	for _, code := range orderedCodes {
		name := activityNameByCode[code]
		if name == "" {
			name = code
		}
		plan := planByCode[code]

		pic := ""
		picName := ""
		picRole := ""
		target := ""
		targetDate := ""
		remarks := ""
		var startDate *time.Time
		var endDate *time.Time

		if plan != nil {
			picUserName := strings.TrimSpace(toString(plan["name"]))
			picUserID := toString(plan["pic_userid"])
			roleName := strings.ToLower(strings.TrimSpace(toString(plan["role"])))
			roleCode := roleCodeByRoleName[roleName]
			if picUserName == "" {
				picUserName = strings.TrimSpace(picUserID)
			}

			pic = formatPicRoleCodeUserName(roleCode, picUserName)
			picName = picUserName
			picRole = roleCode

			if tm, ok := parseAnyTime(plan["target_date"]); ok {
				target = tm.Format("02-Jan")
				targetDate = tm.Format("2006-01-02")
			}

			if tm, ok := parseAnyTime(plan["start_date"]); ok {
				t := tm
				startDate = &t
			}
			if tm, ok := parseAnyTime(plan["end_date"]); ok {
				t := tm
				endDate = &t
			}

			if startDate == nil && endDate == nil && targetDate != "" {
				if tm, ok := parseAnyTime(targetDate); ok {
					t := tm
					startDate = &t
					endDate = &t
				}
			}
			if startDate == nil && endDate != nil {
				startDate = endDate
			}
			if endDate == nil && startDate != nil {
				endDate = startDate
			}

			remarks = toString(plan["remarks"])
		}

		if plan == nil && activeCode == code {
			if targetDate == "" {
				targetDate = time.Now().Format("2006-01-02")
			}
			if target == "" {
				if tm, ok := parseAnyTime(targetDate); ok {
					target = tm.Format("02-Jan")
				}
			}
			if startDate == nil {
				if tm, ok := parseAnyTime(targetDate); ok {
					t := tm
					startDate = &t
				}
			}
			if endDate == nil {
				if tm, ok := parseAnyTime(targetDate); ok {
					t := tm
					endDate = &t
				}
			}
			if remarks == "" {
				remarks = "Current activity"
			}
		}

		row := map[string]interface{}{
			"code_act":      code,
			"activity_name": name,
			"pic":           pic,
			"pic_name":      picName,
			"pic_role":      picRole,
			"target_dd":     target,
			"target_date":   targetDate,
			"start_date":    startDate,
			"end_date":      endDate,
			"remarks":       remarks,
		}

		for _, month := range monthCols {
			if inMonthRange(monthStarts[month], startDate, endDate) {
				row[month] = "✔"
			} else {
				row[month] = ""
			}
		}

		result = append(result, row)
	}

	resp := u.Message(true, "OK")
	resp["data"] = result
	resp["month_columns"] = monthCols
	u.Respond(w, resp)
}

// EngineeringActivityTemplateGetHandler handles GET /rfq-activities/engineering-template
// It returns engineering activity template rows without RFQ plan overlay.
func EngineeringActivityTemplateGetHandler(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	activityRows, err := models.GetDB().Raw(
		`SELECT activity_no, activity_name, pic, due_date_label, remark,
			m0,m1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11
		 FROM rfq_engineering_activity_template
		 WHERE is_active=1
		 ORDER BY activity_no`,
	).Rows()
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load engineering activity template"))
		return
	}
	defer activityRows.Close()

	activities, err := rowsToMaps(activityRows)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to read engineering activity template"))
		return
	}

	monthCols, _ := engineeringTimelineMonths()
	result := make([]map[string]interface{}, 0, len(activities))

	for _, act := range activities {
		code := normalizeActivityCode(act["activity_no"])
		if code == "" {
			continue
		}

		row := map[string]interface{}{
			"code_act":      code,
			"activity_name": toString(nilIfMapMissing(act, "activity_name")),
			"pic":           toString(nilIfMapMissing(act, "pic")),
			"target_dd":     toString(nilIfMapMissing(act, "due_date_label")),
			"target_date":   "",
			"start_date":    nil,
			"end_date":      nil,
			"remarks":       toString(nilIfMapMissing(act, "remark")),
		}

		for idx, month := range monthCols {
			templateKey := fmt.Sprintf("m%d", idx)
			if toBool(nilIfMapMissing(act, templateKey)) {
				row[month] = "✔"
			} else {
				row[month] = ""
			}
		}

		result = append(result, row)
	}

	resp := u.Message(true, "OK")
	resp["data"] = result
	resp["month_columns"] = monthCols
	u.Respond(w, resp)
}

func getRoleCodeMap() (map[string]string, error) {
	rows, err := models.GetDB().Raw(
		"SELECT LOWER(rolename) AS rolename, rolecode FROM rolecode",
	).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	data, err := rowsToMaps(rows)
	if err != nil {
		return nil, err
	}

	mapped := make(map[string]string, len(data))
	for _, item := range data {
		roleName := strings.ToLower(strings.TrimSpace(toString(item["rolename"])))
		roleCode := strings.ToUpper(strings.TrimSpace(toString(item["rolecode"])))
		if roleName == "" || roleCode == "" {
			continue
		}
		mapped[roleName] = roleCode
	}

	return mapped, nil
}

func formatPicRoleCodeUserName(roleCode string, userName string) string {
	trimmedRoleCode := strings.TrimSpace(roleCode)
	trimmedUserName := strings.TrimSpace(userName)

	if trimmedRoleCode == "" && trimmedUserName == "" {
		return ""
	}
	if trimmedRoleCode == "" {
		return trimmedUserName
	}
	if trimmedUserName == "" {
		return trimmedRoleCode
	}

	return trimmedRoleCode + "-" + trimmedUserName
}

func rollingMonths() ([]string, map[string]time.Time) {
	start := time.Now().AddDate(0, -1, 0)
	labels := make([]string, 0, 12)
	monthStarts := make(map[string]time.Time, 12)
	for i := 0; i < 12; i++ {
		d := time.Date(start.Year(), start.Month()+time.Month(i), 1, 0, 0, 0, 0, time.Local)
		label := d.Format("Jan")
		labels = append(labels, label)
		monthStarts[label] = d
	}
	return labels, monthStarts
}

func engineeringTimelineMonths() ([]string, map[string]time.Time) {
	start := time.Now().AddDate(0, -1, 0)
	labels := make([]string, 0, 12)
	monthStarts := make(map[string]time.Time, 12)
	for i := 0; i < 12; i++ {
		d := time.Date(start.Year(), start.Month()+time.Month(i), 1, 0, 0, 0, 0, time.Local)
		label := "M"
		if i > 0 {
			label = fmt.Sprintf("M+%d", i)
		}
		labels = append(labels, label)
		monthStarts[label] = d
	}
	return labels, monthStarts
}

func nilIfMapMissing(item map[string]interface{}, key string) interface{} {
	if item == nil {
		return nil
	}
	v, ok := item[key]
	if !ok {
		return nil
	}
	return v
}

func toBool(v interface{}) bool {
	if v == nil {
		return false
	}

	if b, ok := v.(bool); ok {
		return b
	}

	raw := strings.TrimSpace(strings.ToLower(toString(v)))
	if raw == "" {
		return false
	}

	switch raw {
	case "1", "true", "t", "yes", "y":
		return true
	default:
		return false
	}
}

func inMonthRange(monthStart time.Time, startDate *time.Time, endDate *time.Time) bool {
	if startDate == nil || endDate == nil {
		return false
	}

	startMonth := time.Date(startDate.Year(), startDate.Month(), 1, 0, 0, 0, 0, time.Local)
	endMonth := time.Date(endDate.Year(), endDate.Month(), 1, 0, 0, 0, 0, time.Local)
	curMonth := time.Date(monthStart.Year(), monthStart.Month(), 1, 0, 0, 0, 0, time.Local)

	return !curMonth.Before(startMonth) && !curMonth.After(endMonth)
}

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	if b, ok := v.([]byte); ok {
		return string(b)
	}
	if s, ok := v.(string); ok {
		return s
	}
	return strings.TrimSpace(fmt.Sprint(v))
}

func normalizeActivityCode(v interface{}) string {
	raw := strings.TrimSpace(toString(v))
	if raw == "" {
		return ""
	}

	if num, err := strconv.ParseInt(raw, 10, 64); err == nil {
		return strconv.FormatInt(num, 10)
	}

	return raw
}

func parseAnyTime(v interface{}) (time.Time, bool) {
	if v == nil {
		return time.Time{}, false
	}
	if t, ok := v.(time.Time); ok {
		return t, true
	}
	s := toString(v)
	if s == "" {
		return time.Time{}, false
	}
	layouts := []string{
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02 15:04:05.000",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}
