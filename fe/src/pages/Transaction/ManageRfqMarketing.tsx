import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { Pencil, Trash2, X } from 'lucide-react';
import './css/ManageRfqMarketing.css';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { formatDateTimeInAppTZ } from '../../utils/datetime';
import { getRfqStatusBadgeClass } from '../../utils/rfqStatus';
import {
  ActionResultModal,
  ConfirmActionModal,
  type ConfirmAction,
  type ResultModal,
} from './components/ActionModals';
type RFQItem = {
  id: number;
  rfq_no: string;
  status: string;
  new_part_name?: string | null;
  similar_part_name?: string | null;
  pfs_type?: string | null;
};

type RFQDetailRow = Record<string, any>;

type ActivityOption = {
  code_act: string;
  descr: string;
};

type TimelineItem = {
  activity_name?: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
};

type MainActivityRow = {
  statusactivity?: string;
  activity_desc?: string;
  status?: string;
};

type ActivityPlanRow = {
  code_act?: string;
  target_date?: string | null;
  remarks?: string | null;
};

const preferValue = (...vals: Array<unknown>) => {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s !== '') return s;
  }
  return '';
};

const pickFirst = (row: RFQDetailRow, keys: string[]) => {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
};

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toCodeNumber = (v: unknown) => {
  const raw = String(v ?? '').trim();
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n;

  const digits = raw.replace(/\D/g, '');
  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const normalizeDateInput = (v: unknown) => {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
};

const isApprovedStatus = (v: unknown) => String(v ?? '').trim().toLowerCase() === 'approved';

type EditForm = {
  product_id: number;
  product_type: string;
  customer: string;
  part_name: string;
  part_no: string;
  model: string;
  volume_month: string;
  material: string;
  product_weight: string;
  delivery_condition: string;
  remark_forg: string;
  remark_comp: string;
  remark_mach: string;
  remark_asse: string;
  remark_doc: string;
};

const emptyEditForm = (): EditForm => ({
  product_id: 0,
  product_type: '',
  customer: '',
  part_name: '',
  part_no: '',
  model: '',
  volume_month: '',
  material: '',
  product_weight: '',
  delivery_condition: '',
  remark_forg: '',
  remark_comp: '',
  remark_mach: '',
  remark_asse: '',
  remark_doc: '',
});

const ManageRfqMarketing: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [data, setData] = useState<RFQItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<RFQItem | null>(null);
  const [detail, setDetail] = useState<RFQDetailRow[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [activityOptionsLoading, setActivityOptionsLoading] = useState(false);
  const [mainActivity, setMainActivity] = useState<MainActivityRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [activityPlans, setActivityPlans] = useState<ActivityPlanRow[]>([]);

  const [moveCode, setMoveCode] = useState('');
  const [moveTargetDate, setMoveTargetDate] = useState('');
  const [moveRemarks, setMoveRemarks] = useState('');
  const [moveSaving, setMoveSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm());
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [resultModal, setResultModal] = useState<ResultModal | null>(null);

  useEffect(() => {
    if (!confirmAction && !resultModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmAction, resultModal]);

  const applyMoveFormFromPlan = (code: string, planRows: ActivityPlanRow[]) => {
    const selectedCode = String(code || '').trim();
    if (!selectedCode) {
      setMoveTargetDate('');
      setMoveRemarks('');
      return;
    }

    const found = planRows.find((row) => String(row?.code_act ?? '').trim() === selectedCode);
    setMoveTargetDate(normalizeDateInput(found?.target_date));
    setMoveRemarks(String(found?.remarks ?? '').trim());
  };

  const currentActivityNumber = useMemo(() => {
    return toCodeNumber(preferValue(mainActivity?.statusactivity));
  }, [mainActivity]);

  const isRfqApproved = useMemo(() => {
    if (mainActivity) {
      return isApprovedStatus(mainActivity.status);
    }
    return isApprovedStatus(selected?.status);
  }, [mainActivity, selected]);

  const selectableActivityOptions = useMemo(() => {
    if (currentActivityNumber === null) {
      return activityOptions.filter((option) => toCodeNumber(option.code_act) === 0);
    }

    return activityOptions.filter((option) => {
      const num = toCodeNumber(option.code_act);
      if (num === null) return false;
      if (num === 4 && !isRfqApproved && num !== currentActivityNumber) return false;
      return num === currentActivityNumber || num === currentActivityNumber + 1;
    });
  }, [activityOptions, currentActivityNumber, isRfqApproved]);

  const selectedIdFromUrl = useMemo(() => {
    const raw = String((params as any)?.rfqId || '').trim();
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }, [params]);

  const selectedNoFromUrl = useMemo(() => {
    const sp = new URLSearchParams(location.search || '');
    return (sp.get('rfq_no') || '').trim();
  }, [location.search]);

  useEffect(() => {
    if (!selectedIdFromUrl) {
      setSelected(null);
      setDetail(null);
      return;
    }

    if (selected?.id === selectedIdFromUrl) return;

    const fromList = data.find((r) => r.id === selectedIdFromUrl);
    const fallback: RFQItem =
      fromList ||
      ({
        id: selectedIdFromUrl,
        rfq_no: selectedNoFromUrl || `RFQ #${selectedIdFromUrl}`,
        status: '',
        new_part_name: null,
        similar_part_name: null,
      } as any);

    fetchDetail(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdFromUrl, selectedNoFromUrl, data]);

  const fetchList = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/rfqs', { withCredentials: true });
      const rows = (res.data?.data as any[]) || [];
      const normalized: RFQItem[] = rows
        .map((r) => ({
          id: Number(r?.id ?? r?.rfq_id),
          rfq_no: String(r?.rfq_no ?? ''),
          status: String(r?.status ?? ''),
          new_part_name: r?.new_part_name ?? null,
          similar_part_name: r?.similar_part_name ?? null,
          pfs_type: r?.pfs_type ?? null,
        }))
        .filter((r) => Number.isFinite(r.id) && r.id > 0 && r.rfq_no);

      setData(normalized);
      setSelected((prev) => {
        if (!prev) return prev;
        const latest = normalized.find((row) => row.id === prev.id);
        return latest || prev;
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat daftar RFQ');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (item: RFQItem) => {
    setSelected(item);
    setDetail(null);
    setError('');
    setDetailLoading(true);
    setMainActivity(null);
    setTimeline([]);
    setActivityPlans([]);

    try {
      const res = await api.get(`/rfqs/${item.id}`, { withCredentials: true });
      setDetail((res.data?.data as RFQDetailRow[]) || []);

      // best-effort load activity meta + timeline
      setTimelineLoading(true);
      const [metaRes, timeRes, dashRes] = await Promise.allSettled([
        api.get('/rfqs/mainactivity', { params: { id: item.id }, withCredentials: true }),
        api.get(`/rfqs/${item.id}/timeline`, { withCredentials: true }),
        api.get(`/rfqs/${item.id}/dashboard-activity`, { withCredentials: true }),
      ]);

      if (metaRes.status === 'fulfilled') {
        const rows = (metaRes.value.data?.data as any[]) || [];
        const first = (rows[0] as any) || null;
        setMainActivity(first);
        const currentCode = preferValue(first?.statusactivity);
        if (currentCode) {
          setMoveCode(currentCode);
        }
      }

      if (timeRes.status === 'fulfilled') {
        const rows = (timeRes.value.data?.data as any[]) || [];
        setTimeline(rows as any);
      }

      if (dashRes.status === 'fulfilled') {
        const rows = (dashRes.value.data?.data as ActivityPlanRow[]) || [];
        setActivityPlans(rows);
      }

      const codeForForm = String(preferValue((metaRes as any)?.value?.data?.data?.[0]?.statusactivity) || '').trim();
      if (codeForForm && dashRes.status === 'fulfilled') {
        const rows = (dashRes.value.data?.data as ActivityPlanRow[]) || [];
        applyMoveFormFromPlan(codeForForm, rows);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat detail RFQ');
      setDetail(null);
    } finally {
      setDetailLoading(false);
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const load = async () => {
      setActivityOptionsLoading(true);
      try {
        const res = await api.get('/rfq-activities', { withCredentials: true });
        const rows = (res.data?.data as any[]) || [];
        const opts: ActivityOption[] = rows
          .map((r) => ({ code_act: String(r?.code_act ?? ''), descr: String(r?.descr ?? '') }))
          .filter((o) => String(o.code_act).trim() !== '');
        setActivityOptions(opts);
      } catch {
        setActivityOptions([]);
      } finally {
        setActivityOptionsLoading(false);
      }
    };
    load();
  }, []);

  const reloadActivityPanels = async (rfqId: number) => {
    setTimelineLoading(true);
    try {
      const [metaRes, timeRes, dashRes] = await Promise.allSettled([
        api.get('/rfqs/mainactivity', { params: { id: rfqId }, withCredentials: true }),
        api.get(`/rfqs/${rfqId}/timeline`, { withCredentials: true }),
        api.get(`/rfqs/${rfqId}/dashboard-activity`, { withCredentials: true }),
      ]);
      if (metaRes.status === 'fulfilled') {
        const rows = (metaRes.value.data?.data as any[]) || [];
        const first = (rows[0] as any) || null;
        setMainActivity(first);
        const currentCode = preferValue(first?.statusactivity);
        if (currentCode) {
          setMoveCode(currentCode);
        }
      }
      if (timeRes.status === 'fulfilled') {
        const rows = (timeRes.value.data?.data as any[]) || [];
        setTimeline(rows as any);
      }
      if (dashRes.status === 'fulfilled') {
        const rows = (dashRes.value.data?.data as ActivityPlanRow[]) || [];
        setActivityPlans(rows);
      }

      const codeForForm = String(preferValue((metaRes as any)?.value?.data?.data?.[0]?.statusactivity) || '').trim();
      if (codeForForm && dashRes.status === 'fulfilled') {
        const rows = (dashRes.value.data?.data as ActivityPlanRow[]) || [];
        applyMoveFormFromPlan(codeForForm, rows);
      }
    } finally {
      setTimelineLoading(false);
    }
  };

  const moveActivity = () => {
    if (!selected) return;
    const code = String(moveCode || '').trim();
    if (!code) {
      setError('Status activity wajib dipilih');
      return;
    }

    if (selectableActivityOptions.length > 0) {
      const allowed = selectableActivityOptions.some((option) => String(option.code_act).trim() === code);
      if (!allowed) {
        setError('Perpindahan activity harus berurutan (current atau next).');
        return;
      }
    }

    const selectedCodeNum = toCodeNumber(code);

    if (
      selectedCodeNum === 4 &&
      !isRfqApproved &&
      selectedCodeNum !== currentActivityNumber
    ) {
      setError('Activity 4 hanya bisa dipilih jika RFQ sudah approved.');
      return;
    }

    if (
      currentActivityNumber !== null &&
      selectedCodeNum !== null &&
      selectedCodeNum === currentActivityNumber + 1
    ) {
      if (!moveTargetDate) {
        setError('Target Date wajib diisi untuk pindah ke activity berikutnya.');
        return;
      }

      const previousPlan = activityPlans.find(
        (row) => toCodeNumber(row?.code_act) === currentActivityNumber
      );
      const previousTarget = normalizeDateInput(previousPlan?.target_date);
      if (previousTarget && moveTargetDate <= previousTarget) {
        setError('Target Date activity berikutnya harus lebih besar dari target date activity sebelumnya.');
        return;
      }
    }

    const selectedOption = selectableActivityOptions.find(
      (option) => String(option.code_act).trim() === code
    );

    setConfirmAction({
      type: 'move-activity',
      rfqId: selected.id,
      code,
      targetDate: moveTargetDate,
      remarks: moveRemarks,
      activityLabel: selectedOption ? `${selectedOption.code_act} - ${selectedOption.descr}` : code,
    });
  };

  const executeMoveActivity = async (
    rfqId: number,
    code: string,
    targetDate: string,
    remarks: string
  ) => {
    setMoveSaving(true);
    setError('');
    try {
      await api.post(
        `/rfqs/${rfqId}/activity/move`,
        {
          statusactivity: code,
          target_date: targetDate || null,
          remarks: remarks || '',
        },
        { withCredentials: true }
      );
      await reloadActivityPanels(rfqId);
      await fetchList();
      setResultModal({
        status: 'success',
        title: 'Activity Berhasil Dipindahkan',
        message: 'Perubahan status activity sudah tersimpan dan timeline sudah diperbarui.',
      });
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Gagal move activity';
      setError(message);
      setResultModal({
        status: 'error',
        title: 'Move Activity Gagal',
        message,
      });
    } finally {
      setMoveSaving(false);
    }
  };

  const groupedProducts = useMemo(() => {
    const rows = detail || [];
    const newRows = rows.filter((r) => String(r?.product_type || '').toLowerCase() === 'new');
    const similarRows = rows.filter((r) => String(r?.product_type || '').toLowerCase() === 'similar');
    const otherRows = rows.filter((r) => !newRows.includes(r) && !similarRows.includes(r));

    return [
      { label: 'New Product', rows: newRows },
      { label: 'Similar Product', rows: similarRows },
      { label: 'Other', rows: otherRows },
    ].filter((g) => g.rows.length);
  }, [detail]);

  const openEdit = (row: RFQDetailRow) => {
    const productId = toNum(pickFirst(row, ['product_id', 'id']));
    const productType = String(pickFirst(row, ['product_type']) || '');

    const form: EditForm = {
      product_id: productId,
      product_type: productType,
      customer: String(pickFirst(row, ['customer']) || ''),
      part_name: String(pickFirst(row, ['part_name']) || ''),
      part_no: String(pickFirst(row, ['part_no']) || ''),
      model: String(pickFirst(row, ['model']) || ''),
      volume_month: String(pickFirst(row, ['volume_month']) || ''),
      material: String(pickFirst(row, ['material']) || ''),
      product_weight: String(pickFirst(row, ['product_weight']) || ''),
      delivery_condition: String(pickFirst(row, ['delivery_condition']) || ''),
      remark_forg: String(pickFirst(row, ['td_remark_forg', 'remark_forg']) || ''),
      remark_comp: String(pickFirst(row, ['td_remark_comp', 'remark_comp']) || ''),
      remark_mach: String(pickFirst(row, ['td_remark_mach', 'remark_mach']) || ''),
      remark_asse: String(pickFirst(row, ['td_remark_asse', 'remark_asse']) || ''),
      remark_doc: String(pickFirst(row, ['td_remark_doc', 'remark_doc', 'remark']) || ''),
    };

    setEditForm(form);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.product_id) return;

    setEditSaving(true);
    setError('');

    try {
      const productType = String(editForm.product_type || '').trim().toUpperCase();
      if (productType !== 'NEW' && productType !== 'SIMILAR') {
        throw new Error('Product Type harus NEW atau SIMILAR');
      }

      const res = await api.put(
        '/rfqs/products',
        {
          product_id: editForm.product_id,
          product_type: productType,
          customer: editForm.customer || null,
          part_name: editForm.part_name || null,
          part_no: editForm.part_no || null,
          model: editForm.model || null,
          volume_month: editForm.volume_month ? Number(editForm.volume_month) : null,
          material: editForm.material || null,
          product_weight: editForm.product_weight ? Number(editForm.product_weight) : null,
          delivery_condition: editForm.delivery_condition || null,
          remark_forg: editForm.remark_forg || null,
          remark_comp: editForm.remark_comp || null,
          remark_mach: editForm.remark_mach || null,
          remark_asse: editForm.remark_asse || null,
          remark_doc: editForm.remark_doc || null,
        },
        { withCredentials: true }
      );

      if (res?.data?.status === false) {
        throw new Error(res?.data?.message || 'Gagal update product');
      }

      setEditOpen(false);
      setResultModal({
        status: 'success',
        title: 'Product Berhasil Diupdate',
        message: 'Perubahan sudah tersimpan. Klik tombol di bawah untuk kembali ke detail RFQ yang sudah diperbarui.',
        actionLabel: 'Kembali ke Detail',
      });

      if (selected) {
        await fetchDetail(selected);
      }
      await fetchList();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Gagal update product');
    } finally {
      setEditSaving(false);
    }
  };

  const deleteProduct = (row: RFQDetailRow) => {
    const productId = toNum(pickFirst(row, ['product_id', 'id']));
    if (!productId) return;

    const partName = String(pickFirst(row, ['part_name']) || '').trim();
    setConfirmAction({
      type: 'delete-product',
      productId,
      productLabel: partName || `Product #${productId}`,
    });
  };

  const executeDeleteProduct = async (productId: number) => {
    setError('');
    try {
      await api.delete('/rfqs/products', {
        data: { product_id: productId },
        withCredentials: true,
      });

      if (selected) {
        await fetchDetail(selected);
      }
      await fetchList();

      setResultModal({
        status: 'success',
        title: 'Product Berhasil Dihapus',
        message: 'Data product sudah dihapus dari RFQ ini.',
      });
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Gagal hapus product';
      setError(message);
      setResultModal({
        status: 'error',
        title: 'Hapus Product Gagal',
        message,
      });
    }
  };

  const deleteRFQ = () => {
    if (!selected) return;

    setConfirmAction({
      type: 'delete-rfq',
      rfqId: selected.id,
      rfqNo: selected.rfq_no,
    });
  };

  const executeDeleteRFQ = async (rfqId: number) => {
    setError('');
    try {
      await api.delete(`/rfqs/${rfqId}`, { withCredentials: true });
      setSelected(null);
      setDetail(null);
      navigate('/main/manage-rfq', { replace: true });
      await fetchList();

      setResultModal({
        status: 'success',
        title: 'RFQ Berhasil Dihapus',
        message: 'RFQ beserta detail terkait sudah dihapus.',
      });
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Gagal hapus RFQ';
      setError(message);
      setResultModal({
        status: 'error',
        title: 'Hapus RFQ Gagal',
        message,
      });
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    setConfirmSaving(true);
    try {
      if (confirmAction.type === 'delete-product') {
        await executeDeleteProduct(confirmAction.productId);
      }

      if (confirmAction.type === 'delete-rfq') {
        await executeDeleteRFQ(confirmAction.rfqId);
      }

      if (confirmAction.type === 'move-activity') {
        await executeMoveActivity(
          confirmAction.rfqId,
          confirmAction.code,
          confirmAction.targetDate,
          confirmAction.remarks
        );
      }
    } finally {
      setConfirmSaving(false);
      setConfirmAction(null);
    }
  };


  const Field = ({ label, value }: { label: string; value: any }) => (
    <div className="space-y-1">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="text-sm text-gray-800 break-words">{value ?? '-'}</div>
    </div>
  );

  return (
    <>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>

            <p className="text-sm text-gray-500">Edit/update product RFQ dan hapus RFQ.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* LIST */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl bg-white border border-gray-200 ring-1 ring-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-700">RFQ Saya</div>
                <button
                  onClick={fetchList}
                  className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white"
                >
                  Refresh
                </button>
              </div>

              <div className="max-h-[70vh] overflow-auto">
                {loading && <div className="px-4 py-8 text-sm text-gray-500">Loading...</div>}

                {!loading && data.length === 0 && (
                  <div className="px-4 py-8 text-sm text-gray-500">Belum ada RFQ.</div>
                )}

                {!loading &&
                  data.map((row) => (
                    <button
                      key={row.id}
                      onClick={() =>
                        navigate(`/main/manage-rfq/${row.id}?rfq_no=${encodeURIComponent(row.rfq_no)}`)
                      }
                      className={`w-full text-left px-4 py-3 border-t border-gray-100 hover:bg-gray-50 transition ${selected?.id === row.id ? 'bg-blue-50' : 'bg-white'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-blue-700">{row.rfq_no}</div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRfqStatusBadgeClass(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {row.pfs_type && <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 font-bold text-gray-600">{row.pfs_type}</span>}
                        New: {row.new_part_name || '-'} • Similar: {row.similar_part_name || '-'}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* DETAIL */}
          <div className="lg:col-span-3 space-y-4">
            {!selected && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
                Pilih RFQ di kiri untuk mulai edit / delete.
              </div>
            )}

            {selected && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-gray-800">{selected.rfq_no}</div>
                    <div className="mt-1">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRfqStatusBadgeClass(
                          selected.status
                        )}`}
                      >
                        {selected.status}
                      </span>
                      {selected.pfs_type && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                          {selected.pfs_type === 'FG' ? 'FORGING' : selected.pfs_type === 'TLS' ? 'TOOLSET' : selected.pfs_type === 'JCK' ? 'JACK' : selected.pfs_type}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={deleteRFQ}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    <Trash2 size={16} />
                    Delete RFQ
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="text-xs font-medium text-gray-500">Current Activity</div>
                    <div className="mt-1 text-sm font-semibold text-gray-800">
                      {preferValue(mainActivity?.activity_desc, mainActivity?.statusactivity) || '-'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="text-xs font-medium text-gray-500">Timeline</div>
                    <div className="mt-1 text-sm text-gray-700">
                      {timelineLoading ? 'Loading...' : timeline.length ? `${timeline.length} item(s)` : 'Belum ada timeline'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selected && detailLoading && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading detail...</div>
            )}

            {selected && !detailLoading && detail && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Move Activity</div>
                      <div className="mt-1 text-xs text-gray-500">
                        Pilih activity code dan simpan remarks (optional).
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-1">
                      <div className="text-xs font-medium text-gray-500">Status Activity</div>
                      <select
                        value={moveCode}
                        onChange={(e) => {
                          const nextCode = e.target.value;
                          setMoveCode(nextCode);
                          applyMoveFormFromPlan(nextCode, activityPlans);
                        }}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                        disabled={activityOptionsLoading}
                      >
                        <option value="">{activityOptionsLoading ? 'Loading...' : 'Pilih activity'}</option>
                        {selectableActivityOptions.map((o) => (
                          <option key={o.code_act} value={o.code_act}>
                            {o.code_act} — {o.descr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1 sm:col-span-1">
                      <div className="text-xs font-medium text-gray-500">Target Date</div>
                      <input
                        type="date"
                        value={moveTargetDate}
                        onChange={(e) => setMoveTargetDate(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-1">
                      <div className="text-xs font-medium text-gray-500">Remarks</div>
                      <textarea
                        value={moveRemarks}
                        onChange={(e) => setMoveRemarks(e.target.value)}
                        className="w-full min-h-20 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                        placeholder="Catatan (optional)"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end">
                    <button
                      onClick={moveActivity}
                      disabled={moveSaving || !selected}
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                    >
                      {moveSaving ? 'Saving...' : 'Move Activity'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-sm font-semibold text-gray-800">Activity Timeline</div>
                  {timelineLoading && <div className="mt-3 text-sm text-gray-500">Loading...</div>}
                  {!timelineLoading && timeline.length === 0 && (
                    <div className="mt-3 text-sm text-gray-500">Belum ada aktivitas.</div>
                  )}
                  {!timelineLoading && timeline.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {timeline.map((t, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-semibold text-gray-800">{t.activity_name || '-'}</div>
                            <div className="text-xs text-gray-500">{formatDateTimeInAppTZ(t.created_at)}</div>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">by {t.created_by || '-'}</div>
                          {t.remarks && (
                            <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{t.remarks}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {groupedProducts.map((g) => (
                  <div key={g.label} className="space-y-3">
                    <div className="text-sm font-semibold text-gray-700">{g.label}</div>
                    <div className="space-y-4">
                      {g.rows.map((row, idx) => {
                        const productId = toNum(pickFirst(row, ['product_id', 'id']));
                        const partName = pickFirst(row, ['part_name']);
                        const customer = pickFirst(row, ['customer']);
                        const productType = pickFirst(row, ['product_type']);

                        return (
                          <div key={`${productId}-${idx}`} className="rounded-2xl border border-gray-200 bg-white p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-gray-800">{String(productType || 'Product')}</div>
                                <div className="text-xs text-gray-500">
                                  {String(partName || '-')}{customer ? ` • ${customer}` : ''}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openEdit(row)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                  <Pencil size={14} />
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteProduct(row)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-white"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <Field label="Part No" value={pickFirst(row, ['part_no'])} />
                              <Field label="Model" value={pickFirst(row, ['model'])} />
                              <Field label="Volume / Month" value={pickFirst(row, ['volume_month'])} />
                              <Field label="Material" value={pickFirst(row, ['material'])} />
                              <Field label="Product Weight" value={pickFirst(row, ['product_weight'])} />
                              <Field label="Delivery" value={pickFirst(row, ['delivery_condition'])} />
                            </div>

                            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                              <div className="text-sm font-semibold text-gray-700">Remarks</div>
                              <div className="mt-2 grid grid-cols-1 gap-2">
                                <Field label="Forging" value={pickFirst(row, ['td_remark_forg'])} />
                                <Field label="Component" value={pickFirst(row, ['td_remark_comp'])} />
                                <Field label="Machining" value={pickFirst(row, ['td_remark_mach'])} />
                                <Field label="Assembly" value={pickFirst(row, ['td_remark_asse'])} />
                                <Field label="Document" value={pickFirst(row, ['td_remark_doc'])} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* EDIT MODAL */}
        {editOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white border border-gray-200 shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <div className="text-sm font-semibold text-gray-800">Edit Product</div>
                  <div className="text-xs text-gray-500">Product ID: {editForm.product_id}</div>
                </div>
                <button
                  onClick={() => setEditOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-auto">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500">Product Type</div>
                    <select
                      value={String(editForm.product_type || '').trim().toUpperCase()}
                      onChange={(e) => setEditForm((p) => ({ ...p, product_type: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Pilih...</option>
                      <option value="NEW">NEW</option>
                      <option value="SIMILAR">SIMILAR</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500">Customer</div>
                    <input
                      value={editForm.customer}
                      onChange={(e) => setEditForm((p) => ({ ...p, customer: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500">Part Name</div>
                    <input
                      value={editForm.part_name}
                      onChange={(e) => setEditForm((p) => ({ ...p, part_name: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500">Part No</div>
                    <input
                      value={editForm.part_no}
                      onChange={(e) => setEditForm((p) => ({ ...p, part_no: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500">Model</div>
                    <input
                      value={editForm.model}
                      onChange={(e) => setEditForm((p) => ({ ...p, model: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500">Volume / Month</div>
                    <input
                      value={editForm.volume_month}
                      onChange={(e) => setEditForm((p) => ({ ...p, volume_month: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500">Material</div>
                    <input
                      value={editForm.material}
                      onChange={(e) => setEditForm((p) => ({ ...p, material: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500">Product Weight</div>
                    <input
                      value={editForm.product_weight}
                      onChange={(e) => setEditForm((p) => ({ ...p, product_weight: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      inputMode="decimal"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <div className="text-xs font-medium text-gray-500">Delivery Condition</div>
                    <input
                      value={editForm.delivery_condition}
                      onChange={(e) => setEditForm((p) => ({ ...p, delivery_condition: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="text-sm font-semibold text-gray-700">Remarks</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-500">Forging</div>
                      <textarea
                        value={editForm.remark_forg}
                        onChange={(e) => setEditForm((p) => ({ ...p, remark_forg: e.target.value }))}
                        className="w-full min-h-24 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-500">Component</div>
                      <textarea
                        value={editForm.remark_comp}
                        onChange={(e) => setEditForm((p) => ({ ...p, remark_comp: e.target.value }))}
                        className="w-full min-h-24 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-500">Machining</div>
                      <textarea
                        value={editForm.remark_mach}
                        onChange={(e) => setEditForm((p) => ({ ...p, remark_mach: e.target.value }))}
                        className="w-full min-h-24 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-500">Assembly</div>
                      <textarea
                        value={editForm.remark_asse}
                        onChange={(e) => setEditForm((p) => ({ ...p, remark_asse: e.target.value }))}
                        className="w-full min-h-24 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <div className="text-xs font-medium text-gray-500">Document</div>
                      <textarea
                        value={editForm.remark_doc}
                        onChange={(e) => setEditForm((p) => ({ ...p, remark_doc: e.target.value }))}
                        className="w-full min-h-24 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditOpen(false)}
                  className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white"
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={editSaving}
                >
                  {editSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmActionModal
          confirmAction={confirmAction}
          loading={confirmSaving}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
        />

        <ActionResultModal resultModal={resultModal} onClose={() => setResultModal(null)} />
      </div>
    </>
  );
};

export default ManageRfqMarketing;
