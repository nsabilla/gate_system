import React, { useEffect, useMemo, useState } from 'react';
import PfsHeader from './PfsHeader';
import TimeframeTab from './components/TimeframeTab';
import JackRawMaterial from './components/JackRawMaterial';
import { parseNumberOrNull, parseIntOrNull, toInputValue, parseTabKey, parseDate, parseCutQtyWithRM } from './pfsParsers';
import { isAllowedOutHouseAttachmentFile, toErrorMessage, hasFilledText, buildDrawingFileUrl } from './pfsFormatters';
import type {
  PFSInvestmentItem,
  PFSProcessPlanItem,
  PFSProcessEquipmentItem,
  PFSDrawing,
} from '../../../api/pfs';
import type {
  RFQOption,
  JackRawMaterialRow,
  JackComponentPurchaseRow,
  JackProcessStandardRow,
  JackAssemblingRow,
  JackPackingDeliveryRow,
  JackDiesJigRow,
  JackDevelopmentCostRow,
  ToolsetSubcontRow,
  ToolsetAssyRow,
  ToolsetTechSpecRow,
  ToolsetTechSpecDetailRow,
  ToolsetProcessEquipmentRow,
  ToolsetToolingRow,
  ToolsetPackagingRow,
} from './pfsTypes';
import {
  getPFSBundle,
  getPFSDrawings,
  uploadPFSDrawing,
  deletePFSDrawing,
  getPFSOutHouseAttachments,
  uploadPFSOutHouseAttachment,
  deletePFSOutHouseAttachment,
  upsertPFSOverview,
  upsertPFSTechnicalSpec,
  replacePFSProcessPlan,
  replacePFSProcessEquipment,
  replacePFSInvestments,
  upsertPFSInvestmentSummary,
  getPFSTemplateToolsetBundle,
  upsertPFSTemplateJackBundle,
  upsertPFSTemplateToolsetBundle,
  getPFSTemplateJackBundle,
  getMasterForgingProcesses,
} from '../../../api/pfs';
import { buildTemplateJackPayload, buildTemplateToolsetPayload } from './pfsBuilders';
import {
  emptyJackRawMaterialRow,
  emptyJackComponentPurchaseRow,
  emptyJackProcessStandardRow,
  emptyJackAssemblingRow,
  emptyJackPackingDeliveryRow,
  emptyJackDiesJigRow,
  emptyJackDevelopmentCostRow,
  emptyToolsetSubcontRow,
  emptyToolsetAssyRow,
  emptyToolsetTechSpecRow,
  emptyToolsetTechSpecDetailRow,
  emptyToolsetProcessEquipmentRow,
  emptyToolsetToolingRow,
  emptyToolsetPackagingRow,
} from './pfsFactories';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/useAuth';
import api from '../../../api/axios';
import { formatDateTimeInAppTZ } from '../../../utils/datetime';

const parsePfsTypeParam = (value: unknown): 'jack' | 'toolset' | 'forging' => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'toolset' || normalized === 'forging' || normalized === 'jack') {
    return normalized;
  }
  return 'jack';
};

