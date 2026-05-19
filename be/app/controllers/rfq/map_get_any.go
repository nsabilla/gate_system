package rfq

func mapGetAny(m map[string]interface{}, key string) interface{} {
	if m == nil {
		return nil
	}
	v, ok := m[key]
	if !ok {
		return nil
	}
	return v
}
