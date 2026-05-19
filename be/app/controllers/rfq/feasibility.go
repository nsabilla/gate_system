package rfq

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"projectrfqv1/app/models"
	u "projectrfqv1/utils"

	"github.com/gorilla/mux"
)

type feasibilityPayload struct {
	Customer      string  `json:"customer"`
	PartName      string  `json:"part_name"`
	DateOfIssued  string  `json:"date_of_issued"` // YYYY-MM-DD
	Project       string  `json:"project"`
	PartNumber    string  `json:"part_number"`
	Revision      string  `json:"revision"`
	QtyMonth      int     `json:"qty_month"`
	Masspro       string  `json:"masspro"`
	RevenueY      float64 `json:"revenue_y"`
	Specification string  `json:"specification"`
	Source        string  `json:"source"`
	BasicPrice    float64 `json:"basic_price"`
	ImportDuty    float64 `json:"import_duty"`
	Inclaring     float64 `json:"inclaring"`
	Inventory     float64 `json:"inventory"`
	CostOfMoney   float64 `json:"cost_of_money"`
	MaterialPrice float64 `json:"material_price"`
	ProductWeight float64 `json:"product_weight"`
	MatlWeight    float64 `json:"matl_weight"`
	Rejection     float64 `json:"rejection"`
	MaterialCost  float64 `json:"material_cost"`
	ScrapCost     float64 `json:"scrap_cost"`
}

type feasibilitySummaryRow struct {
	Description string `json:"description"`
	Amount      string `json:"amount"`
}

type feasibilitySummaryResponse struct {
	RFQNo        string                    `json:"rfq_no"`
	PFSType      string                    `json:"pfs_type"`
	StandardCost feasibilitySummarySection `json:"standard_cost"`
	ActualCost   feasibilitySummarySection `json:"actual_cost"`
	SimilarPart  feasibilitySummarySection `json:"similar_part"`
}

type feasibilitySummarySection struct {
	Title string                  `json:"title"`
	Rows  []feasibilitySummaryRow `json:"rows"`
}

type feasibilitySummaryField struct {
	Label string
	Key   string
}

func toSummaryString(value interface{}) string {
	if value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	case []byte:
		return string(typed)
	default:
		return fmt.Sprint(typed)
	}
}

func mapPFSToStandardCostType(pfsType string) string {
	switch strings.ToUpper(strings.TrimSpace(pfsType)) {
	case "FG":
		return "forging"
	case "TLS":
		return "toolset"
	case "JCK":
		return "jack"
	default:
		return strings.ToLower(strings.TrimSpace(pfsType))
	}
}

func buildSummaryRows(data map[string]interface{}, fields []feasibilitySummaryField) []feasibilitySummaryRow {
	rows := make([]feasibilitySummaryRow, 0, len(fields))
	for _, field := range fields {
		rows = append(rows, feasibilitySummaryRow{
			Description: field.Label,
			Amount:      toSummaryString(data[field.Key]),
		})
	}
	return rows
}

func GetFeasibility(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	rfqID, err := strconv.ParseInt(params["id"], 10, 64)
	if err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	data, err := loadOneByQuery(
		`SELECT
			r.rfq_no,
			COALESCE(d.customer, f.customer) AS customer,
			COALESCE(d.part_name, f.part_name) AS part_name,
			COALESCE(d.part_no, f.part_number) AS part_number,
			TO_CHAR(COALESCE(f.date_of_issued, r.created_at), 'YYYY-MM-DD') AS date_of_issued,
			COALESCE(d.volume_month, f.qty_month) AS qty_month,
			f.project,
			f.revision,
			f.masspro,
			f.revenue_y,
			f.specification,
			f.source,
			f.basic_price,
			f.import_duty,
			f.inclaring,
			f.inventory,
			f.cost_of_money,
			f.material_price,
			COALESCE(d.product_weight, f.product_weight) AS product_weight,
			f.matl_weight,
			f.rejection,
			f.material_cost,
			f.scrap_cost
		 FROM rfq AS r
		 LEFT JOIN rfq_feasibility AS f ON r.id = f.rfq_id
		 LEFT JOIN (
			SELECT rfq_id,
			       MAX(CASE WHEN LOWER(TRIM(product_type)) = 'new' THEN part_name END) AS part_name,
			       MAX(CASE WHEN LOWER(TRIM(product_type)) = 'new' THEN part_no END) AS part_no,
			       MAX(CASE WHEN LOWER(TRIM(product_type)) = 'new' THEN customer END) AS customer,
			       MAX(CASE WHEN LOWER(TRIM(product_type)) = 'new' THEN volume_month END) AS volume_month,
			       MAX(CASE WHEN LOWER(TRIM(product_type)) = 'new' THEN product_weight END) AS product_weight
			FROM rfq_detail
			GROUP BY rfq_id
		 ) d ON r.id = d.rfq_id
		 WHERE r.id = ?
		 LIMIT 1`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load feasibility data: "+err.Error()))
		return
	}

	u.Respond(w, map[string]interface{}{
		"status": true,
		"data":   data,
	})
}

