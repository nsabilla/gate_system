-- PROCEDURE: public.sp_dashboard_main_activity(bigint)

-- DROP PROCEDURE IF EXISTS public.sp_dashboard_main_activity(bigint);

CREATE OR REPLACE PROCEDURE public.sp_dashboard_main_activity(
	IN p_rfq_id bigint)
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
    v_sql TEXT := '';
    v_start DATE;
    v_i INT := 0;
    v_month_label VARCHAR(10);
    v_month_num INT;
    v_year_num INT;
    v_target_date_val DATE;
BEGIN
    -- Start 1 bulan sebelum sekarang
    v_start := CURRENT_DATE - INTERVAL '1 month';

    v_sql := 'SELECT a.code_act, a.descr AS activity_name, ' ||
             'p.pic_userid AS pic, to_char(p.target_date, ''DD-Mon'') AS target_dd, ' ||
             'p.start_date, p.end_date, p.remarks, ';

    -- LOOP 12 BULAN
    WHILE v_i < 12 LOOP
        v_target_date_val := v_start + (v_i || ' month')::INTERVAL;
        v_month_num := EXTRACT(MONTH FROM v_target_date_val);
        v_year_num := EXTRACT(YEAR FROM v_target_date_val);
        v_month_label := to_char(v_target_date_val, 'Mon');

        v_sql := v_sql || 
                 'CASE WHEN (p.start_date IS NOT NULL AND p.end_date IS NOT NULL AND ' ||
                 'to_char(p.start_date, ''YYYYMM'') <= ''' || v_year_num || lpad(v_month_num::text, 2, '0') || 
                 ''' AND to_char(p.end_date, ''YYYYMM'') >= ''' || v_year_num || lpad(v_month_num::text, 2, '0') || 
                 ''') THEN ''✔'' ELSE '''' END AS "' || v_month_label || '", ';

        v_i := v_i + 1;
    END LOOP;

    -- Hapus koma terakhir
    v_sql := rtrim(v_sql, ', ');

    v_sql := v_sql || 
             ' FROM rfq_activity a ' ||
             'LEFT JOIN rfq_activity_plan p ' ||
             'ON a.code_act = p.activity_code ' ||
             'AND p.rfq_id = ' || p_rfq_id || ' ' ||
             'ORDER BY a.code_act::INTEGER';

    -- DEBUG / PRINT @sql
    RAISE NOTICE 'DebugQuery: %', v_sql;

    -- EXECUTE
    EXECUTE v_sql;
END;
$BODY$;
ALTER PROCEDURE public.sp_dashboard_main_activity(bigint)
    OWNER TO postgres;

