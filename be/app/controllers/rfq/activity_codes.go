package rfq

import (
	"log"
	"net/http"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

// ListActivityCodes handles:
// GET /rfq-activities
// Returns activity codes from table rfq_activity for UI dropdowns.
func ListActivityCodes(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	rows, err := models.GetDB().Raw(`
		SELECT code_act, descr
		FROM rfq_activity
		ORDER BY CAST(code_act AS INTEGER)
	`).Rows()
	if err != nil {
		log.Println("RFQ ACTIVITY CODES ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load activity codes"))
		return
	}
	defer rows.Close()

	data, err := rowsToMaps(rows)
	if err != nil {
		log.Println("RFQ ACTIVITY CODES READ ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to read activity codes"))
		return
	}

	resp := u.Message(true, "Activity codes")
	resp["data"] = data
	u.Respond(w, resp)
}
