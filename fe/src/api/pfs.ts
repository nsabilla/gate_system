import api from './axios';

export type PFSOverview = {
  rfq_id?: number;
  part_name?: string | null;
  rej_fg?: number | null;
  rej_mc?: number | null;
  eff_fg?: number | null;
  eff_mc?: number | null;
  line_fg?: string | null;
  target_price_fg?: number | null;
  line_mc?: string | null;
  target_price_mc?: number | null;
};

export type PFSTechnicalSpec = {
  rfq_id?: number;
  prod_w?: number | null;
  rm_w?: number | null;
  mat_grade?: string | null;
  dia?: number | null;
  length_mm?: number | null;
  yield_pct?: number | null;
  cut_qty?: number | null;
  qty_pcs?: number | null;
  rm_plus_rem?: number | null;
  remark?: string | null;
};

export type PFSProcessPlanItem = {
  id?: number;
  rfq_id?: number;
  item_type: string;
  mat_grade?: string | null;
  specification?: string | null;
  dia?: number | null;
  target_date?: string | null;
  remark?: string | null;
};

export type PFSProcessEquipmentItem = {
  id?: number;
  rfq_id?: number;
  process_name?: string | null;
  cycle_time?: number | null;
  machine_existing?: string | null;
  machine_new?: string | null;
  dies_price_pcs?: number | null;
  load_cap_old?: number | null;
  load_cap_invest?: number | null;
  load_cap_new?: number | null;
  load_cap_total?: number | null;
  remark?: string | null;
};

export type PFSInvestmentItem = {
  id?: number;
  rfq_id?: number;
  inv_type: 'support' | 'other';
  machine?: string | null;
  qty?: number | null;
  qty_pack?: number | null;
  unit_price?: number | null;
  total_inv?: number | null;
  depr_year?: number | null;
  power_kwh?: number | null;
  area_m2?: number | null;
  manpower?: number | null;
  sim_line?: string | null;
};

export type PFSInvestmentSummary = {
  rfq_id?: number;
  tot_support?: number | null;
  tot_other?: number | null;
  grand_total?: number | null;
};

export type PFSBundle = {
  overview: PFSOverview;
  process_plan: PFSProcessPlanItem[];
  process_equipment: PFSProcessEquipmentItem[];
  technical_spec: PFSTechnicalSpec;
  investments: PFSInvestmentItem[];
  investment_summary: PFSInvestmentSummary;
  new_product?: any;
  similar_product?: any;
};

// PFS Template Jack - Excel Template Reference Sections
export type PFSTemplateJackProductCompareItem = {
  customer?: string | null;
  part_number?: string | null;
  product_name?: string | null;
  qty_per_month?: number | null;
  qty_unit?: string | null;
  rejection_rate_pct?: number | null;
  efficiency_pct?: number | null;
  line_name?: string | null;
  target_price?: number | null;
};

export type PFSTemplateJackBundle = {
  // Metadata
  header?: Record<string, unknown>;

  // (Product comparison removed)

  // Section 2A: Raw Material
  raw_material?: Array<Record<string, unknown>>;

  // Section 2B: Component Part (Purchase)
  component_purchase?: Array<Record<string, unknown>>;

  // Section 2C: Process Standard (In-house)
  process_standard?: Array<Record<string, unknown>>;

  // Section 2D: Dies & Jig Investment
  dies_jig?: Array<Record<string, unknown>>;

  // Section 2G: Development Cost
  development_cost?: Array<Record<string, unknown>>;

  // Section 2E: Process Out House (Outsource)
  process_out_house?: Record<string, unknown>;

  // Section 2F: Assembling Process
  assembling?: Array<Record<string, unknown>>;

  // Section 2H: Packing & Delivery
  packing_delivery?: Array<Record<string, unknown>>;

  // Section 3: Time Frame (Gantt Chart)
  timeframe?: Array<Record<string, unknown>>;

  // Result (OK/NG)
  result?: Record<string, unknown>;
};

export const getPFSBundle = async (rfqId: number, pfsType?: string): Promise<PFSBundle> => {
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  const res = await api.get(`/rfqs/${rfqId}/pfs${typeParam}`, { withCredentials: true });
  return (res.data?.data || {
    overview: {},
    process_plan: [],
    process_equipment: [],
    technical_spec: {},
    investments: [],
    investment_summary: {},
  }) as PFSBundle;
};

export const upsertPFSOverview = async (rfqId: number, payload: PFSOverview, pfsType?: string) => {
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  return api.put(`/rfqs/${rfqId}/pfs/overview${typeParam}`, payload, { withCredentials: true });
};

export const upsertPFSTechnicalSpec = async (rfqId: number, payload: PFSTechnicalSpec, pfsType?: string) => {
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  return api.put(`/rfqs/${rfqId}/pfs/technical-spec${typeParam}`, payload, { withCredentials: true });
};

export const replacePFSProcessPlan = async (rfqId: number, items: PFSProcessPlanItem[], pfsType?: string) => {
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  return api.put(
    `/rfqs/${rfqId}/pfs/process-plan${typeParam}`,
    { items },
    { withCredentials: true }
  );
};

export const replacePFSProcessEquipment = async (rfqId: number, items: PFSProcessEquipmentItem[], pfsType?: string) => {
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  return api.put(
    `/rfqs/${rfqId}/pfs/process-equipment${typeParam}`,
    { items },
    { withCredentials: true }
  );
};

export const replacePFSInvestments = async (rfqId: number, items: PFSInvestmentItem[], pfsType?: string) => {
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  return api.put(
    `/rfqs/${rfqId}/pfs/investments${typeParam}`,
    { items },
    { withCredentials: true }
  );
};

