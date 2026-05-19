package rfq

import (
	"strings"
	"time"
)

func parseNullableDate(value *string) (interface{}, error) {
	if value == nil {
		return nil, nil
	}
	v := strings.TrimSpace(*value)
	if v == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", v)
	if err != nil {
		return nil, err
	}
	return t.Format("2006-01-02"), nil
}