func GetFeasibilitySummary(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	rfqID, err := strconv.ParseInt(params["id"], 10, 64)
	if err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	data, err := loadOneByQuery(
		`SELECT
			r.rfq_no,
			r.pfs_type,
				COALESCE(d.customer, f.customer) AS customer,
				COALESCE(d.part_name, f.part_name) AS part_name,
				COALESCE(d.part_no, f.part_number) AS part_number,
			f.project,
			COALESCE(d.volume_month, f.qty_month) AS qty_month,
			f.masspro,
			f.revenue_y,
			f.specification,
			f.source,
			f.basic_price,
			f.import_duty,
			f.inclaring,
			f.inventory,
			f.cost_of_money,
			f.material_price,
			COALESCE(d.product_weight, f.product_weight) AS product_weight,
			f.matl_weight,
			f.rejection,
			f.material_cost,
			f.scrap_cost,
			COALESCE(pfsv2.cut_qty, 0) AS material_qty,
			COALESCE(pfsv2.rm_w, 0) AS material_weight,
			COALESCE(pfsv2.prod_w, 0) AS pfs_product_weight,
			COALESCE(forg.rej_fg, 0) AS rejection_rate
		 FROM rfq AS r
		 LEFT JOIN rfq_feasibility AS f ON r.id = f.rfq_id
		 LEFT JOIN (
			SELECT rfq_id,
			       MAX(CASE WHEN LOWER(TRIM(product_type)) = 'new' THEN part_name END) AS part_name,
			       MAX(CASE WHEN LOWER(TRIM(product_type)) = 'new' THEN part_no END) AS part_no,
			       MAX(CASE WHEN LOWER(TRIM(product_type)) = 'new' THEN customer END) AS customer,
			       MAX(CASE WHEN LOWER(TRIM(product_type)) = 'new' THEN volume_month END) AS volume_month,
			       MAX(CASE WHEN LOWER(TRIM(product_type)) = 'new' THEN product_weight END) AS product_weight
			FROM rfq_detail
			GROUP BY rfq_id
		 ) d ON r.id = d.rfq_id
		 LEFT JOIN pfs_ov AS forg ON r.id = forg.rfq_id
		 LEFT JOIN pfs_ts AS pfsv2 ON r.id = pfsv2.rfq_id
		 WHERE r.id = ?
		   AND r.status = 'approved'
		 LIMIT 1`,
		rfqID,
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load feasibility summary: "+err.Error()))
		return
	}

	similarData, err := loadOneByQuery(
		`SELECT company_name, part_number, part_name, customer, rejection_rate, similar_product
		 FROM standard_cost_header
		 WHERE rfq_id = ? AND pfs_type = ?
		 ORDER BY id DESC
		 LIMIT 1`,
		rfqID,
		mapPFSToStandardCostType(toSummaryString(data["pfs_type"])),
	)
	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load similar part data: "+err.Error()))
		return
	}

	standardCostFields := []feasibilitySummaryField{
		{Label: "Customer", Key: "customer"},
		{Label: "Part Name", Key: "part_name"},
		{Label: "Part Number", Key: "part_number"},
		{Label: "Project", Key: "project"},
		{Label: "Qty / Month", Key: "qty_month"},
		{Label: "Masspro", Key: "masspro"},
		{Label: "Revenue / Year", Key: "revenue_y"},
		{Label: "Specification", Key: "specification"},
		{Label: "Source", Key: "source"},
		{Label: "Product Weight", Key: "product_weight"},
		{Label: "Mat'l Weight", Key: "matl_weight"},
		{Label: "Rejection", Key: "rejection"},
		{Label: "Basic Price", Key: "basic_price"},
		{Label: "Import Duty", Key: "import_duty"},
		{Label: "Inclaring", Key: "inclaring"},
		{Label: "Inventory", Key: "inventory"},
		{Label: "Cost of Money", Key: "cost_of_money"},
		{Label: "Material Price", Key: "material_price"},
		{Label: "Material Cost", Key: "material_cost"},
		{Label: "Scrap Cost", Key: "scrap_cost"},
	}

	actualCostFields := []feasibilitySummaryField{
		{Label: "Customer", Key: "customer"},
		{Label: "Part Name", Key: "part_name"},
		{Label: "Part Number", Key: "part_number"},
		{Label: "Project", Key: "project"},
		{Label: "Qty / Month", Key: "qty_month"},
		{Label: "Masspro", Key: "masspro"},
		{Label: "Revenue / Year", Key: "revenue_y"},
		{Label: "Specification", Key: "specification"},
		{Label: "Source", Key: "source"},
		{Label: "Product Weight", Key: "pfs_product_weight"},
		{Label: "Material Qty", Key: "material_qty"},
		{Label: "Material Weight", Key: "material_weight"},
		{Label: "Rejection Rate", Key: "rejection_rate"},
		{Label: "Basic Price", Key: "basic_price"},
		{Label: "Import Duty", Key: "import_duty"},
		{Label: "Inclaring", Key: "inclaring"},
		{Label: "Inventory", Key: "inventory"},
		{Label: "Cost of Money", Key: "cost_of_money"},
		{Label: "Material Price", Key: "material_price"},
		{Label: "Material Cost", Key: "material_cost"},
		{Label: "Scrap Cost", Key: "scrap_cost"},
	}

	similarPartFields := []feasibilitySummaryField{
		{Label: "Company Name", Key: "company_name"},
		{Label: "Part Number", Key: "part_number"},
		{Label: "Part Name", Key: "part_name"},
		{Label: "Customer", Key: "customer"},
		{Label: "Rejection Rate", Key: "rejection_rate"},
		{Label: "Similar Product", Key: "similar_product"},
	}

	response := feasibilitySummaryResponse{}
	if len(data) > 0 && toSummaryString(data["rfq_no"]) != "" {
		response.RFQNo = toSummaryString(data["rfq_no"])
		response.PFSType = toSummaryString(data["pfs_type"])
		response.StandardCost = feasibilitySummarySection{
			Title: "RFQ CONDITION (STD COST)",
			Rows:  buildSummaryRows(data, standardCostFields),
		}
		response.ActualCost = feasibilitySummarySection{
			Title: "RFQ CONDITION (ACT COST)",
			Rows:  buildSummaryRows(data, actualCostFields),
		}
		response.SimilarPart = feasibilitySummarySection{
			Title: "SIMILAR PART",
			Rows:  buildSummaryRows(similarData, similarPartFields),
		}
	}

	u.Respond(w, map[string]interface{}{
		"status": true,
		"data":   response,
	})
}

