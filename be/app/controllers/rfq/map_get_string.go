package rfq

import (
	"strconv"
	"strings"
)

func mapGetString(m map[string]interface{}, key string) *string {
	v := mapGetAny(m, key)
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case string:
		clean := strings.TrimSpace(t)
		if clean == "" {
			return nil
		}
		return &clean
	case []byte:
		clean := strings.TrimSpace(string(t))
		if clean == "" {
			return nil
		}
		return &clean
	case float64:
		str := strconv.FormatFloat(t, 'f', -1, 64)
		return &str
	case int:
		str := strconv.Itoa(t)
		return &str
	case int64:
		str := strconv.FormatInt(t, 10)
		return &str
	default:
		return nil
	}
}
