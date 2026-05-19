export type RFQOption = {
  id: number;
  rfq_no: string;
  status: string;
  statusactivity: string;
  pfs_approver_username: string;
  pfs_approver_badge: string;
};

export type RFQDetailRow = Record<string, unknown>;

export type OverviewProductInfo = {
  customer: string;
  partNo: string;
  product: string;
  qtyMonth: string;
  line: string;
};

export type MainActivityRow = {
  statusactivity?: string;
  activity_desc?: string;
  created_by?: string;
};

export type TimelineItem = {
  activity_name?: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
};

export type ActivityOption = {
  code_act: string;
  descr: string;
};

export type JackComponentPurchaseRow = {
  part_name: string;
  material: string;
  qty_unit: string;
  part_no_mtm: string;
  part_no_supplier: string;
  price_idr: string;
};

export type JackProcessStandardRow = {
  process_name: string;
  line_name: string;
  manpower: string;
  cycle_time_sec: string;
};

export type JackAssemblingRow = {
  process_name: string;
  line_name: string;
  manpower: string;
  cycle_time_sec: string;
  rate: string;
  cost_idr: string;
};

export type JackPackingDeliveryRow = {
  item_name: string;
  price: string;
  qty_box: string;
  cost_pcs: string;
};

export type JackRawMaterialRow = {
  part_name: string;
  material: string;
  size_t_mm: string;
  size_l_mm: string;
  size_w_mm: string;
  qty_unit: string;
  qty_pcs: string;
  weight_unit_kg: string;
  remarks: string;
};

export type JackDiesJigRow = {
  part_name: string;
  value_a: string;
  stroke_b: string;
  consumable: string;
  value_c: string;
  stroke_d: string;
  formula_type: string;
  cost_per_pcs: string;
};

export type JackDevelopmentCostRow = {
  cost_name: string;
  amount_idr: string;
  note: string;
};

export type ToolsetSubcontRow = {
  process_name: string;
  cost_idr: string;
  cycle_time_sec: string;
  machine_existing: string;
  machine_new: string;
  remark: string;
};

export type ToolsetAssyRow = {
  process_name: string;
  cycle_time_sec: string;
  machine_existing: string;
  machine_new: string;
  remark: string;
};

export type ToolsetTechSpecDetailRow = {
  material: string;
  diameter_mm: string;
  length_mm: string;
  mass_kg: string;
  material_cost_country_1: string;
  material_cost_rp_kg_1: string;
  material_cost_country_2: string;
  material_cost_rp_kg_2: string;
  cost_finish_country_1: string;
  cost_finish_rp_kg_1: string;
  cost_finish_country_2: string;
  cost_finish_rp_kg_2: string;
  mass_product_gr: string;
};

export type ToolsetTechSpecRow = {
  part_no: string;
  component_name: string;
  qty: string;
  part_no_mtm: string;
  part_no_supplier: string;
  actual_cost_idr: string;
  remark: string;
  isDetailOpen?: boolean;
  detail?: ToolsetTechSpecDetailRow;
};

export type ToolsetProcessEquipmentRow = {
  process_name: string;
  cycle_time_sec: string;
  machine_existing: string;
  machine_new: string;
  remark: string;
};

export type ToolsetToolingRow = {
  tooling_category: string;
  cost_idr: string;
  opm_total_dep: string;
  remark: string;
};

export type ToolsetPackagingRow = {
  item_name: string;
  price_idr: string;
  qty_per_box: string;
  cost_per_box_idr: string;
  remark: string;
};

export type ToolsetSummaryForm = {
  total_tooling_cost: string;
  total_packaging_cost: string;
  total_equipment_investment: string;
  grand_total: string;
};

export type TabKey = 'overview' | 'estimation' | 'drawing' | 'timeframe';

export const TAB_LABELS: Record<TabKey, string> = {
  overview: 'Overview',
  estimation: 'Estimation Process Plan',
  drawing: 'Drawing',
  timeframe: 'Time Frame',
};
