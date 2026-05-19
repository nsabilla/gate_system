package rfq

import (
	"database/sql"
	"log"
	"strconv"
	"strings"

	"projectrfqv1/app/models"
)

type approverProfile struct {
	UserID        string
	Username      string
	BadgeApproval string
	Level         int
	IsActive      bool
	HasApproval   bool
}

type rawApproverProfileRow struct {
	UserID        string        `gorm:"column:userid"`
	Username      string        `gorm:"column:approver_username"`
	BadgeApproval string        `gorm:"column:badge_approval"`
	Level         sql.NullInt64 `gorm:"column:approver_level"`
	Role          string        `gorm:"column:user_role"`
	HasApproval   sql.NullInt64 `gorm:"column:has_approval_row"`
	IsActive      sql.NullInt64 `gorm:"column:is_active"`
}

type levelApproverRow struct {
	Level         sql.NullInt64 `gorm:"column:approver_level"`
	UserID        string        `gorm:"column:userid"`
	Username      string        `gorm:"column:approver_username"`
	BadgeApproval string        `gorm:"column:badge_approval"`
}

type roleApproverRow struct {
	Level         sql.NullInt64 `gorm:"column:approver_level"`
	UserID        string        `gorm:"column:userid"`
	Username      string        `gorm:"column:approver_username"`
	BadgeApproval string        `gorm:"column:badge_approval"`
}

func normalizeApproverProfile(userID string, row *rawApproverProfileRow) approverProfile {
	profile := approverProfile{
		UserID:        strings.TrimSpace(userID),
		Username:      strings.TrimSpace(userID),
		BadgeApproval: "Prepared",
		Level:         1,
		IsActive:      true,
		HasApproval:   false,
	}

	if row == nil {
		return profile
	}

	if v := strings.TrimSpace(row.UserID); v != "" {
		profile.UserID = v
	}
	if v := strings.TrimSpace(row.Username); v != "" {
		profile.Username = v
	}
	if v := strings.TrimSpace(row.BadgeApproval); v != "" {
		profile.BadgeApproval = v
	}
	if row.Level.Valid && row.Level.Int64 > 0 {
		profile.Level = int(row.Level.Int64)
	}
	if row.HasApproval.Valid {
		profile.HasApproval = row.HasApproval.Int64 > 0
	}
	if row.IsActive.Valid {
		profile.IsActive = row.IsActive.Int64 > 0
	}

	return profile
}

func loadApproverProfile(userID string) (approverProfile, error) {
	cleanUserID := strings.TrimSpace(userID)
	if cleanUserID == "" {
		return normalizeApproverProfile(userID, nil), nil
	}

	var row rawApproverProfileRow
	err := models.GetDB().Raw(models.TranslateSQL(`
		SELECT
			COALESCE(NULLIF(TRIM(u.userid), ''), TRIM(?)) AS userid,
			COALESCE(
				NULLIF(TRIM(a.username), ''),
				NULLIF(TRIM(u.name), ''),
				NULLIF(TRIM(a.userid), ''),
				NULLIF(TRIM(u.userid), ''),
				TRIM(?)
			) AS approver_username,
			COALESCE(NULLIF(TRIM(a.badge_approval), ''), 'Prepared') AS badge_approval,
			COALESCE(CAST(a.level AS INTEGER), CAST(u.level AS INTEGER), 1) AS approver_level,
			LOWER(TRIM(CAST(u.role AS CHAR))) AS user_role,
			CASE
				WHEN LOWER(TRIM(CAST(u.role AS CHAR))) IN ('marketing','engineering','management')
					AND COALESCE(CAST(a.level AS INTEGER), CAST(u.level AS INTEGER), 1) IN (2,3)
				THEN 1
				ELSE 0
			END AS has_approval_row,
			CASE
				WHEN COALESCE(u.is_active, false) IS NOT TRUE THEN 0
				WHEN a.userid IS NULL THEN 1
				WHEN COALESCE(a.isactive, false) IS TRUE THEN 1
				ELSE 0
			END AS is_active
		FROM users u
		LEFT JOIN rfq_approve a
			ON LOWER(TRIM(u.userid)) = LOWER(TRIM(a.userid))
		WHERE LOWER(TRIM(u.userid)) = LOWER(TRIM(?))
		ORDER BY
			CASE
				WHEN a.userid IS NULL THEN 0
				WHEN COALESCE(a.isactive, false) IS TRUE THEN 1
				ELSE 0
			END DESC,
			COALESCE(CAST(a.level AS INTEGER), 1) DESC
		LIMIT 1
	`), cleanUserID, cleanUserID, cleanUserID).Scan(&row).Error
	if err != nil {
		return approverProfile{}, err
	}
	log.Printf("DEBUG: Loaded approver profile for %s: Level=%d, HasApproval=%t, Role=%s, IsActive=%t", 
		cleanUserID, row.Level.Int64, row.HasApproval.Int64 > 0, row.Role, row.IsActive.Int64 > 0)

	if strings.TrimSpace(row.UserID) == "" {
		return normalizeApproverProfile(cleanUserID, nil), nil
	}

	profile := normalizeApproverProfile(cleanUserID, &row)
	if profile.HasApproval {
		return profile, nil
	}

	return profile, nil
}