func UpsertFeasibility(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	rfqID, err := strconv.ParseInt(params["id"], 10, 64)
	if err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid RFQ ID"))
		return
	}

	var payload feasibilityPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	db := models.GetDB()

	// Check if exists
	var count int64
	db.Table("rfq_feasibility").Where("rfq_id = ?", rfqID).Count(&count)

	if count > 0 {
		// Update
		err = db.Exec(`
			UPDATE rfq_feasibility
			SET customer = ?, part_name = ?, date_of_issued = ?, project = ?, 
			    part_number = ?, revision = ?, qty_month = ?, masspro = ?, 
			    revenue_y = ?, updated_at = NOW(),
				specification = ?, source = ?, basic_price = ?, import_duty = ?, 
				inclaring = ?, inventory = ?, cost_of_money = ?, material_price = ?, 
				product_weight = ?, matl_weight = ?, rejection = ?, 
				material_cost = ?, scrap_cost = ?
			WHERE rfq_id = ?
		`, payload.Customer, payload.PartName, payload.DateOfIssued, payload.Project,
			payload.PartNumber, payload.Revision, payload.QtyMonth, payload.Masspro,
			payload.RevenueY, payload.Specification, payload.Source, payload.BasicPrice,
			payload.ImportDuty, payload.Inclaring, payload.Inventory, payload.CostOfMoney,
			payload.MaterialPrice, payload.ProductWeight, payload.MatlWeight, payload.Rejection,
			payload.MaterialCost, payload.ScrapCost, rfqID).Error
	} else {
		// Insert
		err = db.Exec(`
			INSERT INTO rfq_feasibility (rfq_id, customer, part_name, date_of_issued, project, 
			                            part_number, revision, qty_month, masspro, revenue_y,
										specification, source, basic_price, import_duty, 
										inclaring, inventory, cost_of_money, material_price, 
										product_weight, matl_weight, rejection, 
										material_cost, scrap_cost)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, rfqID, payload.Customer, payload.PartName, payload.DateOfIssued, payload.Project,
			payload.PartNumber, payload.Revision, payload.QtyMonth, payload.Masspro, payload.RevenueY,
			payload.Specification, payload.Source, payload.BasicPrice, payload.ImportDuty,
			payload.Inclaring, payload.Inventory, payload.CostOfMoney, payload.MaterialPrice,
			payload.ProductWeight, payload.MatlWeight, payload.Rejection, payload.MaterialCost,
			payload.ScrapCost).Error
	}

	if err != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to save feasibility data: "+err.Error()))
		return
	}

	u.Respond(w, u.Message(true, "Feasibility data saved successfully"))
}
