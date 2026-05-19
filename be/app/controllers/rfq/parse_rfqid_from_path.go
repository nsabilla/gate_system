package rfq

import (
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

func parseRFQIDFromPath(r *http.Request) (int64, bool) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}
