import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import {
  getPFSBundle,
  getPFSTemplateJackBundle,
  getPFSTemplateToolsetBundle,
  type PFSBundle,
  type PFSTemplateJackBundle,
  type PFSTemplateToolsetBundle,
} from '../../api/pfs';
import {
  getStandardCostDocument,
  getStandardCostInvestmentAttachments,
  getStandardCostMaster,
  uploadStandardCostInvestmentAttachment,
  upsertStandardCostDocument,
  type StandardCostAttachment,
  type StandardCostDirectRow,
  type StandardCostDirectSummary,
  type StandardCostDocument,
  type StandardCostMasterRow,
  type StandardCostMaterialRow,
  type StandardCostMaterialSummary,
  type StandardCostOverview,
  type StandardCostPercentageSale,
  type StandardCostProcessingRow,
  type StandardCostRateDetik,
  type StandardCostRatePCS,
  type StandardCostTotalProcessing,
} from '../../api/standardCost';
import type { PFSKind, TabKey } from './standard-cost/types';
import { useAuth } from '../../auth/useAuth';
import OverviewTab from './standard-cost/tabs/OverviewTab';
import ProcessingTab from './standard-cost/tabs/ProcessingTab';
import MaterialTab from './standard-cost/tabs/MaterialTab';
import DirectCostTab from './standard-cost/tabs/DirectCostTab';
import { formatDateTimeInAppTZ } from '../../utils/datetime';

type RFQOption = {
  id: number;
  rfq_no: string;
  status: string;
};

const TAB_LABELS: Record<TabKey, string> = {
  overview: 'Overview',
  processing: 'Processing Cost',
  material: 'Material',
  direct: 'Direct Cost To Product',
};

const DEFAULT_PFS_TYPE: PFSKind = 'forging';
const PFS_TYPE_STORAGE_PREFIX = 'rfqmtm:standard-cost:pfs-type';

const isValidPfsType = (value: unknown): value is PFSKind => {
  return value === 'forging' || value === 'jack' || value === 'toolset';
};

const readStoredPfsType = (userId: string, rfqId?: number | null): PFSKind => {
  if (typeof window === 'undefined') return DEFAULT_PFS_TYPE;

  const read = (key: string) => {
    const stored = window.localStorage.getItem(key);
    return isValidPfsType(stored) ? stored : null;
  };

  if (rfqId) {
    const rfqKey = `${PFS_TYPE_STORAGE_PREFIX}:rfq:${rfqId}`;
    const rfqValue = read(rfqKey);
    if (rfqValue) return rfqValue;
  }

  if (userId) {
    const userKey = `${PFS_TYPE_STORAGE_PREFIX}:user:${userId}`;
    const userValue = read(userKey);
    if (userValue) return userValue;
  }

  return DEFAULT_PFS_TYPE;
};

const persistPfsType = (userId: string, rfqId: number, pfsType: PFSKind) => {
  if (typeof window === 'undefined') return;

  try {
    if (userId) {
      window.localStorage.setItem(`${PFS_TYPE_STORAGE_PREFIX}:user:${userId}`, pfsType);
    }
    if (rfqId > 0) {
      window.localStorage.setItem(`${PFS_TYPE_STORAGE_PREFIX}:rfq:${rfqId}`, pfsType);
    }
  } catch {
    // Ignore storage failures and keep the page functional.
  }
};

