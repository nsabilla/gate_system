package rfq

import "time"

func mapGetDateSQL(m map[string]interface{}, key string) interface{} {
	str := mapGetString(m, key)
	if str == nil {
		return nil
	}
	t, err := time.Parse("2006-01-02", *str)
	if err != nil {
		return nil
	}
	return t.Format("2006-01-02")
}
