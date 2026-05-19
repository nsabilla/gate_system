-- Feasibility Summary Report for PostgreSQL
-- This query provides a high-level overview of RFQs and their feasibility status across different PFS types.

SELECT 
    r.rfq_no AS "RFQ Number",
    CASE 
        WHEN r.pfs_type = 'FG' THEN 'Forging'
        WHEN r.pfs_type = 'TLS' THEN 'Toolset'
        WHEN r.pfs_type = 'JCK' THEN 'Jack'
        ELSE COALESCE(r.pfs_type, 'N/A')
    END AS "Type",
    r.status AS "Status",
    COALESCE(f.customer, d.customer) AS "Customer",
    COALESCE(f.part_name, d.part_name) AS "Part Name",
    f.project AS "Project",
    
    -- Financials from Feasibility Record
    f.qty_month AS "Monthly Qty",
    f.revenue_y AS "Annual Revenue",
    f.masspro AS "Masspro Date",
    
    -- New Detailed Financial Fields
    f.specification AS "Specification",
    f.source AS "Source",
    f.basic_price AS "Basic Price",
    f.import_duty AS "Import Duty",
    f.inclaring AS "Inclaring",
    f.inventory AS "Inventory",
    f.cost_of_money AS "Cost of Money",
    f.material_price AS "Material Price",
    f.product_weight AS "Product Weight",
    f.matl_weight AS "Mat'l Weight",
    f.rejection AS "Rejection",
    f.material_cost AS "Material Cost",
    f.scrap_cost AS "Scrap Cost",
    
    -- Investment Summaries
    COALESCE(inv.grand_total, ts.grand_total) AS "Grand Total Investment",
    
    -- Completion Progress (Checks if data exists in various PFS tables)
    CASE WHEN f.rfq_id IS NOT NULL THEN 'Ready' ELSE 'Pending' END AS "Feasibility Data",
    CASE 
        WHEN r.pfs_type = 'FG' THEN 
            CASE WHEN EXISTS (SELECT 1 FROM pfs_inv_sum ps WHERE ps.rfq_id = r.id) THEN 'Complete' ELSE 'Incomplete' END
        WHEN r.pfs_type = 'TLS' THEN 
            CASE WHEN EXISTS (SELECT 1 FROM pfs_toolset_summary pts WHERE pts.rfq_id = r.id) THEN 'Complete' ELSE 'Incomplete' END
        ELSE 'N/A'
    END AS "PFS Progress",
    
    TO_CHAR(r.created_at, 'DD-MM-YYYY HH24:MI') AS "Created At"
FROM 
    rfq r
LEFT JOIN 
    rfq_feasibility f ON r.id = f.rfq_id
LEFT JOIN 
    (SELECT rfq_id, MAX(part_name) as part_name, MAX(customer) as customer FROM rfq_detail GROUP BY rfq_id) d ON r.id = d.rfq_id
LEFT JOIN 
    pfs_inv_sum inv ON r.id = inv.rfq_id
LEFT JOIN 
    pfs_toolset_summary ts ON r.id = ts.rfq_id
ORDER BY 
    r.created_at DESC;