const toInput = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const toFileUrl = (filePath: string): string => {
  const base = String(api.defaults.baseURL || '').trim();
  const raw = String(filePath || '').trim();
  if (!raw) return '#';
  if (/^https?:\/\//i.test(raw)) return raw;

  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^uploads\//i, '');
  let origin = window.location.origin;
  if (base) {
    try {
      origin = new URL(base, window.location.origin).origin;
    } catch {
      origin = window.location.origin;
    }
  }
  return `${origin}/uploads/${normalized}`;
};

const EMPTY_PFS_BUNDLE: PFSBundle = {
  overview: {},
  process_plan: [],
  process_equipment: [],
  technical_spec: {},
  investments: [],
  investment_summary: {},
};

const emptyOverview = (): StandardCostOverview => ({
  company_name: '',
  part_number: '',
  part_name: '',
  customer: '',
  rejection_rate: '',
  similar_product: '',
});

const emptyRateDetik = (): StandardCostRateDetik => ({
  mdepr: '',
  labor: '',
  fohfd: '',
  fohfi: '',
  fohvd: '',
  fohvi: '',
  total_rate: '',
});

const emptyRatePCS = (): StandardCostRatePCS => ({
  mdepr: '',
  labor: '',
  fohfd: '',
  fohfi: '',
  fohvd: '',
  fohvi: '',
  total_cost: '',
});

const emptyTotalProcessing = (): StandardCostTotalProcessing => ({
  mdepr: '',
  labor: '',
  fohfd: '',
  fohfi: '',
  fohvd: '',
  fohvi: '',
  total_cost: '',
});

const emptyPercentageSale = (): StandardCostPercentageSale => ({
  mdepr: '',
  labor: '',
  fohfd: '',
  fohfi: '',
  fohvd: '',
  fohvi: '',
  total_cost: '',
});


const emptyProcessingRow = (rowNo: number): StandardCostProcessingRow => ({
  row_no: rowNo,
  wc: '',
  ops_no: '',
  part_number: '',
  start_factor: '',
  percent_ng: '',
  processing: '',
  product: '',
  qty_per_parent: '',
  qty_req_bj_1_fg: '',
  cycle_time: '',
  rate_detik: emptyRateDetik(),
  rate_pcs: emptyRatePCS(),
});

const emptyMaterialRow = (rowNo: number): StandardCostMaterialRow => ({
  row_no: rowNo,
  raw_material: '',
  top_value: '',
  material_code: '',
  product: '',
  process: '',
  qty_per_parent: '',
  uom: '',
  qty_req_by_parent: '',
  qty_req_bj_1_fg: '',
  top_imp_loc: '',
  import_flag: '',
  currency: '',
  exchange_rate: '',
  rp_uom_material: '',
  cost_pcs_fg: '',
});

const emptyDirectRow = (rowNo: number): StandardCostDirectRow => ({
  row_no: rowNo,
  direct_cost_name: '',
  kode_ce: '',
  used_in_process_wc: '',
  qty_req_bj_1_fg: '',
  value_amount: '',
  qty_per_month: '',
  lifetime_month: '',
  lifetime: '',
  cost_pcs_fg: '',
});

const emptyMaterialSummary = (): StandardCostMaterialSummary => ({
  total_row_material: '',
  presentase_terhadap_sale: '',
});

const emptyDirectSummary = (): StandardCostDirectSummary => ({
  total_direct_cost_to_product: '',
  presentase_terhadap_sale: '',
  summary_title: 'Summary',
  total_cost_per_product: '',
  sales: '',
  unit_contribution_margin: '',
  unit_contribution_margin_pct: '',
  gross_profit: '',
  gross_profit_pct: '',
  remark: '',
});

const hasSavedDocument = (doc: StandardCostDocument): boolean => {
  return Boolean(
    doc.overview?.company_name ||
    doc.overview?.part_number ||
    doc.overview?.part_name ||
    (doc.processing_rows || []).length > 0 ||
    (doc.material_rows || []).length > 0 ||
    (doc.direct_rows || []).length > 0
  );
};

const isFilledText = (value: unknown): boolean => String(value || '').trim() !== '';

const mergeOverviewFromPrefill = (
  current: StandardCostOverview,
  prefill: StandardCostOverview
): StandardCostOverview => ({
  company_name: isFilledText(current.company_name) ? current.company_name : toInput(prefill.company_name),
  part_number: isFilledText(current.part_number) ? current.part_number : toInput(prefill.part_number),
  part_name: isFilledText(current.part_name) ? current.part_name : toInput(prefill.part_name),
  customer: isFilledText(current.customer) ? current.customer : toInput(prefill.customer),
  rejection_rate: isFilledText(current.rejection_rate) ? current.rejection_rate : toInput(prefill.rejection_rate),
  similar_product: isFilledText(current.similar_product) ? current.similar_product : toInput(prefill.similar_product),
});

const normalizeDocument = (doc: Partial<StandardCostDocument>): StandardCostDocument => ({
  overview: {
    ...emptyOverview(),
    ...(doc.overview || {}),
  },

  processing_rows: (doc.processing_rows || []).length > 0
    ? (doc.processing_rows || []).map((row, idx) => ({
      ...emptyProcessingRow(row.row_no || idx + 1),
      ...row,
      rate_detik: { ...emptyRateDetik(), ...(row.rate_detik || {}) },
      rate_pcs: { ...emptyRatePCS(), ...(row.rate_pcs || {}) },
    }))
    : [emptyProcessingRow(1)],

  material_rows: (doc.material_rows || []).length > 0 ? (doc.material_rows || []) : [emptyMaterialRow(1)],
  material_summary: {
    ...emptyMaterialSummary(),
    ...(doc.material_summary || {}),
  },
  direct_rows: (doc.direct_rows || []).length > 0 ? (doc.direct_rows || []) : [emptyDirectRow(1)],
  direct_summary: {
    ...emptyDirectSummary(),
    ...(doc.direct_summary || {}),
  },
  total_processing: {
    ...emptyTotalProcessing(),
    ...(doc.total_processing || {}),
  },
  percentage_sale: {
    ...emptyPercentageSale(),
    ...(doc.percentage_sale || {}),
  },
});

const buildPrefillDocument = (
  pfsType: PFSKind,
  bundle: PFSBundle,
  jackTemplate: PFSTemplateJackBundle,
  toolsetTemplate: PFSTemplateToolsetBundle,
  detailRows: Array<Record<string, unknown>>
): StandardCostDocument => {
  const newRow = detailRows.find((row) => String(row.product_type || '').toLowerCase() === 'new') || {};
  const similarRow = detailRows.find((row) => String(row.product_type || '').toLowerCase() === 'similar') || {};

  const overview: StandardCostOverview = {
    company_name: toInput(newRow.customer),
    part_number: toInput(newRow.part_no),
    part_name: toInput(newRow.part_name),
    customer: toInput(newRow.customer),
    rejection_rate: toInput(bundle.overview?.rej_fg),
    similar_product: toInput(similarRow.part_name),
  };

  let processingRows: StandardCostProcessingRow[] = [];
  let materialRows: StandardCostMaterialRow[] = [];
  let directRows: StandardCostDirectRow[] = [];

  if (pfsType === 'jack') {
    processingRows = (jackTemplate.process_standard || []).map((row, idx) => ({
      row_no: idx + 1,
      wc: toInput(row.line_name),
      ops_no: String(idx + 1),
      part_number: toInput(newRow.part_no),
      start_factor: '',
      percent_ng: toInput(bundle.overview?.rej_fg),
      processing: toInput(row.process_name),
      product: toInput(newRow.part_name),
      qty_per_parent: '1',
      qty_req_bj_1_fg: '1',
      cycle_time: toInput(row.cycle_time_sec),
      rate_detik: emptyRateDetik(),
      rate_pcs: emptyRatePCS(),
    }));

    materialRows = (jackTemplate.raw_material || []).map((row, idx) => ({
      row_no: idx + 1,
      raw_material: toInput(row.part_name),
      top_value: toInput(row.material),
      material_code: '',
      product: toInput(newRow.part_name),
      process: '',
      qty_per_parent: toInput(row.qty_pcs) || '1',
      uom: 'PCS',
      qty_req_by_parent: toInput(row.qty_unit),
      qty_req_bj_1_fg: toInput(row.qty_unit),
      top_imp_loc: '',
      import_flag: '',
      currency: 'IDR',
      exchange_rate: '',
      rp_uom_material: toInput(row.weight_unit_kg),
      cost_pcs_fg: '',
    }));

    directRows = (jackTemplate.component_purchase || []).map((row, idx) => ({
      row_no: idx + 1,
      direct_cost_name: toInput(row.part_name),
      kode_ce: '',
      used_in_process_wc: '',
      qty_req_bj_1_fg: toInput(row.qty_unit),
      value_amount: toInput(row.cost_rate),
      qty_per_month: '',
      lifetime_month: '',
      lifetime: '',
      cost_pcs_fg: toInput(row.price_idr),
    }));
  } else if (pfsType === 'toolset') {
    processingRows = (toolsetTemplate.process_equipment || []).map((row, idx) => ({
      row_no: idx + 1,
      wc: toInput(row.machine_existing),
      ops_no: String(idx + 1),
      part_number: toInput(newRow.part_no),
      start_factor: '',
      percent_ng: toInput(bundle.overview?.rej_fg),
      processing: toInput(row.process_name),
      product: toInput(newRow.part_name),
      qty_per_parent: '1',
      qty_req_bj_1_fg: '1',
      cycle_time: toInput(row.cycle_time_sec),
      rate_detik: emptyRateDetik(),
      rate_pcs: emptyRatePCS(),
    }));

    materialRows = (toolsetTemplate.tech_spec || []).map((row, idx) => ({
      row_no: idx + 1,
      raw_material: toInput(row.component_name),
      top_value: '-',
      material_code: toInput(row.part_no_supplier),
      product: toInput(newRow.part_name),
      process: '',
      qty_per_parent: '1',
      uom: 'PCS',
      qty_req_by_parent: toInput(row.qty),
      qty_req_bj_1_fg: toInput(row.qty),
      top_imp_loc: '',
      import_flag: '',
      currency: 'IDR',
      exchange_rate: '',
      rp_uom_material: toInput(row.actual_cost_idr),
      cost_pcs_fg: toInput(row.actual_cost_idr),
    }));

    directRows = (toolsetTemplate.tooling_breakdown || []).map((row, idx) => ({
      row_no: idx + 1,
      direct_cost_name: toInput(row.tooling_category),
      kode_ce: '',
      used_in_process_wc: '',
      qty_req_bj_1_fg: '1',
      value_amount: toInput(row.cost_idr),
      qty_per_month: '',
      lifetime_month: '',
      lifetime: '',
      cost_pcs_fg: toInput(row.cost_idr),
    }));
  } else {
    processingRows = (bundle.process_equipment || []).map((row, idx) => ({
      row_no: idx + 1,
      wc: toInput(row.machine_existing),
      ops_no: String(idx + 1),
      part_number: toInput(newRow.part_no),
      start_factor: '',
      percent_ng: toInput(bundle.overview?.rej_fg),
      processing: toInput(row.process_name),
      product: toInput(newRow.part_name),
      qty_per_parent: '1',
      qty_req_bj_1_fg: '1',
      cycle_time: toInput(row.cycle_time),
      rate_detik: emptyRateDetik(),
      rate_pcs: emptyRatePCS(),
    }));

    materialRows = [{
      row_no: 1,
      raw_material: toInput(newRow.part_name),
      top_value: toInput(bundle.technical_spec?.mat_grade),
      material_code: '',
      product: toInput(newRow.part_name),
      process: '',
      qty_per_parent: '1',
      uom: 'PCS',
      qty_req_by_parent: toInput(bundle.technical_spec?.cut_qty),
      qty_req_bj_1_fg: toInput(bundle.technical_spec?.cut_qty),
      top_imp_loc: '',
      import_flag: '',
      currency: 'IDR',
      exchange_rate: '',
      rp_uom_material: toInput(bundle.technical_spec?.rm_w),
      cost_pcs_fg: '',
    }];

    directRows = (bundle.investments || []).map((row, idx) => ({
      row_no: idx + 1,
      direct_cost_name: toInput(row.machine),
      kode_ce: '',
      used_in_process_wc: toInput(row.sim_line),
      qty_req_bj_1_fg: toInput(row.qty),
      value_amount: toInput(row.unit_price),
      qty_per_month: '',
      lifetime_month: '',
      lifetime: toInput(row.depr_year),
      cost_pcs_fg: toInput(row.total_inv),
    }));
  }

  return normalizeDocument({
    overview,
    processing_rows: processingRows,
    material_rows: materialRows,
    material_summary: emptyMaterialSummary(),
    direct_rows: directRows,
    direct_summary: emptyDirectSummary(),
    total_processing: emptyTotalProcessing(),
    percentage_sale: emptyPercentageSale(),
  });
};

const StandardCostPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as TabKey;
    if (tab && TAB_LABELS[tab]) {
      return tab;
    }
    return 'overview';
  });

  const setActiveTabInUrl = (tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    navigate({ search: params.toString() }, { replace: true });
  };
  const [rfqOptions, setRfqOptions] = useState<RFQOption[]>([]);
  const [selectedRFQId, setSelectedRFQId] = useState(0);
  const [pfsType, setPfsType] = useState<PFSKind>(DEFAULT_PFS_TYPE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uploadingFeasibility, setUploadingFeasibility] = useState(false);

  const [wcMasterRows, setWcMasterRows] = useState<StandardCostMasterRow[]>([]);
  const [doc, setDoc] = useState<StandardCostDocument>(normalizeDocument({}));
  const [feasibilityFiles, setFeasibilityFiles] = useState<StandardCostAttachment[]>([]);
  const [selectedFeasibilityFile, setSelectedFeasibilityFile] = useState<File | null>(null);
  const { user } = useAuth();

  const selectedRFQ = useMemo(() => {
    if (!selectedRFQId) return null;
    return rfqOptions.find((row) => row.id === selectedRFQId) || null;
  }, [rfqOptions, selectedRFQId]);

  const normalizedUserRole = String(user?.role || '').trim().toLowerCase();
  const canManageStandardCostMaster = normalizedUserRole === 'accounting' || normalizedUserRole === 'admin';
  const canUploadFeasibility = normalizedUserRole === 'accounting' || normalizedUserRole === 'admin';

  const applyPfsPreferenceForRfq = (rfqId: number) => {
    const preferredType = readStoredPfsType(String(user?.userid || ''), rfqId);
    setSelectedRFQId(rfqId);
    setPfsType(preferredType);
    persistPfsType(String(user?.userid || ''), rfqId, preferredType);
  };

  const fetchRFQ = async () => {
    const res = await api.get('/rfqs', { withCredentials: true });
    const rows = (res.data?.data || []) as Array<Record<string, unknown>>;
    const mapped = rows
      .map((row) => {
        const id = Number(row.id ?? row.rfq_id);
        const rfqNo = String(row.rfq_no || '').trim();
        const status = String(row.status || '').trim();
        if (!Number.isFinite(id) || id <= 0 || !rfqNo) return null;
        return { id, rfq_no: rfqNo, status };
      })
      .filter((row): row is RFQOption => row !== null);

    setRfqOptions(mapped);
    if (!selectedRFQId && mapped.length > 0) {
      applyPfsPreferenceForRfq(mapped[0].id);
    }
  };

  const fetchSourceData = async (rfqId: number) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const [savedDoc, bundle, detailRes, jackTemplate, toolsetTemplate, wcMaster, attachmentRows] = await Promise.all([
        getStandardCostDocument(rfqId, pfsType).catch(() => normalizeDocument({})),
        getPFSBundle(rfqId, pfsType).catch(() => EMPTY_PFS_BUNDLE),
        api.get(`/rfqs/${rfqId}`, { withCredentials: true }).catch(() => ({ data: {} })),
        pfsType === 'jack'
          ? getPFSTemplateJackBundle(rfqId, 'jack').catch(() => ({} as PFSTemplateJackBundle))
          : Promise.resolve({} as PFSTemplateJackBundle),
        pfsType === 'toolset'
          ? getPFSTemplateToolsetBundle(rfqId, 'toolset').catch(() => ({} as PFSTemplateToolsetBundle))
          : Promise.resolve({} as PFSTemplateToolsetBundle),
        getStandardCostMaster({ currentValid: true }).catch(() => [] as StandardCostMasterRow[]),
        getStandardCostInvestmentAttachments(rfqId, pfsType).catch(() => [] as StandardCostAttachment[]),
      ]);

      setWcMasterRows(wcMaster);
      setFeasibilityFiles(attachmentRows);

      const detailRows =
        ((detailRes.data?.products || detailRes.data?.data || []) as Array<Record<string, unknown>>);
      const prefillDoc = buildPrefillDocument(pfsType, bundle, jackTemplate, toolsetTemplate, detailRows);

      if (hasSavedDocument(savedDoc)) {
        const normalizedSavedDoc = normalizeDocument(savedDoc);
        setDoc({
          ...normalizedSavedDoc,
          overview: mergeOverviewFromPrefill(normalizedSavedDoc.overview, prefillDoc.overview),
        });
        return;
      }

      setDoc(prefillDoc);
    } catch {
      setError('Gagal memuat data Standard Cost');
      setDoc(normalizeDocument({}));
      setWcMasterRows([]);
      setFeasibilityFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const uploadFeasibilityStudy = async () => {
    if (!selectedRFQId || !selectedFeasibilityFile) {
      setError('Pilih RFQ dan file feasibility study terlebih dahulu');
      return;
    }

    const ext = selectedFeasibilityFile.name.toLowerCase();
    if (!ext.endsWith('.xls') && !ext.endsWith('.xlsx')) {
      setError('File feasibility study harus bertipe .xls atau .xlsx');
      return;
    }

    setUploadingFeasibility(true);
    setError('');
    setMessage('');
    try {
      await uploadStandardCostInvestmentAttachment(selectedRFQId, pfsType, selectedFeasibilityFile);
      const files = await getStandardCostInvestmentAttachments(selectedRFQId, pfsType);
      setFeasibilityFiles(files);
      setSelectedFeasibilityFile(null);
      setMessage('Feasibility study berhasil diupload');
    } catch {
      setError('Gagal upload feasibility study');
    } finally {
      setUploadingFeasibility(false);
    }
  };

  const cleanPayload = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(cleanPayload);
    } else if (obj !== null && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed === '') {
            result[key] = null;
          } else if (!isNaN(Number(trimmed)) && key !== 'part_number' && key !== 'part_name' && key !== 'company_name' && key !== 'customer' && key !== 'similar_product' && key !== 'processing' && key !== 'product' && key !== 'ops_no' && key !== 'raw_material' && key !== 'material_code' && key !== 'direct_cost_name' && key !== 'kode_ce' && key !== 'used_in_process_wc' && key !== 'top_imp_loc' && key !== 'currency' && key !== 'process' && key !== 'uom' && key !== 'import_flag' && key !== 'top_value' && key !== 'remark' && key !== 'summary_title' && key !== 'wc') {
            result[key] = Number(trimmed);
          } else {
            result[key] = trimmed;
          }
        } else {
          result[key] = cleanPayload(value);
        }
      }
      return result;
    }
    return obj;
  };

  const saveDocument = async () => {
    if (!selectedRFQId) {
      setError('Pilih RFQ terlebih dahulu');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const cleanedDoc = cleanPayload(doc);
      await upsertStandardCostDocument(selectedRFQId, pfsType, cleanedDoc);
      setMessage('Standard Cost berhasil disimpan ke server');
    } catch {
      setError('Gagal menyimpan Standard Cost');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchRFQ().catch(() => {
      setError('Gagal memuat daftar RFQ');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRFQId) return;
    setSelectedFeasibilityFile(null);
    fetchSourceData(selectedRFQId).catch(() => {
      setError('Gagal memuat data Standard Cost');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRFQId, pfsType]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <label className="space-y-1 text-sm">
            <span className="text-gray-700">PFS List</span>
            <select
              value={selectedRFQId || ''}
              onChange={(e) => applyPfsPreferenceForRfq(Number(e.target.value || 0))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Pilih RFQ</option>
              {rfqOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.rfq_no} ({row.status || '-'})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-gray-700">Template</span>
            <select
              value={pfsType}
              onChange={(e) => {
                const nextType = e.target.value as PFSKind;
                setPfsType(nextType);
                persistPfsType(String(user?.userid || ''), selectedRFQId, nextType);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="forging">Forging</option>
              <option value="jack">Jack</option>
              <option value="toolset">Toolset</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex min-w-max gap-2 overflow-x-auto pb-1">
          {(Object.keys(TAB_LABELS) as TabKey[]).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTabInUrl(tabKey)}
              className={`rounded-lg px-3 py-2 text-sm ${activeTab === tabKey ? 'bg-[#0D79BD] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {TAB_LABELS[tabKey]}
            </button>
          ))}
        </div>

        {canManageStandardCostMaster && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-emerald-900">Kelola master Standard Cost</div>
              {/* <div className="text-xs text-emerald-700">Tambah, edit, dan hapus baris tabel cost center dan work center dari layar terpisah yang lebih nyaman.</div> */}
            </div>
            <button
              type="button"
              onClick={() => navigate('/main/standard-cost-master')}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Open Master
            </button>
          </div>
        )}
      </div>

      {selectedRFQ && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
          RFQ aktif: <span className="font-semibold text-gray-900">{selectedRFQ.rfq_no}</span>
          <span className="mx-2 text-gray-400">•</span>
          Template: <span className="font-semibold capitalize text-gray-900">{pfsType}</span>
        </div>
      )}

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading Standard Cost...</div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          {activeTab === 'overview' && (
            <OverviewTab
              overview={doc.overview}
              onChange={(overview) => setDoc((prev) => ({ ...prev, overview }))}
              feasibilityFiles={feasibilityFiles}
              selectedFeasibilityFile={selectedFeasibilityFile}
              onSelectFeasibilityFile={setSelectedFeasibilityFile}
              onUploadFeasibilityFile={uploadFeasibilityStudy}
              uploadingFeasibility={uploadingFeasibility}
              canUploadFeasibility={canUploadFeasibility}
              formatDateTime={formatDateTimeInAppTZ}
              buildFileUrl={toFileUrl}
            />
          )}

          {activeTab === 'processing' && (
            <ProcessingTab
              rows={doc.processing_rows}
              totalProcessing={doc.total_processing}
              percentageSale={doc.percentage_sale}
              salesPrice={doc.direct_summary.sales}
              wcMasterRows={wcMasterRows}
              rejectionRate={doc.overview?.rejection_rate || ''}
              onChangeRows={(processing_rows) => setDoc((prev) => ({ ...prev, processing_rows }))}
              onChangeTotalProcessing={(total_processing) => setDoc((prev) => ({ ...prev, total_processing }))}
              onChangePercentageSale={(percentage_sale) => setDoc((prev) => ({ ...prev, percentage_sale }))}
            />
          )}

          {activeTab === 'material' && (
            <MaterialTab
              rows={doc.material_rows}
              summary={doc.material_summary}
              salesPrice={doc.direct_summary.sales}
              rejectionRate={doc.overview?.rejection_rate || ''}
              onChangeRows={(material_rows) => setDoc((prev) => ({ ...prev, material_rows }))}
              onChangeSummary={(material_summary) => setDoc((prev) => ({ ...prev, material_summary }))}
            />
          )}

          {activeTab === 'direct' && (
            <DirectCostTab
              rows={doc.direct_rows}
              summary={doc.direct_summary}
              totalProcessing={doc.total_processing}
              materialSummary={doc.material_summary}
              onChangeRows={(direct_rows) => setDoc((prev) => ({ ...prev, direct_rows }))}
              onChangeSummary={(direct_summary) => setDoc((prev) => ({ ...prev, direct_summary }))}
            />
          )}



          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={saveDocument}
              disabled={!selectedRFQId || saving}
              className="rounded-lg bg-[#0D79BD] px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StandardCostPage;
