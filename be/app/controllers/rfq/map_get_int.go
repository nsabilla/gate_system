package rfq

import (
	"strconv"
	"strings"
)

func mapGetInt(m map[string]interface{}, key string) *int {
	v := mapGetAny(m, key)
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case float64:
		i := int(t)
		return &i
	case int:
		return &t
	case int64:
		i := int(t)
		return &i
	case string:
		clean := strings.TrimSpace(t)
		if clean == "" {
			return nil
		}
		i64, err := strconv.ParseInt(clean, 10, 64)
		if err != nil {
			return nil
		}
		i := int(i64)
		return &i
	default:
		return nil
	}
}
