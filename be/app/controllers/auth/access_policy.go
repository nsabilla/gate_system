package auth

import (
	"database/sql"
	"net/http"
	"strings"

	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

const (
	BadgePrepared = "prepared"
	BadgeApprove  = "approve"
)

const (
	PermissionRFQCRUD    = "rfq_crud"
	PermissionRFQApprove = "rfq_approve"
	PermissionPFSCRUD    = "pfs_crud"
	PermissionPFSApprove = "pfs_approve"
)

type userAccessProfile struct {
	Name   string
	UserID string
	Role   string
	Badge  string
}

func normalizeBadge(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	if v == BadgeApprove || v == "approved" || strings.Contains(v, "acknowledge") || strings.Contains(v, "checked") {
		return BadgeApprove
	}
	return BadgePrepared
}

func normalizeRole(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func BuildPermissions(role, badge string) map[string]bool {
	role = normalizeRole(role)
	badge = normalizeBadge(badge)

	if role == "admin" {
		return map[string]bool{
			PermissionRFQCRUD:    true,
			PermissionRFQApprove: true,
			PermissionPFSCRUD:    true,
			PermissionPFSApprove: true,
		}
	}

	return map[string]bool{
		PermissionRFQCRUD:    role == "marketing" && badge == BadgePrepared,
		PermissionRFQApprove: role == "marketing" && badge == BadgeApprove,
		PermissionPFSCRUD:    role == "engineering" && badge == BadgePrepared,
		PermissionPFSApprove: role == "engineering" && badge == BadgeApprove,
	}
}

func HasPermission(role, badge, permission string) bool {
	return BuildPermissions(role, badge)[permission]
}

func loadUserAccessProfile(userID string) (*userAccessProfile, error) {
	profile := &userAccessProfile{}
	db := models.GetDB()
	if db == nil {
		return nil, nil
	}

	err := db.Raw(`
		SELECT
			u.name,
			u.userid,
			COALESCE(NULLIF(TRIM(apv.badge_approval), ''), 'Prepared') AS badge,
			u.role
		FROM users u
		LEFT JOIN rfq_approve apv
			ON LOWER(TRIM(u.userid)) = LOWER(TRIM(apv.userid))
		WHERE LOWER(TRIM(u.userid)) = LOWER(TRIM(?))
		LIMIT 1
	`, userID).Row().Scan(&profile.Name, &profile.UserID, &profile.Badge, &profile.Role)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	profile.Role = normalizeRole(profile.Role)
	profile.Badge = normalizeBadge(profile.Badge)
	return profile, nil
}

func ResolveUserBadge(userID string) (string, error) {
	profile, err := loadUserAccessProfile(userID)
	if err != nil {
		return "", err
	}
	if profile == nil {
		return BadgePrepared, nil
	}
	return profile.Badge, nil
}

func ResolveUserAccessProfile(userID string) (*userAccessProfile, error) {
	profile, err := loadUserAccessProfile(userID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return &userAccessProfile{UserID: userID, Badge: BadgePrepared}, nil
	}
	return profile, nil
}

func RequirePermission(permission string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			role, okRole := GetUserRole(r)
			badge, okBadge := GetUserBadge(r)
			if !okRole || !okBadge {
				u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
				return
			}

			if !HasPermission(role, badge, permission) {
				u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden"))
				return
			}

			next(w, r)
		}
	}
}
