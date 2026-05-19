import api from './axios';

export type StandardCostMasterRow = {
  id: number;
  cost_center: string;
  wc: string;
  labor: number;
  mdepr: number;
  fd: number;
  fi: number;
  vd: number;
  vi: number;
  valid_from?: string;
  valid_to?: string;
  is_active: number | boolean;
};

export type StandardCostPayload = {
  cost_center: string;
  wc: string;
  labor: number;
  mdepr: number;
  fd: number;
  fi: number;
  vd: number;
  vi: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
};

/* removed redeclared getStandardCostMaster */

export const createStandardCostMaster = async (payload: StandardCostPayload) => {
  const { data } = await api.post('/standard-cost/master', payload);
  return data;
};

export const updateStandardCostMaster = async (id: number, payload: StandardCostPayload) => {
  const { data } = await api.put(`/standard-cost/master/${id}`, payload);
  return data;
};

export const deleteStandardCostMaster = async (id: number) => {
  const { data } = await api.delete(`/standard-cost/master/${id}`);
  return data;
};

export type StandardCostOverview = {
  company_name: string;
  part_number: string;
  part_name: string;
  customer: string;
  rejection_rate: string;
  similar_product: string;
};

export type StandardCostRateDetik = {
  mdepr: string;
  labor: string;
  fohfd: string;
  fohfi: string;
  fohvd: string;
  fohvi: string;
  total_rate: string;
}

export type StandardCostRatePCS = {
  mdepr: string;
  labor: string;
  fohfd: string;
  fohfi: string;
  fohvd: string;
  fohvi: string;
  total_cost: string;
}

export type StandardCostProcessingRow = {
  row_no: number;
  wc: string;
  ops_no: string;
  part_number: string;
  start_factor: string;
  percent_ng: string;
  processing: string;
  product: string;
  qty_per_parent: string;
  qty_req_bj_1_fg: string;
  cycle_time: string;
  standard_cost_master_id?: number | null;
  labor?: string;
  mdepr?: string;
  fd?: string;
  fi?: string;
  vd?: string;
  vi?: string;
  rate_detik?: StandardCostRateDetik;
  rate_pcs?: StandardCostRatePCS;
};

export type StandardCostMaterialRow = {
  row_no: number;
  raw_material: string;
  top_value: string;
  material_code: string;
  product: string;
  process: string;
  qty_per_parent: string;
  uom: string;
  qty_req_by_parent: string;
  qty_req_bj_1_fg: string;
  top_imp_loc: string;
  import_flag: string;
  currency: string;
  exchange_rate: string;
  rp_uom_material: string;
  cost_pcs_fg: string;
};

export type StandardCostMaterialSummary = {
  total_row_material: string;
  presentase_terhadap_sale: string;
};

export type StandardCostDirectRow = {
  row_no: number;
  direct_cost_name: string;
  kode_ce: string;
  used_in_process_wc: string;
  qty_req_bj_1_fg: string;
  value_amount: string;
  qty_per_month: string;
  lifetime_month: string;
  lifetime: string;
  cost_pcs_fg: string;
};

export type StandardCostDirectSummary = {
  total_direct_cost_to_product: string;
  presentase_terhadap_sale: string;
  summary_title: string;
  total_cost_per_product: string;
  sales: string;
  unit_contribution_margin: string;
  unit_contribution_margin_pct: string;
  gross_profit: string;
  gross_profit_pct: string;
  remark: string;
};

export type StandardCostTotalProcessing = {
  mdepr: string;
  labor: string;
  fohfd: string;
  fohfi: string;
  fohvd: string;
  fohvi: string;
  total_cost: string;
};

export type StandardCostPercentageSale = {
  mdepr: string;
  labor: string;
  fohfd: string;
  fohfi: string;
  fohvd: string;
  fohvi: string;
  total_cost: string;
};

export type StandardCostSignatureCell = {
  label: string;
  name: string;
  badge: string;
};

export type StandardCostDocument = {
  report_code?: string;
  report_notes?: string[];
  signature_cells?: StandardCostSignatureCell[];
  overview: StandardCostOverview;
  processing_rows: StandardCostProcessingRow[];
  material_rows: StandardCostMaterialRow[];
  material_summary: StandardCostMaterialSummary;
  direct_rows: StandardCostDirectRow[];
  direct_summary: StandardCostDirectSummary;
  total_processing: StandardCostTotalProcessing;
  percentage_sale: StandardCostPercentageSale;
};

export type StandardCostAttachment = {
  id: number;
  rfq_id: number;
  pfs_type: string;
  file_name: string;
  file_path: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
};

export const getStandardCostMaster = async (params?: { costCenter?: string; wc?: string; currentValid?: boolean }): Promise<StandardCostMasterRow[]> => {
  const qp: Record<string, string> = {};
  if (params?.costCenter) qp.cost_center = params.costCenter;
  if (params?.wc) qp.wc = params.wc;
  if (params?.currentValid) qp.current_valid = '1';

  const res = await api.get('/standard-cost/master', {
    withCredentials: true,
    params: qp,
  });

  return (res.data?.data || []) as StandardCostMasterRow[];
};

export const getStandardCostDocument = async (rfqId: number, pfsType: 'forging' | 'jack' | 'toolset'): Promise<StandardCostDocument> => {
  const res = await api.get(`/rfqs/${rfqId}/standard-cost`, {
    withCredentials: true,
    params: { type: pfsType },
  });
  return (res.data?.data || {
    report_notes: [],
    signature_cells: [],
    overview: {},
    processing_rows: [],
    material_rows: [],
    material_summary: {},
    direct_rows: [],
    direct_summary: {},
  }) as StandardCostDocument;
};

export const upsertStandardCostDocument = async (
  rfqId: number,
  pfsType: 'forging' | 'jack' | 'toolset',
  payload: StandardCostDocument
) => {
  return api.put(`/rfqs/${rfqId}/standard-cost`, payload, {
    withCredentials: true,
    params: { type: pfsType },
  });
};

export const getStandardCostInvestmentAttachments = async (
  rfqId: number,
  pfsType: 'forging' | 'jack' | 'toolset'
): Promise<StandardCostAttachment[]> => {
  const res = await api.get(`/rfqs/${rfqId}/standard-cost/investment-attachments`, {
    withCredentials: true,
    params: { type: pfsType },
  });
  return (res.data?.data || []) as StandardCostAttachment[];
};

export const uploadStandardCostInvestmentAttachment = async (
  rfqId: number,
  pfsType: 'forging' | 'jack' | 'toolset',
  file: File
) => {
  const form = new FormData();
  form.append('file', file);

  return api.post(`/rfqs/${rfqId}/standard-cost/investment-attachments`, form, {
    withCredentials: true,
    params: { type: pfsType },
  });
};
