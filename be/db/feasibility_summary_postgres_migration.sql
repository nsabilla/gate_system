-- PostgreSQL migration helper for feasibility summary data source
-- Safe to run multiple times.

ALTER TABLE public.rfq
    ADD COLUMN IF NOT EXISTS pfs_type VARCHAR(10) DEFAULT 'FG';

ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS specification TEXT;
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS source VARCHAR(255);
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS basic_price NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS import_duty NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS inclaring NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS inventory NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS cost_of_money NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS material_price NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS product_weight NUMERIC(15,4) DEFAULT 0;
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS matl_weight NUMERIC(15,4) DEFAULT 0;
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS rejection NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS material_cost NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.rfq_feasibility
    ADD COLUMN IF NOT EXISTS scrap_cost NUMERIC(15,2) DEFAULT 0;

ALTER TABLE public.pfs_ov
    ADD COLUMN IF NOT EXISTS rej_fg NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.pfs_ov
    ADD COLUMN IF NOT EXISTS rej_mc NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.pfs_ov
    ADD COLUMN IF NOT EXISTS eff_fg NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.pfs_ov
    ADD COLUMN IF NOT EXISTS eff_mc NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.pfs_ov
    ADD COLUMN IF NOT EXISTS line_fg VARCHAR(100);
ALTER TABLE public.pfs_ov
    ADD COLUMN IF NOT EXISTS target_price_fg NUMERIC(15,4) DEFAULT 0;
ALTER TABLE public.pfs_ov
    ADD COLUMN IF NOT EXISTS line_mc VARCHAR(100);
ALTER TABLE public.pfs_ov
    ADD COLUMN IF NOT EXISTS target_price_mc NUMERIC(15,4) DEFAULT 0;

ALTER TABLE public.pfs_ts
    ADD COLUMN IF NOT EXISTS prod_w NUMERIC(10,3) DEFAULT 0;
ALTER TABLE public.pfs_ts
    ADD COLUMN IF NOT EXISTS rm_w NUMERIC(10,3) DEFAULT 0;
ALTER TABLE public.pfs_ts
    ADD COLUMN IF NOT EXISTS mat_grade VARCHAR(255);
ALTER TABLE public.pfs_ts
    ADD COLUMN IF NOT EXISTS dia NUMERIC(10,3) DEFAULT 0;
ALTER TABLE public.pfs_ts
    ADD COLUMN IF NOT EXISTS length_mm NUMERIC(10,3) DEFAULT 0;
ALTER TABLE public.pfs_ts
    ADD COLUMN IF NOT EXISTS yield_pct NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.pfs_ts
    ADD COLUMN IF NOT EXISTS cut_qty INTEGER DEFAULT 0;
ALTER TABLE public.pfs_ts
    ADD COLUMN IF NOT EXISTS rm_plus_rem NUMERIC(10,3) DEFAULT 0;
ALTER TABLE public.pfs_ts
    ADD COLUMN IF NOT EXISTS remark TEXT;
