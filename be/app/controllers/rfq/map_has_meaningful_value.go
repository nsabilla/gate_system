package rfq

import "strings"

func mapHasMeaningfulValue(m map[string]interface{}) bool {
	if m == nil {
		return false
	}
	for _, v := range m {
		if v == nil {
			continue
		}
		switch t := v.(type) {
		case string:
			if strings.TrimSpace(t) != "" {
				return true
			}
		default:
			return true
		}
	}
	return false
}
