package rfq

import (
	"net/http"
	"strings"

	"projectrfqv1/app/controllers/auth"
	u "projectrfqv1/utils"
)

func requireEngineeringForPFSWrite(w http.ResponseWriter, r *http.Request) bool {
	role, ok := auth.GetUserRole(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return false
	}

	normalizedRole := strings.ToLower(strings.TrimSpace(role))
	if normalizedRole != "engineering" && normalizedRole != "management" {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden: only engineering or management can create or update PFS"))
		return false
	}

	return true
}
