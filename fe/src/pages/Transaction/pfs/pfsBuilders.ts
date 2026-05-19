import type {
  OverviewProductInfo,
  JackRawMaterialRow,
  JackProcessStandardRow,
  JackComponentPurchaseRow,
  JackAssemblingRow,
  JackPackingDeliveryRow,
  JackDiesJigRow,
  JackDevelopmentCostRow,
  ToolsetTechSpecRow,
  ToolsetProcessEquipmentRow,
  ToolsetSubcontRow,
  ToolsetAssyRow,
  ToolsetToolingRow,
  ToolsetPackagingRow,
  ToolsetSummaryForm,
} from './pfsTypes';
import { parseNumberOrNull, toInputValue, parseDate } from './pfsParsers';

export const buildTemplateJackPayload = (params: {
  newProduct: OverviewProductInfo;
  similarProduct: OverviewProductInfo;
  overview: any;
  technicalSpec: any;
  processPlan: any[];
  rawMaterialRows: JackRawMaterialRow[];
  componentPurchaseRows: JackComponentPurchaseRow[];
  processStandardRows: JackProcessStandardRow[];
  assemblingRows: JackAssemblingRow[];
  packingDeliveryRows: JackPackingDeliveryRow[];
  diesJigRows: JackDiesJigRow[];
  developmentCostRows: JackDevelopmentCostRow[];
  processEquipment: any[];
  investments: any[];
  investmentSummary: any;
  timeline: any[];
  jackRawMaterialTotal: number;
}) => {
  const {
    processPlan,
    rawMaterialRows,
    componentPurchaseRows,
    processStandardRows,
    assemblingRows,
    packingDeliveryRows,
    diesJigRows,
    developmentCostRows,
    timeline,
  } = params;

  return {
    raw_material: rawMaterialRows.map((row, idx) => ({
      row_no: idx + 1,
      part_name: String(row.part_name || '').trim() || null,
      material: String(row.material || '').trim() || null,
      size_t_mm: parseNumberOrNull(toInputValue(row.size_t_mm)),
      size_l_mm: parseNumberOrNull(toInputValue(row.size_l_mm)),
      size_w_mm: parseNumberOrNull(toInputValue(row.size_w_mm)),
      qty_unit: parseNumberOrNull(toInputValue(row.qty_unit)),
      qty_pcs: parseNumberOrNull(toInputValue(row.qty_pcs)),
      weight_unit_kg: parseNumberOrNull(toInputValue(row.weight_unit_kg)),
      remarks: String(row.remarks || '').trim() || null,
      total_wt_unit_kg: params.jackRawMaterialTotal,
    })),
    process_standard: processStandardRows.map((row, idx) => ({
      row_no: idx + 1,
      process_name: String(row.process_name || '').trim() || null,
      line_name: String(row.line_name || '').trim() || null,
      manpower: parseNumberOrNull(toInputValue(row.manpower)),
      cycle_time_sec: parseNumberOrNull(toInputValue(row.cycle_time_sec)),
    })),
    dies_jig: (diesJigRows.length > 0
      ? diesJigRows
      : processPlan
        .filter((row) => String(row.item_type || '').trim().toLowerCase() === 'die')
        .map((row) => ({
          part_name: String(row.mat_grade || '').trim(),
          value_a: toInputValue(row.dia),
          stroke_b: '',
          consumable: '',
          value_c: '',
          stroke_d: '',
          formula_type: 'formula_a',
          cost_per_pcs: '',
        }))).map((row, idx) => ({
          row_no: idx + 1,
          part_name: String(row.part_name || '').trim() || null,
          value_a: parseNumberOrNull(toInputValue(row.value_a)),
          stroke_b: parseNumberOrNull(toInputValue(row.stroke_b)),
          consumable: String(row.consumable || '').trim() || null,
          value_c: parseNumberOrNull(toInputValue(row.value_c)),
          stroke_d: parseNumberOrNull(toInputValue(row.stroke_d)),
          formula_type: String(row.formula_type || '').trim() || null,
          cost_per_pcs: parseNumberOrNull(toInputValue(row.cost_per_pcs)),
        })),
    component_purchase: componentPurchaseRows.map((row, idx) => ({
      row_no: idx + 1,
      part_name: String(row.part_name || '').trim() || null,
      material: String(row.material || '').trim() || null,
      qty_unit: parseNumberOrNull(toInputValue(row.qty_unit)),
      part_no_mtm: String(row.part_no_mtm || '').trim() || null,
      part_no_supplier: String(row.part_no_supplier || '').trim() || null,
      price_idr: parseNumberOrNull(toInputValue(row.price_idr)),
    })),
    assembling: assemblingRows.map((row, idx) => ({
      row_no: idx + 1,
      process_name: String(row.process_name || '').trim() || null,
      line_name: String(row.line_name || '').trim() || null,
      manpower: parseNumberOrNull(toInputValue(row.manpower)),
      cycle_time_sec: parseNumberOrNull(toInputValue(row.cycle_time_sec)),
      rate: parseNumberOrNull(toInputValue(row.rate)),
      cost_idr: parseNumberOrNull(toInputValue(row.cost_idr)),
    })),
    packing_delivery: packingDeliveryRows.map((row, idx) => ({
      row_no: idx + 1,
      item_name: String(row.item_name || '').trim() || null,
      price_idr: parseNumberOrNull(toInputValue(row.price)),
      qty_per_box: parseNumberOrNull(toInputValue(row.qty_box)),
      cost_per_pcs_idr: parseNumberOrNull(toInputValue(row.cost_pcs)),
    })),
    development_cost: developmentCostRows.map((row, idx) => ({
      row_no: idx + 1,
      cost_name: String(row.cost_name || '').trim() || null,
      amount_idr: parseNumberOrNull(toInputValue(row.amount_idr)),
      note: String(row.note || '').trim() || null,
    })),
    timeframe: timeline.map((row, idx) => ({
      row_no: idx + 1,
      main_activity: String(row.activity_name || '').trim() || null,
      pic_userid: String(row.created_by || '').trim() || null,
      due_text: null,
      start_month_no: null,
      end_month_no: null,
      remark: String(row.remarks || '').trim() || null,
    })),
    result: { final_result: null, note_text: null },
  };
};

