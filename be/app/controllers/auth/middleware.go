package auth

import (
	"context"
	"fmt"
	"net/http"

	jwt "github.com/golang-jwt/jwt/v5"

	u "projectrfqv1/utils"
)

// ======================================================================
// AUTH VALIDATION MIDDLEWARE
// ======================================================================
func ValidateMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		// =====================
		// GET ACCESS TOKEN
		// =====================
		cookie, err := r.Cookie("access_token")
		if err != nil {
			u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
			return
		}

		secret, err := jwtSecretBytes()
		if err != nil {
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, err.Error()))
			return
		}

		// =====================
		// PARSE & VALIDATE TOKEN
		// =====================
		token, err := jwt.Parse(cookie.Value, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return secret, nil
		})

		if err != nil || !token.Valid {
			u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Access token expired or invalid"))
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Invalid token claims"))
			return
		}

		// =====================
		// EXTRACT USERID (STRING)
		// =====================
		userid, ok := claims["userid"].(string)
		if !ok || userid == "" {
			u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Invalid token userid"))
			return
		}

		// =====================
		// EXTRACT ROLE
		// =====================
		role := ""
		if r, ok := claims["role"].(string); ok {
			role = r
		}

		badge := BadgePrepared
		if b, ok := claims["badge"].(string); ok {
			badge = normalizeBadge(b)
		}

		// Prefer latest badge from DB, but keep request working when DB is not available
		// (e.g. unit tests that only validate JWT middleware behavior).
		if latestBadge, err := ResolveUserBadge(userid); err == nil && latestBadge != "" {
			badge = latestBadge
		}

		// =====================
		// SET CONTEXT
		// =====================
		ctx := context.WithValue(r.Context(), decodedClaimsKey, claims)
		ctx = context.WithValue(ctx, userIDKey, userid)
		ctx = context.WithValue(ctx, userRoleKey, role)
		ctx = context.WithValue(ctx, userBadgeKey, badge)

		next(w, r.WithContext(ctx))
	}
}

//
// ======================================================================
// CONTEXT HELPERS
// ======================================================================
//

// Get all JWT claims
func GetClaims(r *http.Request) jwt.MapClaims {
	claims, _ := r.Context().Value(decodedClaimsKey).(jwt.MapClaims)
	return claims
}

// Get authenticated USERID (string)
func GetUserID(r *http.Request) (string, bool) {
	userid, ok := r.Context().Value(userIDKey).(string)
	return userid, ok && userid != ""
}

// Get authenticated ROLE
func GetUserRole(r *http.Request) (string, bool) {
	role, ok := r.Context().Value(userRoleKey).(string)
	return role, ok
}

// Get authenticated BADGE
func GetUserBadge(r *http.Request) (string, bool) {
	badge, ok := r.Context().Value(userBadgeKey).(string)
	if !ok {
		return "", false
	}
	return normalizeBadge(badge), true
}
