package rfq

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/jinzhu/gorm"

	"projectrfqv1/app/controllers/auth"
	"projectrfqv1/app/models"
	u "projectrfqv1/utils"
)

/*
====================================================
HELPER

		CreateRFQRequest
	}

	userID, ok := auth.GetUserID(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

====================================================
*/
func nullOrValue[T any](v *T) interface{} {
	if v == nil {
		return nil
	}
	return *v
}

func getPtrString(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func getPtrInt(s string) *int {
	if s == "" {
		return nil
	}
	i, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &i
}

func getPtrFloat(s string) *float64 {
	if s == "" {
		return nil
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return &f
}

func uploadFileFromForm(r *http.Request, formKey string) (path *string, name *string, contentType *string, size *int, err error) {
	file, header, err := r.FormFile(formKey)
	if err != nil {
		return nil, nil, nil, nil, nil
	}
	defer file.Close()

	if err := os.MkdirAll("uploads/technical", 0755); err != nil {
		return nil, nil, nil, nil, err
	}

	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), header.Filename)
	savedPath := filepath.ToSlash(filepath.Join("uploads/technical", filename))

	dst, err := os.Create(savedPath)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		_ = os.Remove(savedPath)
		return nil, nil, nil, nil, err
	}

	ct := header.Header.Get("Content-Type")
	sz := int(header.Size)
	return &savedPath, &header.Filename, &ct, &sz, nil
}

func toInt64(v interface{}) (int64, bool) {
	switch t := v.(type) {
	case int64:
		return t, true
	case int32:
		return int64(t), true
	case int:
		return int64(t), true
	case uint64:
		return int64(t), true
	case []byte:
		i, err := strconv.ParseInt(string(t), 10, 64)
		return i, err == nil
	case string:
		i, err := strconv.ParseInt(t, 10, 64)
		return i, err == nil
	default:
		return 0, false
	}
}

/*
====================================================
INTERNAL SAVE PRODUCT (AMAN & REUSABLE)
====================================================
*/
func saveRFQProduct(
	db *gorm.DB,
	createdBy string,
	rfqID *int64,
	p RFQProductPayload,
	pfsType string,
) (int64, error) {

	rows, err := db.Raw(`
	SELECT sp_rfq_crud(
	?::varchar,  -- p_action
	?::bigint,   -- p_rfq_id
	?::varchar,  -- p_created_by
	?::bigint,   -- p_product_id
	?::varchar,  -- p_product_type
	?::varchar,  -- p_customer
	?::varchar,  -- p_part_name
	?::varchar,  -- p_part_no
	?::varchar,  -- p_model
	?::integer,  -- p_volume_month
	?::varchar,  -- p_material
	?::numeric,  -- p_product_weight
	?::varchar,  -- p_delivery_condition

	?::text,     -- p_remark_forg
	?::text,     -- p_remark_comp
	?::text,     -- p_remark_mach
	?::text,     -- p_remark_asse
	?::text,     -- p_remark_doc

	?::varchar,  -- p_tech_forg
	?::varchar,  -- p_tech_comp
	?::varchar,  -- p_tech_mach
	?::varchar,  -- p_tech_asse
	?::varchar,  -- p_tech_doc

	?::varchar,  -- p_tech_name
	?::varchar,  -- p_tech_type
	?::integer,  -- p_tech_size
	?::varchar   -- p_pfs_type
) AS rfq_id
	`,
		"CREATE",
		nullOrValue(rfqID),
		createdBy,
		nil,
		p.ProductType,
		nullOrValue(p.Customer),
		nullOrValue(p.PartName),
		nullOrValue(p.PartNo),
		nullOrValue(p.Model),
		nullOrValue(p.VolumeMonth),
		nullOrValue(p.Material),
		nullOrValue(p.ProductWeight),
		nullOrValue(p.DeliveryCondition),
		nullOrValue(p.RemarkForg),
		nullOrValue(p.RemarkComp),
		nullOrValue(p.RemarkMach),
		nullOrValue(p.RemarkAsse),
		nullOrValue(p.RemarkDoc),

		nullOrValue(p.TechForg),
		nullOrValue(p.TechComp),
		nullOrValue(p.TechMach),
		nullOrValue(p.TechAsse),
		nullOrValue(p.TechDoc),

		nullOrValue(p.TechName),
		nullOrValue(p.TechType),
		nullOrValue(p.TechSize),
		pfsType,
	).Rows()

	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var outRFQID int64
	if rows.Next() {
		columns, err := rows.Columns()
		if err != nil {
			return 0, err
		}

		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}
		if err := rows.Scan(valuePtrs...); err != nil {
			return 0, err
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}

		if v, ok := row["rfq_id"]; ok {
			if id, ok := toInt64(v); ok {
				outRFQID = id
			}
		} else if v, ok := row["id"]; ok {
			if id, ok := toInt64(v); ok {
				outRFQID = id
			}
		}
	}

	if outRFQID == 0 && rfqID != nil {
		outRFQID = *rfqID
	}
	if outRFQID == 0 {
		return 0, errors.New("stored procedure did not return rfq_id (expected SELECT v_rfq_id AS rfq_id)")
	}

	return outRFQID, nil
}