const PfsPage: React.FC = () => {
  const { user } = useAuth();
  const params = useParams();
  const paramRFQId = Number((params as any).rfqId || 0);
  const pfsType = parsePfsTypeParam((params as any).type);
  const location = useLocation();

  const [selectedRFQId, setSelectedRFQId] = useState<number | null>(null);
  const [rfqOptions, setRfqOptions] = useState<RFQOption[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'estimation' | 'drawing' | 'timeframe'>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = String(params.get('tab') || '').trim().toLowerCase();
    if (tab === 'estimation' || tab === 'drawing' || tab === 'timeframe') {
      return tab;
    }
    return 'overview';
  });
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const canCrudPFS = Boolean(user?.permissions?.pfs_crud);
  const canApprovePFS = Boolean(user?.permissions?.pfs_approve);
  const canViewPFS = Boolean(user?.permissions?.pfs_crud || user?.permissions?.pfs_approve);

  const [selectedOutHouseFile, setSelectedOutHouseFile] = useState<File | null>(null);
  const [uploadingOutHouseAttachment, setUploadingOutHouseAttachment] = useState<boolean>(false);
  const [uploadingDrawing, setUploadingDrawing] = useState<boolean>(false);
  const [outHouseAttachments, setOutHouseAttachments] = useState<any[]>([]);

  const [jackRawMaterialRows, setJackRawMaterialRows] = useState<any[]>([]);
  const [jackComponentPurchaseRows, setJackComponentPurchaseRows] = useState<any[]>([]);
  const [jackProcessStandardRows, setJackProcessStandardRows] = useState<any[]>([]);
  const [jackAssemblingRows, setJackAssemblingRows] = useState<any[]>([]);
  const [jackPackingDeliveryRows, setJackPackingDeliveryRows] = useState<any[]>([]);
  const [jackDiesJigRows, setJackDiesJigRows] = useState<any[]>([]);
  const [jackDevelopmentCostRows, setJackDevelopmentCostRows] = useState<any[]>([]);

  const [investmentSummary, setInvestmentSummary] = useState<any>({ tot_support: '', tot_other: '', grand_total: '' });
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [moveCode, setMoveCode] = useState<string>('');
  const [moveTargetDate, setMoveTargetDate] = useState<string>('');
  const [moveRemarks, setMoveRemarks] = useState<string>('');

  const [activityOptions] = useState<any[]>([]);
  const [currentPIC] = useState<string>('');
  const [disableApproveSave] = useState<boolean>(false);

  const [selectedDrawingFile, setSelectedDrawingFile] = useState<File | null>(null);
  const [drawings, setDrawings] = useState<PFSDrawing[]>([]);
  const [processPlan, setProcessPlan] = useState<PFSProcessPlanItem[]>([]);
  const [processEquipment, setProcessEquipment] = useState<PFSProcessEquipmentItem[]>([]);
  const [toolsetSubcontRows, setToolsetSubcontRows] = useState<any[]>([]);
  const [autoToolsetSummary, setAutoToolsetSummary] = useState<any>({ total_tooling_cost: '', total_packaging_cost: '', total_equipment_investment: '', grand_total: '' });
  const [masterForgingProcesses, setMasterForgingProcesses] = useState<any[]>([]);

  const navigate = useNavigate();

  const setActiveTabInUrl = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (!selectedRFQId) {
      return;
    }

    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    const path = `/main/pfs/${pfsType}/${selectedRFQId}${params.toString() ? `?${params.toString()}` : ''}`;
    navigate(path, { replace: true });
  };

  const goToPFS = async (
    id: number,
    no?: string,
    replace = false,
    tab?: typeof activeTab,
    type?: typeof pfsType
  ) => {
    const activeTabValue = tab ?? activeTab;
    const activeType = type ?? pfsType;
    const params = new URLSearchParams(location.search);
    if (no) params.set('rfq_no', no);
    params.set('tab', activeTabValue);
    const path = `/main/pfs/${activeType}/${id}${params.toString() ? `?${params.toString()}` : ''}`;
    setSelectedRFQId(id);
    if (no) setSelectedRFQNo(no);

    const selected = rfqOptions.find((row) => row.id === id);
    if (selected) {
      setSelectedRFQStatus(selected.status || null);
      setSelectedRFQCodeAct(Number(selected.statusactivity || 0) || null);
    }

    await loadSelectedRFQData(id);

    if (replace) {
      navigate(path, { replace: true });
    } else {
      navigate(path);
    }
  };

  const loadSelectedRFQData = async (rfqId: number) => {
    if (!rfqId) return;

    try {
      const res = await api.get(`/rfqs/${rfqId}`, { withCredentials: true });
      const rows = (res.data?.data as Array<Record<string, unknown>>) || [];
      const toStringValue = (value: unknown) => (value === null || value === undefined ? '' : String(value));
      const findByType = (productType: 'new' | 'similar') =>
        rows.find((row) => String(row.product_type || '').trim().toLowerCase() === productType) || null;

      const newRow = findByType('new');
      const similarRow = findByType('similar');

      if (newRow) {
        setNewProduct({
          customer: toStringValue(newRow.customer),
          partNo: toStringValue(newRow.part_no),
          product: toStringValue(newRow.part_name),
          qtyMonth: toStringValue(newRow.volume_month),
          line: toStringValue((newRow as any).line),
        });
      }

      if (similarRow) {
        setSimilarProduct({
          customer: toStringValue(similarRow.customer),
          partNo: toStringValue(similarRow.part_no),
          product: toStringValue(similarRow.part_name),
          qtyMonth: toStringValue(similarRow.volume_month),
          line: toStringValue((similarRow as any).line),
        });
      }
    } catch {
      // fallback ke bundle di bawah
    }

    await Promise.all([
      fetchBundle(rfqId).catch(() => {
        setError('Gagal memuat data PFS');
      }),
      fetchTimeFrame(rfqId).catch(() => {
        // fetchTimeFrame sudah mengelola error sendiri
      }),
    ]);
  };

  const [toolsetPurchaseEquipmentPlanRows, setToolsetPurchaseEquipmentPlanRows] = useState<any[]>([]);
  const [investments, setInvestments] = useState<PFSInvestmentItem[]>([]);
  const [userLevel] = useState<number | null>(null);
  const [selectedRFQNo, setSelectedRFQNo] = useState<string | null>(null);
  const [selectedRFQStatus, setSelectedRFQStatus] = useState<string | null>(null);
  const [selectedRFQCodeAct, setSelectedRFQCodeAct] = useState<number | null>(null);
  const isRFQApproved = String(selectedRFQStatus || '').toLowerCase() === 'approved';

  const [newProduct, setNewProduct] = useState<any>({ customer: '', partNo: '', product: '', qtyMonth: '', line: '' });
  const [similarProduct, setSimilarProduct] = useState<any>({ customer: '', partNo: '', product: '', qtyMonth: '', line: '' });
  const [overview, setOverview] = useState<any>({ rej_fg: '', rej_mc: '', eff_fg: '', eff_mc: '' });
  const [disableCrudSave] = useState<boolean>(false);

  const [technicalSpec, setTechnicalSpec] = useState<any>({ prod_w: '', rm_w: '', mat_grade: '', dia: '', length_mm: '', yield_pct: '', cut_qty: '', qty_pcs: '', rm_plus_rem: '', remark: '' });
  const [cutQtyInput, setCutQtyInput] = useState<string>('');

  const [toolsetTechSpecRows, setToolsetTechSpecRows] = useState<any[]>([]);
  const [toolsetProcessEquipmentRows, setToolsetProcessEquipmentRows] = useState<any[]>([]);
  const [toolsetAssyRows, setToolsetAssyRows] = useState<any[]>([]);
  const [toolsetToolingRows, setToolsetToolingRows] = useState<any[]>([]);
  const [toolsetPackagingRows, setToolsetPackagingRows] = useState<any[]>([]);

  const fetchRFQs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rfqs', { withCredentials: true });
      const rows = (res.data?.data || []) as Array<Record<string, unknown>>;
      const mapped = rows
        .map((row): RFQOption | null => {
          const id = Number(row.id ?? row.rfq_id);
          const rfq_no = String(row.rfq_no || '').trim();
          const status = String(row.status || '').trim();
          const statusactivity = String(row.statusactivity || '').trim();
          if (!Number.isFinite(id) || id <= 0 || !rfq_no) return null;
          return { id, rfq_no, status, statusactivity, pfs_approver_username: '', pfs_approver_badge: '' };
        })
        .filter((item): item is RFQOption => item !== null);

      setRfqOptions(mapped);
      if (selectedRFQId != null) {
        const current = mapped.find((row) => row.id === selectedRFQId);
        if (current) {
          setSelectedRFQNo(current.rfq_no);
          setSelectedRFQStatus(current.status || null);
          setSelectedRFQCodeAct(Number(current.statusactivity) || null);
        }
      } else if (mapped.length > 0) {
        const firstOption = mapped[0];
        if (firstOption) {
          setSelectedRFQId(firstOption.id);
          setSelectedRFQNo(firstOption.rfq_no);
          setSelectedRFQStatus(firstOption.status);
          setSelectedRFQCodeAct(Number(firstOption.statusactivity) || null);
        }
      }
    } catch (err) {
      setError('Gagal memuat daftar RFQ');
      setRfqOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBundle = async (rfqId: number) => {
    setLoading(true);
    try {
      const bundle = await getPFSBundle(rfqId, pfsType);
      setOverview(bundle?.overview || { rej_fg: '', rej_mc: '', eff_fg: '', eff_mc: '' });
      setTechnicalSpec(bundle?.technical_spec || { prod_w: '', rm_w: '', mat_grade: '', dia: '', length_mm: '', yield_pct: '', cut_qty: '', qty_pcs: '', rm_plus_rem: '', remark: '' });
      setProcessPlan(bundle?.process_plan || []);
      setProcessEquipment(bundle?.process_equipment || []);
      setInvestments(bundle?.investments || []);
      setInvestmentSummary(bundle?.investment_summary || { tot_support: '', tot_other: '', grand_total: '' });

      const toStringValue = (value: unknown) => (value === null || value === undefined ? '' : String(value));

      // Auto-fill Product Comparison from RFQ Details
      if (bundle.new_product) {
        setNewProduct({
          customer: toStringValue(bundle.new_product.customer),
          partNo: toStringValue(bundle.new_product.part_no),
          product: toStringValue(bundle.new_product.part_name),
          qtyMonth: toStringValue(bundle.new_product.volume_month),
          line: toStringValue(bundle.overview?.line_fg),
        });
      }

      if (bundle.similar_product) {
        setSimilarProduct({
          customer: toStringValue(bundle.similar_product.customer),
          partNo: toStringValue(bundle.similar_product.part_no),
          product: toStringValue(bundle.similar_product.part_name),
          qtyMonth: toStringValue(bundle.similar_product.volume_month),
          line: toStringValue(bundle.overview?.line_mc),
        });
      }
      if (pfsType === 'toolset') {
        const bundleToolset = await getPFSTemplateToolsetBundle(rfqId, pfsType).catch(() => null);
        setAutoToolsetSummary(bundleToolset?.summary || { total_tooling_cost: '', total_packaging_cost: '', total_equipment_investment: '', grand_total: '' });

        const detailMap = new Map<number, any>();
        (bundleToolset?.tech_spec_detail || []).forEach((detail: any) => {
          const rowNo = Number(detail.tech_spec_row_no ?? detail.row_no ?? 0) || 0;
          if (rowNo > 0 && !detailMap.has(rowNo)) {
            detailMap.set(rowNo, {
              material: toStringValue(detail.material),
              diameter_mm: toStringValue(detail.diameter_mm),
              length_mm: toStringValue(detail.length_mm),
              mass_kg: toStringValue(detail.mass_kg),
              material_cost_country_1: toStringValue(detail.material_cost_country_1),
              material_cost_rp_kg_1: toStringValue(detail.material_cost_rp_kg_1),
              material_cost_country_2: toStringValue(detail.material_cost_country_2),
              material_cost_rp_kg_2: toStringValue(detail.material_cost_rp_kg_2),
              cost_finish_country_1: toStringValue(detail.cost_finish_country_1),
              cost_finish_rp_kg_1: toStringValue(detail.cost_finish_rp_kg_1),
              cost_finish_country_2: toStringValue(detail.cost_finish_country_2),
              cost_finish_rp_kg_2: toStringValue(detail.cost_finish_rp_kg_2),
              mass_product_gr: toStringValue(detail.mass_product_gr),
            });
          }
        });

        setToolsetTechSpecRows((bundleToolset?.tech_spec || []).map((row: any, idx: number) => ({
          part_no: toStringValue(row.part_no),
          component_name: toStringValue(row.component_name),
          qty: toStringValue(row.qty),
          part_no_mtm: toStringValue(row.part_no_mtm),
          part_no_supplier: toStringValue(row.part_no_supplier),
          actual_cost_idr: toStringValue(row.actual_cost_idr),
          remark: toStringValue(row.remark),
          isDetailOpen: false,
          detail: detailMap.get(Number(row.row_no ?? idx + 1)) || undefined,
        })));
        setToolsetProcessEquipmentRows((bundleToolset?.process_equipment || []).map((row: any) => ({
          process_name: toStringValue(row.process_name),
          cycle_time_sec: toStringValue(row.cycle_time_sec),
          machine_existing: toStringValue(row.machine_existing),
          machine_new: toStringValue(row.machine_new),
          remark: toStringValue(row.remark),
        })));
        setToolsetSubcontRows((bundleToolset?.equipment_out_house || []).map((row: any) => ({
          process_name: toStringValue(row.process_name),
          cost_idr: toStringValue(row.cost_idr),
          cycle_time_sec: toStringValue(row.cycle_time_sec),
          machine_existing: toStringValue(row.machine_existing),
          machine_new: toStringValue(row.machine_new),
          remark: toStringValue(row.remark),
        })));
        setToolsetAssyRows((bundleToolset?.assy_toolset || []).map((row: any) => ({
          process_name: toStringValue(row.process_name),
          cycle_time_sec: toStringValue(row.cycle_time_sec),
          machine_existing: toStringValue(row.machine_existing),
          machine_new: toStringValue(row.machine_new),
          remark: toStringValue(row.remark),
        })));
        setToolsetToolingRows((bundleToolset?.tooling_breakdown || []).map((row: any) => ({
          tooling_category: toStringValue(row.tooling_category),
          cost_idr: toStringValue(row.cost_idr),
          opm_total_dep: toStringValue(row.opm_total_dep),
          remark: toStringValue(row.remark),
        })));
        setToolsetPackagingRows((bundleToolset?.packaging || []).map((row: any) => ({
          item_name: toStringValue(row.item_name),
          price_idr: toStringValue(row.price_idr),
          qty_per_box: toStringValue(row.qty_per_box),
          cost_per_box_idr: toStringValue(row.cost_per_box_idr),
          remark: toStringValue(row.remark),
        })));
        setToolsetPurchaseEquipmentPlanRows((bundleToolset?.purchase_equipment_plan || []).map((row: any) => ({
          item_type: toStringValue(row.item_type),
          specification: toStringValue(row.specification),
          dia: row.dia ?? '',
          target_date: toStringValue(row.target_date),
          remark: toStringValue(row.remark),
        })));
      } else if (pfsType === 'jack') {
        const bundleJack = await getPFSTemplateJackBundle(rfqId, pfsType).catch(() => null);
        setJackRawMaterialRows(bundleJack?.raw_material || []);
        setJackComponentPurchaseRows(bundleJack?.component_purchase || []);
        setJackProcessStandardRows(bundleJack?.process_standard || []);
        setJackAssemblingRows(bundleJack?.assembling || []);
        setJackPackingDeliveryRows(bundleJack?.packing_delivery || []);
        setJackDiesJigRows(bundleJack?.dies_jig || []);
        setJackDevelopmentCostRows(bundleJack?.development_cost || []);

        setToolsetTechSpecRows([]);
        setToolsetProcessEquipmentRows([]);
        setToolsetSubcontRows([]);
        setToolsetAssyRows([]);
        setToolsetToolingRows([]);
        setToolsetPackagingRows([]);
        setToolsetPurchaseEquipmentPlanRows([]);
        setAutoToolsetSummary({ total_tooling_cost: '', total_packaging_cost: '', total_equipment_investment: '', grand_total: '' });
      } else {
        setJackRawMaterialRows([]);
        setJackComponentPurchaseRows([]);
        setJackProcessStandardRows([]);
        setJackAssemblingRows([]);
        setJackPackingDeliveryRows([]);
        setJackDiesJigRows([]);
        setJackDevelopmentCostRows([]);

        setToolsetTechSpecRows([]);
        setToolsetProcessEquipmentRows([]);
        setToolsetSubcontRows([]);
        setToolsetAssyRows([]);
        setToolsetToolingRows([]);
        setToolsetPackagingRows([]);
        setToolsetPurchaseEquipmentPlanRows([]);
        setAutoToolsetSummary({ total_tooling_cost: '', total_packaging_cost: '', total_equipment_investment: '', grand_total: '' });
      }

      setDrawings(await getPFSDrawings(rfqId, pfsType).catch(() => []));
      setOutHouseAttachments(await getPFSOutHouseAttachments(rfqId, pfsType).catch(() => []));
    } catch (err: any) {
      setError(toErrorMessage(err, 'Gagal memuat data PFS'));
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeFrame = async (rfqId: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/rfqs/${rfqId}/pfs/timeframe`, { withCredentials: true });
      setTimeline(res.data?.data || []);
    } catch (err: any) {
      setError(toErrorMessage(err, 'Gagal memuat timeline'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDrawing = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedDrawingFile(file);
  };

  const saveDrawing = async () => {
    if (!selectedRFQId || !selectedDrawingFile) return;
    try {
      setLoading(true);
      setUploadingDrawing(true);
      setError('');
      await uploadPFSDrawing(selectedRFQId, selectedDrawingFile, pfsType);
      setDrawings(await getPFSDrawings(selectedRFQId, pfsType));
      setSelectedDrawingFile(null);
      setMessage('Drawing berhasil disimpan');
    } catch (err: any) {
      setError(toErrorMessage(err, 'Gagal menyimpan drawing'));
    } finally {
      setLoading(false);
      setUploadingDrawing(false);
    }
  };

  const handleSelectOutHouseAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedOutHouseFile(null);
      return;
    }

    if (!isAllowedOutHouseAttachmentFile(file.name)) {
      setError('File Out House Purchasing harus bertipe .xls, .xlsx, .doc, atau .docx');
      setSelectedOutHouseFile(null);
      return;
    }

    setError('');
    setSelectedOutHouseFile(file);
    void saveOutHouseAttachment(file);
  };

    const saveOutHouseAttachment = async (forcedFile?: File | null) => {
    if (!selectedRFQId) return;
    const fileToUpload = forcedFile || selectedOutHouseFile;
    if (!canCrudPFS) {
      setError('Mode Prepared untuk role engineering yang dapat membuat atau mengubah PFS');
      return;
    }
    if (!isRFQApproved) {
      setError('Create PFS hanya bisa jika status RFQ sudah approved');
      return;
    }
    if (!fileToUpload) {
      setError('Pilih file Out House Purchasing terlebih dahulu');
      return;
    }
    if (!isAllowedOutHouseAttachmentFile(fileToUpload.name)) {
      setError('File Out House Purchasing harus bertipe .xls, .xlsx, .doc, atau .docx');
      return;
    }

    setUploadingOutHouseAttachment(true);
    setError('');
    setMessage('');
    try {
      await uploadPFSOutHouseAttachment(selectedRFQId, fileToUpload, pfsType);
      const files = await getPFSOutHouseAttachments(selectedRFQId, pfsType);
      setOutHouseAttachments(files);
      setSelectedOutHouseFile(null);
      setMessage('Lampiran Out House Purchasing berhasil disimpan');
    } catch (err: any) {
      setError(toErrorMessage(err, 'Gagal simpan lampiran Out House Purchasing'));
    } finally {
      setUploadingOutHouseAttachment(false);
    }
  };

  const handleDeleteOutHouseAttachment = async (fileId: number) => {
    if (!selectedRFQId || !confirm('Yakin ingin menghapus lampiran Out House Purchasing ini?')) return;
    try {
      await deletePFSOutHouseAttachment(selectedRFQId, fileId, pfsType);
      const files = await getPFSOutHouseAttachments(selectedRFQId, pfsType);
      setOutHouseAttachments(files);
    } catch (err: any) {
      setError(toErrorMessage(err, 'Gagal hapus lampiran Out House Purchasing'));
    }
  };

  const handleDeleteDrawing = async (fileId: number) => {
    if (!selectedRFQId || !confirm('Yakin ingin menghapus drawing ini?')) return;
    try {
      await deletePFSDrawing(selectedRFQId, fileId, pfsType);
      const d = await getPFSDrawings(selectedRFQId, pfsType);
      setDrawings(d);
    } catch (err: any) {
      setError(toErrorMessage(err, 'Gagal hapus drawing'));
    }
  };

  useEffect(() => {
    fetchRFQs().catch(() => {
      setError('Gagal memuat daftar RFQ');
      setRfqOptions([]);
    });
    getMasterForgingProcesses().then(setMasterForgingProcesses).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paramRFQId > 0 && paramRFQId !== selectedRFQId) {
      setSelectedRFQId(paramRFQId);
    }
  }, [paramRFQId, selectedRFQId]);

  useEffect(() => {
    if (paramRFQId <= 0) return;

    const selected = rfqOptions.find((row) => row.id === paramRFQId);
    if (!selected) return;

    const sp = new URLSearchParams(location.search || '');
    const currentNo = (sp.get('rfq_no') || '').trim();
    const currentTab = parseTabKey(sp.get('tab'));
    if (currentNo === selected.rfq_no && currentTab === activeTab) return;

    goToPFS(paramRFQId, selected.rfq_no, true, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramRFQId, rfqOptions, activeTab, location.search]);

  useEffect(() => {
    if (!selectedRFQId) return;
    void loadSelectedRFQData(selectedRFQId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRFQId, pfsType]);

  const saveOverview = async () => {
    if (!selectedRFQId) return;
    if (!canCrudPFS) {
      setError('Mode Prepared untuk role engineering yang dapat membuat atau mengubah PFS');
      return;
    }
    if (!isRFQApproved) {
      setError('Create PFS hanya bisa jika status RFQ sudah approved');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await upsertPFSOverview(selectedRFQId, {
        rej_fg: parseNumberOrNull(toInputValue(overview.rej_fg)),
        rej_mc: parseNumberOrNull(toInputValue(overview.rej_mc)),
        eff_fg: parseNumberOrNull(toInputValue(overview.eff_fg)),
        eff_mc: parseNumberOrNull(toInputValue(overview.eff_mc)),
        line_fg: String(newProduct.line || '').trim() || null,
        line_mc: String(similarProduct.line || '').trim() || null,
      }, pfsType);

      if (pfsType === 'jack') {
        await upsertPFSTemplateJackBundle(
          selectedRFQId,
          buildTemplateJackPayload({
            newProduct,
            similarProduct,
            overview,
            technicalSpec,
            processPlan,
            rawMaterialRows: jackRawMaterialRows,
            componentPurchaseRows: jackComponentPurchaseRows,
            processStandardRows: jackProcessStandardRows,
            assemblingRows: jackAssemblingRows,
            packingDeliveryRows: jackPackingDeliveryRows,
            diesJigRows: jackDiesJigRows,
            developmentCostRows: jackDevelopmentCostRows,
            processEquipment,
            investments,
            investmentSummary,
            timeline,
            jackRawMaterialTotal,
          }),
          pfsType
        );
      } else if (pfsType === 'toolset') {
        await upsertPFSTemplateToolsetBundle(
          selectedRFQId,
          buildTemplateToolsetPayload({
            newProduct,
            similarProduct,
            overview,
            toolsetTechSpecRows,
            toolsetProcessEquipmentRows,
            toolsetSubcontRows,
            toolsetAssyRows,
            toolsetToolingRows,
            toolsetPackagingRows,
            toolsetPurchaseEquipmentPlanRows,
            toolsetSummary: autoToolsetSummary,
          }),
          pfsType
        );
      }

      setMessage(`Overview ${pfsType} template berhasil disimpan`);
      await fetchBundle(selectedRFQId);
    } catch (e) {
      setError(toErrorMessage(e, 'Gagal menyimpan overview'));
    } finally {
      setSaving(false);
    }
  };

  const saveEstimation = async () => {
    if (!selectedRFQId) return;
    if (!canCrudPFS) {
      setError('Mode Prepared untuk role engineering yang dapat membuat atau mengubah PFS');
      return;
    }
    if (!isRFQApproved) {
      setError('Create PFS hanya bisa jika status RFQ sudah approved');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await upsertPFSTechnicalSpec(selectedRFQId, {
        prod_w: parseNumberOrNull(toInputValue(technicalSpec.prod_w)),
        rm_w: parseNumberOrNull(toInputValue(technicalSpec.rm_w)),
        mat_grade: String(technicalSpec.mat_grade || '').trim() || null,
        dia: parseNumberOrNull(toInputValue(technicalSpec.dia)),
        length_mm: parseNumberOrNull(toInputValue(technicalSpec.length_mm)),
        yield_pct: parseNumberOrNull(toInputValue(technicalSpec.yield_pct)),
        cut_qty: parseIntOrNull(toInputValue(technicalSpec.cut_qty)),
        rm_plus_rem: parseNumberOrNull(toInputValue(technicalSpec.rm_plus_rem)),
        remark: String(technicalSpec.remark || '').trim() || null,
      }, pfsType);

      await replacePFSProcessPlan(
        selectedRFQId,
        processPlan.map((item) => ({
          item_type: item.item_type === 'die' ? 'die' : 'rm',
          mat_grade: String(item.mat_grade || '').trim() || null,
          dia: parseNumberOrNull(toInputValue(item.dia)),
          target_date: parseDate(toInputValue(item.target_date)),
          remark: String(item.remark || '').trim() || null,
        })),
        pfsType
      );

      await replacePFSProcessEquipment(
        selectedRFQId,
        processEquipment.map((item) => ({
          process_name: String(item.process_name || '').trim() || null,
          cycle_time: parseNumberOrNull(toInputValue(item.cycle_time)),
          machine_existing: String(item.machine_existing || '').trim() || null,
          machine_new: String(item.machine_new || '').trim() || null,
          dies_price_pcs: parseNumberOrNull(toInputValue(item.dies_price_pcs)),
          load_cap_old: parseNumberOrNull(toInputValue(item.load_cap_old)),
          load_cap_invest: parseNumberOrNull(toInputValue(item.load_cap_invest)),
          load_cap_new: parseNumberOrNull(toInputValue(item.load_cap_new)),
          load_cap_total: parseNumberOrNull(toInputValue(item.load_cap_total)),
          remark: String(item.remark || '').trim() || null,
        })),
        pfsType
      );

      const normalizedInvestments: PFSInvestmentItem[] = investments.map((item) => ({
        inv_type: item.inv_type === 'other' ? ('other' as const) : ('support' as const),
        machine: String(item.machine || '').trim() || null,
        qty: parseIntOrNull(toInputValue(item.qty)),
        qty_pack: parseIntOrNull(toInputValue(item.qty_pack)),
        unit_price: parseNumberOrNull(toInputValue(item.unit_price)),
        total_inv: parseNumberOrNull(toInputValue(item.total_inv)),
        depr_year: parseIntOrNull(toInputValue(item.depr_year)),
        power_kwh: parseNumberOrNull(toInputValue(item.power_kwh)),
        area_m2: parseNumberOrNull(toInputValue(item.area_m2)),
        manpower: parseIntOrNull(toInputValue(item.manpower)),
        sim_line: String(item.sim_line || '').trim() || null,
      }));

      await replacePFSInvestments(selectedRFQId, normalizedInvestments, pfsType);

      const supportTotal = normalizedInvestments
        .filter((item) => item.inv_type === 'support')
        .reduce((sum, item) => sum + Number(item.total_inv || 0), 0);
      const otherTotal = normalizedInvestments
        .filter((item) => item.inv_type === 'other')
        .reduce((sum, item) => sum + Number(item.total_inv || 0), 0);
      const grandTotal = supportTotal + otherTotal;

      await upsertPFSInvestmentSummary(selectedRFQId, {
        tot_support:
          parseNumberOrNull(toInputValue(investmentSummary.tot_support)) ?? supportTotal,
        tot_other: parseNumberOrNull(toInputValue(investmentSummary.tot_other)) ?? otherTotal,
        grand_total: parseNumberOrNull(toInputValue(investmentSummary.grand_total)) ?? grandTotal,
      }, pfsType);

      if (pfsType === 'jack') {
        await upsertPFSTemplateJackBundle(
          selectedRFQId,
          buildTemplateJackPayload({
            newProduct,
            similarProduct,
            overview,
            technicalSpec,
            processPlan,
            rawMaterialRows: jackRawMaterialRows,
            componentPurchaseRows: jackComponentPurchaseRows,
            processStandardRows: jackProcessStandardRows,
            assemblingRows: jackAssemblingRows,
            packingDeliveryRows: jackPackingDeliveryRows,
            diesJigRows: jackDiesJigRows,
            developmentCostRows: jackDevelopmentCostRows,
            processEquipment,
            investments: normalizedInvestments,
            investmentSummary: {
              ...investmentSummary,
              tot_support:
                parseNumberOrNull(toInputValue(investmentSummary.tot_support)) ?? supportTotal,
              tot_other: parseNumberOrNull(toInputValue(investmentSummary.tot_other)) ?? otherTotal,
              grand_total: parseNumberOrNull(toInputValue(investmentSummary.grand_total)) ?? grandTotal,
            },
            timeline,
            jackRawMaterialTotal,
          }),
          pfsType
        );
      } else if (pfsType === 'toolset') {
        await upsertPFSTemplateToolsetBundle(
          selectedRFQId,
          buildTemplateToolsetPayload({
            newProduct,
            similarProduct,
            overview,
            toolsetTechSpecRows,
            toolsetProcessEquipmentRows,
            toolsetSubcontRows,
            toolsetAssyRows,
            toolsetToolingRows,
            toolsetPackagingRows,
            toolsetPurchaseEquipmentPlanRows,
            toolsetSummary: autoToolsetSummary,
          }),
          pfsType
        );
      }

      setMessage(`Estimation Process Plan ${pfsType} template berhasil disimpan`);
      await fetchBundle(selectedRFQId);
    } catch (e) {
      setError(toErrorMessage(e, 'Gagal menyimpan Estimation Process Plan'));
    } finally {
      setSaving(false);
    }
  };

  const moveActivity = async () => {
    if (!selectedRFQId) return;
    if (!canApprovePFS) {
      setError('Mode Approve untuk role engineering yang dapat approve PFS');
      return;
    }
    if (!isRFQApproved) {
      setError('Create PFS hanya bisa jika status RFQ sudah approved');
      return;
    }
    if (!moveCode.trim()) {
      setError('Status Activity wajib dipilih');
      return;
    }
    if (pfsType === 'jack') {
      if (!moveTargetDate.trim()) {
        setError('Target Tanggal wajib diisi untuk approval Jack');
        return;
      }
      if (!moveRemarks.trim()) {
        setError('Remark wajib diisi untuk approval Jack');
        return;
      }

      const hasRawMaterial = jackRawMaterialRows.some((row) =>
        hasFilledText(row.part_name) &&
        hasFilledText(row.material) &&
        hasFilledText(row.qty_unit) &&
        hasFilledText(row.qty_pcs) &&
        hasFilledText(row.weight_unit_kg)
      );
      if (!hasRawMaterial) {
        setError('Jack approval membutuhkan Raw Material yang terisi lengkap');
        return;
      }

      const hasProcessStandard = jackProcessStandardRows.some((row) =>
        hasFilledText(row.process_name) &&
        hasFilledText(row.line_name) &&
        hasFilledText(row.manpower) &&
        hasFilledText(row.cycle_time_sec)
      );
      if (!hasProcessStandard) {
        setError('Jack approval membutuhkan Process Standard yang terisi lengkap');
        return;
      }

      const hasComponentPurchase = jackComponentPurchaseRows.some((row) =>
        hasFilledText(row.part_name) &&
        hasFilledText(row.qty_unit) &&
        hasFilledText(row.cost_rate) &&
        hasFilledText(row.price_idr)
      );
      if (!hasComponentPurchase) {
        setError('Jack approval membutuhkan Component Purchase yang terisi lengkap');
        return;
      }
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.put(
        `/rfqs/${selectedRFQId}/pfs/timeframe?type=${encodeURIComponent(pfsType)}`,
        {
          statusactivity: moveCode.trim(),
          target_date: moveTargetDate || null,
          remarks: moveRemarks || '',
        },
        { withCredentials: true }
      );
      setMessage('Time Frame berhasil disimpan');
      setMoveRemarks('');
      await Promise.all([fetchTimeFrame(selectedRFQId), fetchRFQs()]);
    } catch (e) {
      setError(toErrorMessage(e, 'Gagal menyimpan Time Frame'));
    } finally {
      setSaving(false);
    }
  };

  const addProcessPlanRow = () => {
    setProcessPlan((prev) => [
      ...prev,
      { item_type: '', mat_grade: '', dia: null, target_date: '', remark: '' },
    ]);
  };

  const updateProcessPlanRow = <K extends keyof PFSProcessPlanItem>(
    index: number,
    field: K,
    value: PFSProcessPlanItem[K]
  ) => {
    setProcessPlan((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addProcessEquipmentRow = () => {
    setProcessEquipment((prev) => [
      ...prev,
      {
        process_name: null,
        cycle_time: null,
        machine_existing: null,
        machine_new: null,
        dies_price_pcs: null,
        load_cap_old: null,
        load_cap_invest: null,
        load_cap_new: null,
        load_cap_total: null,
        remark: null,
      },
    ]);
  };

  const updateProcessEquipmentRow = <K extends keyof PFSProcessEquipmentItem>(
    index: number,
    field: K,
    value: PFSProcessEquipmentItem[K]
  ) => {
    setProcessEquipment((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, [field]: value } : row));
      const current = next[index];
      if (!current) return next;

      if (field === 'load_cap_old' || field === 'load_cap_invest' || field === 'load_cap_new') {
        const oldC = Number(current.load_cap_old || 0);
        const invC = Number(current.load_cap_invest || 0);
        const newC = Number(current.load_cap_new || 0);
        next[index] = { ...current, load_cap_total: oldC + invC + newC };
      }
      return next;
    });
  };

  const addJackRawMaterialRow = () => {
    setJackRawMaterialRows((prev) => [...prev, emptyJackRawMaterialRow()]);
  };

  // const updateJackRawMaterialRow = <K extends keyof JackRawMaterialRow>(
  //   index: number,
  //   field: K,
  //   value: JackRawMaterialRow[K]
  // ) => {
  //   setJackRawMaterialRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  // };
  const updateJackRawMaterialRow = <K extends keyof JackRawMaterialRow>(
    index: number,
    field: K,
    value: JackRawMaterialRow[K]
  ) => {
    setJackRawMaterialRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };

        // Kalkulasi otomatis wt/unit (kg) jika field dimensi atau qty berubah
        if (['part_name', 'size_t_mm', 'size_l_mm', 'size_w_mm', 'qty_unit', 'qty_pcs'].includes(field as string)) {
          const t = parseNumberOrNull(updated.size_t_mm);
          const l = parseNumberOrNull(updated.size_l_mm) ?? 0;
          const w = parseNumberOrNull(updated.size_w_mm) ?? 0;
          const qUnit = parseNumberOrNull(updated.qty_unit) ?? 0;
          const qPcs = parseNumberOrNull(updated.qty_pcs) ?? 1;

          // Jika t kosong (karena user mengetik "Dia =" atau dibiarkan kosong), 
          // maka gunakan L sebagai diameter untuk perhitungan silinder (L * L * W)
          const effectiveT = t !== null ? t : l;

          // Deteksi apakah ini Screw Shaft
          const partNameLower = String(updated.part_name || '').toLowerCase();
          const isScrewShaft = partNameLower.includes('screw') || partNameLower.includes('shaft');

          let wt = 0;
          if (isScrewShaft) {
            // Rumus Screw Shaft: tidak dibagi qty_pcs dan konstanta 0.0000061625
            wt = effectiveT * l * w * 0.0000061625 * qUnit;
          } else {
            // Rumus Part Biasa: dibagi qty_pcs dan konstanta 0.00000785
            wt = (effectiveT * l * w * 0.00000785 * qUnit) / (qPcs === 0 ? 1 : qPcs);
          }

          // Dibulatkan ke 3 angka di belakang koma sesuai di gambar (contoh: 0.244)
          if (wt > 0) {
            updated.weight_unit_kg = String(Math.round(wt * 1000) / 1000);
          } else {
            updated.weight_unit_kg = '';
          }
        }

        return updated;
      })
    );
  };

  const deleteJackRawMaterialRow = (index: number) => {
    setJackRawMaterialRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addJackComponentPurchaseRow = () => {
    setJackComponentPurchaseRows((prev) => [...prev, emptyJackComponentPurchaseRow()]);
  };

  const updateJackComponentPurchaseRow = <K extends keyof JackComponentPurchaseRow>(
    index: number,
    field: K,
    value: JackComponentPurchaseRow[K]
  ) => {
    setJackComponentPurchaseRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const deleteJackComponentPurchaseRow = (index: number) => {
    setJackComponentPurchaseRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addJackProcessStandardRow = () => {
    setJackProcessStandardRows((prev) => [...prev, emptyJackProcessStandardRow()]);
  };

  const updateJackProcessStandardRow = <K extends keyof JackProcessStandardRow>(
    index: number,
    field: K,
    value: JackProcessStandardRow[K]
  ) => {
    setJackProcessStandardRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const deleteJackProcessStandardRow = (index: number) => {
    setJackProcessStandardRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addJackAssemblingRow = () => {
    setJackAssemblingRows((prev) => [...prev, emptyJackAssemblingRow()]);
  };

  const updateJackAssemblingRow = <K extends keyof JackAssemblingRow>(
    index: number,
    field: K,
    value: JackAssemblingRow[K]
  ) => {
    setJackAssemblingRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };

      // Logic Matematika: Cost = cycle_time_sec * rate
      if (field === 'cycle_time_sec' || field === 'rate') {
        const ct = parseNumberOrNull(updated.cycle_time_sec);
        const rate = parseNumberOrNull(updated.rate);
        if (ct !== null && rate !== null) {
          // Dibulatkan 2 desimal jika perlu, atau hapus pembulatan jika ingin angka mutlak
          updated.cost_idr = String(Math.round(ct * rate * 100) / 100);
        } else {
          updated.cost_idr = '';
        }
      }
      return updated;
    }));
  };

  const deleteJackAssemblingRow = (index: number) => {
    setJackAssemblingRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addJackPackingDeliveryRow = () => {
    setJackPackingDeliveryRows((prev) => [...prev, emptyJackPackingDeliveryRow()]);
  };

  const updateJackPackingDeliveryRow = <K extends keyof JackPackingDeliveryRow>(
    index: number,
    field: K,
    value: JackPackingDeliveryRow[K]
  ) => {
    setJackPackingDeliveryRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };
        // Auto-calculate cost_pcs = price * qty_box
        if (field === 'price' || field === 'qty_box') {
          const price = parseNumberOrNull(field === 'price' ? String(value) : updated.price);
          const qtyBox = parseNumberOrNull(field === 'qty_box' ? String(value) : updated.qty_box);
          if (price !== null && qtyBox !== null && qtyBox > 0) {
            updated.cost_pcs = String(Math.round((price / qtyBox) * 100) / 100);
          } else {
            updated.cost_pcs = '';
          }
        }
        return updated;
      })
    );
  };

  const deleteJackPackingDeliveryRow = (index: number) => {
    setJackPackingDeliveryRows((prev) => prev.filter((_, i) => i !== index));
  };

  const jackPackingDeliveryTotal = useMemo(() => {
    return jackPackingDeliveryRows.reduce((sum, row) => {
      const val = parseNumberOrNull(row.cost_pcs);
      return sum + (val ?? 0);
    }, 0);
  }, [jackPackingDeliveryRows]);

  const addJackDiesJigRow = () => {
    setJackDiesJigRows((prev) => [...prev, emptyJackDiesJigRow()]);
  };

  const updateJackDiesJigRow = <K extends keyof JackDiesJigRow>(
    index: number,
    field: K,
    value: JackDiesJigRow[K]
  ) => {
    setJackDiesJigRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };
        // Auto-calculate cost_per_pcs based on formula_type
        if (field === 'value_a' || field === 'stroke_b' || field === 'value_c' || field === 'stroke_d' || field === 'formula_type') {
          const a = parseNumberOrNull(updated.value_a);
          const b = parseNumberOrNull(updated.stroke_b);
          const c = parseNumberOrNull(updated.value_c);
          const d = parseNumberOrNull(updated.stroke_d);
          const fType = updated.formula_type || 'formula_a';
          let costPcs = 0;

          if (fType === 'formula_a') {
            if (a !== null && b !== null && b > 0) costPcs = (a / b) + (0.05 * (a / b));
          } else if (fType === 'formula_b') {
            if (c !== null && d !== null && d > 0) costPcs = (c / d) + (c / d);
          }

          updated.cost_per_pcs = costPcs > 0 ? String(Math.round(costPcs * 100) / 100) : '';
        }
        return updated;
      })
    );
  };

  const deleteJackDiesJigRow = (index: number) => {
    setJackDiesJigRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addJackDevelopmentCostRow = () => {
    setJackDevelopmentCostRows((prev) => [...prev, emptyJackDevelopmentCostRow()]);
  };

  const updateJackDevelopmentCostRow = <K extends keyof JackDevelopmentCostRow>(
    index: number,
    field: K,
    value: JackDevelopmentCostRow[K]
  ) => {
    setJackDevelopmentCostRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const deleteJackDevelopmentCostRow = (index: number) => {
    setJackDevelopmentCostRows((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Totals for all Jack sections ───────────────────────
  const jackRawMaterialTotal = useMemo(() => {
    return jackRawMaterialRows.reduce((sum, row) => {
      const val = parseNumberOrNull(row.weight_unit_kg) ?? 0;
      // Jika part_name mengandung 'Screw Shaft', tidak dijumlahkan ke dalam total 
      if (row.part_name?.toLowerCase().includes('screw shaft') || row.material?.toLowerCase().includes('screw shaft')) {
        return sum; // Exclude entirely
      }
      return sum + val;
    }, 0);
  }, [jackRawMaterialRows]);

  const jackComponentPurchaseTotal = useMemo(() => {
    return jackComponentPurchaseRows.reduce((sum, row) => {
      const price_idr = parseNumberOrNull(row.price_idr) ?? 0;
      // Perhitungan akhir menggunakan total dari price_idr per row (di mana price_idr = qty_unit * cost_rate)
      return sum + price_idr;
    }, 0);
  }, [jackComponentPurchaseRows]);

  const jackDiesJigTotal = useMemo(() => {
    return jackDiesJigRows.reduce((sum, row) => {
      const val = parseNumberOrNull(row.cost_per_pcs);
      return sum + (val ?? 0);
    }, 0);
  }, [jackDiesJigRows]);

  const jackAssemblingTotal = useMemo(() => {
    return jackAssemblingRows.reduce((sum, row) => {
      const val = parseNumberOrNull(row.cost_idr);
      return sum + (val ?? 0);
    }, 0);
  }, [jackAssemblingRows]);

  const jackDevelopmentCostTotal = useMemo(() => {
    // 1. Jumlahkan semua amount_idr terlebih dahulu
    const totalAmount = jackDevelopmentCostRows.reduce((sum, row) => {
      const val = parseNumberOrNull(row.amount_idr);
      return sum + (val ?? 0);
    }, 0);

    // 2. Logic Matematika: Total = SUM(amount_idr) / (1800 * 24)
    // 1800 * 24 = 43200
    const finalTotal = totalAmount / 43200;

    // 3. Bulatkan ke 2 angka di belakang koma
    return Math.round(finalTotal * 100) / 100;
  }, [jackDevelopmentCostRows]);

  const addToolsetSubcontRow = () => {
    setToolsetSubcontRows((prev) => [...prev, emptyToolsetSubcontRow()]);
  };

  const addToolsetTechSpecRow = () => {
    setToolsetTechSpecRows((prev) => [...prev, emptyToolsetTechSpecRow()]);
  };

  const updateToolsetTechSpecRow = <K extends keyof ToolsetTechSpecRow>(
    index: number,
    field: K,
    value: ToolsetTechSpecRow[K]
  ) => {
    setToolsetTechSpecRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const deleteToolsetTechSpecRow = (index: number) => {
    setToolsetTechSpecRows((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleToolsetTechSpecDetail = (index: number) => {
    setToolsetTechSpecRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const isOpen = !row.isDetailOpen;
        return {
          ...row,
          isDetailOpen: isOpen,
          detail: isOpen && !row.detail ? emptyToolsetTechSpecDetailRow() : row.detail,
        };
      })
    );
  };

  const updateToolsetTechSpecDetail = <K extends keyof ToolsetTechSpecDetailRow>(
    index: number,
    field: K,
    value: ToolsetTechSpecDetailRow[K]
  ) => {
    setToolsetTechSpecRows((prev) =>
      prev.map((row, i) => {
        if (i !== index || !row.detail) return row;

        const updatedDetail = { ...row.detail, [field]: value };

        // Auto-calculate mass_kg on diameter_mm or length_mm change
        if (['diameter_mm', 'length_mm'].includes(field as string)) {
          const dia = parseNumberOrNull(updatedDetail.diameter_mm);
          const len = parseNumberOrNull(updatedDetail.length_mm);
          if (dia !== null && len !== null) {
            const mass = dia * dia * len * 0.0000061625;
            updatedDetail.mass_kg = String(Math.round(mass * 1000) / 1000); // 3 decimal places
          } else {
            updatedDetail.mass_kg = '';
          }
        }

        // Auto-calculate finish costs when mass_kg or material_cost changes
        if (['diameter_mm', 'length_mm', 'mass_kg', 'material_cost_rp_kg_1', 'material_cost_rp_kg_2'].includes(field as string)) {
          const massKg = parseNumberOrNull(updatedDetail.mass_kg);

          if (massKg !== null) {
            const costRp1 = parseNumberOrNull(updatedDetail.material_cost_rp_kg_1);
            if (costRp1 !== null) {
              updatedDetail.cost_finish_rp_kg_1 = String(Math.round(massKg * costRp1 * 1000) / 1000); // 3 decimal places
            } else {
              updatedDetail.cost_finish_rp_kg_1 = '';
            }

            const costRp2 = parseNumberOrNull(updatedDetail.material_cost_rp_kg_2);
            if (costRp2 !== null) {
              updatedDetail.cost_finish_rp_kg_2 = String(Math.round(massKg * costRp2 * 1000) / 1000); // 3 decimal places
            } else {
              updatedDetail.cost_finish_rp_kg_2 = '';
            }
          } else {
            updatedDetail.cost_finish_rp_kg_1 = '';
            updatedDetail.cost_finish_rp_kg_2 = '';
          }
        }

        return { ...row, detail: updatedDetail };
      })
    );
  };

  const addToolsetProcessEquipmentRow = () => {
    setToolsetProcessEquipmentRows((prev) => [...prev, emptyToolsetProcessEquipmentRow()]);
  };

  const updateToolsetProcessEquipmentRow = <K extends keyof ToolsetProcessEquipmentRow>(
    index: number,
    field: K,
    value: ToolsetProcessEquipmentRow[K]
  ) => {
    setToolsetProcessEquipmentRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const deleteToolsetProcessEquipmentRow = (index: number) => {
    setToolsetProcessEquipmentRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateToolsetSubcontRow = <K extends keyof ToolsetSubcontRow>(
    index: number,
    field: K,
    value: ToolsetSubcontRow[K]
  ) => {
    setToolsetSubcontRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const deleteToolsetSubcontRow = (index: number) => {
    setToolsetSubcontRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addToolsetAssyRow = () => {
    setToolsetAssyRows((prev) => [...prev, emptyToolsetAssyRow()]);
  };

  const updateToolsetAssyRow = <K extends keyof ToolsetAssyRow>(
    index: number,
    field: K,
    value: ToolsetAssyRow[K]
  ) => {
    setToolsetAssyRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const deleteToolsetAssyRow = (index: number) => {
    setToolsetAssyRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Toolset equipment plan handlers removed

  const addToolsetToolingRow = () => {
    setToolsetToolingRows((prev) => [...prev, emptyToolsetToolingRow()]);
  };

  const updateToolsetToolingRow = <K extends keyof ToolsetToolingRow>(
    index: number,
    field: K,
    value: ToolsetToolingRow[K]
  ) => {
    setToolsetToolingRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const deleteToolsetToolingRow = (index: number) => {
    setToolsetToolingRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addToolsetPackagingRow = () => {
    setToolsetPackagingRows((prev) => [...prev, emptyToolsetPackagingRow()]);
  };

  const updateToolsetPackagingRow = <K extends keyof ToolsetPackagingRow>(
    index: number,
    field: K,
    value: ToolsetPackagingRow[K]
  ) => {
    setToolsetPackagingRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const deleteToolsetPackagingRow = (index: number) => {
    setToolsetPackagingRows((prev) => prev.filter((_, i) => i !== index));
  };
  const addToolsetPurchaseEquipmentPlanRow = () => {
    setToolsetPurchaseEquipmentPlanRows((prev) => [
      ...prev,
      { item_type: '', specification: '', dia: null, target_date: '', remark: '' },
    ]);
  };

  const updateToolsetPurchaseEquipmentPlanRow = <K extends keyof PFSProcessPlanItem>(
    index: number,
    field: K,
    value: PFSProcessPlanItem[K]
  ) => {
    setToolsetPurchaseEquipmentPlanRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const deleteToolsetPurchaseEquipmentPlanRow = (index: number) => {
    setToolsetPurchaseEquipmentPlanRows((prev) => prev.filter((_, i) => i !== index));
  };
  //

  const addInvestmentRow = () => {
    setInvestments((prev) => [
      ...prev,
      {
        inv_type: 'support',
        machine: null,
        qty: null,
        qty_pack: null,
        unit_price: null,
        total_inv: null,
        depr_year: null,
        power_kwh: null,
        area_m2: null,
        manpower: null,
        sim_line: null,
      },
    ]);
  };

  const recalcInvestmentSummary = (rows: PFSInvestmentItem[]) => {
    const totSupport = rows
      .filter((r) => r.inv_type === 'support')
      .reduce((sum, r) => sum + Number(r.total_inv || 0), 0);
    const totOther = rows
      .filter((r) => r.inv_type === 'other')
      .reduce((sum, r) => sum + Number(r.total_inv || 0), 0);
    setInvestmentSummary((prev: any) => ({
      ...prev,
      tot_support: totSupport,
      tot_other: totOther,
      grand_total: totSupport + totOther,
    }));
  };

  const updateInvestmentRow = <K extends keyof PFSInvestmentItem>(
    index: number,
    field: K,
    value: PFSInvestmentItem[K]
  ) => {
    setInvestments((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, [field]: value } : row));
      const current = next[index];
      if (!current) return next;

      if (field === 'qty' || field === 'unit_price') {
        const qty = Number(current.qty || 0);
        const price = Number(current.unit_price || 0);
        next[index] = { ...current, total_inv: qty > 0 && price > 0 ? qty * price : 0 };
      }

      recalcInvestmentSummary(next);
      return next;
    });
  };

  const deleteInvestmentRow = (idx: number) => {
    setInvestments((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      recalcInvestmentSummary(next);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <PfsHeader
        rfqOptions={rfqOptions}
        selectedRFQId={selectedRFQId}
        onSelectRFQ={(id, rfqNo) => goToPFS(id, rfqNo)}
        userLevel={userLevel}
        activeTab={activeTab}
        setActiveTabInUrl={setActiveTabInUrl}
      />

      {selectedRFQNo && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
          RFQ aktif: <span className="font-semibold text-gray-900">{selectedRFQNo}</span>
          <span className="text-gray-400"> • </span>
          Status:
          <span
            className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${isRFQApproved
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700'
              }`}
          >
            {selectedRFQStatus || '-'}
          </span>
          <span className="text-gray-400 mx-1"> • </span>
          Template:
          <span
            className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${pfsType === 'jack'
              ? 'bg-blue-100 text-blue-700'
              : pfsType === 'toolset'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-orange-100 text-orange-700'
              }`}
          >
            {pfsType}
          </span>
        </div>
      )}

      {selectedRFQId != null && selectedRFQId > 0 && !isRFQApproved && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Create PFS hanya bisa dilakukan jika status RFQ sudah <b>approved</b>.
        </div>
      )}

      {selectedRFQId != null && selectedRFQId > 0 && isRFQApproved && selectedRFQCodeAct !== 3 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Approve PFS hanya bisa dilakukan jika <b>code_act RFQ = 3</b>.
        </div>
      )}

      {selectedRFQId != null && selectedRFQId > 0 && !canViewPFS && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Role <b>{user?.role || '-'}</b> tidak memiliki akses ke workflow PFS.
        </div>
      )}

      {selectedRFQId != null && selectedRFQId > 0 && canApprovePFS && !canCrudPFS && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Badge <b>approve</b> untuk role engineering: Anda hanya dapat melakukan approve PFS pada tab <b>Time Frame</b>.
        </div>
      )}

      {selectedRFQId != null && selectedRFQId > 0 && canCrudPFS && !canApprovePFS && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Badge <b>prepared</b> untuk role engineering: Anda dapat CRUD PFS pada tab Overview dan Estimation.
        </div>
      )}

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
      )}

      {!selectedRFQId && !loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Silakan pilih RFQ pada dropdown di atas untuk mulai input PFS.
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Loading data PFS...
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Overview</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Isi overview sesuai produk New dan Similar pada RFQ terpilih.
                  </p>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${pfsType === 'jack'
                  ? 'bg-blue-100 text-blue-700'
                  : pfsType === 'toolset'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-orange-100 text-orange-700'
                  }`}>
                  {pfsType} Template
                </div>
              </div>

              <fieldset disabled={!canCrudPFS} className="space-y-6">
                <section className="rounded-lg border border-gray-200">
                  <div className="rounded-t-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                    New Product
                  </div>
                  <div className="grid gap-4 p-4 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Customer</span>
                      <input
                        value={newProduct.customer}
                        readOnly
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Part Number</span>
                      <input
                        value={newProduct.partNo}
                        readOnly
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Product</span>
                      <input
                        value={newProduct.product}
                        readOnly
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Quantity / Month (pcs)</span>
                      <input
                        value={newProduct.qtyMonth}
                        readOnly
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Rejection Rate (%)</span>
                      <input
                        value={toInputValue(overview.rej_fg)}
                        onChange={(e) =>
                          setOverview((prev: any) => ({ ...prev, rej_fg: parseNumberOrNull(e.target.value) }))
                        }
                        type="number"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Efficiency (%)</span>
                      <input
                        value={toInputValue(overview.eff_fg)}
                        onChange={(e) =>
                          setOverview((prev: any) => ({ ...prev, eff_fg: parseNumberOrNull(e.target.value) }))
                        }
                        type="number"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Line</span>
                      <input
                        value={newProduct.line}
                        onChange={(e) => setNewProduct((prev: any) => ({ ...prev, line: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200">
                  <div className="rounded-t-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                    Similar Product
                  </div>
                  <div className="grid gap-4 p-4 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Customer</span>
                      <input
                        value={similarProduct.customer}
                        readOnly
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Part Number</span>
                      <input
                        value={similarProduct.partNo}
                        readOnly
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Product</span>
                      <input
                        value={similarProduct.product}
                        readOnly
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Quantity / Month</span>
                      <input
                        value={similarProduct.qtyMonth}
                        readOnly
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Rejection Rate (%)</span>
                      <input
                        value={toInputValue(overview.rej_mc)}
                        onChange={(e) =>
                          setOverview((prev: any) => ({ ...prev, rej_mc: parseNumberOrNull(e.target.value) }))
                        }
                        type="number"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Efficiency (%)</span>
                      <input
                        value={toInputValue(overview.eff_mc)}
                        onChange={(e) =>
                          setOverview((prev: any) => ({ ...prev, eff_mc: parseNumberOrNull(e.target.value) }))
                        }
                        type="number"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-700">Line</span>
                      <input
                        value={similarProduct.line}
                        onChange={(e) => setSimilarProduct((prev: any) => ({ ...prev, line: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                  </div>
                </section>
              </fieldset>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={disableCrudSave}
                  onClick={saveOverview}
                  className="rounded-lg bg-[#0D79BD] px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'estimation' && (
            <div className="space-y-5">
              {/* Estimation Forms Go Here */}

              <fieldset disabled={!canCrudPFS} className="space-y-5">
                {pfsType === 'forging' && (
                  <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between">
                      {/* <div>
                        <h2 className="text-base font-semibold text-gray-800">
                          {pfsType === 'jack' ? 'Product Comparison & Base Data' : 'Technical Specification'}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                          {pfsType === 'jack'
                            ? 'Product comparison dengan similar product + raw material base'
                            : 'Data di bagian ini dipakai untuk kalkulasi material dan efisiensi proses.'
                          }
                        </p>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${pfsType === 'jack'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700'
                        }`}>
                        {pfsType} Template
                      </div> */}
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-700">Product Weight</span>
                        <input
                          value={toInputValue(technicalSpec.prod_w)}
                          onChange={(e) => {
                            const newProdW = parseNumberOrNull(e.target.value);
                            setTechnicalSpec((prev: any) => {
                              const yieldPct = prev.yield_pct;
                              let newRmW = prev.rm_w;
                              if (newProdW != null && yieldPct != null && yieldPct > 0) {
                                newRmW = Math.ceil((newProdW / (yieldPct / 100)) * 1000) / 1000;
                              }
                              return { ...prev, prod_w: newProdW, rm_w: newRmW };
                            });
                          }}
                          type="number"
                          step="0.01"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-700">RM Weight</span>
                        <input
                          value={toInputValue(technicalSpec.rm_w)}
                          readOnly
                          type="text"
                          title="Auto-calculated: Product Weight / (Yield% / 100)"
                          className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-700">Material Grade</span>
                        <input
                          value={toInputValue(technicalSpec.mat_grade)}
                          onChange={(e) =>
                            setTechnicalSpec((prev: any) => ({ ...prev, mat_grade: e.target.value }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-700">Dia</span>
                        <input
                          value={toInputValue(technicalSpec.dia)}
                          onChange={(e) =>
                            setTechnicalSpec((prev: any) => ({ ...prev, dia: parseNumberOrNull(e.target.value) }))
                          }
                          type="number"
                          step="0.01"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-700">Length (mm)</span>
                        <input
                          value={toInputValue(technicalSpec.length_mm)}
                          onChange={(e) =>
                            setTechnicalSpec((prev: any) => ({
                              ...prev,
                              length_mm: parseNumberOrNull(e.target.value),
                            }))
                          }
                          type="number"
                          step="0.01"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-700">Yield (%)</span>
                        <input
                          value={toInputValue(technicalSpec.yield_pct)}
                          onChange={(e) => {
                            const newYieldPct = parseNumberOrNull(e.target.value);
                            setTechnicalSpec((prev: any) => {
                              const prodW = prev.prod_w;
                              let newRmW = prev.rm_w;
                              if (prodW != null && newYieldPct != null && newYieldPct > 0) {
                                newRmW = Math.ceil((prodW / (newYieldPct / 100)) * 1000) / 1000;
                              }
                              return { ...prev, yield_pct: newYieldPct, rm_w: newRmW };
                            });
                          }}
                          type="number"
                          step="0.01"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="text-gray-700">Cut Qty</span>
                        <input
                          value={cutQtyInput}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setCutQtyInput(nextValue);
                            const parsed = parseCutQtyWithRM(nextValue);
                            setTechnicalSpec((prev: any) => ({
                              ...prev,
                              cut_qty: parsed.cutQty,
                            }));
                          }}
                          type="text"
                          placeholder="Contoh: 59 / 5800"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </label>
                      {pfsType !== 'jack' && (
                        <label className="space-y-1 text-sm">
                          <span className="text-gray-700">RM + Rem (TEST)</span>
                          <input
                            value={toInputValue(technicalSpec.rm_plus_rem)}
                            onChange={(e) =>
                              setTechnicalSpec((prev: any) => ({
                                ...prev,
                                rm_plus_rem: parseNumberOrNull(e.target.value),
                              }))
                            }
                            type="number"
                            step="0.01"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                          />
                        </label>
                      )}
                    </div>
                    <label className="mt-4 block space-y-1 text-sm">
                      <span className="text-gray-700">Remark</span>
                      <textarea
                        value={toInputValue(technicalSpec.remark)}
                        onChange={(e) => setTechnicalSpec((prev: any) => ({ ...prev, remark: e.target.value }))}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                  </div>
                )}

                {pfsType === 'forging' && (
                  <>
                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Forging: </span>Process & Equipment
                        </h2>
                        <button
                          type="button"
                          onClick={addProcessEquipmentRow}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Standar proses manufaktur dan detail equipment untuk Forging.
                      </p>
                      <div className="space-y-3">
                        {processEquipment.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Process & Equipment. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {processEquipment.map((item, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Process #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => setProcessEquipment((prev) => prev.filter((_, i) => i !== idx))}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Process Name</span>
                                <select
                                  value={toInputValue(item.process_name)}
                                  onChange={(e) =>
                                    updateProcessEquipmentRow(idx, 'process_name', e.target.value)
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
                                >
                                  <option value="">-- Pilih Proses --</option>
                                  {masterForgingProcesses.map((m: any) => (
                                    <option key={m.id} value={m.process_name}>
                                      {m.process_name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Cycle Time</span>
                                <input
                                  value={toInputValue(item.cycle_time)}
                                  onChange={(e) => updateProcessEquipmentRow(idx, 'cycle_time', parseNumberOrNull(e.target.value))}
                                  type="number"
                                  step="0.01"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Existing Machine</span>
                                <input
                                  value={toInputValue(item.machine_existing)}
                                  onChange={(e) => updateProcessEquipmentRow(idx, 'machine_existing', e.target.value)}
                                  type="text"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Machine New</span>
                                <input
                                  value={toInputValue(item.machine_new)}
                                  onChange={(e) => updateProcessEquipmentRow(idx, 'machine_new', e.target.value)}
                                  type="text"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Dies Price</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={toInputValue(item.dies_price_pcs)}
                                  onChange={(e) =>
                                    updateProcessEquipmentRow(idx, 'dies_price_pcs', parseNumberOrNull(e.target.value))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Load vs Cap (Old)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={toInputValue(item.load_cap_old)}
                                  onChange={(e) =>
                                    updateProcessEquipmentRow(idx, 'load_cap_old', parseNumberOrNull(e.target.value))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Load vs Cap (Invest)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={toInputValue(item.load_cap_invest)}
                                  onChange={(e) =>
                                    updateProcessEquipmentRow(idx, 'load_cap_invest', parseNumberOrNull(e.target.value))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Load vs Cap (New)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={toInputValue(item.load_cap_new)}
                                  onChange={(e) =>
                                    updateProcessEquipmentRow(idx, 'load_cap_new', parseNumberOrNull(e.target.value))
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Load vs Cap (Total)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={toInputValue(item.load_cap_total)}
                                  readOnly
                                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm md:col-span-3">
                                <span className="text-gray-700">Remark</span>
                                <input
                                  value={toInputValue(item.remark)}
                                  onChange={(e) =>
                                    updateProcessEquipmentRow(idx, 'remark', e.target.value)
                                  }
                                  type="text"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Forging: </span>Purchase Equipment Plan
                        </h2>
                        <button
                          type="button"
                          onClick={addProcessPlanRow}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Tambahkan baris jika ada lebih dari satu item material atau die.
                      </p>
                      <div className="space-y-3">
                        {processPlan.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Purchase Equipment Plan. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {processPlan.map((item, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Item #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => setProcessPlan((prev) => prev.filter((_, i) => i !== idx))}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-4">
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Item Type</span>
                                <input
                                  value={toInputValue(item.item_type)}
                                  onChange={(e) =>
                                    updateProcessPlanRow(idx, 'item_type', e.target.value)
                                  }
                                  type="text"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm md:col-span-2">
                                <span className="text-gray-700">Specification</span>
                                <input
                                  value={toInputValue(item.mat_grade)}
                                  onChange={(e) =>
                                    updateProcessPlanRow(idx, 'mat_grade', e.target.value)
                                  }
                                  type="text"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                  placeholder="(e.g. S55C Ø 50 / SKT4)"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Target Date</span>
                                <input
                                  type="date"
                                  value={toInputValue(item.target_date)}
                                  onChange={(e) =>
                                    updateProcessPlanRow(idx, 'target_date', e.target.value)
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm md:col-span-4">
                                <span className="text-gray-700">Remark</span>
                                <input
                                  value={toInputValue(item.remark)}
                                  onChange={(e) =>
                                    updateProcessPlanRow(idx, 'remark', e.target.value)
                                  }
                                  type="text"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Forging: </span>Investment
                        </h2>
                        <button
                          type="button"
                          onClick={addInvestmentRow}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Isi biaya equipment per item. Total akan otomatis dihitung dari Qty × Unit Price.
                      </p>
                      <div className="space-y-3">
                        {investments.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data investment. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {investments.map((item, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Investment #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteInvestmentRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <label className="space-y-1 text-sm">
                                <span className="invisible">Type</span>
                                <select
                                  value={item.inv_type}
                                  onChange={(e) =>
                                    updateInvestmentRow(
                                      idx,
                                      'inv_type',
                                      e.target.value === 'other' ? 'other' : 'support'
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                >
                                  <option value="support">support</option>
                                  <option value="other">other</option>
                                </select>
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Machine Name</span>
                                <input
                                  value={toInputValue(item.machine)}
                                  onChange={(e) => updateInvestmentRow(idx, 'machine', e.target.value)}
                                  type="text"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Qty/Unit</span>
                                <input
                                  value={toInputValue(item.qty)}
                                  onChange={(e) => updateInvestmentRow(idx, 'qty', parseIntOrNull(e.target.value))}
                                  type="number"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Qty per Packing</span>
                                <input
                                  value={toInputValue(item.qty_pack)}
                                  onChange={(e) => updateInvestmentRow(idx, 'qty_pack', parseIntOrNull(e.target.value))}
                                  type="number"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Unit Price</span>
                                <input
                                  value={toInputValue(item.unit_price)}
                                  onChange={(e) =>
                                    updateInvestmentRow(idx, 'unit_price', parseNumberOrNull(e.target.value))
                                  }
                                  type="number"
                                  step="0.01"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Total Invest</span>
                                <input
                                  value={toInputValue(item.total_inv)}
                                  readOnly
                                  type="number"
                                  step="0.01"
                                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 border-blue-100"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Depre Time (Year(s))</span>
                                <input
                                  value={toInputValue(item.depr_year)}
                                  onChange={(e) => updateInvestmentRow(idx, 'depr_year', parseIntOrNull(e.target.value))}
                                  type="number"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Power (KWH)</span>
                                <input
                                  value={toInputValue(item.power_kwh)}
                                  onChange={(e) => updateInvestmentRow(idx, 'power_kwh', parseNumberOrNull(e.target.value))}
                                  type="number"
                                  step="0.01"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Area (m²)</span>
                                <input
                                  value={toInputValue(item.area_m2)}
                                  onChange={(e) => updateInvestmentRow(idx, 'area_m2', parseNumberOrNull(e.target.value))}
                                  type="number"
                                  step="0.01"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Man Power (Man/Shift)</span>
                                <input
                                  value={toInputValue(item.manpower)}
                                  onChange={(e) => updateInvestmentRow(idx, 'manpower', parseIntOrNull(e.target.value))}
                                  type="number"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Similar Line (Current Line)</span>
                                <input
                                  value={toInputValue(item.sim_line)}
                                  onChange={(e) => updateInvestmentRow(idx, 'sim_line', e.target.value)}
                                  type="text"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <label className="space-y-1 text-sm">
                          <span className="text-gray-700">Total Support</span>
                          <input
                            type="number"
                            step="0.01"
                            readOnly
                            value={toInputValue(investmentSummary.tot_support)}
                            title="Auto-sum dari semua investment bertipe support"
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                          />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="text-gray-700">Total Other</span>
                          <input
                            type="number"
                            step="0.01"
                            readOnly
                            value={toInputValue(investmentSummary.tot_other)}
                            title="Auto-sum dari semua investment bertipe other"
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                          />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="text-gray-700">Grand Total</span>
                          <input
                            type="number"
                            step="0.01"
                            readOnly
                            value={toInputValue(investmentSummary.grand_total)}
                            title="Total Support + Total Other"
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-semibold"
                          />
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {pfsType === 'jack' && (
                  <>
                    <JackRawMaterial
                      ctx={{
                        jackRawMaterialRows,
                        addJackRawMaterialRow,
                        deleteJackRawMaterialRow,
                        updateJackRawMaterialRow,
                        jackRawMaterialTotal,
                        toInputValue,
                      }}
                    />

                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Jack: </span>Component Purchase
                        </h2>
                        <button
                          type="button"
                          onClick={addJackComponentPurchaseRow}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Daftar komponen yang perlu dibeli dari supplier. Data ini menjadi referensi Accounting pada Direct Cost to Product.
                      </p>
                      <div className="space-y-3">
                        {jackComponentPurchaseRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Component Purchase. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {jackComponentPurchaseRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Component #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteJackComponentPurchaseRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-2 md:grid-cols-3">
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Part Name</span>
                                <input
                                  value={row.part_name}
                                  onChange={(e) => updateJackComponentPurchaseRow(idx, 'part_name', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Material</span>
                                <input
                                  value={row.material}
                                  onChange={(e) => updateJackComponentPurchaseRow(idx, 'material', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Qty/Unit</span>
                                <input
                                  type="number"
                                  value={row.qty_unit}
                                  onChange={(e) => updateJackComponentPurchaseRow(idx, 'qty_unit', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Part No MTM</span>
                                <input
                                  value={row.part_no_mtm}
                                  onChange={(e) => updateJackComponentPurchaseRow(idx, 'part_no_mtm', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Part No Supplier</span>
                                <input
                                  value={row.part_no_supplier}
                                  onChange={(e) => updateJackComponentPurchaseRow(idx, 'part_no_supplier', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Price</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.price_idr}
                                  onChange={(e) => updateJackComponentPurchaseRow(idx, 'price_idr', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total Row */}
                      {jackComponentPurchaseRows.length > 0 && (
                        <div className="mt-4 flex items-center justify-end gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                          <span className="text-sm font-semibold text-gray-700">Total Price</span>
                          <span className="text-sm font-bold text-blue-700">IDR {jackComponentPurchaseTotal.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Jack: </span>Process Standard
                        </h2>
                        <button
                          type="button"
                          onClick={addJackProcessStandardRow}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Standar proses manufaktur untuk produk jack. Process Name di sini menjadi referensi Accounting pada form Processing.
                      </p>
                      <div className="space-y-3">
                        {jackProcessStandardRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Process Standard. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {jackProcessStandardRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Process #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteJackProcessStandardRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Process Press/Stamping</span>
                                <input
                                  value={row.process_name}
                                  onChange={(e) => updateJackProcessStandardRow(idx, 'process_name', e.target.value)}
                                  type="text"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Line</span>
                                <input
                                  value={row.line_name}
                                  onChange={(e) => updateJackProcessStandardRow(idx, 'line_name', e.target.value)}
                                  type="text"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Man Power</span>
                                <input
                                  type="number"
                                  value={row.manpower}
                                  onChange={(e) => updateJackProcessStandardRow(idx, 'manpower', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                              <label className="space-y-1 text-sm">
                                <span className="text-gray-700">Cycle Time</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.cycle_time_sec}
                                  onChange={(e) => updateJackProcessStandardRow(idx, 'cycle_time_sec', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>

                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Jack: </span>Dies &amp; Jig Investment
                        </h2>
                        <button
                          type="button"
                          onClick={addJackDiesJigRow}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Isi field dies, jig, stroke, consumable, dan biaya per pcs sesuai template Jack.
                      </p>
                      <div className="space-y-3">
                        {jackDiesJigRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Dies &amp; Jig. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {jackDiesJigRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Dies &amp; Jig #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteJackDiesJigRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-2 md:grid-cols-4">
                              <label className="space-y-1 text-sm md:col-span-4">
                                <span className="text-gray-700">Part Name</span>
                                <input
                                  value={row.part_name}
                                  onChange={(e) => updateJackDiesJigRow(idx, 'part_name', e.target.value)}
                                  type="text"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Value A</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.value_a}
                                  onChange={(e) => updateJackDiesJigRow(idx, 'value_a', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Stroke B</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.stroke_b}
                                  onChange={(e) => updateJackDiesJigRow(idx, 'stroke_b', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Consumable</span>
                                <input
                                  value={row.consumable}
                                  onChange={(e) => updateJackDiesJigRow(idx, 'consumable', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Value C</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.value_c}
                                  onChange={(e) => updateJackDiesJigRow(idx, 'value_c', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Stroke D</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.stroke_d}
                                  onChange={(e) => updateJackDiesJigRow(idx, 'stroke_d', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Formula Type</span>
                                <select
                                  value={row.formula_type || 'formula_a'}
                                  onChange={(e) => updateJackDiesJigRow(idx, 'formula_type', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                >
                                  <option value="formula_a">(A/B+(0,05 x (A/B)))</option>
                                  <option value="formula_b">(C/D+(C/D))</option>
                                </select>
                              </label>
                              <label className="space-y-1 md:col-span-2">
                                <span className="text-xs text-gray-500">Cost/Pcs (Auto)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.cost_per_pcs}
                                  readOnly
                                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total Row */}
                      {jackDiesJigRows.length > 0 && (
                        <div className="mt-4 flex items-center justify-end gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                          <span className="text-sm font-semibold text-gray-700">Total Cost/pcs</span>
                          <span className="text-sm font-bold text-blue-700">IDR {jackDiesJigTotal.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Jack: </span>Development Cost
                        </h2>
                        <button
                          type="button"
                          onClick={addJackDevelopmentCostRow}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Biaya pengembangan produk yang diperlukan.
                      </p>
                      <div className="space-y-3">
                        {jackDevelopmentCostRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Development Cost. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {jackDevelopmentCostRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Development Cost #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteJackDevelopmentCostRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-2 md:grid-cols-3">
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-600 text-xs">Cost Name</span>
                                <input
                                  value={row.cost_name}
                                  onChange={(e) => updateJackDevelopmentCostRow(idx, 'cost_name', e.target.value)}
                                  placeholder="e.g. Testing, Supp Facility, R&D"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-600 text-xs">Amount (Rp)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.amount_idr}
                                  onChange={(e) => updateJackDevelopmentCostRow(idx, 'amount_idr', e.target.value)}
                                  placeholder="e.g. 8000000"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-600 text-xs">Note</span>
                                <input
                                  value={row.note}
                                  onChange={(e) => updateJackDevelopmentCostRow(idx, 'note', e.target.value)}
                                  placeholder="e.g. *Based on RDDP/Design Requirement"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total Row */}
                      {jackDevelopmentCostRows.length > 0 && (
                        <div className="mt-4 flex items-center justify-end gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                          <span className="text-sm font-semibold text-gray-700">Total</span>
                          <span className="text-sm font-bold text-blue-700">Rp {jackDevelopmentCostTotal.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Jack: </span>Process Out House
                        </h2>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Biaya proses yang dikerjakan di luar (outsource).
                      </p>
                      <div className="space-y-3">
                        <div className="rounded-lg border border-gray-200 p-3">
                          <div className="mb-2 text-xs font-semibold text-gray-500">Outsource Cost</div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="space-y-1 text-sm">
                              <span className="text-gray-700">Process Out House Cost (IDR)</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Cost amount"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="space-y-1 text-sm">
                              <span className="text-gray-700">Note</span>
                              <input
                                placeholder="Additional notes"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Jack: </span>Out House Purchasing Attachment
                        </h2>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Lampiran purchasing (Excel / Word) untuk proses out house agar bisa dilihat engineering.
                      </p>

                      <div className="rounded-lg border border-gray-200 p-3">
            <div className="grid gap-3">
                          <input
                            type="file"
                            accept=".xls,.xlsx,.doc,.docx"
                            onChange={handleSelectOutHouseAttachment}
                            disabled={!canCrudPFS || uploadingOutHouseAttachment}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <p className="mt-2 text-xs text-gray-500">
              Allowed format: .xls, .xlsx, .doc, .docx. File akan otomatis diupload setelah dipilih.
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          File dipilih: <span className="font-medium text-gray-800">{selectedOutHouseFile?.name || '-'}</span>
                        </p>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Uploaded Files ({outHouseAttachments.length})
                        </div>
                        {outHouseAttachments.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada lampiran out house purchasing.
                          </div>
                        )}
                        {outHouseAttachments.map((file) => (
                          <div key={file.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-gray-800">{file.file_name}</div>
                              <div className="text-xs text-gray-500">
                                Upload by {file.uploaded_by || '-'} &bull; {formatDateTimeInAppTZ(file.created_at)}
                              </div>
                            </div>
                            <div className="ml-3 flex shrink-0 items-center gap-2">
                              <a
                                href={buildDrawingFileUrl(file.file_path)}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                              >
                                View
                              </a>
                              {canCrudPFS && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOutHouseAttachment(file.id)}
                                  disabled={uploadingOutHouseAttachment}
                                  className="rounded px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                  Hapus
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Jack: </span>Assembling
                        </h2>
                        <button
                          type="button"
                          onClick={addJackAssemblingRow}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Proses assembling produk jack.
                      </p>
                      <div className="space-y-3">
                        {jackAssemblingRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Assembling. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {jackAssemblingRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Assembling Process #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteJackAssemblingRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-2 md:grid-cols-3">
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Assembling Process</span>
                                <input
                                  value={row.process_name}
                                  onChange={(e) => updateJackAssemblingRow(idx, 'process_name', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Line</span>
                                <input
                                  value={row.line_name}
                                  onChange={(e) => updateJackAssemblingRow(idx, 'line_name', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Man Power</span>
                                <input
                                  type="number"
                                  value={row.manpower}
                                  onChange={(e) => updateJackAssemblingRow(idx, 'manpower', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Cycle Time</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.cycle_time_sec}
                                  onChange={(e) => updateJackAssemblingRow(idx, 'cycle_time_sec', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Rate</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.rate}
                                  onChange={(e) => updateJackAssemblingRow(idx, 'rate', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Cost (IDR)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.cost_idr}
                                  onChange={(e) => updateJackAssemblingRow(idx, 'cost_idr', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total Row */}
                      {jackAssemblingRows.length > 0 && (
                        <div className="mt-4 flex items-center justify-end gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                          <span className="text-sm font-semibold text-gray-700">Total Cost</span>
                          <span className="text-sm font-bold text-blue-700">IDR {jackAssemblingTotal.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Jack: </span>Packing &amp; Delivery
                        </h2>
                        <button
                          type="button"
                          onClick={addJackPackingDeliveryRow}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Daftar item untuk packing dan pengiriman produk. Cost/pcs dihitung otomatis dari Price ÷ Qty/box.
                      </p>
                      <div className="space-y-3">
                        {jackPackingDeliveryRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Packing &amp; Delivery. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {jackPackingDeliveryRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Packing Item #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteJackPackingDeliveryRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-2 md:grid-cols-4">
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-600 text-xs">Item</span>
                                <input
                                  value={row.item_name}
                                  onChange={(e) => updateJackPackingDeliveryRow(idx, 'item_name', e.target.value)}
                                  placeholder="e.g. Carton Box, Polyfoam, Delivery"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-600 text-xs">Price (IDR)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.price}
                                  onChange={(e) => updateJackPackingDeliveryRow(idx, 'price', e.target.value)}
                                  placeholder="e.g. 3500"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-600 text-xs">Qty/box</span>
                                <input
                                  type="number"
                                  step="1"
                                  value={row.qty_box}
                                  onChange={(e) => updateJackPackingDeliveryRow(idx, 'qty_box', e.target.value)}
                                  placeholder="e.g. 4"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="text-gray-600 text-xs">Cost/pcs (IDR)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.cost_pcs}
                                  readOnly
                                  title="Auto: Price ÷ Qty/box"
                                  placeholder="Auto-calculated"
                                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total Row */}
                      {jackPackingDeliveryRows.length > 0 && (
                        <div className="mt-4 flex items-center justify-end gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                          <span className="text-sm font-semibold text-gray-700">Total Cost/pcs</span>
                          <span className="text-sm font-bold text-blue-700">IDR {jackPackingDeliveryTotal.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Jack: </span>Timeframe
                        </h2>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Jadwal timeline pengerjaan produk jack.
                      </p>
                      <div className="space-y-3">
                        {timeline.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data timeframe. Data diambil dari timeline section.
                          </div>
                        )}
                        {timeline.map((item, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 text-xs font-semibold text-gray-500">Timeframe #{idx + 1}</div>
                            <div className="grid gap-2 md:grid-cols-5">
                              <input
                                value={toInputValue(item.activity_name)}
                                readOnly
                                placeholder="Main Activity"
                                className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                              />
                              <input
                                value={toInputValue(item.created_by)}
                                readOnly
                                placeholder="PIC/Username"
                                className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                              />
                              <input
                                type="text"
                                placeholder="Due Date Text"
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                placeholder="Start Month"
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                placeholder="End Month"
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="mt-2">
                              <input
                                value={toInputValue(item.remarks)}
                                readOnly
                                placeholder="Remarks"
                                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-white p-5">
                      <div className="mb-3">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-blue-600">Jack: </span>Result
                        </h2>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Hasil akhir dari pengerjaan jack template.
                      </p>
                      <div className="space-y-3">
                        <div className="rounded-lg border border-gray-200 p-3">
                          <div className="mb-2 text-xs font-semibold text-gray-500">Final Result</div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="space-y-1 text-sm">
                              <span className="text-gray-700">Final Result Status</span>
                              <select
                                defaultValue="ok"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              >
                                <option value="">-- Select --</option>
                                <option value="ok">OK</option>
                                <option value="ng">NG</option>
                              </select>
                            </label>
                            <label className="space-y-1 text-sm">
                              <span className="text-gray-700">Notes</span>
                              <input
                                placeholder="Additional notes and remarks"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 mt-5">
                      <p className="text-sm text-blue-800">
                        <strong>Jack Template Complete:</strong> All 10 sections have been added. The form now displays Jack template-specific fields matching the backend structure.
                      </p>
                    </div>
                  </>
                )}

                {pfsType === 'toolset' && (
                  <div className="space-y-4 rounded-xl border border-purple-200 bg-purple-50 p-5">
                    <div className="rounded-lg border border-purple-300 bg-white p-4 text-sm text-purple-800">
                      Semua section Toolset sudah aktif: Tech Spec, Process Equipment, Equipment Out House,
                      Equipment Plan (K1-K9), Tooling Breakdown, Packaging, Summary.
                    </div>
                    <div className="rounded-xl border border-purple-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-purple-600">1. Tech </span>Spec
                        </h2>
                        <button
                          type="button"
                          onClick={addToolsetTechSpecRow}
                          className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm text-purple-700 hover:bg-purple-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Masukkan spesifikasi teknis untuk komponen toolset.
                      </p>
                      <div className="space-y-3">
                        {toolsetTechSpecRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Tech Spec. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {toolsetTechSpecRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Tech Spec #{idx + 1}</span>
                              <div className="flex space-x-2">
                                <button
                                  type="button"
                                  onClick={() => toggleToolsetTechSpecDetail(idx)}
                                  className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-xs text-purple-700 hover:bg-purple-100"
                                >
                                  {row.isDetailOpen ? 'Hide Detail' : 'Detail'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteToolsetTechSpecRow(idx)}
                                  className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <div className="grid gap-2 md:grid-cols-4">
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Level</span>
                                <input
                                  value={row.part_no}
                                  onChange={(e) => updateToolsetTechSpecRow(idx, 'part_no', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Component Name</span>
                                <input
                                  value={row.component_name}
                                  onChange={(e) => updateToolsetTechSpecRow(idx, 'component_name', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Qty</span>
                                <input
                                  value={row.qty}
                                  onChange={(e) => updateToolsetTechSpecRow(idx, 'qty', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Part No MTM</span>
                                <input
                                  value={row.part_no_mtm}
                                  onChange={(e) => updateToolsetTechSpecRow(idx, 'part_no_mtm', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Part No Supplier</span>
                                <input
                                  value={row.part_no_supplier}
                                  onChange={(e) => updateToolsetTechSpecRow(idx, 'part_no_supplier', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Actual Cost IDR</span>
                                <input
                                  value={row.actual_cost_idr}
                                  onChange={(e) => updateToolsetTechSpecRow(idx, 'actual_cost_idr', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1 md:col-span-2">
                                <span className="text-xs text-gray-500">Remark</span>
                                <input
                                  value={row.remark}
                                  onChange={(e) => updateToolsetTechSpecRow(idx, 'remark', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                            </div>

                            {row.isDetailOpen && row.detail && (
                              <div className="mt-3 rounded-lg bg-gray-50 p-4 border border-purple-100">
                                <h4 className="mb-3 text-sm font-semibold text-purple-800">Tech Spec Detail</h4>
                                <div className="grid gap-2 md:grid-cols-4">
                                  <label className="space-y-1"><span className="text-xs text-gray-500">Material</span><input value={row.detail.material} onChange={(e) => updateToolsetTechSpecDetail(idx, 'material', e.target.value)} placeholder="Material" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
                                  <label className="space-y-1"><span className="text-xs text-gray-500">Diameter (mm)</span><input type="number" step="0.01" value={row.detail.diameter_mm} onChange={(e) => updateToolsetTechSpecDetail(idx, 'diameter_mm', e.target.value)} placeholder="Diameter" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
                                  <label className="space-y-1"><span className="text-xs text-gray-500">Length (mm)</span><input type="number" step="0.01" value={row.detail.length_mm} onChange={(e) => updateToolsetTechSpecDetail(idx, 'length_mm', e.target.value)} placeholder="Length" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
                                  <label className="space-y-1"><span className="text-xs text-gray-500">Mass (kg)</span><input value={row.detail.mass_kg} readOnly placeholder="Mass" className="w-full rounded-lg border border-gray-300 bg-gray-200 px-3 py-2 text-sm" title="Auto: (Diameter^2) * Length * 0.0000061625" /></label>

                                  <label className="space-y-1"><span className="text-xs text-gray-500">Mat. Cost Country 1</span><input value={row.detail.material_cost_country_1} onChange={(e) => updateToolsetTechSpecDetail(idx, 'material_cost_country_1', e.target.value)} placeholder="Country 1" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
                                  <label className="space-y-1"><span className="text-xs text-gray-500">Mat. Cost Rp/Kg 1</span><input type="number" step="0.01" value={row.detail.material_cost_rp_kg_1} onChange={(e) => updateToolsetTechSpecDetail(idx, 'material_cost_rp_kg_1', e.target.value)} placeholder="Rp/Kg 1" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
                                  <label className="space-y-1"><span className="text-xs text-gray-500">Mat. Cost Country 2</span><input value={row.detail.material_cost_country_2} onChange={(e) => updateToolsetTechSpecDetail(idx, 'material_cost_country_2', e.target.value)} placeholder="Country 2" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
                                  <label className="space-y-1"><span className="text-xs text-gray-500">Mat. Cost Rp/Kg 2</span><input type="number" step="0.01" value={row.detail.material_cost_rp_kg_2} onChange={(e) => updateToolsetTechSpecDetail(idx, 'material_cost_rp_kg_2', e.target.value)} placeholder="Rp/Kg 2" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>

                                  <label className="space-y-1"><span className="text-xs text-gray-500">Finish Cost Country 1</span><input value={row.detail.cost_finish_country_1} readOnly placeholder="Auto" className="w-full rounded-lg border border-gray-300 bg-gray-200 px-3 py-2 text-sm" title="Auto: Mass * Rp/Kg" /></label>
                                  <label className="space-y-1"><span className="text-xs text-gray-500">Finish Cost Rp/Kg 1</span><input type="number" step="0.01" value={row.detail.cost_finish_rp_kg_1} onChange={(e) => updateToolsetTechSpecDetail(idx, 'cost_finish_rp_kg_1', e.target.value)} placeholder="Fin Rp/Kg 1" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
                                  <label className="space-y-1"><span className="text-xs text-gray-500">Finish Cost Country 2</span><input value={row.detail.cost_finish_country_2} readOnly placeholder="Auto" className="w-full rounded-lg border border-gray-300 bg-gray-200 px-3 py-2 text-sm" title="Auto: Mass * Rp/Kg" /></label>
                                  <label className="space-y-1"><span className="text-xs text-gray-500">Finish Cost Rp/Kg 2</span><input type="number" step="0.01" value={row.detail.cost_finish_rp_kg_2} onChange={(e) => updateToolsetTechSpecDetail(idx, 'cost_finish_rp_kg_2', e.target.value)} placeholder="Fin Rp/Kg 2" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>

                                  <label className="space-y-1 md:col-span-4"><span className="text-xs text-gray-500">Mass Product (gr)</span><input type="number" step="0.01" value={row.detail.mass_product_gr} onChange={(e) => updateToolsetTechSpecDetail(idx, 'mass_product_gr', e.target.value)} placeholder="Mass gr" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-purple-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-purple-600">2. Process </span>Equipment
                        </h2>
                        <button
                          type="button"
                          onClick={addToolsetProcessEquipmentRow}
                          className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm text-purple-700 hover:bg-purple-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Masukkan data mesin dan peralatan untuk proses produksi.
                      </p>
                      <div className="space-y-3">
                        {toolsetProcessEquipmentRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Process Equipment. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {toolsetProcessEquipmentRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Process #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteToolsetProcessEquipmentRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-2 md:grid-cols-3">
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Process Name</span>
                                <input
                                  value={row.process_name}
                                  onChange={(e) => updateToolsetProcessEquipmentRow(idx, 'process_name', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Cycle Time Sec</span>
                                <input
                                  value={row.cycle_time_sec}
                                  onChange={(e) => updateToolsetProcessEquipmentRow(idx, 'cycle_time_sec', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Machine Existing</span>
                                <input
                                  value={row.machine_existing}
                                  onChange={(e) => updateToolsetProcessEquipmentRow(idx, 'machine_existing', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Machine New</span>
                                <input
                                  value={row.machine_new}
                                  onChange={(e) => updateToolsetProcessEquipmentRow(idx, 'machine_new', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Remark</span>
                                <input
                                  value={row.remark}
                                  onChange={(e) => updateToolsetProcessEquipmentRow(idx, 'remark', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-purple-300 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold text-purple-900">2.1 Assy Tool Set (In House)</h3>
                        <button type="button" onClick={addToolsetAssyRow} className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm text-purple-700">Add Row</button>
                      </div>
                      <div className="space-y-2">
                        {toolsetAssyRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Assy Process #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteToolsetAssyRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Process Name</span>
                                <input value={row.process_name} onChange={(e) => updateToolsetAssyRow(idx, 'process_name', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Cycle Time Sec</span>
                                <input value={row.cycle_time_sec} onChange={(e) => updateToolsetAssyRow(idx, 'cycle_time_sec', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Machine Existing</span>
                                <input value={row.machine_existing} onChange={(e) => updateToolsetAssyRow(idx, 'machine_existing', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Machine New</span>
                                <input value={row.machine_new} onChange={(e) => updateToolsetAssyRow(idx, 'machine_new', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Remark</span>
                                <input value={row.remark} onChange={(e) => updateToolsetAssyRow(idx, 'remark', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-purple-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-purple-600">3. Equipment </span>Out House
                        </h2>
                        <button
                          type="button"
                          onClick={addToolsetSubcontRow}
                          className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm text-purple-700 hover:bg-purple-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Masukkan rincian untuk subcont atau out house process.
                      </p>
                      <div className="space-y-3">
                        {toolsetSubcontRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Equipment Out House. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {toolsetSubcontRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Equipment #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteToolsetSubcontRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-2 md:grid-cols-3">
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Process Name</span>
                                <input
                                  value={row.process_name}
                                  onChange={(e) => updateToolsetSubcontRow(idx, 'process_name', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Cost IDR</span>
                                <input
                                  value={row.cost_idr}
                                  onChange={(e) => updateToolsetSubcontRow(idx, 'cost_idr', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Cycle Time Sec</span>
                                <input
                                  value={row.cycle_time_sec}
                                  onChange={(e) => updateToolsetSubcontRow(idx, 'cycle_time_sec', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Machine Existing</span>
                                <input
                                  value={row.machine_existing}
                                  onChange={(e) => updateToolsetSubcontRow(idx, 'machine_existing', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Machine New</span>
                                <input
                                  value={row.machine_new}
                                  onChange={(e) => updateToolsetSubcontRow(idx, 'machine_new', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Remark</span>
                                <input
                                  value={row.remark}
                                  onChange={(e) => updateToolsetSubcontRow(idx, 'remark', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-purple-300 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold text-purple-900">4. Purchase Equipment Plan</h3>
                        <button type="button" onClick={addToolsetPurchaseEquipmentPlanRow} className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm text-purple-700">Add Row</button>
                      </div>
                      <div className="space-y-2">
                        {toolsetPurchaseEquipmentPlanRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Equipment Plan #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteToolsetPurchaseEquipmentPlanRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Item Type</span>
                                <input value={row.item_type || ''} onChange={(e) => updateToolsetPurchaseEquipmentPlanRow(idx, 'item_type', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Specification</span>
                                <input value={row.specification || ''} onChange={(e) => updateToolsetPurchaseEquipmentPlanRow(idx, 'specification', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Diameter</span>
                                <input value={row.dia ?? ''} onChange={(e) => updateToolsetPurchaseEquipmentPlanRow(idx, 'dia', e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Target Date</span>
                                <input value={row.target_date || ''} onChange={(e) => updateToolsetPurchaseEquipmentPlanRow(idx, 'target_date', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1 md:col-span-2">
                                <span className="text-xs text-gray-500">Remark</span>
                                <input value={row.remark || ''} onChange={(e) => updateToolsetPurchaseEquipmentPlanRow(idx, 'remark', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-purple-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-purple-600">5. Tooling </span>Breakdown
                        </h2>
                        <button
                          type="button"
                          onClick={addToolsetToolingRow}
                          className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm text-purple-700 hover:bg-purple-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Masukkan rincian biaya tooling yang diperlukan.
                      </p>
                      <div className="space-y-3">
                        {toolsetToolingRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Tooling. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {toolsetToolingRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Tooling #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteToolsetToolingRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Tooling Category</span>
                                <input value={row.tooling_category} onChange={(e) => updateToolsetToolingRow(idx, 'tooling_category', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Cost IDR</span>
                                <input value={row.cost_idr} onChange={(e) => updateToolsetToolingRow(idx, 'cost_idr', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Remark</span>
                                <input value={row.remark} onChange={(e) => updateToolsetToolingRow(idx, 'remark', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total Row */}
                      {toolsetToolingRows.length > 0 && (
                        <div className="mt-4 flex items-center justify-end gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
                          <span className="text-sm font-semibold text-gray-700">Total Tooling IDR</span>
                          <span className="text-sm font-bold text-purple-700">
                            {Number(autoToolsetSummary.total_tooling_cost || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-purple-200 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-gray-800">
                          <span className="text-purple-600">6. Packaging</span>
                        </h2>
                        <button
                          type="button"
                          onClick={addToolsetPackagingRow}
                          className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm text-purple-700 hover:bg-purple-100"
                        >
                          Add Row
                        </button>
                      </div>
                      <p className="mb-4 text-sm text-gray-500">
                        Masukkan rincian biaya packaging (kemasan).
                      </p>
                      <div className="space-y-3">
                        {toolsetPackagingRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                            Belum ada data Packaging. Klik <b>Add Row</b> untuk menambah.
                          </div>
                        )}
                        {toolsetPackagingRows.map((row, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                              <span>Packaging #{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => deleteToolsetPackagingRow(idx)}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Item Name</span>
                                <input value={row.item_name} onChange={(e) => updateToolsetPackagingRow(idx, 'item_name', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Price IDR</span>
                                <input value={row.price_idr} onChange={(e) => updateToolsetPackagingRow(idx, 'price_idr', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Qty/Box</span>
                                <input value={row.qty_per_box} onChange={(e) => updateToolsetPackagingRow(idx, 'qty_per_box', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs text-gray-500">Cost/Box IDR</span>
                                <input value={row.cost_per_box_idr} onChange={(e) => updateToolsetPackagingRow(idx, 'cost_per_box_idr', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                              <label className="space-y-1 md:col-span-2">
                                <span className="text-xs text-gray-500">Remark</span>
                                <input value={row.remark} onChange={(e) => updateToolsetPackagingRow(idx, 'remark', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-purple-300 bg-white p-4">
                      <h3 className="mb-3 font-semibold text-purple-900">8. Summary</h3>
                      <p className="mb-2 text-xs text-gray-500">Auto-calculated dari Tooling Breakdown, Packaging, dan Equipment Out House.</p>
                      <div className="grid gap-2 md:grid-cols-4">
                        <label className="space-y-1">
                          <span className="text-xs text-gray-500">Total Tooling Cost</span>
                          <input
                            value={autoToolsetSummary.total_tooling_cost}
                            readOnly
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="text-xs text-gray-500">Total Packaging Cost</span>
                          <input
                            value={autoToolsetSummary.total_packaging_cost}
                            readOnly
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="text-xs text-gray-500">Total Equipment Investment</span>
                          <input
                            value={autoToolsetSummary.total_equipment_investment}
                            readOnly
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="text-xs text-gray-500">Grand Total</span>
                          <input
                            value={autoToolsetSummary.grand_total}
                            readOnly
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {(pfsType === 'forging' || pfsType === 'jack') && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-800">
                      <strong>Note:</strong> Jack template currently uses the generic form structure while we build template-specific sections.
                    </p>
                  </div>
                )}
              </fieldset>

              {pfsType !== 'jack' && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-gray-800">Vendor Price Files ({pfsType.toUpperCase()})</h3>
                  <p className="mt-1 text-xs text-gray-500">Read-only list pada tab Estimation Process Plan.</p>
                  <div className="mt-4 space-y-2">
                    {outHouseAttachments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                        Belum ada file vendor price pada RFQ ini.
                      </div>
                    ) : (
                      outHouseAttachments.map((file) => (
                        <div key={file.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-gray-800">{file.file_name}</div>
                            <div className="text-xs text-gray-500">
                              Upload by {file.uploaded_by || '-'} &bull; {formatDateTimeInAppTZ(file.created_at)}
                            </div>
                          </div>
                          <a
                            href={buildDrawingFileUrl(file.file_path)}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-3 rounded px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                          >
                            View
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={disableCrudSave}
                  onClick={saveEstimation}
                  className="rounded-lg bg-[#0D79BD] px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'drawing' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-base font-semibold text-gray-800">Drawing Document</h2>

                {/* Drag & Drop Upload Area */}
                <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-10 mt-2 group hover:border-[#0D79BD]/50 transition-colors">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg,.pdf"
                    onChange={handleSelectDrawing}
                    disabled={!canCrudPFS || uploadingDrawing}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200/60 mb-4 group-hover:bg-blue-50 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 group-hover:text-[#0D79BD] transition-colors">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-[#1e293b]">Click to Choose Files</h3>
                  <p className="mb-6 text-sm text-gray-500 max-w-sm text-center">
                    Drag and drop your PNG, JPG, WebP, SVG images here or browse
                  </p>
                  <span className="text-sm font-medium text-blue-600 underline cursor-pointer">
                    {uploadingDrawing ? 'Menyimpan...' : 'Browse File'}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-600">
                    File dipilih: <span className="font-medium text-gray-800">{selectedDrawingFile?.name || '-'}</span>
                  </p>
                  <button
                    type="button"
                    disabled={
                      !canCrudPFS ||
                      !selectedRFQId ||
                      !isRFQApproved ||
                      !selectedDrawingFile ||
                      uploadingDrawing ||
                      loading
                    }
                    onClick={saveDrawing}
                    className="rounded-lg bg-[#0D79BD] px-4 py-2 text-sm text-white disabled:opacity-60"
                  >
                    {uploadingDrawing ? 'Saving...' : 'Save'}
                  </button>
                </div>

                {/* Uploaded Files List */}
                {drawings.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800">Uploaded Drawings ({drawings.length})</h3>
                    {drawings.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex shrink-0 items-center justify-center rounded-lg bg-blue-50 p-2 text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{d.file_name}</div>
                            <div className="text-xs text-gray-500">
                              Upload by {d.uploaded_by || '-'} &bull; {formatDateTimeInAppTZ(d.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={buildDrawingFileUrl(d.file_path)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                          >
                            View
                          </a>
                          {canCrudPFS && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDrawing(d.id)}
                              disabled={uploadingDrawing}
                              className="rounded px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-base font-semibold text-gray-800">Vendor Price / Out House Purchasing</h2>

                <div className="grid gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Upload Vendor Price</label>
                    <input
                      type="file"
                      accept=".xls,.xlsx,.doc,.docx"
                      onChange={handleSelectOutHouseAttachment}
                      disabled={!canCrudPFS || uploadingOutHouseAttachment}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-500">
                      Format file: .xls, .xlsx, .doc, .docx. Berlaku untuk template {pfsType.toUpperCase()} dan otomatis upload setelah dipilih.
                    </p>
                    <p className="text-sm text-gray-600">
                      File dipilih: <span className="font-medium text-gray-800">{selectedOutHouseFile?.name || '-'}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800">Vendor Price Files ({pfsType.toUpperCase()})</h3>
                  {outHouseAttachments.length === 0 ? (
                    <p className="text-sm text-gray-500">Belum ada file vendor price pada RFQ ini.</p>
                  ) : (
                    outHouseAttachments.map((file) => (
                      <div key={file.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-800">{file.file_name}</div>
                          <div className="text-xs text-gray-500">
                            Upload by {file.uploaded_by || '-'} &bull; {formatDateTimeInAppTZ(file.created_at)}
                          </div>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          <a
                            href={buildDrawingFileUrl(file.file_path)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                          >
                            View
                          </a>
                          {canCrudPFS && (
                            <button
                              type="button"
                              onClick={() => handleDeleteOutHouseAttachment(file.id)}
                              disabled={uploadingOutHouseAttachment}
                              className="rounded px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeframe' && (
            <TimeframeTab
              ctx={{
                canViewPFS,
                canApprovePFS,
                moveCode,
                setMoveCode,
                moveTargetDate,
                setMoveTargetDate,
                moveRemarks,
                setMoveRemarks,
                moveActivity,
                saving,
                selectedRFQId,
                isRFQApproved,
                activityOptions,
                currentPIC,
                disableApproveSave,
                timeline,
                fetchTimeFrame,
                formatDateTimeInAppTZ,
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default PfsPage;