func normalizeUserIDForMatch(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	if v == "" {
		return ""
	}

	allDigits := true
	for _, ch := range v {
		if ch < '0' || ch > '9' {
			allDigits = false
			break
		}
	}
	if !allDigits {
		return v
	}

	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return v
	}
	return strconv.FormatInt(n, 10)
}

type fallbackApproverRow struct {
	UserID        string        `gorm:"column:userid"`
	Username      string        `gorm:"column:approver_username"`
	BadgeApproval string        `gorm:"column:badge_approval"`
	Level         sql.NullInt64 `gorm:"column:approver_level"`
}

func findApproverProfileByNormalizedUserID(userID string) (approverProfile, bool, error) {
	normalizedNeedle := normalizeUserIDForMatch(userID)
	if normalizedNeedle == "" {
		return approverProfile{}, false, nil
	}

	rows := make([]fallbackApproverRow, 0)
	err := models.GetDB().Raw(models.TranslateSQL(`
		SELECT
			TRIM(a.userid) AS userid,
			COALESCE(NULLIF(TRIM(a.username), ''), NULLIF(TRIM(u.name), ''), NULLIF(TRIM(a.userid), '')) AS approver_username,
			COALESCE(NULLIF(TRIM(a.badge_approval), ''), 'Prepared') AS badge_approval,
			COALESCE(CAST(a.level AS INTEGER), 1) AS approver_level
		FROM rfq_approve a
		LEFT JOIN users u
			ON LOWER(TRIM(u.userid)) = LOWER(TRIM(a.userid))
		WHERE COALESCE(a.isactive, false) IS TRUE
	`)).Scan(&rows).Error
	if err != nil {
		return approverProfile{}, false, err
	}

	for _, row := range rows {
		if normalizeUserIDForMatch(row.UserID) != normalizedNeedle {
			continue
		}

		level := 1
		if row.Level.Valid && row.Level.Int64 > 0 {
			level = int(row.Level.Int64)
		}

		profile := approverProfile{
			UserID:        strings.TrimSpace(row.UserID),
			Username:      strings.TrimSpace(row.Username),
			BadgeApproval: strings.TrimSpace(row.BadgeApproval),
			Level:         level,
			IsActive:      true,
			HasApproval:   true,
		}
		if profile.UserID == "" {
			profile.UserID = strings.TrimSpace(userID)
		}
		if profile.Username == "" {
			profile.Username = profile.UserID
		}
		if profile.BadgeApproval == "" {
			profile.BadgeApproval = "Prepared"
		}

		return profile, true, nil
	}

	return approverProfile{}, false, nil
}

