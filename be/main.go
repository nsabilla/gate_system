package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"

	_ "github.com/joho/godotenv/autoload"

	"projectrfqv1/app/models"
	"projectrfqv1/routes"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

func main() {
	port := os.Getenv("WEB_PORT")
	if port == "" {
		// Backward compatible with existing .env samples / older setups
		port = os.Getenv("web_port")
	}
	if port == "" {
		port = "8085"
	}

	prefix := os.Getenv("PREFIX")
	if prefix == "" {
		// Backward compatible with existing .env samples / older setups
		prefix = os.Getenv("prefix")
	}
	if prefix == "" {
		prefix = "/api/v1"
	}

	fmt.Println("Server running on port :", port)
	fmt.Println("API Prefix :", prefix)

	// Initialize DB connection
	models.MustInitDBFromEnv()

	// Run database migrations
	if err := models.RunAllMigrations(); err != nil {
		fmt.Println("WARNING: Migration failed:", err)
		// Don't panic, continue anyway as migrations might be optional
	}

	// route
	r := mux.NewRouter().StrictSlash(true)

	// Serve uploaded files (technical documents, images, etc.)
	r.PathPrefix("/uploads/").Handler(
		http.StripPrefix("/uploads/", http.FileServer(http.Dir("uploads"))),
	)

	// Register API routes
	routes.ApiRoutes(prefix, r)

	// MIDDLEWARE
	loggedRouter := handlers.LoggingHandler(os.Stdout, r)

	// CORS CONFIG to frontend
	headersOk := handlers.AllowedHeaders([]string{
		"Content-Type",
	})

	allowedOriginsFromEnv := map[string]struct{}{}
	for _, rawOrigin := range strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",") {
		origin := strings.ToLower(strings.TrimSpace(rawOrigin))
		if origin != "" {
			allowedOriginsFromEnv[origin] = struct{}{}
		}
	}

	originsOk := handlers.AllowedOriginValidator(func(origin string) bool {
		origin = strings.ToLower(strings.TrimSpace(origin))

		if origin == "" {
			return false
		}

		if _, ok := allowedOriginsFromEnv[origin]; ok {
			return true
		}

		if strings.HasPrefix(origin, "http://localhost:") ||
			strings.HasPrefix(origin, "http://127.0.0.1:") {
			return true
		}

		u, err := url.Parse(origin)
		if err != nil {
			return false
		}

		ip := net.ParseIP(u.Hostname())
		if ip != nil && (ip.IsPrivate() || ip.IsLoopback()) {
			return true
		}

		return false
	})

	methodsOk := handlers.AllowedMethods([]string{
		"GET",
		"POST",
		"PUT",
		"PATCH",
		"DELETE",
		"OPTIONS",
	})

	credentialsOk := handlers.AllowCredentials()
	log.Fatal(http.ListenAndServe(
		":"+port,
		handlers.CORS(
			originsOk,
			headersOk,
			methodsOk,
			credentialsOk,
		)(loggedRouter),
	))
}
