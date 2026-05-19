package rfq

import (
	"encoding/json"
	"net/http"
	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"

	"github.com/gorilla/mux"
)

type StandardCostPayload struct {
	CostCenter string  `json:"cost_center"`
	Wc         string  `json:"wc"`
	Labor      float64 `json:"labor"`
	Mdepr      float64 `json:"mdepr"`
	Fd         float64 `json:"fd"`
	Fi         float64 `json:"fi"`
	Vd         float64 `json:"vd"`
	Vi         float64 `json:"vi"`
	ValidFrom  string  `json:"valid_from"`
	ValidTo    string  `json:"valid_to"`
	IsActive   *bool   `json:"is_active"`
}

func CreateStandardCostMaster(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	role, ok := auth.GetUserRole(r)
	if !ok || !allowStandardCostCrudRole(role) {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden: Only accounting role can perform this action"))
		return
	}

	var payload StandardCostPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request payload"))
		return
	}

	isActive := true
	if payload.IsActive != nil {
		isActive = *payload.IsActive
	}

	db := models.GetDB()
	query := `INSERT INTO standard_cost (cost_center, wc, labor, mdepr, fd, fi, vd, vi, valid_from, valid_to, is_active, created_at, updated_at)
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`

	if err := db.Exec(models.TranslateSQL(query), payload.CostCenter, payload.Wc, payload.Labor, payload.Mdepr, payload.Fd, payload.Fi, payload.Vd, payload.Vi, payload.ValidFrom, payload.ValidTo, isActive).Error; err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to create standard cost: "+err.Error()))
		return
	}

	u.Respond(w, u.Message(true, "Standard cost created successfully"))
}

func UpdateStandardCostMaster(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	role, ok := auth.GetUserRole(r)
	if !ok || !allowStandardCostCrudRole(role) {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden: Only accounting role can perform this action"))
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	var payload StandardCostPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request payload"))
		return
	}

	isActive := true
	if payload.IsActive != nil {
		isActive = *payload.IsActive
	}

	db := models.GetDB()
	query := `UPDATE standard_cost SET cost_center = ?, wc = ?, labor = ?, mdepr = ?, fd = ?, fi = ?, vd = ?, vi = ?, valid_from = ?, valid_to = ?, is_active = ?, updated_at = NOW()
			  WHERE id = ?`

	if err := db.Exec(models.TranslateSQL(query), payload.CostCenter, payload.Wc, payload.Labor, payload.Mdepr, payload.Fd, payload.Fi, payload.Vd, payload.Vi, payload.ValidFrom, payload.ValidTo, isActive, id).Error; err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to update standard cost: "+err.Error()))
		return
	}

	u.Respond(w, u.Message(true, "Standard cost updated successfully"))
}

func DeleteStandardCostMaster(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	role, ok := auth.GetUserRole(r)
	if !ok || !allowStandardCostCrudRole(role) {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden: Only accounting role can perform this action"))
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	db := models.GetDB()
	query := `DELETE FROM standard_cost WHERE id = ?`

	if err := db.Exec(models.TranslateSQL(query), id).Error; err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to delete standard cost: "+err.Error()))
		return
	}

	u.Respond(w, u.Message(true, "Standard cost deleted successfully"))
}
