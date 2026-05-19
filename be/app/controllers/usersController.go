package controllers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"

	"github.com/gorilla/mux"
)

// ======================================================================
// REQUEST DTO
// ======================================================================
type UpdateMeRequest struct {
	Name     *string `json:"name"`
	Email    *string `json:"email"`
	Password *string `json:"password"`
}

// ======================================================================
// SANITIZER
// ======================================================================
func sanitizeUser(user *models.User) {
	if user != nil {
		user.Password = ""
	}
}

func sanitizeUsers(users []*models.User) {
	for _, user := range users {
		sanitizeUser(user)
	}
}

// ======================================================================
// GET CURRENT AUTHENTICATED USER
// ======================================================================
func GetMe(w http.ResponseWriter, r *http.Request) {
	userid, ok := auth.GetUserID(r)
	if !ok {
		u.Respond(w, u.Message(false, "Unauthorized"))
		return
	}

	user := models.GetUserByUserID(userid)
	if user == nil {
		u.Respond(w, u.Message(false, "User not found"))
		return
	}

	badge, ok := auth.GetUserBadge(r)
	if !ok {
		badge = auth.BadgePrepared
	}

	sanitizeUser(user)
	resp := u.Message(true, "success")
	resp["data"] = map[string]interface{}{
		"name":        user.Name,
		"userid":      user.UserID,
		"role":        user.Role,
		"badge":       badge,
		"permissions": auth.BuildPermissions(user.Role, badge),
	}
	u.Respond(w, resp)
}

// ======================================================================
// UPDATE CURRENT USER (SELF)
// ======================================================================
func UpdateMe(w http.ResponseWriter, r *http.Request) {
	userid, ok := auth.GetUserID(r)
	if !ok {
		u.Respond(w, u.Message(false, "Unauthorized"))
		return
	}

	user := models.GetUserByUserID(userid)
	if user == nil {
		u.Respond(w, u.Message(false, "User not found"))
		return
	}

	var req UpdateMeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		u.Respond(w, u.Message(false, "Invalid request body"))
		return
	}
	defer r.Body.Close()

	if req.Name != nil {
		user.Name = strings.TrimSpace(*req.Name)
	}

	if req.Email != nil {
		user.Email = strings.ToLower(strings.TrimSpace(*req.Email))
	}

	if req.Password != nil && *req.Password != "" {
		user.Password = *req.Password
	}

	user.UpdatedAt = time.Now()

	if err := models.UpdateUser(user); err != nil {
		u.Respond(w, u.Message(false, "Could not update user"))
		return
	}

	sanitizeUser(user)
	resp := u.Message(true, "Updated successfully")
	resp["data"] = user
	u.Respond(w, resp)
}

// ======================================================================
// GET USER BY ID (ADMIN / SELF)
// ======================================================================
func GetUser(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		u.Respond(w, u.Message(false, "Invalid user id"))
		return
	}

	// auth identity
	userid, ok := auth.GetUserID(r)
	if !ok {
		u.Respond(w, u.Message(false, "Unauthorized"))
		return
	}

	requestUser := models.GetUserByUserID(userid)
	if requestUser == nil {
		u.Respond(w, u.Message(false, "Unauthorized"))
		return
	}

	// allow self OR admin
	if requestUser.Role != "admin" && uint(id) != requestUser.ID {
		u.Respond(w, u.Message(false, "Forbidden"))
		return
	}

	user := models.GetUser(id)
	if user == nil {
		u.Respond(w, u.Message(false, "User not found"))
		return
	}

	sanitizeUser(user)
	resp := u.Message(true, "success")
	resp["data"] = user
	u.Respond(w, resp)
}

// ======================================================================
// GET ALL USERS (ADMIN ONLY)
// ======================================================================
func GetUsers(w http.ResponseWriter, r *http.Request) {

	role, ok := auth.GetUserRole(r)
	if !ok || role != "admin" {
		u.Respond(w, u.Message(false, "Forbidden"))
		return
	}

	users := models.GetUsers()
	if users == nil {
		u.Respond(w, u.Message(false, "No users found"))
		return
	}

	sanitizeUsers(users)
	resp := u.Message(true, "success")
	resp["data"] = users
	u.Respond(w, resp)
}

