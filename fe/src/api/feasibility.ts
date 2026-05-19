import api from './axios';

export type FeasibilityData = {
  rfq_id?: number;
  customer?: string;
  part_name?: string;
  date_of_issued?: string;
  project?: string;
  part_number?: string;
  revision?: string;
  qty_month?: number;
  masspro?: string;
  revenue_y?: number;
  specification?: string;
  source?: string;
  basic_price?: number;
  import_duty?: number;
  inclaring?: number;
  inventory?: number;
  cost_of_money?: number;
  material_price?: number;
  product_weight?: number;
  matl_weight?: number;
  rejection?: number;
  material_cost?: number;
  scrap_cost?: number;
};

export type FeasibilitySummaryRow = {
  description: string;
  amount: string;
};

export type FeasibilitySummarySection = {
  title: string;
  rows: FeasibilitySummaryRow[];
};

export type FeasibilitySummaryData = {
  rfq_no?: string;
  pfs_type?: string;
  standard_cost?: FeasibilitySummarySection;
  actual_cost?: FeasibilitySummarySection;
  similar_part?: FeasibilitySummarySection;
};

export const getFeasibility = async (rfqId: number): Promise<FeasibilityData | null> => {
  const res = await api.get(`/rfqs/${rfqId}/feasibility`, { withCredentials: true });
  return res.data?.data || null;
};

export const getFeasibilitySummary = async (rfqId: number): Promise<FeasibilitySummaryData | null> => {
  const res = await api.get(`/rfqs/${rfqId}/feasibility/summary`, { withCredentials: true });
  return res.data?.data || null;
};

export const upsertFeasibility = async (rfqId: number, data: FeasibilityData) => {
  return api.put(`/rfqs/${rfqId}/feasibility`, data, { withCredentials: true });
};
