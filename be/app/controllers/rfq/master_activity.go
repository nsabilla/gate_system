package rfq

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

type masterActivityUpsertRequest struct {
	CodeAct string `json:"code_act"`
	Descr   string `json:"descr"`
}

// MasterActivityList handles:
// GET /rfq-activities/master
// Optional: ?id={numericId}
// Calls sp_master_rfq_activity('SELECT', ...)
func MasterActivityList(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	q := r.URL.Query()
	idStr := strings.TrimSpace(q.Get("id"))
	var idArg interface{} = nil
	if idStr != "" {
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || id <= 0 {
			u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid id"))
			return
		}
		idArg = id
	}

	query := `SELECT * FROM rfq_activity WHERE 1=1`
	var args []interface{}
	if idArg != nil {
		query += " AND id = ?"
		args = append(args, idArg)
	}
	query += " ORDER BY id DESC"
	rows, err := models.GetDB().Raw(query, args...).Rows()
	if err != nil {
		log.Println("SP MASTER RFQ ACTIVITY SELECT ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load master activity"))
		return
	}
	defer rows.Close()

	data, err := readDataSkippingDebug(rows)
	if err != nil {
		log.Println("MASTER RFQ ACTIVITY READ ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to read master activity"))
		return
	}

	resp := u.Message(true, "Master activity")
	resp["data"] = data
	u.Respond(w, resp)
}

// MasterActivityCreate handles:
// POST /rfq-activities/master
// body: { code_act, descr }
func MasterActivityCreate(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	var req masterActivityUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}
	req.CodeAct = strings.TrimSpace(req.CodeAct)
	req.Descr = strings.TrimSpace(req.Descr)
	if req.CodeAct == "" || req.Descr == "" {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "code_act and descr are required"))
		return
	}

	rows, err := models.GetDB().Raw(
		`CALL sp_master_rfq_activity(?,?,?,?,?)`,
		"INSERT",
		nil,
		req.CodeAct,
		req.Descr,
		userID,
	).Rows()
	if err != nil {
		log.Println("SP MASTER RFQ ACTIVITY INSERT ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to create activity"))
		return
	}
	// Drain all resultsets (DebugQuery etc.)
	for {
		_, _ = rowsToMaps(rows)
		if !rows.NextResultSet() {
			break
		}
	}
	_ = rows.Close()

	u.Respond(w, u.Message(true, "Activity created"))
}

// MasterActivityUpdate handles:
// PUT /rfq-activities/master/{id}
func MasterActivityUpdate(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid id"))
		return
	}

	var req masterActivityUpsertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}
	req.CodeAct = strings.TrimSpace(req.CodeAct)
	req.Descr = strings.TrimSpace(req.Descr)
	if req.CodeAct == "" || req.Descr == "" {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "code_act and descr are required"))
		return
	}

	rows, err := models.GetDB().Raw(
		`CALL sp_master_rfq_activity(?,?,?,?,?)`,
		"UPDATE",
		id,
		req.CodeAct,
		req.Descr,
		userID,
	).Rows()
	if err != nil {
		log.Println("SP MASTER RFQ ACTIVITY UPDATE ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to update activity"))
		return
	}
	for {
		_, _ = rowsToMaps(rows)
		if !rows.NextResultSet() {
			break
		}
	}
	_ = rows.Close()

	u.Respond(w, u.Message(true, "Activity updated"))
}

// MasterActivityDelete handles:
// DELETE /rfq-activities/master/{id}
func MasterActivityDelete(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid id"))
		return
	}

	rows, err := models.GetDB().Raw(
		`CALL sp_master_rfq_activity(?,?,?,?,?)`,
		"DELETE",
		id,
		"",
		"",
		userID,
	).Rows()
	if err != nil {
		log.Println("SP MASTER RFQ ACTIVITY DELETE ERROR:", err)
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to delete activity"))
		return
	}
	for {
		_, _ = rowsToMaps(rows)
		if !rows.NextResultSet() {
			break
		}
	}
	_ = rows.Close()

	u.Respond(w, u.Message(true, "Activity deleted"))
}
