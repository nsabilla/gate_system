package auth

import (
	"net/http"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"

	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

/*
|--------------------------------------------------------------------------
| REFRESH ACCESS TOKEN
|--------------------------------------------------------------------------
*/
func Refresh(w http.ResponseWriter, r *http.Request) {

	// =====================
	// GET REFRESH TOKEN
	// =====================
	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		u.Respond(w, u.Message(false, "Refresh token missing"))
		return
	}

	secret, err := jwtSecretBytes()
	if err != nil {
		u.Respond(w, u.Message(false, err.Error()))
		return
	}

	// =====================
	// PARSE TOKEN
	// =====================
	token, err := jwt.Parse(cookie.Value, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrTokenSignatureInvalid
		}
		return secret, nil
	})

	if err != nil || !token.Valid {
		u.Respond(w, u.Message(false, "Invalid refresh token"))
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		u.Respond(w, u.Message(false, "Invalid token claims"))
		return
	}

	// =====================
	// VALIDATE TOKEN TYPE
	// =====================
	if claims["type"] != "refresh" {
		u.Respond(w, u.Message(false, "Invalid token type"))
		return
	}

	// =====================
	// EXTRACT USERID (STRING)
	// =====================
	userid, ok := claims["userid"].(string)
	if !ok || userid == "" {
		u.Respond(w, u.Message(false, "Invalid token userid"))
		return
	}

	// =====================
	// LOAD USER
	// =====================
	user := models.GetUserByUserID(userid)
	if user == nil || !user.IsActive {
		u.Respond(w, u.Message(false, "User not found or inactive"))
		return
	}

	// =====================
	// GENERATE NEW ACCESS TOKEN
	// =====================
	newExp := time.Now().Add(AccessTokenTTL)
	badge, err := ResolveUserBadge(user.UserID)
	if err != nil {
		u.Respond(w, u.Message(false, "Failed to load user approval badge"))
		return
	}

	newAccessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userid": user.UserID,
		"uid":    user.ID, // internal only
		"role":   user.Role,
		"badge":  badge,
		"type":   "access",
		"exp":    newExp.Unix(),
	}).SignedString(secret)

	if err != nil {
		u.Respond(w, u.Message(false, "Failed to generate access token"))
		return
	}

	setCookie(w, "access_token", newAccessToken, newExp)

	u.Respond(w, u.Message(true, "token refreshed"))
}
