package rfq

import "projectrfqv1/app/models"

func loadListByQuery(query string, args ...interface{}) ([]map[string]interface{}, error) {
	rows, err := models.GetDB().Raw(query, args...).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items, err := rowsToMaps(rows)
	if err != nil {
		return nil, err
	}
	if items == nil {
		return []map[string]interface{}{}, nil
	}
	return items, nil
}