/*
====================================================
CREATE RFQ
SUPPORT:
- JSON (OLD)
- MULTIPART OLD
- MULTIPART NP + SP (NEW)
====================================================
*/
func CreateRFQ(w http.ResponseWriter, r *http.Request) {

	/* ================= DEBUG HEADER ================= */
	log.Println("===== CREATE RFQ HIT =====")
	log.Println("Content-Type:", r.Header.Get("Content-Type"))

	userID, ok := auth.GetUserID(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	db := models.GetDB()
	pfsType := parsePFSType(r)

	/*
		==================================================
		PASTIKAN FORM TERPARSE (AMAN UNTUK JSON & MULTIPART)
		==================================================
	*/
	_ = r.ParseMultipartForm(20 << 20)

	log.Println("np_part_name:", r.FormValue("np_part_name"))
	log.Println("sp_part_name:", r.FormValue("sp_part_name"))

	/*
		==================================================
		MODE BARU (NP & SP) — PRIORITAS
		==================================================
	*/
	if r.FormValue("np_part_name") != "" {

		log.Println(">>> MODE BARU AKTIF (NP / SP)")

		tx := db.Begin()
		defer func() {
			if rec := recover(); rec != nil {
				log.Println("PANIC:", rec)
				tx.Rollback()
			}
		}()

		/* ---------- NEW PRODUCT ---------- */
		np := RFQProductPayload{
			ProductType:       "NEW",
			Customer:          getPtrString(r.FormValue("np_customer")),
			PartName:          getPtrString(r.FormValue("np_part_name")),
			PartNo:            getPtrString(r.FormValue("np_part_no")),
			Model:             getPtrString(r.FormValue("np_model")),
			VolumeMonth:       getPtrInt(r.FormValue("np_volume_month")),
			Material:          getPtrString(r.FormValue("np_material")),
			ProductWeight:     getPtrFloat(r.FormValue("np_product_weight")),
			DeliveryCondition: getPtrString(r.FormValue("np_delivery_condition")),
			RemarkForg:        getPtrString(r.FormValue("np_remark_forg")),
			RemarkComp:        getPtrString(r.FormValue("np_remark_comp")),
			RemarkMach:        getPtrString(r.FormValue("np_remark_mach")),
			RemarkAsse:        getPtrString(r.FormValue("np_remark_asse")),
			RemarkDoc:         getPtrString(r.FormValue("np_remark_doc")),
		}

		if np.RemarkDoc == nil {
			np.RemarkDoc = getPtrString(r.FormValue("np_remark"))
		}

		if np.PartName == nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "New Product part name is required"))
			return
		}

		/* ---------- UPLOAD FILE NP ---------- */
		metaSet := false
		applyMeta := func(name, ct *string, sz *int) {
			np.TechName = name
			np.TechType = ct
			np.TechSize = sz
			metaSet = true
		}

		uploadNP := func(key string, setPath func(*string)) error {
			pth, name, ct, sz, err := uploadFileFromForm(r, key)
			if err != nil {
				return err
			}
			if pth != nil {
				setPath(pth)
				if !metaSet {
					applyMeta(name, ct, sz)
				}
			}
			return nil
		}

		if err := uploadNP("np_technical_document_forg", func(p *string) { np.TechForg = p }); err != nil {
			tx.Rollback()
			u.Respond(w, u.Message(false, "Failed to save uploaded file (forging)"))
			return
		}
		if err := uploadNP("np_technical_document_comp", func(p *string) { np.TechComp = p }); err != nil {
			tx.Rollback()
			u.Respond(w, u.Message(false, "Failed to save uploaded file (component)"))
			return
		}
		if err := uploadNP("np_technical_document_mach", func(p *string) { np.TechMach = p }); err != nil {
			tx.Rollback()
			u.Respond(w, u.Message(false, "Failed to save uploaded file (machining)"))
			return
		}
		if err := uploadNP("np_technical_document_asse", func(p *string) { np.TechAsse = p }); err != nil {
			tx.Rollback()
			u.Respond(w, u.Message(false, "Failed to save uploaded file (assembly)"))
			return
		}
		if err := uploadNP("np_technical_document_doc", func(p *string) { np.TechDoc = p }); err != nil {
			tx.Rollback()
			u.Respond(w, u.Message(false, "Failed to save uploaded file (document)"))
			return
		}

		if np.TechDoc == nil {
			_ = uploadNP("np_technical_document", func(p *string) { np.TechDoc = p })
		}

		var rfqID *int64
		createdRFQID, err := saveRFQProduct(tx, userID, rfqID, np, pfsType)
		if err != nil {
			tx.Rollback()
			u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, err.Error()))
			return
		}
		rfqID = &createdRFQID

		/* ---------- SIMILAR PRODUCT (OPTIONAL) ---------- */
		if r.FormValue("sp_part_name") != "" {

			log.Println(">>> SIMILAR PRODUCT DETECTED")

			sp := RFQProductPayload{
				ProductType:       "SIMILAR",
				Customer:          getPtrString(r.FormValue("sp_customer")),
				PartName:          getPtrString(r.FormValue("sp_part_name")),
				PartNo:            getPtrString(r.FormValue("sp_part_no")),
				Model:             getPtrString(r.FormValue("sp_model")),
				VolumeMonth:       getPtrInt(r.FormValue("sp_volume_month")),
				Material:          getPtrString(r.FormValue("sp_material")),
				ProductWeight:     getPtrFloat(r.FormValue("sp_product_weight")),
				DeliveryCondition: getPtrString(r.FormValue("sp_delivery_condition")),
				RemarkForg:        getPtrString(r.FormValue("sp_remark_forg")),
				RemarkComp:        getPtrString(r.FormValue("sp_remark_comp")),
				RemarkMach:        getPtrString(r.FormValue("sp_remark_mach")),
				RemarkAsse:        getPtrString(r.FormValue("sp_remark_asse")),
				RemarkDoc:         getPtrString(r.FormValue("sp_remark_doc")),
			}

			if sp.RemarkDoc == nil {
				sp.RemarkDoc = getPtrString(r.FormValue("sp_remark"))
			}

			metaSet = false
			applyMeta = func(name, ct *string, sz *int) {
				sp.TechName = name
				sp.TechType = ct
				sp.TechSize = sz
				metaSet = true
			}

			uploadSP := func(key string, setPath func(*string)) error {
				pth, name, ct, sz, err := uploadFileFromForm(r, key)
				if err != nil {
					return err
				}
				if pth != nil {
					setPath(pth)
					if !metaSet {
						applyMeta(name, ct, sz)
					}
				}
				return nil
			}

			_ = uploadSP("sp_technical_document_forg", func(p *string) { sp.TechForg = p })
			_ = uploadSP("sp_technical_document_comp", func(p *string) { sp.TechComp = p })
			_ = uploadSP("sp_technical_document_mach", func(p *string) { sp.TechMach = p })
			_ = uploadSP("sp_technical_document_asse", func(p *string) { sp.TechAsse = p })
			_ = uploadSP("sp_technical_document_doc", func(p *string) { sp.TechDoc = p })

			if sp.TechDoc == nil {
				_ = uploadSP("sp_technical_document", func(p *string) { sp.TechDoc = p })
			}

			if _, err := saveRFQProduct(tx, userID, rfqID, sp, pfsType); err != nil {
				tx.Rollback()
				u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, err.Error()))
				return
			}
		}

		tx.Commit()
		resp := u.Message(true, "RFQ created (draft)")
		resp["rfq_id"] = createdRFQID
		u.Respond(w, resp)
		return
	}

	/*
		==================================================
		MODE LAMA (FAIL FAST JIKA PAYLOAD TIDAK VALID)
		==================================================
	*/
	log.Println(">>> MODE LAMA AKTIF")

	var req CreateRFQRequest

	if strings.Contains(r.Header.Get("Content-Type"), "application/json") {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			u.Respond(w, u.Message(false, "Invalid request body"))
			return
		}
	} else {
		req.ProductType = r.FormValue("product_type")
		req.PartName = getPtrString(r.FormValue("part_name"))
	}

	if req.ProductType == "" || req.PartName == nil {
		log.Println("MODE LAMA INVALID PAYLOAD — ABORT")
		u.Respond(w, u.Message(false, "Invalid RFQ payload"))
		return
	}

	u.Respond(w, u.Message(false, "Legacy mode not supported for this request"))
}

