package rfq

func ptrValue[T any](v *T) interface{} {
	if v == nil {
		return nil
	}
	return *v
}
