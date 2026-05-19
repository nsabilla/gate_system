-- FUNCTION: public.sp_rfq_list(character varying, character varying, character varying, character varying)

-- DROP FUNCTION IF EXISTS public.sp_rfq_list(character varying, character varying, character varying, character varying);

CREATE OR REPLACE FUNCTION public.sp_rfq_list(
    IN p_user_id character varying,
    IN p_role character varying,
    IN p_status character varying,
    IN p_keyword character varying)
RETURNS TABLE (
    id bigint,
    rfq_no character varying,
    status character varying,
    created_by character varying,
    created_at timestamp without time zone,
    new_part_name text,
    similar_part_name text
)
LANGUAGE plpgsql
AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.rfq_no,
        r.status,
        r.created_by,
        r.created_at,
        MAX(CASE WHEN LOWER(TRIM(p.product_type)) = 'new' THEN p.part_name END) AS new_part_name,
        MAX(CASE WHEN LOWER(TRIM(p.product_type)) = 'similar' THEN p.part_name END) AS similar_part_name
    FROM rfq r
    LEFT JOIN rfq_detail p ON p.rfq_id = r.id
    WHERE
        (
            LOWER(TRIM(COALESCE(p_role, ''))) <> 'marketing'
            OR r.created_by = p_user_id
        )
        AND (
            NULLIF(TRIM(COALESCE(p_status, '')), '') IS NULL
            OR LOWER(TRIM(r.status)) = LOWER(TRIM(p_status))
        )
        AND (
            NULLIF(TRIM(COALESCE(p_keyword, '')), '') IS NULL
            OR r.rfq_no ILIKE '%' || p_keyword || '%'
            OR EXISTS (
                SELECT 1
                FROM rfq_detail px
                WHERE px.rfq_id = r.id
                  AND px.part_name ILIKE '%' || p_keyword || '%'
            )
        )
    GROUP BY
        r.id,
        r.rfq_no,
        r.status,
        r.created_by,
        r.created_at
    ORDER BY
        r.created_at DESC;
END;
$BODY$;