export const upsertPFSInvestmentSummary = async (
  rfqId: number,
  payload: PFSInvestmentSummary,
  pfsType?: string
) => {
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  return api.put(`/rfqs/${rfqId}/pfs/investment-summary${typeParam}`, payload, {
    withCredentials: true,
  });
};

export const getPFSTemplateJackBundle = async (rfqId: number, pfsType?: string): Promise<PFSTemplateJackBundle> => {
  const typeParam = pfsType || 'jack';
  const res = await api.get(`/rfqs/${rfqId}/pfs/template?type=${encodeURIComponent(typeParam)}`, { withCredentials: true });
  return (res.data?.data || {}) as PFSTemplateJackBundle;
};

export const upsertPFSTemplateJackBundle = async (
  rfqId: number,
  payload: PFSTemplateJackBundle,
  pfsType?: string
) => {
  const typeParam = pfsType || 'jack';
  return api.put(`/rfqs/${rfqId}/pfs/template?type=${encodeURIComponent(typeParam)}`, payload, { withCredentials: true });
};

// PFS Template Toolset - Excel Template Reference Sections
export type PFSTemplateToolsetBundle = {
  // Metadata
  header?: Record<string, unknown>;

  // (Product comparison removed)

  // Section 2: Technical Specification (Component Details with Part Numbers & Costs)
  tech_spec?: Array<Record<string, unknown>>;

  // Section 2B: Technical Specification Detail (Inhouse Process Material Details)
  tech_spec_detail?: Array<Record<string, unknown>>;

  // Section 3: Process & Equipment (In-house Processes)
  process_equipment?: Array<Record<string, unknown>>;

  // Section 4: Equipment Out of House (Outsource Processes)
  equipment_out_house?: Array<Record<string, unknown>>;

  // Section 4B: Assembly Toolset
  assy_toolset?: Array<Record<string, unknown>>;

  // Section 5: Purchase Equipment Plan
  purchase_equipment_plan?: Array<Record<string, unknown>>;

  // Section 5 (legacy): Equipment Plan (Monthly Gantt Schedule K1-K9)
  equipment_plan?: Array<Record<string, unknown>>;

  // Section 6: Tooling Breakdown (Cost by Category)
  tooling_breakdown?: Array<Record<string, unknown>>;

  // Section 7: Packaging & Other (Packaging Details)
  packaging?: Array<Record<string, unknown>>;

  // Summary: Totals and Grand Total
  summary?: Record<string, unknown>;
};

export const getPFSTemplateToolsetBundle = async (rfqId: number, pfsType?: string): Promise<PFSTemplateToolsetBundle> => {
  const typeParam = pfsType || 'toolset';
  const res = await api.get(`/rfqs/${rfqId}/pfs/template?type=${encodeURIComponent(typeParam)}`, { withCredentials: true });
  return (res.data?.data || {}) as PFSTemplateToolsetBundle;
};

export const upsertPFSTemplateToolsetBundle = async (
  rfqId: number,
  payload: PFSTemplateToolsetBundle,
  pfsType?: string
) => {
  const typeParam = pfsType || 'toolset';
  return api.put(`/rfqs/${rfqId}/pfs/template?type=${encodeURIComponent(typeParam)}`, payload, { withCredentials: true });
};

// ─── PFS Drawing ────────────────────────────────────────────

export type PFSDrawing = {
  id: number;
  rfq_id: number;
  file_name: string;
  file_path: string;
  uploaded_by: string;
  created_at: string;
};

export type PFSOutHouseAttachment = {
  id: number;
  rfq_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
};

export const getPFSDrawings = async (rfqId: number, pfsType?: string): Promise<PFSDrawing[]> => {
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  const res = await api.get(`/rfqs/${rfqId}/pfs/drawing${typeParam}`, { withCredentials: true });
  return (res.data?.data || []) as PFSDrawing[];
};

export const uploadPFSDrawing = async (rfqId: number, file: File, pfsType?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  return api.post(`/rfqs/${rfqId}/pfs/drawing${typeParam}`, formData, {
    withCredentials: true,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deletePFSDrawing = async (rfqId: number, fileId: number, pfsType?: string) => {
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  return api.delete(`/rfqs/${rfqId}/pfs/drawing/${fileId}${typeParam}`, { withCredentials: true });
};

export const getPFSOutHouseAttachments = async (
  rfqId: number,
  pfsType?: string
): Promise<PFSOutHouseAttachment[]> => {
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  const res = await api.get(`/rfqs/${rfqId}/pfs/out-house-purchasing-attachments${typeParam}`, {
    withCredentials: true,
  });
  return (res.data?.data || []) as PFSOutHouseAttachment[];
};

export const uploadPFSOutHouseAttachment = async (rfqId: number, file: File, pfsType?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  return api.post(`/rfqs/${rfqId}/pfs/out-house-purchasing-attachments${typeParam}`, formData, {
    withCredentials: true,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deletePFSOutHouseAttachment = async (rfqId: number, fileId: number, pfsType?: string) => {
  const typeParam = pfsType ? `?type=${encodeURIComponent(pfsType)}` : '';
  return api.delete(`/rfqs/${rfqId}/pfs/out-house-purchasing-attachments/${fileId}${typeParam}`, {
    withCredentials: true,
  });
};

export const getMasterForgingProcesses = async (): Promise<any[]> => {
  const res = await api.get('/pfs/master/forging-processes', { withCredentials: true });
  return (res.data?.data || []) as any[];
};