export const buildTemplateToolsetPayload = (params: {
  newProduct: OverviewProductInfo;
  similarProduct: OverviewProductInfo;
  overview: any;
  toolsetTechSpecRows: ToolsetTechSpecRow[];
  toolsetProcessEquipmentRows: ToolsetProcessEquipmentRow[];
  toolsetSubcontRows: ToolsetSubcontRow[];
  toolsetAssyRows: ToolsetAssyRow[];
  toolsetToolingRows: ToolsetToolingRow[];
  toolsetPackagingRows: ToolsetPackagingRow[];
  toolsetPurchaseEquipmentPlanRows: any[];
  toolsetSummary: ToolsetSummaryForm;
}) => {
  const {
    toolsetTechSpecRows,
    toolsetProcessEquipmentRows,
    toolsetSubcontRows,
    toolsetAssyRows,
    toolsetToolingRows,
    toolsetPackagingRows,
    toolsetPurchaseEquipmentPlanRows,
    toolsetSummary,
  } = params;

  return {
    tech_spec: toolsetTechSpecRows.map((row, idx) => ({
      row_no: idx + 1,
      part_no: String(row.part_no || '').trim() || null,
      component_name: String(row.component_name || '').trim() || null,
      qty: parseNumberOrNull(String(row.qty || '')),
      part_no_mtm: String(row.part_no_mtm || '').trim() || null,
      part_no_supplier: String(row.part_no_supplier || '').trim() || null,
      actual_cost_idr: parseNumberOrNull(String(row.actual_cost_idr || '')),
      remark: String(row.remark || '').trim() || null,
    })),
    tech_spec_detail: toolsetTechSpecRows.flatMap((row, idx) => {
      if (!row.detail) return [];
      return {
        tech_spec_row_no: idx + 1,
        row_no: idx + 1,
        material: String(row.detail.material || '').trim() || null,
        diameter_mm: parseNumberOrNull(String(row.detail.diameter_mm || '')),
        length_mm: parseNumberOrNull(String(row.detail.length_mm || '')),
        mass_kg: parseNumberOrNull(String(row.detail.mass_kg || '')),
        material_cost_country_1: String(row.detail.material_cost_country_1 || '').trim() || null,
        material_cost_rp_kg_1: parseNumberOrNull(String(row.detail.material_cost_rp_kg_1 || '')),
        material_cost_country_2: String(row.detail.material_cost_country_2 || '').trim() || null,
        material_cost_rp_kg_2: parseNumberOrNull(String(row.detail.material_cost_rp_kg_2 || '')),
        cost_finish_country_1: String(row.detail.cost_finish_country_1 || '').trim() || null,
        cost_finish_rp_kg_1: parseNumberOrNull(String(row.detail.cost_finish_rp_kg_1 || '')),
        cost_finish_country_2: String(row.detail.cost_finish_country_2 || '').trim() || null,
        cost_finish_rp_kg_2: parseNumberOrNull(String(row.detail.cost_finish_rp_kg_2 || '')),
        mass_product_gr: parseNumberOrNull(String(row.detail.mass_product_gr || '')),
      };
    }),
    process_equipment: toolsetProcessEquipmentRows.map((row, idx) => ({
      row_no: idx + 1,
      process_name: String(row.process_name || '').trim() || null,
      cycle_time_sec: parseNumberOrNull(String(row.cycle_time_sec || '')),
      machine_existing: String(row.machine_existing || '').trim() || null,
      machine_new: String(row.machine_new || '').trim() || null,
      remark: String(row.remark || '').trim() || null,
    })),
    equipment_out_house: toolsetSubcontRows.map((row, idx) => ({
      row_no: idx + 1,
      process_name: String(row.process_name || '').trim() || null,
      cost_idr: parseNumberOrNull(String(row.cost_idr || '')),
      cycle_time_sec: parseNumberOrNull(String(row.cycle_time_sec || '')),
      machine_existing: String(row.machine_existing || '').trim() || null,
      machine_new: String(row.machine_new || '').trim() || null,
      remark: String(row.remark || '').trim() || null,
    })),
    assy_toolset: toolsetAssyRows.map((row, idx) => ({
      row_no: idx + 1,
      process_name: String(row.process_name || '').trim() || null,
      cycle_time_sec: parseNumberOrNull(String(row.cycle_time_sec || '')),
      machine_existing: String(row.machine_existing || '').trim() || null,
      machine_new: String(row.machine_new || '').trim() || null,
      remark: String(row.remark || '').trim() || null,
    })),
    tooling_breakdown: toolsetToolingRows.map((row, idx) => ({
      row_no: idx + 1,
      tooling_category: String(row.tooling_category || '').trim() || null,
      cost_idr: parseNumberOrNull(String(row.cost_idr || '')),
      opm_total_dep: parseNumberOrNull(String(row.opm_total_dep || '')),
      remark: String(row.remark || '').trim() || null,
    })),
    packaging: toolsetPackagingRows.map((row, idx) => ({
      row_no: idx + 1,
      item_name: String(row.item_name || '').trim() || null,
      price_idr: parseNumberOrNull(String(row.price_idr || '')),
      qty_per_box: parseNumberOrNull(String(row.qty_per_box || '')),
      cost_per_box_idr: parseNumberOrNull(String(row.cost_per_box_idr || '')),
      remark: String(row.remark || '').trim() || null,
    })),
    purchase_equipment_plan: toolsetPurchaseEquipmentPlanRows.map((row) => ({
      item_type: String(row.item_type || '').trim() || null,
      specification: String(row.specification || '').trim() || null,
      dia: parseNumberOrNull(String(row.dia || '')),
      target_date: parseDate(String(row.target_date || '')),
      remark: String(row.remark || '').trim() || null,
    })),
    summary: {
      total_tooling_cost: parseNumberOrNull(String(toolsetSummary.total_tooling_cost || '')),
      total_packaging_cost: parseNumberOrNull(String(toolsetSummary.total_packaging_cost || '')),
      total_equipment_investment: parseNumberOrNull(String(toolsetSummary.total_equipment_investment || '')),
      grand_total: parseNumberOrNull(String(toolsetSummary.grand_total || '')),
    },
  };
};
