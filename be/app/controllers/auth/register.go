package auth

import (
	"encoding/json"
	"net/http"
	"strings"

	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

func registerUser(w http.ResponseWriter, r *http.Request) {

	req := &models.User{}

	// =====================
	// DECODE REQUEST BODY
	// =====================
	if err := json.NewDecoder(r.Body).Decode(req); err != nil {
		u.Respond(w, u.Message(false, "Invalid request body"))
		return
	}
	defer r.Body.Close()

	// =====================
	// NORMALISASI & DEFAULT
	// =====================
	req.UserID = strings.TrimSpace(req.UserID)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if req.UserID == "" {
		u.Respond(w, u.Message(false, "userid is required"))
		return
	}

	if req.AuthProvider == "" {
		req.AuthProvider = "local"
	}

	req.Role = strings.ToLower(strings.TrimSpace(req.Role))
	if req.Role == "" {
		req.Role = "marketing"
	}

	allowedRole := map[string]bool{
		"marketing":   true,
		"engineering": true,
		"accounting":  true,
		"purchasing":  true,
	}
	if !allowedRole[req.Role] {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "invalid role"))
		return
	}

	var exists int64
	err := models.GetDB().Table("users").Where("userid = ?", req.UserID).Count(&exists).Error
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate userid"))
		return
	}
	if exists > 0 {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "userid already exists"))
		return
	}

	// =====================
	// SECURITY GUARD
	// =====================
	// Jangan izinkan client set field sensitif
	req.IsActive = true

	// =====================
	// CREATE USER
	// =====================
	resp := req.Create()
	if resp == nil {
		u.Respond(w, u.Message(false, "Failed to create user"))
		return
	}

	// =====================
	// HIDE PASSWORD FROM RESPONSE
	// =====================
	if data, ok := resp["data"].(*models.User); ok {
		data.Password = ""
	}

	u.Respond(w, resp)
}

func Register(w http.ResponseWriter, r *http.Request) {
	registerUser(w, r)
}

func CreateUser(w http.ResponseWriter, r *http.Request) {
	registerUser(w, r)
}
