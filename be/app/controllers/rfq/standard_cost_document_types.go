package rfq

type standardCostOverviewPayload struct {
	CompanyName    *string  `json:"company_name"`
	PartNumber     *string  `json:"part_number"`
	PartName       *string  `json:"part_name"`
	Customer       *string  `json:"customer"`
	RejectionRate  *float64 `json:"rejection_rate"`
	SimilarProduct *string  `json:"similar_product"`
}

type standardCostProcessingItemPayload struct {
	RowNo                int      `json:"row_no"`
	WC                   *string  `json:"wc"`
	OpsNo                *string  `json:"ops_no"`
	PartNumber           *string  `json:"part_number"`
	StartFactor          *float64 `json:"start_factor"`
	PercentNG            *float64 `json:"percent_ng"`
	Processing           *string  `json:"processing"`
	Product              *string  `json:"product"`
	QtyPerParent         *float64 `json:"qty_per_parent"`
	QtyReqBJ1FG          *float64 `json:"qty_req_bj_1_fg"`
	CycleTime            *float64 `json:"cycle_time"`
	StandardCostMasterID *int64   `json:"standard_cost_master_id"`
	Labor                *float64 `json:"labor"`
	MDepr                *float64 `json:"mdepr"`
	FD                   *float64 `json:"fd"`
	FI                   *float64 `json:"fi"`
	VD                   *float64 `json:"vd"`
	VI                   *float64 `json:"vi"`
	RateDetik            standardCostRateDetikPayload `json:"rate_detik"`
	RatePCS              standardCostRatePCSPayload   `json:"rate_pcs"`
}

type standardCostMaterialItemPayload struct {
	RowNo          int      `json:"row_no"`
	RawMaterial    *string  `json:"raw_material"`
	TopValue       *string  `json:"top_value"`
	MaterialCode   *string  `json:"material_code"`
	Product        *string  `json:"product"`
	Process        *string  `json:"process"`
	QtyPerParent   *float64 `json:"qty_per_parent"`
	UOM            *string  `json:"uom"`
	QtyReqByParent *float64 `json:"qty_req_by_parent"`
	QtyReqBJ1FG    *float64 `json:"qty_req_bj_1_fg"`
	TopImpLoc      *string  `json:"top_imp_loc"`
	ImportFlag     *string  `json:"import_flag"`
	Currency       *string  `json:"currency"`
	ExchangeRate   *float64 `json:"exchange_rate"`
	RpUOMMaterial  *float64 `json:"rp_uom_material"`
	CostPcsFG      *float64 `json:"cost_pcs_fg"`
}

type standardCostDirectItemPayload struct {
	RowNo           int      `json:"row_no"`
	DirectCostName  *string  `json:"direct_cost_name"`
	KodeCE          *string  `json:"kode_ce"`
	UsedInProcessWC *string  `json:"used_in_process_wc"`
	QtyReqBJ1FG     *float64 `json:"qty_req_bj_1_fg"`
	ValueAmount     *float64 `json:"value_amount"`
	QtyPerMonth     *float64 `json:"qty_per_month"`
	LifetimeMonth   *float64 `json:"lifetime_month"`
	Lifetime        *float64 `json:"lifetime"`
	CostPcsFG       *float64 `json:"cost_pcs_fg"`
}

type standardCostMaterialSummaryPayload struct {
	TotalRowMaterial       *float64 `json:"total_row_material"`
	PresentaseTerhadapSale *float64 `json:"presentase_terhadap_sale"`
}

type standardCostDirectSummaryPayload struct {
	TotalDirectCostToProduct  *float64 `json:"total_direct_cost_to_product"`
	PresentaseTerhadapSale    *float64 `json:"presentase_terhadap_sale"`
	SummaryTitle              *string  `json:"summary_title"`
	TotalCostPerProduct       *float64 `json:"total_cost_per_product"`
	Sales                     *float64 `json:"sales"`
	UnitContributionMargin    *float64 `json:"unit_contribution_margin"`
	UnitContributionMarginPct *float64 `json:"unit_contribution_margin_pct"`
	GrossProfit               *float64 `json:"gross_profit"`
	GrossProfitPct            *float64 `json:"gross_profit_pct"`
	Remark                    *string  `json:"remark"`
}

type standardCostRateDetikPayload struct {
	MDepr     *float64 `json:"mdepr"`
	Labor     *float64 `json:"labor"`
	FOHFD     *float64 `json:"fohfd"`
	FOHFI     *float64 `json:"fohfi"`
	FOHVD     *float64 `json:"fohvd"`
	FOHVI     *float64 `json:"fohvi"`
	TotalRate *float64 `json:"total_rate"`
}

type standardCostRatePCSPayload struct {
	MDepr     *float64 `json:"mdepr"`
	Labor     *float64 `json:"labor"`
	FOHFD     *float64 `json:"fohfd"`
	FOHFI     *float64 `json:"fohfi"`
	FOHVD     *float64 `json:"fohvd"`
	FOHVI     *float64 `json:"fohvi"`
	TotalCost *float64 `json:"total_cost"`
}



type standardCostTotalProcessingPayload struct {
	MDepr     *float64 `json:"mdepr"`
	Labor     *float64 `json:"labor"`
	FOHFD     *float64 `json:"fohfd"`
	FOHFI     *float64 `json:"fohfi"`
	FOHVD     *float64 `json:"fohvd"`
	FOHVI     *float64 `json:"fohvi"`
	TotalCost *float64 `json:"total_cost"`
}

type standardCostPercentageSalePayload struct {
	MDepr     *float64 `json:"mdepr"`
	Labor     *float64 `json:"labor"`
	FOHFD     *float64 `json:"fohfd"`
	FOHFI     *float64 `json:"fohfi"`
	FOHVD     *float64 `json:"fohvd"`
	FOHVI     *float64 `json:"fohvi"`
	TotalCost *float64 `json:"total_cost"`
}

type standardCostDocumentPayload struct {
	Overview        standardCostOverviewPayload         `json:"overview"`
	ProcessingRows  []standardCostProcessingItemPayload `json:"processing_rows"`
	MaterialRows    []standardCostMaterialItemPayload   `json:"material_rows"`
	MaterialSummary standardCostMaterialSummaryPayload  `json:"material_summary"`
	DirectRows      []standardCostDirectItemPayload     `json:"direct_rows"`
	DirectSummary   standardCostDirectSummaryPayload    `json:"direct_summary"`
	TotalProcessing standardCostTotalProcessingPayload  `json:"total_processing"`
	PercentageSale  standardCostPercentageSalePayload   `json:"percentage_sale"`
}
