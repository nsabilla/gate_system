import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { Search, X } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { formatDateTimeInAppTZ } from '../../utils/datetime';
import { getRfqStatusBadgeClass, isRfqPendingGroup, normalizeRfqStatus, normalizeRfqStatusFilter } from '../../utils/rfqStatus';

/* ================= TYPES ================= */
type RFQItem = {
  id: number;
  rfq_no: string;
  status: string;
  code_act?: string | null;
  statusactivity?: string | null;
  created_by?: string;
  created_at?: string;
  new_part_name?: string | null;
  similar_part_name?: string | null;
  rfq_approver_username?: string | null;
  rfq_approver_badge?: string | null;
  pfs_approver_username?: string | null;
  pfs_approver_badge?: string | null;
  rfq_prepared_username?: string | null;
  rfq_prepared_badge?: string | null;
  rfq_l2_username?: string | null;
  rfq_l2_badge?: string | null;
  rfq_l3_username?: string | null;
  rfq_l3_badge?: string | null;
  pfs_prepared_username?: string | null;
  pfs_prepared_badge?: string | null;
  pfs_l2_username?: string | null;
  pfs_l2_badge?: string | null;
  pfs_l3_username?: string | null;
  pfs_l3_badge?: string | null;
  pfs_created?: boolean;
  rfq_l2_approved?: boolean;
  rfq_l3_approved?: boolean;
};

type RFQDetailRow = Record<string, any>;

type TimelineItem = {
  activity_name?: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
};

type MainActivityRow = {
  statusactivity?: string;
  activity_desc?: string;
};

const preferValue = (...vals: Array<unknown>) => {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s !== '') return s;
  }
  return '';
};

/* ================= HELPERS ================= */

const getBackendOrigin = () => {
  const base = String(api.defaults.baseURL || '').trim();

  // Absolute API base from env/config, e.g. http://localhost:8085/api/v1
  if (/^https?:\/\//i.test(base)) {
    return base.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
  }

  // Relative API base ("/api/v1") would point to frontend origin. For uploads,
  // force backend host:port so opening file does not get handled by SPA router.
  const protocol = window.location.protocol || 'http:';
  const host = window.location.hostname || 'localhost';
  return `${protocol}//${host}:8085`;
};

const toFileUrl = (path?: string | null) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = getBackendOrigin();
  const normalized = String(path).replace(/\\/g, '/');
  const clean = normalized.replace(/^\/+/, '');
  return `${origin}/${clean}`;
};

const fileKind = (path: string) => {
  const clean = path.split('?')[0].split('#')[0];
  const ext = clean.includes('.') ? clean.split('.').pop()?.toLowerCase() : '';
  const imageExt = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
  if (ext && imageExt.includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
};

const pickFirst = (row: RFQDetailRow, keys: string[]) => {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
};

const canApproveByStage = (row: RFQItem, level: number | null) => {
  const codeRaw = String(row.code_act ?? row.statusactivity ?? '').trim();
  const codeNum = Number(codeRaw.replace(/\D+/g, '') || codeRaw || '0');
  const codeActReady = Number.isFinite(codeNum) && codeNum === 3;
  const l2 = Boolean(row.rfq_l2_approved);
  const l3 = Boolean(row.rfq_l3_approved);
  const isApproved = normalizeRfqStatus(row.status) === 'approved';

  if (!codeActReady || isApproved) return false;
  if (l3) return false;
  if (level === 2) return !l2;
  if (level === 3) return l2 && !l3;
  return false;
};

const badgeLabel = (value: string | null | undefined, fallback: string) => {
  const v = String(value || '').trim();
  return v || fallback;
};

const Field = ({ label, value }: { label: string; value: any }) => (
  <div className="space-y-1">
    <div className="text-xs font-medium text-gray-500">{label}</div>
    <div className="text-sm text-gray-800 break-words">{value ?? '-'}</div>
  </div>
);

const FilePreview = ({ label, path }: { label: string; path?: string | null }) => {
  const url = useMemo(() => toFileUrl(path), [path]);
  if (!url) return <Field label={label} value={'-'} />;

  const kind = fileKind(url);

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="flex items-center gap-3">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-[#0D79BD] hover:underline"
        >
          Open file
        </a>
        <span className="text-xs text-gray-400 break-all">{path}</span>
      </div>

      {kind === 'image' && (
        <div className="space-y-2">
          <a href={url} target="_blank" rel="noreferrer" className="block">
            <img
              src={url}
              alt={label}
              className="max-h-72 w-full rounded-xl border border-gray-200 object-contain bg-white"
              loading="lazy"
            />
          </a>
          <div className="text-xs text-gray-500">Klik gambar untuk lihat ukuran asli.</div>
        </div>
      )}

      {kind === 'pdf' && (
        <iframe
          title={label}
          src={url}
          className="h-72 w-full rounded-xl border border-gray-200 bg-white"
        />
      )}

      {kind === 'other' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Preview tidak tersedia untuk tipe file ini.
        </div>
      )}
    </div>
  );
};