// ======================================================================
// CREATE USER (ADMIN)
// ======================================================================
func CreateUser(w http.ResponseWriter, r *http.Request) {

	role, ok := auth.GetUserRole(r)
	if !ok || role != "admin" {
		u.Respond(w, u.Message(false, "Forbidden"))
		return
	}

	var payload models.User
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.Respond(w, u.Message(false, "Invalid request body"))
		return
	}
	defer r.Body.Close()

	// ==========================
	// NORMALISASI DATA
	// ==========================
	payload.UserID = strings.TrimSpace(payload.UserID)
	payload.Email = strings.ToLower(strings.TrimSpace(payload.Email))

	if payload.UserID == "" {
		u.Respond(w, u.Message(false, "UserID is required"))
		return
	}

	// ==========================
	// CEK DUPLICATE USERID
	// ==========================
	if models.IsUserIDExists(payload.UserID) {
		u.Respond(w, u.Message(false, "UserID already exists"))
		return
	}

	if payload.AuthProvider == "" {
		payload.AuthProvider = "local"
	}

	// ==========================
	// CREATE USER
	// ==========================
	resp := payload.Create()
	if resp == nil {
		u.Respond(w, u.Message(false, "Failed to create user"))
		return
	}

	sanitizeUser(&payload)
	u.Respond(w, resp)
}

// ======================================================================
// UPDATE USER (ADMIN OR SELF)
// ======================================================================
func UpdateUser(w http.ResponseWriter, r *http.Request) {

	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		u.Respond(w, u.Message(false, "Invalid user id"))
		return
	}

	requestUserID, ok := auth.GetUserID(r)
	if !ok {
		u.Respond(w, u.Message(false, "Unauthorized"))
		return
	}

	requestUser := models.GetUserByUserID(requestUserID)
	if requestUser == nil {
		u.Respond(w, u.Message(false, "Unauthorized"))
		return
	}

	// ==========================
	// ADMIN ATAU DIRI SENDIRI
	// ==========================
	if requestUser.Role != "admin" && uint(id) != requestUser.ID {
		u.Respond(w, u.Message(false, "Forbidden"))
		return
	}

	user := models.GetUser(id)
	if user == nil {
		u.Respond(w, u.Message(false, "User not found"))
		return
	}

	var payload models.User
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.Respond(w, u.Message(false, "Invalid request body"))
		return
	}
	defer r.Body.Close()

	// ==========================
	// NORMALISASI
	// ==========================
	payload.UserID = strings.TrimSpace(payload.UserID)
	payload.Email = strings.ToLower(strings.TrimSpace(payload.Email))

	// ==========================
	// CEK DUPLICATE USERID
	// ==========================
	if payload.UserID != "" && payload.UserID != user.UserID {
		if models.IsUserIDExistsExceptID(payload.UserID, user.ID) {
			u.Respond(w, u.Message(false, "UserID already exists"))
			return
		}
	}

	if payload.UserID != "" {
		user.UserID = payload.UserID
	}
	if payload.Name != "" {
		user.Name = payload.Name
	}
	if payload.Email != "" {
		user.Email = payload.Email
	}

	// hanya admin boleh ubah role
	if requestUser.Role == "admin" && payload.Role != "" {
		user.Role = payload.Role
	}

	user.UpdatedAt = time.Now()

	if err := models.UpdateUser(user); err != nil {
		u.Respond(w, u.Message(false, "Could not update user"))
		return
	}

	sanitizeUser(user)

	resp := u.Message(true, "Updated successfully")
	resp["data"] = user
	u.Respond(w, resp)
}

//
// DELETE USER (ADMIN Only

func DeleteUser(w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id, err := strconv.Atoi(params["id"])
	if err != nil {
		u.Respond(w, u.Message(false, "Invalid user id"))
		return
	}

	requestUserID, ok := auth.GetUserID(r)
	if !ok {
		u.Respond(w, u.Message(false, "Unauthorized"))
		return
	}

	requestUser := models.GetUserByUserID(requestUserID)
	if requestUser == nil {
		u.Respond(w, u.Message(false, "Unauthorized"))
		return
	}

	if requestUser.Role != "admin" && uint(id) != requestUser.ID {
		u.Respond(w, u.Message(false, "Forbidden"))
		return
	}

	user := models.GetUser(id)
	if user == nil {
		u.Respond(w, u.Message(false, "User not found"))
		return
	}

	if err := models.DeleteUser(user); err != nil {
		u.Respond(w, u.Message(false, "Could not delete user"))
		return
	}

	u.Respond(w, u.Message(true, "User deleted successfully"))
}
