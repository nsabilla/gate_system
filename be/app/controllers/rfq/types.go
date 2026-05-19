package rfq

// INTERNAL PAYLOAD untuk CREATE RFQ (multipart)
type RFQProductPayload struct {
	ProductType       string
	Customer          *string
	PartName          *string
	PartNo            *string
	Model             *string
	VolumeMonth       *int
	Material          *string
	ProductWeight     *float64
	DeliveryCondition *string

	RemarkForg *string
	RemarkComp *string
	RemarkMach *string
	RemarkAsse *string
	RemarkDoc  *string

	TechForg *string
	TechComp *string
	TechMach *string
	TechAsse *string
	TechDoc  *string

	TechName *string
	TechType *string
	TechSize *int
}
