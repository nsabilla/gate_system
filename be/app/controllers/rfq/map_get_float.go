package rfq

import (
	"strconv"
	"strings"
)

func mapGetFloat(m map[string]interface{}, key string) *float64 {
	v := mapGetAny(m, key)
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case float64:
		return &t
	case int:
		f := float64(t)
		return &f
	case int64:
		f := float64(t)
		return &f
	case string:
		clean := strings.TrimSpace(t)
		if clean == "" {
			return nil
		}
		f, err := strconv.ParseFloat(clean, 64)
		if err != nil {
			return nil
		}
		return &f
	default:
		return nil
	}
}
