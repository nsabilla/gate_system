package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

func jwtSecretBytes() ([]byte, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return nil, errors.New("JWT_SECRET is not set")
	}
	return []byte(secret), nil
}

const (
	AccessTokenTTL  = 15 * time.Minute
	RefreshTokenTTL = 7 * 24 * time.Hour
)

var authCookiePaths = []string{"/", "/api", "/api/v1"}

type ctxKey string

const (
	decodedClaimsKey ctxKey = "decoded"
	userIDKey        ctxKey = "userid"
	userRoleKey      ctxKey = "role"
	userBadgeKey     ctxKey = "badge"
)

// =====================
// LOGIN REQUEST
// =====================
type LoginRequest struct {
	UserID   string `json:"userid"`
	Password string `json:"password"`
}

// =====================
// LOGIN HANDLER
// =====================
func Login(w http.ResponseWriter, r *http.Request) {

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		u.Respond(w, u.Message(false, "Invalid request body"))
		return
	}
	defer r.Body.Close()

	if req.UserID == "" || req.Password == "" {
		u.Respond(w, u.Message(false, "userid and password are required"))
		return
	}

	// 🔐 Ambil user berdasarkan USERID
	user := models.GetUserByUserID(req.UserID)
	if user == nil || !user.IsActive {
		u.Respond(w, u.Message(false, "Invalid credentials"))
		return
	}

	// 🔐 Validasi password (khusus local auth)
	if user.AuthProvider == "local" {
		if err := bcrypt.CompareHashAndPassword(
			[]byte(user.Password),
			[]byte(req.Password),
		); err != nil {
			u.Respond(w, u.Message(false, "Invalid credentials"))
			return
		}
	}

	accessExp := time.Now().Add(AccessTokenTTL)
	refreshExp := time.Now().Add(RefreshTokenTTL)

	badge, err := ResolveUserBadge(user.UserID)
	if err != nil {
		u.Respond(w, u.Message(false, "Failed to load user approval badge"))
		return
	}

	secret, err := jwtSecretBytes()
	if err != nil {
		u.Respond(w, u.Message(false, err.Error()))
		return
	}

	//
	// =====================
	// ACCESS TOKEN
	// =====================
	//
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userid": user.UserID,
		"uid":    user.ID, // internal DB ID
		"role":   user.Role,
		"badge":  badge,
		"type":   "access",
		"exp":    accessExp.Unix(),
	}).SignedString(secret)

	if err != nil {
		u.Respond(w, u.Message(false, "Failed to generate access token"))
		return
	}

	//
	// =====================
	// REFRESH TOKEN
	// =====================
	//
	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userid": user.UserID,
		"type":   "refresh",
		"exp":    refreshExp.Unix(),
	}).SignedString(secret)

	if err != nil {
		u.Respond(w, u.Message(false, "Failed to generate refresh token"))
		return
	}

	clearAuthCookie(w, "access_token")
	clearAuthCookie(w, "refresh_token")
	setCookie(w, "access_token", accessToken, accessExp)
	setCookie(w, "refresh_token", refreshToken, refreshExp)

	u.Respond(w, u.Message(true, "login success"))
}

// =====================
// LOGOUT
// =====================
func Logout(w http.ResponseWriter, r *http.Request) {
	clearAuthCookie(w, "access_token")
	clearAuthCookie(w, "refresh_token")

	u.Respond(w, u.Message(true, "logout success"))
}

// =====================
// COOKIE HELPER
// =====================
func setCookie(w http.ResponseWriter, name, value string, exp time.Time) {
	maxAge := 0
	if value == "" || exp.Before(time.Now()) {
		maxAge = -1
	}

	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    value,
		HttpOnly: true,
		Secure:   false, //
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
		Expires:  exp,
		MaxAge:   maxAge,
	})
}

func clearAuthCookie(w http.ResponseWriter, name string) {
	exp := time.Unix(0, 0)
	for _, path := range authCookiePaths {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    "",
			HttpOnly: true,
			Secure:   false,
			SameSite: http.SameSiteLaxMode,
			Path:     path,
			Expires:  exp,
			MaxAge:   -1,
		})
	}
}
