CREATE OR REPLACE PROCEDURE public.sp_rfq_activity_plan(
	IN p_mode character varying,
	IN p_plan_id bigint,
	IN p_rfq_id bigint,
	IN p_activity_code character varying,
	IN p_user character varying,
	IN p_target_date character varying,
	IN p_start_date character varying,
	IN p_end_date character varying,
	IN p_remarks text)
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
    v_target_date DATE;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    v_target_date := NULLIF(p_target_date, '')::DATE;
    v_start_date := NULLIF(p_start_date, '')::DATE;
    v_end_date := NULLIF(p_end_date, '')::DATE;

    IF p_mode = 'UPDATE' AND p_plan_id IS NOT NULL THEN
        UPDATE rfq_activity_plan SET
            remarks = p_remarks,
            target_date = v_target_date,
            start_date = v_start_date,
            end_date = v_end_date,
            updated_at = NOW(),
            updateby = p_user
        WHERE id = p_plan_id;
    ELSE
        -- Default to UPSERT behavior by checking if exists for this RFQ + Activity
        IF EXISTS (SELECT 1 FROM rfq_activity_plan WHERE rfq_id = p_rfq_id AND activity_code = p_activity_code) THEN
            UPDATE rfq_activity_plan SET
                remarks = p_remarks,
                target_date = v_target_date,
                start_date = v_start_date,
                end_date = v_end_date,
                updated_at = NOW(),
                updateby = p_user
            WHERE rfq_id = p_rfq_id AND activity_code = p_activity_code;
        ELSE
            INSERT INTO rfq_activity_plan (
                rfq_id, activity_code, remarks, 
                target_date, start_date, end_date, 
                created_at, addby
            ) VALUES (
                p_rfq_id, p_activity_code, p_remarks,
                v_target_date, v_start_date, v_end_date,
                NOW(), p_user
            );
        END IF;
    END IF;
END;
$BODY$;
