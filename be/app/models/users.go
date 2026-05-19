package models

import (
	"fmt"
	"strings"

	u "projectrfqv1/utils"

	"github.com/jinzhu/gorm"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	gorm.Model
	Name         string  `json:"name"`
	UserID       string  `json:"userid" gorm:"column:userid;type:varchar(30);unique;not null"`
	Email        string  `json:"email" gorm:"type:varchar(150);unique_index"`
	Password     string  `json:"password,omitempty"`
	Role         string  `json:"role" gorm:"type:enum('marketing','engineering','accounting','purchasing')"`
	GoogleID     *string `json:"google_id,omitempty"`
	AuthProvider string  `json:"auth_provider" gorm:"type:enum('local','google');default:'local'"`
	IsActive     bool    `json:"is_active" gorm:"default:true"`
}

func (user *User) Validate() (map[string]interface{}, bool) {

	if user.Name == "" {
		return u.Message(false, "Name is required"), false
	}

	if user.UserID == "" {
		return u.Message(false, "UserID is required"), false
	}

	if user.Email == "" {
		return u.Message(false, "Email is required"), false
	}

	if !strings.Contains(user.Email, "@") {
		return u.Message(false, "Email is not valid"), false
	}

	if user.AuthProvider == "local" && user.Password == "" {
		return u.Message(false, "Password is required"), false
	}

	return u.Message(true, "success"), true
}

// Hash password
func (user *User) BeforeCreate(scope *gorm.Scope) error {

	if user.AuthProvider == "local" && user.Password != "" {

		hashedPassword, err := bcrypt.GenerateFromPassword(
			[]byte(user.Password),
			bcrypt.DefaultCost,
		)
		if err != nil {
			return err
		}

		scope.SetColumn("Password", string(hashedPassword))
	}

	return nil
}

// Hash password on update
func (user *User) BeforeUpdate(scope *gorm.Scope) error {

	if scope.HasColumn("Password") && user.Password != "" {

		hashedPassword, err := bcrypt.GenerateFromPassword(
			[]byte(user.Password),
			bcrypt.DefaultCost,
		)
		if err != nil {
			return err
		}

		scope.SetColumn("Password", string(hashedPassword))
	}

	return nil
}

// register user
func (user *User) Create() map[string]interface{} {

	if resp, ok := user.Validate(); !ok {
		return resp
	}

	if user.AuthProvider == "" {
		user.AuthProvider = "local"
	}

	if err := GetDB().Create(user).Error; err != nil {
		return u.Message(false, err.Error())
	}

	resp := u.Message(true, "success")
	resp["data"] = user
	return resp
}

// get user by id
func GetUser(id int) *User {
	user := &User{}
	if err := GetDB().First(&user, id).Error; err != nil {
		return nil
	}
	return user
}

// get all users
func GetUsers() []*User {
	users := make([]*User, 0)
	if err := GetDB().Find(&users).Error; err != nil {
		fmt.Println(err)
		return nil
	}
	return users
}

// update user
func UpdateUser(user *User) error {
	return GetDB().Save(user).Error
}

// delete user
func DeleteUser(user *User) error {
	return GetDB().Delete(user).Error
}

// get user for update or delete
func GetUserForUpdateOrDelete(id int, user *User) error {
	return GetDB().Where("id = ?", id).First(&user).Error
}

// get user by email
func GetUserByEmail(email string) *User {
	user := &User{}
	if err := GetDB().Where("email = ?", email).First(&user).Error; err != nil {
		return nil
	}
	return user
}

// get user by userid
func GetUserByUserID(userid string) *User {
	user := &User{}
	if err := GetDB().
		Where("userid = ?", userid).
		First(&user).Error; err != nil {
		return nil
	}
	return user
}

func IsUserIDExists(userID string) bool {
	var count int64
	db.Model(&User{}).
		Where("user_id = ?", userID).
		Count(&count)
	return count > 0
}

func IsUserIDExistsExceptID(userID string, excludeID uint) bool {
	var count int64
	db.Model(&User{}).
		Where("user_id = ? AND id <> ?", userID, excludeID).
		Count(&count)
	return count > 0
}