/*
====================================================
UPDATE RFQ PRODUCT (JSON ONLY)
====================================================
*/
func UpdateRFQProduct(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	var req struct {
		ProductID int64 `json:"product_id"`
		CreateRFQRequest
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid request body"))
		return
	}

	req.ProductType = strings.ToUpper(strings.TrimSpace(req.ProductType))
	if req.ProductType != "NEW" && req.ProductType != "SIMILAR" {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid product_type (must be NEW or SIMILAR)"))
		return
	}

	if req.ProductID <= 0 {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid product_id"))
		return
	}

	// Enforce: marketing hanya boleh update product milik RFQ yang dibuat dirinya
	var createdBy string
	err := models.GetDB().Raw(`
		SELECT r.created_by
		FROM rfq r
		JOIN rfq_detail d ON d.rfq_id = r.id
		WHERE d.id = ?
		LIMIT 1
	`, req.ProductID).Row().Scan(&createdBy)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			u.RespondWithStatus(w, http.StatusNotFound, u.Message(false, "Product not found"))
			return
		}
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate product owner"))
		return
	}
	if createdBy != userID {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden"))
		return
	}

	// Preserve existing technical document fields when not provided by client.
	// (Frontend edit form currently doesn't send technical_document_* values.)
	type existingTech struct {
		TechForg sql.NullString
		TechComp sql.NullString
		TechMach sql.NullString
		TechAsse sql.NullString
		TechDoc  sql.NullString
		TechName sql.NullString
		TechType sql.NullString
		TechSize sql.NullInt64
	}

	var ex existingTech
	techRow := models.GetDB().Raw(`
		SELECT
			technical_document_forg,
			technical_document_comp,
			technical_document_mach,
			technical_document_asse,
			technical_document_doc,
			technical_document_name,
			technical_document_type,
			technical_document_size
		FROM rfq_detail
		WHERE id = ?
		LIMIT 1
	`, req.ProductID).Row()
	if err := techRow.Scan(
		&ex.TechForg,
		&ex.TechComp,
		&ex.TechMach,
		&ex.TechAsse,
		&ex.TechDoc,
		&ex.TechName,
		&ex.TechType,
		&ex.TechSize,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			u.RespondWithStatus(w, http.StatusNotFound, u.Message(false, "Product not found"))
			return
		}
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to load existing technical document fields"))
		return
	}

	coalesceStringPtr := func(in *string, cur sql.NullString) *string {
		if in != nil {
			return in
		}
		if cur.Valid {
			s := cur.String
			return &s
		}
		return nil
	}
	coalesceIntPtr := func(in *int, cur sql.NullInt64) *int {
		if in != nil {
			return in
		}
		if cur.Valid {
			i := int(cur.Int64)
			return &i
		}
		return nil
	}

	inTechDoc := req.TechDoc
	if inTechDoc == nil {
		inTechDoc = req.TechPath
	}

	result := models.GetDB().Exec(`
		SELECT sp_rfq_crud(
			?::varchar, -- p_action
			NULL::bigint, -- p_rfq_id
			NULL::varchar, -- p_created_by
			?::bigint, -- p_product_id
			?::varchar, -- p_product_type
			?::varchar, ?::varchar, ?::varchar, ?::varchar, ?::integer, ?::varchar, ?::numeric, ?::varchar,
			?::text, ?::text, ?::text, ?::text, ?::text,
			?::varchar, ?::varchar, ?::varchar, ?::varchar, ?::varchar,
			?::varchar, ?::varchar, ?::integer
		)
	`,
		"UPDATE",
		req.ProductID,
		nullOrValue(req.Customer),
		nullOrValue(req.PartName),
		nullOrValue(req.PartNo),
		nullOrValue(req.Model),
		nullOrValue(req.VolumeMonth),
		nullOrValue(req.Material),
		nullOrValue(req.ProductWeight),
		nullOrValue(req.DeliveryCondition),
		nullOrValue(func() *string {
			if req.RemarkForg != nil {
				return req.RemarkForg
			}
			return nil
		}()),
		nullOrValue(req.RemarkComp),
		nullOrValue(req.RemarkMach),
		nullOrValue(req.RemarkAsse),
		nullOrValue(func() *string {
			if req.RemarkDoc != nil {
				return req.RemarkDoc
			}
			return req.Remark
		}()),
		nullOrValue(coalesceStringPtr(req.TechForg, ex.TechForg)),
		nullOrValue(coalesceStringPtr(req.TechComp, ex.TechComp)),
		nullOrValue(coalesceStringPtr(req.TechMach, ex.TechMach)),
		nullOrValue(coalesceStringPtr(req.TechAsse, ex.TechAsse)),
		nullOrValue(coalesceStringPtr(inTechDoc, ex.TechDoc)),
		nullOrValue(coalesceStringPtr(req.TechName, ex.TechName)),
		nullOrValue(coalesceStringPtr(req.TechType, ex.TechType)),
		nullOrValue(coalesceIntPtr(req.TechSize, ex.TechSize)),
	)

	if result.Error != nil {
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, result.Error.Error()))
		return
	}

	u.Respond(w, u.Message(true, "Product updated"))
}

