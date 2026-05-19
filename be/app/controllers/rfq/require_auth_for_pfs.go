package rfq

import (
	"net/http"

	"projectrfqv1/app/controllers/auth"
	u "projectrfqv1/utils"
)

func requireAuthForPFS(w http.ResponseWriter, r *http.Request) bool {
	if _, ok := auth.GetUserID(r); !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return false
	}
	return true
}
