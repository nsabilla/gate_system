package rfq

import "github.com/jinzhu/gorm"

func deleteByRFQIfProvided(tx *gorm.DB, tableName string, provided bool, rfqID int64) error {
	if !provided {
		return nil
	}
	return tx.Exec("DELETE FROM "+tableName+" WHERE rfq_id = ?", rfqID).Error
}
