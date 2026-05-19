package rfq

func mapGetRowNo(row map[string]interface{}, idx int) int {
	v := mapGetInt(row, "row_no")
	if v == nil || *v <= 0 {
		return idx + 1
	}
	return *v
}
