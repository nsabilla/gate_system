package models

import (
	"errors"
	"fmt"
	"os"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/mysql"
	_ "github.com/jinzhu/gorm/dialects/postgres"
	_ "github.com/joho/godotenv/autoload"
)

var db *gorm.DB

// InitDBFromEnv initializes the global DB connection using environment variables.
// This is intentionally NOT called from init() to make packages testable without
// requiring a real database.
func InitDBFromEnv() (*gorm.DB, error) {
	username := os.Getenv("db_user")
	password := os.Getenv("db_pass")
	dbName := os.Getenv("db_name")
	dbHost := os.Getenv("db_host")
	dbPort := os.Getenv("db_port")
	dbType := os.Getenv("db_type")
	charset := os.Getenv("charset")
	parseTime := os.Getenv("parse_time")

	if dbType == "" {
		return nil, errors.New("db_type is not set")
	}
	if dbHost == "" || dbPort == "" || dbName == "" {
		return nil, errors.New("db_host/db_port/db_name must be set")
	}
	if charset == "" {
		charset = "utf8mb4"
	}
	if parseTime == "" {
		parseTime = "True"
	}

	var dbUri string
	if dbType == "mysql" {
		dbUri = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=%s&&parseTime=%s", username, password, dbHost, dbPort, dbName, charset, parseTime)
	} else if dbType == "postgres" {
		dbUri = fmt.Sprintf("host=%s port=%s user=%s dbname=%s password=%s sslmode=disable", dbHost, dbPort, username, dbName, password)
	} else {
		return nil, fmt.Errorf("unsupported db_type: %s", dbType)
	}

	conn, err := gorm.Open(dbType, dbUri)
	if err != nil {
		return nil, err
	}

	SetDB(conn)
	fmt.Println("Connected to database on " + dbHost)
	return conn, nil
}

// MustInitDBFromEnv is a convenience for production startup.
func MustInitDBFromEnv() *gorm.DB {
	conn, err := InitDBFromEnv()
	if err != nil {
		fmt.Println(err.Error())
		panic("Failed to connect to database")
	}
	return conn
}

// SetDB overrides the global DB instance (useful for unit tests).
func SetDB(conn *gorm.DB) {
	db = conn
}

func GetDB() *gorm.DB {
	return db
}

func GetDBType() string {
	return os.Getenv("db_type")
}
