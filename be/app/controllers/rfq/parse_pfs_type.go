package rfq

import (
	"net/http"
	"strings"
)

// parsePFSType extracts and validates the PFS type query parameter (forging, jack, toolset).
// Defaults to "forging" if not specified or invalid.
func parsePFSType(r *http.Request) string {
	typeParam := strings.ToLower(strings.TrimSpace(r.FormValue("pfs_type")))
	if typeParam == "" {
		typeParam = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type")))
	}

	switch typeParam {
	case "jack", "jck":
		return "JCK"
	case "toolset", "tls":
		return "TLS"
	case "forging", "fg":
		return "FG"
	default:
		return "FG"
	}
}