func loadActiveApproversByLevel(levels []int) (map[int]approverProfile, error) {
	approvers := make(map[int]approverProfile)
	if len(levels) == 0 {
		return approvers, nil
	}

	rows := make([]levelApproverRow, 0)
	err := models.GetDB().Raw(models.TranslateSQL(`
		SELECT
			COALESCE(CAST(a.level AS INTEGER), 1) AS approver_level,
			COALESCE(NULLIF(TRIM(a.userid), ''), NULLIF(TRIM(u.userid), '')) AS userid,
			COALESCE(NULLIF(TRIM(a.username), ''), NULLIF(TRIM(u.name), ''), NULLIF(TRIM(a.userid), ''), NULLIF(TRIM(u.userid), '')) AS approver_username,
			COALESCE(NULLIF(TRIM(a.badge_approval), ''), 'Prepared') AS badge_approval
		FROM rfq_approve a
		LEFT JOIN users u
			ON LOWER(TRIM(u.userid)) = LOWER(TRIM(a.userid))
		WHERE
			COALESCE(CAST(a.level AS INTEGER), 1) IN (?)
			AND COALESCE(a.isactive, false) IS TRUE
		ORDER BY COALESCE(CAST(a.level AS INTEGER), 1) ASC, approver_username ASC
	`), levels).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		if !row.Level.Valid || row.Level.Int64 <= 0 {
			continue
		}
		level := int(row.Level.Int64)
		if _, exists := approvers[level]; exists {
			continue
		}

		profile := approverProfile{
			UserID:        strings.TrimSpace(row.UserID),
			Username:      strings.TrimSpace(row.Username),
			BadgeApproval: strings.TrimSpace(row.BadgeApproval),
			Level:         level,
			IsActive:      true,
			HasApproval:   true,
		}
		if profile.UserID == "" {
			continue
		}
		if profile.Username == "" {
			profile.Username = profile.UserID
		}
		if profile.BadgeApproval == "" {
			profile.BadgeApproval = "Prepared"
		}

		approvers[level] = profile
	}

	return approvers, nil
}

func loadActiveApproverByRole(role string, preferredLevels []int) (approverProfile, error) {
	cleanRole := strings.ToLower(strings.TrimSpace(role))
	if cleanRole == "" {
		return approverProfile{}, nil
	}

	rows := make([]roleApproverRow, 0)
	err := models.GetDB().Raw(models.TranslateSQL(`
		SELECT
			COALESCE(CAST(a.level AS INTEGER), CAST(u.level AS INTEGER), 1) AS approver_level,
			COALESCE(NULLIF(TRIM(a.userid), ''), NULLIF(TRIM(u.userid), '')) AS userid,
			COALESCE(NULLIF(TRIM(a.username), ''), NULLIF(TRIM(u.name), ''), NULLIF(TRIM(a.userid), ''), NULLIF(TRIM(u.userid), '')) AS approver_username,
			COALESCE(NULLIF(TRIM(a.badge_approval), ''), 'Prepared') AS badge_approval
		FROM users u
		LEFT JOIN rfq_approve a
			ON LOWER(TRIM(u.userid)) = LOWER(TRIM(a.userid))
		WHERE
			LOWER(TRIM(CAST(u.role AS CHAR))) = LOWER(TRIM(?))
			AND COALESCE(u.is_active, false) IS TRUE
			AND COALESCE(CAST(a.level AS INTEGER), CAST(u.level AS INTEGER), 1) IN (1,2,3)
			AND (
				a.userid IS NULL
				OR COALESCE(a.isactive, false) IS TRUE
			)
		ORDER BY COALESCE(CAST(a.level AS INTEGER), CAST(u.level AS INTEGER), 1) ASC, approver_username ASC
	`), cleanRole).Scan(&rows).Error
	if err != nil {
		return approverProfile{}, err
	}
	if len(rows) == 0 {
		return approverProfile{}, nil
	}

	byLevel := make(map[int]approverProfile)
	firstAny := approverProfile{}
	for _, row := range rows {
		level := 1
		if row.Level.Valid && row.Level.Int64 > 0 {
			level = int(row.Level.Int64)
		}

		profile := approverProfile{
			UserID:        strings.TrimSpace(row.UserID),
			Username:      strings.TrimSpace(row.Username),
			BadgeApproval: strings.TrimSpace(row.BadgeApproval),
			Level:         level,
			IsActive:      true,
			HasApproval:   true,
		}
		if profile.UserID == "" {
			continue
		}
		if profile.Username == "" {
			profile.Username = profile.UserID
		}
		if profile.BadgeApproval == "" {
			profile.BadgeApproval = "Prepared"
		}

		if firstAny.UserID == "" {
			firstAny = profile
		}
		if _, exists := byLevel[level]; !exists {
			byLevel[level] = profile
		}
	}

	for _, level := range preferredLevels {
		if profile, exists := byLevel[level]; exists {
			return profile, nil
		}
	}

	return firstAny, nil
}
