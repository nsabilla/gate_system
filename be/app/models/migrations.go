package models

import (
	"strings"
)

// EnsureRFQPFSTypeColumn ensures the rfq table has the pfs_type column for supporting
// unique RFQ numbers per PFS type (forging, toolset, jack).
// Format: RFQ-{sequence}-{TYPE} (e.g., RFQ-001-FG)
func EnsureRFQPFSTypeColumn() error {
	db := GetDB()

	// Try to add pfs_type column with default value 'FG'
	// If it already exists, the error will be caught and ignored
	query := `ALTER TABLE rfq ADD COLUMN pfs_type VARCHAR(10) DEFAULT 'FG'`
	if err := db.Exec(query).Error; err != nil {
		// Check if it's a "column already exists" error (acceptable)
		errStr := strings.ToLower(err.Error())
		if !strings.Contains(errStr, "duplicate column") &&
			!strings.Contains(errStr, "already exists") &&
			!strings.Contains(errStr, "unknown column") {
			// Only return error if it's not a "column already exists" type error
			return err
		}
	}

	return nil
}

// EnsureFeasibilityColumns ensures the rfq_feasibility table has all the new fields
// requested for detailed financial tracking.
func EnsureFeasibilityColumns() error {
	db := GetDB()

	columns := []string{
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS specification TEXT",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS source VARCHAR(255)",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS basic_price NUMERIC(15,2) DEFAULT 0",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS import_duty NUMERIC(15,2) DEFAULT 0",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS inclaring NUMERIC(15,2) DEFAULT 0",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS inventory NUMERIC(15,2) DEFAULT 0",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS cost_of_money NUMERIC(15,2) DEFAULT 0",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS material_price NUMERIC(15,2) DEFAULT 0",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS product_weight NUMERIC(15,4) DEFAULT 0",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS matl_weight NUMERIC(15,4) DEFAULT 0",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS rejection NUMERIC(15,2) DEFAULT 0",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS material_cost NUMERIC(15,2) DEFAULT 0",
		"ALTER TABLE rfq_feasibility ADD COLUMN IF NOT EXISTS scrap_cost NUMERIC(15,2) DEFAULT 0",
	}

	for _, query := range columns {
		if err := db.Exec(query).Error; err != nil {
			// Ignore "already exists" errors just in case IF NOT EXISTS isn't supported or fails
			errStr := strings.ToLower(err.Error())
			if !strings.Contains(errStr, "already exists") && !strings.Contains(errStr, "duplicate column") {
				return err
			}
		}
	}

	return nil
}

// EnsureActivityPlanColumns ensures the rfq_activity_plan table has all required columns
func EnsureActivityPlanColumns() error {
	db := GetDB()

	columns := []string{
		"ALTER TABLE rfq_activity_plan ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
		"ALTER TABLE rfq_activity_plan ADD COLUMN IF NOT EXISTS addby VARCHAR(255)",
		"ALTER TABLE rfq_activity_plan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
		"ALTER TABLE rfq_activity_plan ADD COLUMN IF NOT EXISTS updateby VARCHAR(255)",
	}

	for _, query := range columns {
		if err := db.Exec(query).Error; err != nil {
			// Ignore "already exists" errors
			errStr := strings.ToLower(err.Error())
			if !strings.Contains(errStr, "already exists") &&
				!strings.Contains(errStr, "duplicate column") &&
				!strings.Contains(errStr, "column") {
				return err
			}
		}
	}

	return nil
}

// RunAllMigrations executes all pending schema migrations
func RunAllMigrations() error {
	if err := EnsureRFQPFSTypeColumn(); err != nil {
		return err
	}

	if err := EnsureFeasibilityColumns(); err != nil {
		return err
	}

	if err := EnsureActivityPlanColumns(); err != nil {
		return err
	}

	return nil
}
