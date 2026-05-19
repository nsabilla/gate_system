package rfq

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

func ApproveRFQ(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}
	role, ok := auth.GetUserRole(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}
	normalizedRole := strings.ToLower(strings.TrimSpace(role))
	if normalizedRole != "marketing" && normalizedRole != "management" {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden: only marketing or management can approve RFQ"))
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
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden: only level 2 or 3 approver can approve RFQ"))
		return
	}

	vars := mux.Vars(r)
	rfqIDStr := strings.TrimSpace(vars["id"])
	rfqID, err := strconv.ParseInt(rfqIDStr, 10, 64)
	if err != nil || rfqID <= 0 {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	var currentStatus string
	var currentCodeAct sql.NullString
	err = models.GetDB().Raw(models.TranslateSQL(`
		SELECT status, CAST(statusactivity AS CHAR) AS code_act
		FROM rfq
		WHERE id = ?
		LIMIT 1
	`), rfqID).Row().Scan(&currentStatus, &currentCodeAct)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			u.RespondWithStatus(w, http.StatusNotFound, u.Message(false, "RFQ not found"))
			return
		}
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate RFQ status"))
		return
	}

	codeActNum, ok := ParseActivityCodeNumber(currentCodeAct.String)
	if !ok || codeActNum != 3 {
		u.RespondWithStatus(w, http.StatusConflict, u.Message(false, "RFQ can only be approved when code_act is 3"))
		return
	}

	l2Done, l3Done := getRFQFlowState(rfqID)

	if approver.Level == 2 {
		if l2Done {
			u.Respond(w, u.Message(true, "RFQ already approved by level 2"))
			return
		}
		markRFQFlowLevel(rfqID, 2, userID)

		u.Respond(w, u.Message(true, "RFQ approved by level 2"))
		return
	}

	if !l2Done {
		u.RespondWithStatus(w, http.StatusConflict, u.Message(false, "RFQ must be approved by level 2 before level 3"))
		return
	}
	if l3Done {
		u.Respond(w, u.Message(true, "RFQ already approved by level 3"))
		return
	}
	markRFQFlowLevel(rfqID, 3, userID)

	if strings.EqualFold(strings.TrimSpace(currentStatus), "approved") {
		u.Respond(w, u.Message(true, "RFQ level 3 finalized"))
		return
	}

	result := models.GetDB().Exec(`
		UPDATE rfq
		SET status = 'approved'
		WHERE id = ? AND LOWER(TRIM(status)) <> 'approved'
	`, rfqID)
	if result.Error != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to approve RFQ"))
		return
	}

	if result.RowsAffected > 0 {
		// Automatically move to activity 4 (Approved)
		today := time.Now().Format("2006-01-02")

		// 1. Move Activity via SP
		moveRows, moveErr := models.GetDB().Raw(
			`CALL sp_mainactivity(?,?,?,?,?,?,?,?)`,
			"MOVE_ACTIVITY",
			rfqID,
			"",
			"",
			userID,
			"",
			"4",
			"Automatically moved to Approved stage upon L3 approval",
		).Rows()

		if moveErr == nil {
			// Drain result sets
			for {
				if moveRows.Next() {
				}
				if !moveRows.NextResultSet() {
					break
				}
			}
			moveRows.Close()
		}

		// 2. Sync Plan
		if err := SyncDashboardActivityPlan(rfqID, "4", userID, "Approved by L3 Management", today); err != nil {
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "RFQ approved but failed to sync dashboard activity"))
			return
		}

		u.Respond(w, u.Message(true, "RFQ approved and moved to Activity 4"))
		return
	}

	u.Respond(w, u.Message(true, "RFQ already approved"))
}
