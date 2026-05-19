package rfq

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

func DeleteRFQ(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	role, okRole := auth.GetUserRole(r)
	badge, okBadge := auth.GetUserBadge(r)
	if !okRole || !okBadge {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	if !auth.HasPermission(role, badge, auth.PermissionRFQCRUD) {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden"))
		return
	}

	vars := mux.Vars(r)
	rfqIDStr := vars["id"]
	rfqID, err := strconv.ParseInt(rfqIDStr, 10, 64)
	if err != nil || rfqID <= 0 {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	tx := models.GetDB().Begin()
	if tx.Error != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to start transaction"))
		return
	}

	if err := tx.Exec(`DELETE FROM rfq_detail WHERE rfq_id = ?`, rfqID).Error; err != nil {
		tx.Rollback()
		log.Println("RFQ DELETE DETAILS ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to delete RFQ details"))
		return
	}

	if err := tx.Exec(`DELETE FROM rfq_activity_log WHERE rfq_id = ?`, rfqID).Error; err != nil {
		tx.Rollback()
		log.Println("RFQ DELETE ACTIVITY LOG ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to delete RFQ activity logs"))
		return
	}

	// Defensive cleanup for schema variants where rfq_id may be stored as string-like values.
	if err := tx.Exec(models.TranslateSQL(`DELETE FROM rfq_activity_log WHERE TRIM(CAST(rfq_id AS CHAR)) = ?`), strconv.FormatInt(rfqID, 10)).Error; err != nil {
		tx.Rollback()
		log.Println("RFQ DELETE ACTIVITY LOG FALLBACK ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to delete RFQ activity logs"))
		return
	}

	var remainingActivityLogs int64
	if err := tx.Raw(models.TranslateSQL(`SELECT COUNT(*) FROM rfq_activity_log WHERE TRIM(CAST(rfq_id AS CHAR)) = ?`), strconv.FormatInt(rfqID, 10)).Row().Scan(&remainingActivityLogs); err != nil {
		tx.Rollback()
		log.Println("RFQ ACTIVITY LOG COUNT ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate RFQ activity logs"))
		return
	}
	if remainingActivityLogs > 0 {
		tx.Rollback()
		log.Printf("RFQ DELETE BLOCKED: %d activity logs still reference rfq_id=%d\n", remainingActivityLogs, rfqID)
		u.RespondWithStatus(w, http.StatusConflict, u.Message(false, "RFQ still has activity log references"))
		return
	}

	if err := tx.Exec(`DELETE FROM rfq WHERE id = ?`, rfqID).Error; err != nil {
		tx.Rollback()
		log.Println("RFQ DELETE HEADER ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to delete RFQ"))
		return
	}

	if err := tx.Commit().Error; err != nil {
		log.Println("RFQ DELETE COMMIT ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to delete RFQ"))
		return
	}

	u.Respond(w, u.Message(true, "RFQ deleted"))
}
