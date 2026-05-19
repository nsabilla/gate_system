package auth

import (
	"net/http"

	u "projectrfqv1/utils"
)

func RequireRole(allowedRoles ...string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {

			role, ok := GetUserRole(r)
			if !ok {
				u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
				return
			}

			for _, allowed := range allowedRoles {
				if role == allowed {
					next(w, r)
					return
				}
			}

			u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden"))
		}
	}
}
