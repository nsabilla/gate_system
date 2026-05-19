package models

import (
	"regexp"
	"strings"
)

// TranslateSQL converts MySQL-specific DDL/DML to PostgreSQL if the current db_type is postgres.
func TranslateSQL(query string) string {
	if GetDBType() != "postgres" {
		return query
	}

	// 1. Handle AUTO_INCREMENT
	reBigIntAuto := regexp.MustCompile(`(?i)BIGINT\s+AUTO_INCREMENT`)
	query = reBigIntAuto.ReplaceAllString(query, "BIGSERIAL")

	reIntAuto := regexp.MustCompile(`(?i)INT\s+AUTO_INCREMENT`)
	query = reIntAuto.ReplaceAllString(query, "SERIAL")

	// 2. Handle DATETIME
	query = strings.ReplaceAll(query, "DATETIME", "TIMESTAMP")

	// 3. Handle ON UPDATE CURRENT_TIMESTAMP (remove it, needs trigger in PG)
	reOnUpdate := regexp.MustCompile(`(?i)ON\s+UPDATE\s+CURRENT_TIMESTAMP`)
	query = reOnUpdate.ReplaceAllString(query, "")

	// 4. Handle ENUM(...)
	reEnum := regexp.MustCompile(`(?i)ENUM\s*\([^)]+\)`)
	query = reEnum.ReplaceAllString(query, "VARCHAR(255)")

	// 5. Handle MySQL inline KEY (index) definitions - PostgreSQL doesn't support them in CREATE TABLE
	// Example: KEY idx_rfq_id (rfq_id)
	reKey := regexp.MustCompile(`(?i),\s*KEY\s+[a-zA-Z0-9_]+\s*\([^)]+\)`)
	query = reKey.ReplaceAllString(query, "")

	// 6. Handle MySQL inline UNIQUE KEY
	// UNIQUE KEY uq_name (col) -> CONSTRAINT uq_name UNIQUE (col)
	reUniqueKey := regexp.MustCompile(`(?i)UNIQUE\s+KEY\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)`)
	query = reUniqueKey.ReplaceAllString(query, "CONSTRAINT $1 UNIQUE ($2)")

	// 7. Handle DATE_FORMAT(col, '%Y-%m-%d') -> TO_CHAR(col, 'YYYY-MM-DD')
	reDateFormat := regexp.MustCompile(`(?i)DATE_FORMAT\s*\(\s*([^,]+)\s*,\s*'%Y-%m-%d'\s*\)`)
	query = reDateFormat.ReplaceAllString(query, "TO_CHAR($1, 'YYYY-MM-DD')")

	// 8. Handle CAST(x AS SIGNED) -> CAST(x AS INTEGER)
	reCastSigned := regexp.MustCompile(`(?i)CAST\s*\(\s*(.+?)\s*AS\s+SIGNED\s*\)`)
	query = reCastSigned.ReplaceAllString(query, "CAST($1 AS INTEGER)")

	// 9. Handle CAST(x AS CHAR) -> CAST(x AS VARCHAR)
	reCastChar := regexp.MustCompile(`(?i)CAST\s*\(\s*(.+?)\s*AS\s+CHAR\s*\)`)
	query = reCastChar.ReplaceAllString(query, "CAST($1 AS VARCHAR)")

	// 10. Handle IFNULL -> COALESCE
	reIfNull := regexp.MustCompile(`(?i)IFNULL\s*\(`)
	query = reIfNull.ReplaceAllString(query, "COALESCE(")

	// 11. Handle simple IF(cond, a, b) -> CASE WHEN cond THEN a ELSE b END
	// Notes: This simple regex only handles well-formed non-nested IF() functions.
	reIf := regexp.MustCompile(`(?i)\bIF\s*\(([^,]+),\s*([^,]+),\s*([^)]+)\)`)
	query = reIf.ReplaceAllString(query, "CASE WHEN $1 THEN $2 ELSE $3 END")

	return query
}
