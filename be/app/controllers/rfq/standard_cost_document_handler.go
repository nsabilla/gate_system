package rfq

import (
	"encoding/json"
	"net/http"

	"projectrfqv1/app/controllers/auth"
	u "projectrfqv1/utils"
)

// GetStandardCostDocument handles GET /rfqs/{id}/standard-cost?type=forging|jack|toolset
func GetStandardCostDocument(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	role, ok := auth.GetUserRole(r)
	if !ok || !allowStandardCostRole(role) {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden"))
		return
	}

	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	pfsType := parsePFSType(r)

	doc, err := scLoadDocumentByRFQType(rfqID, pfsType)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load standard cost document"))
		return
	}

	resp := u.Message(true, "Standard cost document loaded")
	resp["data"] = doc
	u.Respond(w, resp)
}

// UpsertStandardCostDocument handles PUT /rfqs/{id}/standard-cost?type=forging|jack|toolset
func UpsertStandardCostDocument(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	role, ok := auth.GetUserRole(r)
	if !ok || !allowStandardCostWriteRole(role) {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden: only accounting, purchasing, or admin can save standard cost documents"))
		return
	}

	rfqID, ok := parseRFQIDFromPath(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}
	pfsType := parsePFSType(r)

	var payload standardCostDocumentPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	if err := scUpsertDocumentByRFQType(rfqID, pfsType, payload, userID); err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save standard cost document"))
		return
	}

	resp := u.Message(true, "Standard cost document saved")
	resp["data"] = map[string]interface{}{
		"rfq_id": rfqID,
		"type":   pfsType,
	}
	u.Respond(w, resp)
}
