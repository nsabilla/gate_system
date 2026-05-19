-- PROCEDURE: public.sp_master_rfq_activity(character varying, bigint, character varying, character varying, character varying)

-- DROP PROCEDURE IF EXISTS public.sp_master_rfq_activity(character varying, bigint, character varying, character varying, character varying);

CREATE OR REPLACE PROCEDURE public.sp_master_rfq_activity(
	IN p_mode character varying,
	IN p_id bigint,
	IN p_code_act character varying,
	IN p_descr character varying,
	IN p_user character varying)
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
    v_sql TEXT := '';
BEGIN
    p_code_act := COALESCE(p_code_act, '');
    p_descr := COALESCE(p_descr, '');
    p_user := COALESCE(p_user, '');

    IF p_mode = 'SELECT' THEN
        v_sql := 'SELECT id, code_act, descr, addby, updateby, created_at, updated_at FROM rfq_activity WHERE 1=1';
        IF p_id IS NOT NULL THEN
            v_sql := v_sql || ' AND id = ' || p_id;
        END IF;

    ELSIF p_mode = 'INSERT' THEN
        v_sql := 'INSERT INTO rfq_activity(code_act, descr, addby, created_at) VALUES(' ||
                 quote_literal(p_code_act) || ',' || quote_literal(p_descr) || ',' || quote_literal(p_user) || ', NOW())';

    ELSIF p_mode = 'UPDATE' THEN
        v_sql := 'UPDATE rfq_activity SET code_act = ' || quote_literal(p_code_act) || 
                 ', descr = ' || quote_literal(p_descr) || 
                 ', updateby = ' || quote_literal(p_user) || 
                 ', updated_at = NOW() WHERE id = ' || p_id;

    ELSIF p_mode = 'DELETE' THEN
        v_sql := 'DELETE FROM rfq_activity WHERE id = ' || p_id;
    END IF;

    RAISE NOTICE 'DebugQuery: %', v_sql;
    IF v_sql <> '' THEN
        EXECUTE v_sql;
    END IF;
END;
$BODY$;
ALTER PROCEDURE public.sp_master_rfq_activity(character varying, bigint, character varying, character varying, character varying)
    OWNER TO postgres;

