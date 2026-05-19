package rfq

import "time"

type RFQListRow struct {
	ID              int       `json:"id"`
	RFQNo           string    `json:"rfq_no"`
	Status          string    `json:"status"`
	CreatedBy       string    `json:"created_by"`
	CreatedAt       time.Time `json:"created_at"`
	NewPartName     *string   `json:"new_part_name"`
	SimilarPartName *string   `json:"similar_part_name"`
}
