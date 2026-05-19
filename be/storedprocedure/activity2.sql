-- PROCEDURE: public.sp_mainactivity(character varying, bigint, character varying, character varying, character varying, character varying, character varying, text)

-- DROP PROCEDURE IF EXISTS public.sp_mainactivity(character varying, bigint, character varying, character varying, character varying, character varying, character varying, text);

CREATE OR REPLACE PROCEDURE public.sp_mainactivity(
	IN p_mode character varying,
	IN p_id bigint,
	IN p_rfq_no character varying,
	IN p_title character varying,
	IN p_created_by character varying,
	IN p_status character varying,
	IN p_statusactivity character varying,
	IN p_remarks text)
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
    v_sql TEXT := '';
    v_activity_name VARCHAR(100);
BEGIN
    -- Amankan NULL (PostgreSQL menggunakan coalesce)
    p_rfq_no := COALESCE(p_rfq_no, '');
    p_title := COALESCE(p_title, '');
    p_created_by := COALESCE(p_created_by, '');
    p_status := COALESCE(p_status, '');
    p_statusactivity := COALESCE(p_statusactivity, '');
    p_remarks := COALESCE(p_remarks, '');

    IF p_mode = 'SELECT' THEN
        v_sql := 'SELECT r.id, r.rfq_no, r.title, r.created_by, r.status, r.statusactivity, a.descr AS activity_desc, r.created_at ' ||
                 'FROM rfq r LEFT JOIN rfq_activity a ON r.statusactivity = a.code_act WHERE 1=1';
        
        IF p_id IS NOT NULL THEN
            v_sql := v_sql || ' AND r.id = ' || p_id;
        END IF;

        IF p_rfq_no <> '' THEN
            v_sql := v_sql || ' AND r.rfq_no = ' || quote_literal(p_rfq_no);
        END IF;

    ELSIF p_mode = 'INSERT' THEN
        v_sql := 'INSERT INTO rfq(rfq_no, title, created_by, status, statusactivity, created_at) VALUES(' ||
                 quote_literal(p_rfq_no) || ',' || quote_literal(p_title) || ',' || quote_literal(p_created_by) || ',' || 
                 quote_literal(p_status) || ',' || quote_literal(p_statusactivity) || ', NOW())';

    ELSIF p_mode = 'UPDATE' THEN
        v_sql := 'UPDATE rfq SET title = ' || quote_literal(p_title) || 
                 ', status = ' || quote_literal(p_status) || 
                 ', statusactivity = ' || quote_literal(p_statusactivity) || 
                 ' WHERE id = ' || p_id;

    ELSIF p_mode = 'DELETE' THEN
        v_sql := 'DELETE FROM rfq WHERE id = ' || p_id;

    ELSIF p_mode = 'MOVE_ACTIVITY' THEN
        -- Ambil nama activity
        SELECT descr INTO v_activity_name FROM rfq_activity WHERE code_act = p_statusactivity;

        -- Update RFQ
        UPDATE rfq SET statusactivity = p_statusactivity WHERE id = p_id;
        
        -- Insert Log
        INSERT INTO rfq_activity_log(rfq_id, activity_code, activity_name, remarks, created_by)
        VALUES (p_id, p_statusactivity, v_activity_name, p_remarks, p_created_by);
        
        v_sql := '-- MOVE_ACTIVITY EXECUTED MANUALLY IN PLPGSQL --';

    ELSIF p_mode = 'GET_TIMELINE' THEN
        v_sql := 'SELECT activity_name, remarks, created_by, created_at FROM rfq_activity_log WHERE rfq_id = ' || 
                 p_id || ' ORDER BY created_at ASC';
    END IF;

    -- PRINT & EXECUTE
    IF v_sql <> '' THEN
        RAISE NOTICE 'DebugQuery: %', v_sql;
        IF p_mode <> 'MOVE_ACTIVITY' THEN
            EXECUTE v_sql;
        END IF;
    END IF;
END;
$BODY$;
ALTER PROCEDURE public.sp_mainactivity(character varying, bigint, character varying, character varying, character varying, character varying, character varying, text)
    OWNER TO postgres;