/*
====================================================
DELETE RFQ PRODUCT
====================================================
*/
func DeleteRFQProduct(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r)
	if !ok {
		u.RespondWithStatus(w, http.StatusUnauthorized, u.Message(false, "Unauthorized"))
		return
	}

	var req struct {
		ProductID int64 `json:"product_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		u.Respond(w, u.Message(false, "Invalid request body"))
		return
	}

	if req.ProductID <= 0 {
		u.RespondWithStatus(w, http.StatusBadRequest, u.Message(false, "Invalid product_id"))
		return
	}

	// Enforce: marketing hanya boleh delete product milik RFQ yang dibuat dirinya
	var createdBy string
	err := models.GetDB().Raw(`
		SELECT r.created_by
		FROM rfq r
		JOIN rfq_detail d ON d.rfq_id = r.id
		WHERE d.id = ?
		LIMIT 1
	`, req.ProductID).Row().Scan(&createdBy)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			u.RespondWithStatus(w, http.StatusNotFound, u.Message(false, "Product not found"))
			return
		}
		u.RespondWithStatus(w, http.StatusInternalServerError, u.Message(false, "Failed to validate product owner"))
		return
	}
	if createdBy != userID {
		u.RespondWithStatus(w, http.StatusForbidden, u.Message(false, "Forbidden"))
		return
	}

	result := models.GetDB().Exec(
		`SELECT sp_rfq_crud(
    'DELETE'::varchar,
    NULL::bigint,
    NULL::varchar,
    ?::bigint,      -- p_product_id
    NULL::varchar,  -- p_product_type
    NULL::varchar,NULL::varchar,NULL::varchar,NULL::varchar,NULL::integer,NULL::varchar,NULL::numeric,NULL::varchar,
    NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,
    NULL::varchar,NULL::varchar,NULL::varchar,NULL::varchar,NULL::varchar,
    NULL::varchar,NULL::varchar,NULL::integer
)
		`,
		req.ProductID,
	)

	if result.Error != nil {
		u.Respond(w, u.Message(false, result.Error.Error()))
		return
	}

	u.Respond(w, u.Message(true, "Product deleted"))
}

/*
====================================================
GET RFQ DETAIL
====================================================
*/
func GetRFQDetail(w http.ResponseWriter, r *http.Request) {

	/* ================= GET & VALIDATE PARAM ================= */
	vars := mux.Vars(r)
	rfqIDStr := vars["id"]

	rfqID, err := strconv.ParseInt(rfqIDStr, 10, 64)
	if err != nil || rfqID <= 0 {
		u.RespondWithStatus(
			w,
			http.StatusBadRequest,
			u.Message(false, "Invalid RFQ ID"),
		)
		return
	}

	/* ================= EXEC STORED PROCEDURE ================= */
	rows, err := models.GetDB().Raw(`
		SELECT 
			r.id, r.rfq_no, r.pfs_type, r.status, r.created_by, r.created_at,
			d.id AS product_id, d.product_type, d.customer, d.part_name, d.part_no, d.model, d.volume_month, 
			d.material, d.product_weight, d.delivery_condition, 
			d.t_d_remark_forg, d.t_d_remark_comp, d.t_d_remark_mach, d.t_d_remark_asse, d.t_d_remark_doc,
			d.technical_document_forg, d.technical_document_comp, d.technical_document_mach, 
			d.technical_document_asse, d.technical_document_doc, d.technical_document_name, 
			d.technical_document_type, d.technical_document_size
		FROM rfq r
		JOIN rfq_detail d ON d.rfq_id = r.id
		WHERE r.id = ?
	`, rfqID).Rows()

	if err != nil {
		log.Println("RFQ DETAIL QUERY ERROR:", err)
		u.RespondWithStatus(
			w,
			http.StatusInternalServerError,
			u.Message(false, err.Error()),
		)
		return
	}
	defer rows.Close()

	/* ================= READ COLUMNS ================= */
	columns, err := rows.Columns()
	if err != nil {
		log.Println("RFQ DETAIL COLUMNS ERROR:", err)
		u.RespondWithStatus(
			w,
			http.StatusInternalServerError,
			u.Message(false, err.Error()),
		)
		return
	}

	/* ================= SCAN ROWS ================= */
	results := make([]map[string]interface{}, 0)

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			log.Println("RFQ DETAIL ROW SCAN ERROR:", err)
			continue
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}

		results = append(results, row)
	}

	log.Printf("RFQ DETAIL [%d] ROW COUNT: %d\n", rfqID, len(results))

	/* ================= RESPONSE ================= */
	resp := u.Message(true, "RFQ detail")
	resp["data"] = results
	u.Respond(w, resp)
}
