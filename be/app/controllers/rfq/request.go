package rfq

type CreateRFQRequest struct {
	ProductType string `json:"product_type"` // NEW / SIMILAR

	Customer          *string  `json:"customer"`
	PartName          *string  `json:"part_name"`
	PartNo            *string  `json:"part_no"`
	Model             *string  `json:"model"`
	VolumeMonth       *int     `json:"volume_month"`
	Material          *string  `json:"material"`
	ProductWeight     *float64 `json:"product_weight"`
	DeliveryCondition *string  `json:"delivery_condition"`

	// Remarks (by section)
	RemarkForg *string `json:"remark_forg"`
	RemarkComp *string `json:"remark_comp"`
	RemarkMach *string `json:"remark_mach"`
	RemarkAsse *string `json:"remark_asse"`
	RemarkDoc  *string `json:"remark_doc"`

	// Legacy single remark (backward compatible)
	Remark *string `json:"remark,omitempty"`

	// Technical Document (by section)
	TechForg *string `json:"technical_document_forg"`
	TechComp *string `json:"technical_document_comp"`
	TechMach *string `json:"technical_document_mach"`
	TechAsse *string `json:"technical_document_asse"`
	TechDoc  *string `json:"technical_document_doc"`

	// Legacy single technical document path (backward compatible)
	TechPath *string `json:"technical_document,omitempty"`

	TechName *string `json:"technical_document_name"`
	TechType *string `json:"technical_document_type"`
	TechSize *int    `json:"technical_document_size"`
}
