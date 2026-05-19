// Factories for empty rows and default objects
export const emptyOverviewProductInfo = (): { customer: string; partNo: string; product: string; qtyMonth: string; line: string } => ({
  customer: '',
  partNo: '',
  product: '',
  qtyMonth: '',
  line: '',
});

export const emptyJackComponentPurchaseRow = () => ({
  part_name: '',
  material: '',
  qty_unit: '',
  part_no_mtm: '',
  part_no_supplier: '',
  price_idr: '',
});

export const emptyJackProcessStandardRow = () => ({
  process_name: '',
  line_name: '',
  manpower: '',
  cycle_time_sec: '',
});

export const emptyJackAssemblingRow = () => ({
  process_name: '',
  line_name: '',
  manpower: '',
  cycle_time_sec: '',
  rate: '',
  cost_idr: '',
});

export const emptyJackPackingDeliveryRow = () => ({
  item_name: '',
  price: '',
  qty_box: '',
  cost_pcs: '',
});

export const emptyJackRawMaterialRow = () => ({
  part_name: '',
  material: '',
  size_t_mm: '',
  size_l_mm: '',
  size_w_mm: '',
  qty_unit: '',
  qty_pcs: '',
  weight_unit_kg: '',
  remarks: '',
});

export const emptyJackDiesJigRow = () => ({
  part_name: '',
  value_a: '',
  stroke_b: '',
  consumable: '',
  value_c: '',
  stroke_d: '',
  formula_type: 'formula_a',
  cost_per_pcs: '',
});

export const emptyJackDevelopmentCostRow = () => ({
  cost_name: '',
  amount_idr: '',
  note: '',
});

export const emptyToolsetSubcontRow = () => ({
  process_name: '',
  cost_idr: '',
  cycle_time_sec: '',
  machine_existing: '',
  machine_new: '',
  remark: '',
});

export const emptyToolsetAssyRow = () => ({
  process_name: '',
  cycle_time_sec: '',
  machine_existing: '',
  machine_new: '',
  remark: '',
});

export const emptyToolsetTechSpecRow = () => ({
  part_no: '',
  component_name: '',
  qty: '',
  part_no_mtm: '',
  part_no_supplier: '',
  actual_cost_idr: '',
  remark: '',
  isDetailOpen: false,
});

export const emptyToolsetTechSpecDetailRow = () => ({
  material: '',
  diameter_mm: '',
  length_mm: '',
  mass_kg: '',
  material_cost_country_1: '',
  material_cost_rp_kg_1: '',
  material_cost_country_2: '',
  material_cost_rp_kg_2: '',
  cost_finish_country_1: '',
  cost_finish_rp_kg_1: '',
  cost_finish_country_2: '',
  cost_finish_rp_kg_2: '',
  mass_product_gr: '',
});

export const emptyToolsetProcessEquipmentRow = () => ({
  process_name: '',
  cycle_time_sec: '',
  machine_existing: '',
  machine_new: '',
  remark: '',
});

export const emptyToolsetToolingRow = () => ({
  tooling_category: '',
  cost_idr: '',
  opm_total_dep: '',
  remark: '',
});

export const emptyToolsetPackagingRow = () => ({
  item_name: '',
  price_idr: '',
  qty_per_box: '',
  cost_per_box_idr: '',
  remark: '',
});

export const emptyToolsetSummaryForm = () => ({
  total_tooling_cost: '',
  total_packaging_cost: '',
  total_equipment_investment: '',
  grand_total: '',
});
