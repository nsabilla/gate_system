-- 1. Perluas kolom-kolom yang rawan melebihi 50 karakter
DO $$ 
BEGIN
    -- Perlebar nomor RFQ
    ALTER TABLE rfq ALTER COLUMN rfq_no TYPE VARCHAR(100);
    
    -- Perlebar nama file dan path dokumen teknis
    ALTER TABLE rfq_detail ALTER COLUMN technical_document_name TYPE VARCHAR(255);
    ALTER TABLE rfq_detail ALTER COLUMN technical_document_type TYPE VARCHAR(100);
    ALTER TABLE rfq_detail ALTER COLUMN technical_document_forg TYPE VARCHAR(255);
    ALTER TABLE rfq_detail ALTER COLUMN technical_document_comp TYPE VARCHAR(255);
    ALTER TABLE rfq_detail ALTER COLUMN technical_document_mach TYPE VARCHAR(255);
    ALTER TABLE rfq_detail ALTER COLUMN technical_document_asse TYPE VARCHAR(255);
    ALTER TABLE rfq_detail ALTER COLUMN technical_document_doc TYPE VARCHAR(255);
    
    -- Pastikan enum type ada
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfq_detail_product_type_enum') THEN
        CREATE TYPE rfq_detail_product_type_enum AS ENUM ('NEW', 'SIMILAR');
    END IF;
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Notice: Some table alterations might have been skipped or already applied.';
END $$;

-- 2. Update Fungsi
CREATE OR REPLACE FUNCTION public.sp_rfq_crud(
    p_action character varying,
    p_rfq_id bigint,
    p_created_by character varying,
    p_product_id bigint,
    p_product_type character varying,
    p_customer character varying,
    p_part_name character varying,
    p_part_no character varying,
    p_model character varying,
    p_volume_month integer,
    p_material character varying,
    p_product_weight numeric,
    p_delivery_condition character varying,
    p_remark_forg text,
    p_remark_comp text,
    p_remark_mach text,
    p_remark_asse text,
    p_remark_doc text,
    p_tech_forg character varying,
    p_tech_comp character varying,
    p_tech_mach character varying,
    p_tech_asse character varying,
    p_tech_doc character varying,
    p_tech_name character varying,
    p_tech_type character varying,
    p_tech_size integer,
    p_pfs_type character varying DEFAULT 'FG')
RETURNS BIGINT
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
    v_rfq_id BIGINT;
    v_rfq_no VARCHAR(100); -- Diperlebar dari 50 ke 100
    v_pfs_type VARCHAR(20); -- Diperlebar
    v_sequence BIGINT;
BEGIN
    v_pfs_type := COALESCE(UPPER(TRIM(p_pfs_type)), 'FG');
    
    IF v_pfs_type NOT IN ('FG', 'TLS', 'JCK') THEN
        v_pfs_type := 'FG';
    END IF;
    
    IF p_action = 'CREATE' THEN
        IF p_rfq_id IS NULL THEN
            SELECT COALESCE(MAX(NULLIF(split_part(rfq_no, '-', 2), '')::BIGINT), 0) + 1
            INTO v_sequence
            FROM rfq
            WHERE rfq_no LIKE 'RFQ-%';
            
            v_rfq_no := 'RFQ-' || (CASE WHEN v_sequence < 1000 THEN LPAD(v_sequence::text, 3, '0') ELSE v_sequence::text END) || '-' || v_pfs_type;
            
            INSERT INTO rfq (rfq_no, pfs_type, created_by, status, statusactivity, title)
            VALUES (v_rfq_no, v_pfs_type, p_created_by, 'draft', '0', '')
            RETURNING id INTO v_rfq_id;
        ELSE
            v_rfq_id := p_rfq_id;
        END IF;

        INSERT INTO rfq_detail (
            rfq_id, product_type, customer, part_name, part_no, model, volume_month, 
            material, product_weight, delivery_condition, t_d_remark_forg, t_d_remark_comp, 
            t_d_remark_mach, t_d_remark_asse, t_d_remark_doc, technical_document_forg, 
            technical_document_comp, technical_document_mach, technical_document_asse, 
            technical_document_doc, technical_document_name, technical_document_type, 
            technical_document_size, created_at
        ) VALUES (
            v_rfq_id, p_product_type::rfq_detail_product_type_enum, p_customer, p_part_name, p_part_no, p_model, p_volume_month, 
            p_material, p_product_weight, p_delivery_condition, p_remark_forg, p_remark_comp, 
            p_remark_mach, p_remark_asse, p_remark_doc, p_tech_forg, 
            p_tech_comp, p_tech_mach, p_tech_asse, 
            p_tech_doc, p_tech_name, p_tech_type, p_tech_size, NOW()
        );

    ELSIF p_action = 'UPDATE' THEN
        UPDATE rfq_detail SET
            product_type = p_product_type::rfq_detail_product_type_enum, customer = p_customer, 
            part_name = p_part_name, part_no = p_part_no, model = p_model, 
            volume_month = p_volume_month, material = p_material, 
            product_weight = p_product_weight, delivery_condition = p_delivery_condition,
            t_d_remark_forg = p_remark_forg, t_d_remark_comp = p_remark_comp, 
            t_d_remark_mach = p_remark_mach, t_d_remark_asse = p_remark_asse, 
            t_d_remark_doc = p_remark_doc, technical_document_forg = p_tech_forg, 
            technical_document_comp = p_tech_comp, technical_document_mach = p_tech_mach, 
            technical_document_asse = p_tech_asse, technical_document_doc = p_tech_doc,
            technical_document_name = p_tech_name, technical_document_type = p_tech_type, 
            technical_document_size = p_tech_size
        WHERE id = p_product_id;
        v_rfq_id := p_rfq_id;

    ELSIF p_action = 'DELETE' THEN
        DELETE FROM rfq_detail WHERE id = p_product_id;
        v_rfq_id := p_rfq_id;
    END IF;

    RETURN v_rfq_id;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error executing RFQ CRUD: %', SQLERRM;
END;
$BODY$;