/* ================= MAIN ================= */
const RfqPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const pfsType = useMemo(() => {
    const t = String((params as { type?: string })?.type || '').trim().toLowerCase();
    return (t === 'forging' || t === 'jack' || t === 'toolset' ? t : 'forging') as 'forging' | 'jack' | 'toolset';
  }, [params]);

  const selectedIdFromUrl = useMemo(() => {
    const raw = String((params as any)?.rfqId || '').trim();
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }, [params]);

  const selectedNoFromUrl = useMemo(() => {
    const sp = new URLSearchParams(location.search || '');
    return (sp.get('rfq_no') || '').trim();
  }, [location.search]);
  const statusFromUrl = useMemo(() => {
    const sp = new URLSearchParams(location.search || '');
    return normalizeRfqStatusFilter(sp.get('status'));
  }, [location.search]);
  const [data, setData] = useState<RFQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [canApprove, setCanApprove] = useState(false);
  const [approveLevel, setApproveLevel] = useState<number | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const [status, setStatus] = useState(statusFromUrl);
  const [keyword, setKeyword] = useState('');

  const [selected, setSelected] = useState<RFQItem | null>(null);
  const [detail, setDetail] = useState<RFQDetailRow[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [mainActivity, setMainActivity] = useState<MainActivityRow | null>(null);

  const canApproveL2 = (row: RFQItem) => canApprove && approveLevel === 2 && canApproveByStage(row, 2);
  const canApproveL3 = (row: RFQItem) => canApprove && approveLevel === 3 && canApproveByStage(row, 3);

  const applyLocalFilters = (rows: RFQItem[]) => {
    const statusFilter = normalizeRfqStatusFilter(status);
    const keywordFilter = String(keyword || '').trim().toLowerCase();

    return rows.filter((row) => {
      const rowStatus = normalizeRfqStatus(row.status);
      const statusOk = !statusFilter
        || (statusFilter === 'pending' ? isRfqPendingGroup(rowStatus) : rowStatus === statusFilter);
      if (!statusOk) return false;

      if (!keywordFilter) return true;
      const haystack = [row.rfq_no, row.new_part_name, row.similar_part_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keywordFilter);
    });
  };

  useEffect(() => {
    setStatus(statusFromUrl);
  }, [statusFromUrl]);

  useEffect(() => {
    // Keep UI selection in sync with the URL
    if (!selectedIdFromUrl) {
      setSelected(null);
      setDetail(null);
      setDetailError('');
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

  /* ================= FETCH LIST ================= */
  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rfqs', {
        params: {
          status: status || undefined,
          q: keyword || undefined,
        },
        withCredentials: true,
      });
      setCanApprove(Boolean(res.data?.can_approve));
      const levelValue = Number(res.data?.approver_level || 0);
      setApproveLevel(Number.isFinite(levelValue) && levelValue > 0 ? levelValue : null);
      const rows = (res.data?.data as any[]) || [];
      const normalized: RFQItem[] = rows
        .map((r) => ({
          id: Number(r?.id ?? r?.rfq_id),
          rfq_no: String(r?.rfq_no ?? ''),
          status: String(r?.status ?? ''),
          code_act: r?.code_act != null ? String(r?.code_act) : null,
          statusactivity: r?.statusactivity != null ? String(r?.statusactivity) : null,
          created_by: r?.created_by,
          created_at: r?.created_at,
          new_part_name: r?.new_part_name ?? null,
          similar_part_name: r?.similar_part_name ?? null,
          rfq_approver_username: r?.rfq_approver_username ?? null,
          rfq_approver_badge: r?.rfq_approver_badge ?? null,
          pfs_approver_username: r?.pfs_approver_username ?? null,
          pfs_approver_badge: r?.pfs_approver_badge ?? null,
          rfq_prepared_username: r?.rfq_prepared_username ?? null,
          rfq_prepared_badge: r?.rfq_prepared_badge ?? null,
          rfq_l2_username: r?.rfq_l2_username ?? null,
          rfq_l2_badge: r?.rfq_l2_badge ?? null,
          rfq_l3_username: r?.rfq_l3_username ?? null,
          rfq_l3_badge: r?.rfq_l3_badge ?? null,
          pfs_prepared_username: r?.pfs_prepared_username ?? null,
          pfs_prepared_badge: r?.pfs_prepared_badge ?? null,
          pfs_l2_username: r?.pfs_l2_username ?? null,
          pfs_l2_badge: r?.pfs_l2_badge ?? null,
          pfs_l3_username: r?.pfs_l3_username ?? null,
          pfs_l3_badge: r?.pfs_l3_badge ?? null,
          pfs_created: Boolean(r?.pfs_created),
          rfq_l2_approved: Boolean(r?.rfq_l2_approved),
          rfq_l3_approved: Boolean(r?.rfq_l3_approved),
        }))
        .filter((r) => Number.isFinite(r.id) && r.id > 0 && r.rfq_no);

      setData(applyLocalFilters(normalized));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveRFQ = async (item: RFQItem) => {
    if (!canApprove) return;

    if (!canApproveByStage(item, approveLevel)) {
      window.alert('RFQ belum memenuhi urutan approval level (L2 dulu, lalu L3).');
      return;
    }

    const levelLabel = approveLevel === 2 ? 'L2' : approveLevel === 3 ? 'L3' : '';
    const ok = window.confirm(`Approve ${levelLabel} RFQ ${item.rfq_no}?`);
    if (!ok) return;

    try {
      setApprovingId(item.id);
      await api.post(`/rfqs/${item.id}/approve`, {}, { withCredentials: true });
      await fetchList();
    } catch (e: any) {
      window.alert(e?.response?.data?.message || 'Gagal approve RFQ');
    } finally {
      setApprovingId(null);
    }
  };

  /* ================= FETCH DETAIL ================= */
  const fetchDetail = async (item: RFQItem) => {
    setSelected(item);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    setTimeline([]);
    setMainActivity(null);

    try {
      const res = await api.get(`/rfqs/${item.id}`, { withCredentials: true });
      setDetail((res.data?.data as RFQDetailRow[]) || []);

      // load activity meta + timeline (best-effort)
      setTimelineLoading(true);
      const [metaRes, timeRes] = await Promise.allSettled([
        api.get('/rfqs/mainactivity', { params: { id: item.id }, withCredentials: true }),
        api.get(`/rfqs/${item.id}/timeline`, { withCredentials: true }),
      ]);

      if (metaRes.status === 'fulfilled') {
        const rows = (metaRes.value.data?.data as any[]) || [];
        setMainActivity((rows[0] as any) || null);
      }
      if (timeRes.status === 'fulfilled') {
        const rows = (timeRes.value.data?.data as any[]) || [];
        setTimeline(rows as any);
      }
    } catch (e: any) {
      setDetailError(e?.response?.data?.message || 'Gagal memuat detail RFQ');
      setDetail(null);
    } finally {
      setDetailLoading(false);
      setTimelineLoading(false);
    }
  };

  const groupedProducts = useMemo(() => {
    const rows = detail || [];
    const groups: { label: string; rows: RFQDetailRow[] }[] = [];

    const newRows = rows.filter((r) => String(r?.product_type || r?.ProductType || '').toLowerCase() === 'new');
    const similarRows = rows.filter(
      (r) => String(r?.product_type || r?.ProductType || '').toLowerCase() === 'similar'
    );
    const otherRows = rows.filter((r) => !newRows.includes(r) && !similarRows.includes(r));

    if (newRows.length) groups.push({ label: 'New Product', rows: newRows });
    if (similarRows.length) groups.push({ label: 'Similar Product', rows: similarRows });
    if (otherRows.length) groups.push({ label: 'Other', rows: otherRows });

    return groups;
  }, [detail]);

  const renderProduct = (row: RFQDetailRow, idx: number) => {
    const productType = pickFirst(row, ['product_type', 'ProductType']);
    const partName = pickFirst(row, ['part_name', 'PartName']);
    const partNo = pickFirst(row, ['part_no', 'PartNo']);
    const model = pickFirst(row, ['model', 'Model']);
    const customer = pickFirst(row, ['customer', 'Customer']);
    const volumeMonth = pickFirst(row, ['volume_month', 'VolumeMonth']);
    const material = pickFirst(row, ['material', 'Material']);
    const productWeight = pickFirst(row, ['product_weight', 'ProductWeight']);
    const deliveryCondition = pickFirst(row, ['delivery_condition', 'DeliveryCondition']);

    const remarkForg = pickFirst(row, ['t_d_remark_forg', 'td_remark_forg', 'remark_forg', 'RemarkForg']);
    const remarkComp = pickFirst(row, ['t_d_remark_comp', 'td_remark_comp', 'remark_comp', 'RemarkComp']);
    const remarkMach = pickFirst(row, ['t_d_remark_mach', 'td_remark_mach', 'remark_mach', 'RemarkMach']);
    const remarkAsse = pickFirst(row, ['t_d_remark_asse', 'td_remark_asse', 'remark_asse', 'RemarkAsse']);
    const remarkDoc = pickFirst(row, ['t_d_remark_doc', 'td_remark_doc', 'remark_doc', 'RemarkDoc', 'remark']);

    const techForg = pickFirst(row, ['technical_document_forg', 'tech_forg', 'TechForg']);
    const techComp = pickFirst(row, ['technical_document_comp', 'tech_comp', 'TechComp']);
    const techMach = pickFirst(row, ['technical_document_mach', 'tech_mach', 'TechMach']);
    const techAsse = pickFirst(row, ['technical_document_asse', 'tech_asse', 'TechAsse']);
    const techDoc = pickFirst(row, [
      'technical_document_doc',
      'tech_doc',
      'TechDoc',
      'technical_document',
      'tech_path',
      'TechPath',
    ]);

    const techName = pickFirst(row, ['technical_document_name', 'tech_name', 'TechName']);
    const techType = pickFirst(row, ['technical_document_type', 'tech_type', 'TechType']);
    const techSize = pickFirst(row, ['technical_document_size', 'tech_size', 'TechSize']);

    return (
      <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-800">
              {String(productType || 'Product')}
            </div>
            <div className="text-xs text-gray-500">{String(partName || '-')}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer" value={customer} />
          <Field label="Part No" value={partNo} />
          <Field label="Model" value={model} />
          <Field label="Volume / Month" value={volumeMonth} />
          <Field label="Material" value={material} />
          <Field label="Product Weight" value={productWeight} />
          <Field label="Delivery Condition" value={deliveryCondition} />
          <Field label="Tech Meta" value={[techName, techType, techSize].filter(Boolean).join(' • ') || '-'} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
            <div className="text-sm font-semibold text-gray-700">Remarks</div>
            <div className="grid grid-cols-1 gap-2">
              <Field label="Forging" value={remarkForg} />
              <Field label="Component" value={remarkComp} />
              <Field label="Machining" value={remarkMach} />
              <Field label="Assembly" value={remarkAsse} />
              <Field label="Document" value={remarkDoc} />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-700">Technical Documents</div>
            <div className="grid grid-cols-1 gap-4">
              <FilePreview label="Forging" path={techForg} />
              <FilePreview label="Component" path={techComp} />
              <FilePreview label="Machining" path={techMach} />
              <FilePreview label="Assembly" path={techAsse} />
              <FilePreview label="Document" path={techDoc} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ================= UI ================= */
  return (
    <>

    <div className="space-y-6">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-800">
          <span className="font-semibold">User Level</span>
          <span>L{approveLevel ?? '-'}</span>
        </div>
        <p className="text-sm text-gray-500">
          Klik nomor RFQ untuk lihat detail & file yang diinput marketing.
        </p>
      </div>

      {/* ================= FILTER ================= */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
        </select>

        <div className="relative sm:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search RFQ No / Product"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                fetchList();
              }
            }}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <button
          onClick={fetchList}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.98] transition"
        >
          Apply Filter
        </button>
      </div>

      {/* ================= CONTENT ================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* LIST */}
        <div className="lg:col-span-2 space-y-4">
          <div className="overflow-x-auto rounded-2xl bg-white border border-gray-200 ring-1 ring-gray-100">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-4 text-left font-medium">RFQ No</th>
                  <th className="px-5 py-4 text-left font-medium">Status</th>
                  <th className="px-5 py-4 text-left font-medium">RFQ Levels</th>
                  <th className="px-5 py-4 text-left font-medium">PFS Levels</th>
                  {approveLevel === 2 && <th className="px-5 py-4 text-left font-medium">Action L2</th>}
                  {approveLevel === 3 && <th className="px-5 py-4 text-left font-medium">Action L3</th>}
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={approveLevel === 2 || approveLevel === 3 ? 5 : 4} className="px-5 py-10 text-center text-gray-500">
                      Loading data...
                    </td>
                  </tr>
                )}

                {!loading && data.length === 0 && (
                  <tr>
                    <td colSpan={approveLevel === 2 || approveLevel === 3 ? 5 : 4} className="px-5 py-10 text-center text-gray-500">
                      Tidak ada data RFQ
                    </td>
                  </tr>
                )}

                {!loading &&
                  data.map((row) => {
                    const active = selected?.id === row.id;
                    return (
                      <tr
                        key={row.id}
                        className={`border-t border-gray-100 hover:bg-gray-50 ${active ? 'bg-blue-50/40' : ''}`}
                      >
                        <td className="px-5 py-4 font-medium">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/main/rfq-list/${row.id}?rfq_no=${encodeURIComponent(row.rfq_no)}`
                              )
                            }
                            className="text-blue-700 hover:underline"
                          >
                            {row.rfq_no}
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRfqStatusBadgeClass(
                              row.status
                            )}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-700">
                          <div className="space-y-1 text-xs leading-4">
                            <div><span className="font-semibold">{badgeLabel(row.rfq_prepared_badge, 'Prepared')}:</span> {row.rfq_prepared_username || '-'}</div>
                            <div><span className="font-semibold">{badgeLabel(row.rfq_l2_badge, 'Approve')}:</span> {row.rfq_l2_username || '-'}</div>
                            <div><span className="font-semibold">{badgeLabel(row.rfq_l3_badge, 'Approve')}:</span> {row.rfq_l3_username || '-'}</div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-700">
                          {row.pfs_created ? (
                            <div className="space-y-1 text-xs leading-4">
                              <div><span className="font-semibold">{badgeLabel(row.pfs_prepared_badge, 'Prepared')}:</span> {row.pfs_prepared_username || '-'}</div>
                              <div><span className="font-semibold">{badgeLabel(row.pfs_l2_badge, 'Approve')}:</span> {row.pfs_l2_username || '-'}</div>
                              <div><span className="font-semibold">{badgeLabel(row.pfs_l3_badge, 'Approve')}:</span> {row.pfs_l3_username || '-'}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        {approveLevel === 2 && (
                          <td className="px-5 py-4">
                            {canApproveL2(row) ? (
                              <button
                                type="button"
                                onClick={() => approveRFQ(row)}
                                disabled={approvingId === row.id}
                                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {approvingId === row.id ? 'Approving...' : 'Approve L2'}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        )}
                        {approveLevel === 3 && (
                          <td className="px-5 py-4">
                            {canApproveL3(row) ? (
                              <button
                                type="button"
                                onClick={() => approveRFQ(row)}
                                disabled={approvingId === row.id}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {approvingId === row.id ? 'Approving...' : 'Approve L3'}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* <div className="text-xs text-gray-500">
            Tips: file preview membutuhkan backend expose folder <span className="font-mono">/uploads</span>.
          </div> */}
        </div>

        {/* DETAIL */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-gray-800">RFQ Detail</div>
                <div className="text-sm text-gray-500">
                  {selected ? (
                    <>
                      <span className="font-semibold text-gray-700">{selected.rfq_no}</span>
                      <span className="text-gray-400"> • </span>
                      <span className="text-gray-500">ID: {selected.id}</span>
                    </>
                  ) : (
                    'Pilih RFQ dari tabel di kiri.'
                  )}
                </div>
              </div>

              {selected && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/main/pfs/${pfsType}/${selected.id}?rfq_no=${encodeURIComponent(selected.rfq_no)}`)}
                    className="rounded-lg border border-[#0D79BD]/30 bg-[#0D79BD]/5 px-3 py-2 text-sm text-[#0D79BD] hover:bg-[#0D79BD]/10"
                  >
                    Open PFS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setDetail(null);
                      setDetailError('');
                      navigate('/main/rfq-list');
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    aria-label="Close detail"
                  >
                    <span className="inline-flex items-center gap-2">
                      <X size={16} />
                      Close
                    </span>
                  </button>
                </div>
              )}
            </div>

            {detailLoading && <div className="text-sm text-gray-500">Loading detail...</div>}

            {detailError && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {detailError}
              </div>
            )}

            {!detailLoading && selected && !detailError && (
              <>
                {(detail?.length || 0) === 0 ? (
                  <div className="text-sm text-gray-500">Tidak ada detail.</div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="text-xs font-medium text-gray-500">Current Activity</div>
                        <div className="mt-1 text-sm font-semibold text-gray-800">
                          {preferValue(mainActivity?.activity_desc, mainActivity?.statusactivity) || '-'}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="text-xs font-medium text-gray-500">Timeline</div>
                        <div className="mt-1 text-sm text-gray-700">
                          {timelineLoading
                            ? 'Loading timeline...'
                            : timeline.length
                              ? `${timeline.length} item(s)`
                              : 'Belum ada timeline'}
                        </div>
                      </div>
                    </div>

                    {groupedProducts.map((g) => (
                      <div key={g.label} className="space-y-3">
                        <div className="text-sm font-semibold text-gray-700">{g.label}</div>
                        <div className="space-y-5">{g.rows.map(renderProduct)}</div>
                      </div>
                    ))}

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
                                <div className="text-sm font-semibold text-gray-800">
                                  {t.activity_name || '-'}
                                </div>
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
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default RfqPage;
