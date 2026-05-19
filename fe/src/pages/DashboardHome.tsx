import React, { useEffect, useState, useMemo } from 'react';
import api from '../api/axios';
import { useAuth } from '../auth/useAuth';
import {
  RefreshCw,
  ChevronDown,
  ClipboardList,
  CheckCircle2,
  Clock,
  FileText,
  ArrowRight,
  BarChart3,
  Activity,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getRfqStatusBadgeClass, isRfqPendingGroup, normalizeRfqStatus } from '../utils/rfqStatus';

/* ===== TYPES ===== */
interface RFQInfo {
  id: number;
  rfq_no: string;
  status?: string;
  pfs_type?: string;
  new_part_name?: string;
  similar_part_name?: string;
  code_act?: string;
}

interface ActivityPlanRow {
  code_act: string;
  activity_name: string;
  pic?: string | null;
  pic_name?: string | null;
  pic_role?: string | null;
  target_dd?: string | null;
  target_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  remarks?: string | null;
  [key: string]: any;
}

/* ===== HELPERS ===== */
const isMonthFilled = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  if (['-', '0', 'false', 'null', 'undefined', 'no'].includes(normalized)) return false;
  return true;
};

const DashboardHome: React.FC = () => {
  const { user } = useAuth();

  /* ===== INSIGHTS DUMMY DATA & STATES ===== */
  const [timeUnit, setTimeUnit] = useState('Hari');
  const [priorityFilter, setPriorityFilter] = useState('All');

  const leadTimeData = [
    { label: 'Preliminary Feasibility Study', target: 1, actual: 1.2 },
    { label: 'Standard Cost', target: 2, actual: 2.6 },
    { label: 'Feasibility Summary', target: 3, actual: 3.8 },
    { label: 'Price Quotation', target: 1, actual: 1.1 },
    { label: 'Letter of Intent (LOI)', target: 1, actual: 0.8 },
  ];

  const bottleneckData = [
    { label: 'Feasibility Summary', percentage: 45, color: '#FF4D4F' },
    { label: 'Standard Cost', percentage: 30, color: '#FFA940' },
    { label: 'Price Quotation', percentage: 15, color: '#1890FF' },
    { label: 'Preliminary Feasibility Study', percentage: 7, color: '#52C41A' },
    { label: 'Letter of Intent', percentage: 3, color: '#9254DE' },
  ];

  const topPriorityRfqs = [
    { rfqNo: 'RFQ-24045', customer: 'Astra Honda Motor', dept: 'Engineering', amount: 'Rp 2.450.000.000', priority: 'High', stage: 'Standard Cost', stageColor: '#FFA940', leadTime: '3 / 8 Hari', status: 'On Progress', statusColor: 'orange' },
    { rfqNo: 'RFQ-24038', customer: 'Yamaha Indonesia', dept: 'Engineering', amount: 'Rp 1.850.000.000', priority: 'High', stage: 'Feasibility Summary', stageColor: '#FF4D4F', leadTime: '5 / 8 Hari', status: 'On Progress', statusColor: 'orange' },
    { rfqNo: 'RFQ-24052', customer: 'Suzuki Indomobil', dept: 'Engineering', amount: 'Rp 850.000.000', priority: 'Medium', stage: 'Price Quotation', stageColor: '#1890FF', leadTime: '6 / 8 Hari', status: 'On Progress', statusColor: 'orange' },
    { rfqNo: 'RFQ-24041', customer: 'Mitsubishi Motors', dept: 'Engineering', amount: 'Rp 620.000.000', priority: 'Medium', stage: 'Standard Cost', stageColor: '#FFA940', leadTime: '2 / 8 Hari', status: 'On Progress', statusColor: 'orange' },
    { rfqNo: 'RFQ-24048', customer: 'Daihatsu Indonesia', dept: 'Engineering', amount: 'Rp 420.000.000', priority: 'Normal', stage: 'Preliminary Feasibility Study', stageColor: '#52C41A', leadTime: '1 / 8 Hari', status: 'On Track', statusColor: 'green' },
  ];

  const priorityData = [
    { label: 'High', count: 12, percentage: '9.4%', color: '#FF4D4F' },
    { label: 'Medium', count: 38, percentage: '29.7%', color: '#FFA940' },
    { label: 'Normal', count: 78, percentage: '60.9%', color: '#52C41A' },
  ];

  const timelineRfqs = [
    {
      rfqNo: 'RFQ-24045',
      customer: 'Astra Honda Motor',
      amount: 'Rp 2.450.000.000',
      priority: 'High',
      connectorWidth: '20%',
      step1: { status: 'completed', date: '02 Mei' },
      step2: { status: 'active', date: '03 - 04 Mei' },
      step3: { status: 'pending', date: '' },
      step4: { status: 'pending', date: '' },
      step5: { status: 'pending', date: '' },
      leadTimeText: '3 / 8 Hari',
      status: 'On Progress',
      progressWidth: '37.5%',
    },
    {
      rfqNo: 'RFQ-24038',
      customer: 'Yamaha Indonesia',
      amount: 'Rp 1.850.000.000',
      priority: 'High',
      connectorWidth: '40%',
      step1: { status: 'completed', date: '01 Mei' },
      step2: { status: 'completed', date: '02 - 03 Mei' },
      step3: { status: 'active', date: '04 - 06 Mei' },
      step4: { status: 'pending', date: '' },
      step5: { status: 'pending', date: '' },
      leadTimeText: '5 / 8 Hari',
      status: 'On Progress',
      progressWidth: '62.5%',
    },
    {
      rfqNo: 'RFQ-24052',
      customer: 'Suzuki Indomobil',
      amount: 'Rp 850.000.000',
      priority: 'Medium',
      connectorWidth: '60%',
      step1: { status: 'completed', date: '05 Mei' },
      step2: { status: 'completed', date: '06 - 07 Mei' },
      step3: { status: 'completed', date: '08 - 10 Mei' },
      step4: { status: 'active', date: '11 Mei' },
      step5: { status: 'pending', date: '' },
      leadTimeText: '6 / 8 Hari',
      status: 'On Progress',
      progressWidth: '75%',
    },
    {
      rfqNo: 'RFQ-24041',
      customer: 'Mitsubishi Motors',
      amount: 'Rp 620.000.000',
      priority: 'Medium',
      connectorWidth: '10%',
      step1: { status: 'error', date: '1 Hari' },
      step2: { status: 'pending', date: '' },
      step3: { status: 'pending', date: '' },
      step4: { status: 'pending', date: '' },
      step5: { status: 'pending', date: '' },
      leadTimeText: '2 Hari',
      status: 'Overdue',
      progressWidth: '100%',
    },
    {
      rfqNo: 'RFQ-24048',
      customer: 'Daihatsu Indonesia',
      amount: 'Rp 420.000.000',
      priority: 'Normal',
      connectorWidth: '0%',
      step1: { status: 'completed', date: '07 Mei' },
      step2: { status: 'pending', date: '' },
      step3: { status: 'pending', date: '' },
      step4: { status: 'pending', date: '' },
      step5: { status: 'pending', date: '' },
      leadTimeText: '1 / 8 Hari',
      status: 'On Track',
      progressWidth: '12.5%',
    },
  ];

  /* RFQ list */
  const [allRfqs, setAllRfqs] = useState<RFQInfo[]>([]);
  const [rfqLoading, setRfqLoading] = useState(true);

  /* Activity dashboard */
  const [selectedRfqId, setSelectedRfqId] = useState<number | null>(null);
  const [activityRows, setActivityRows] = useState<ActivityPlanRow[]>([]);
  const [monthColumns, setMonthColumns] = useState<string[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  /* ===== FETCH RFQs ===== */
  const fetchRfqs = async () => {
    setRfqLoading(true);
    try {
      const res = await api.get('/rfqs', { withCredentials: true });
      const raw = (res.data?.data as RFQInfo[]) || [];
      const rfqs: RFQInfo[] = raw
        .map((r: any) => ({
          id: Number(r?.id ?? 0),
          rfq_no: String(r?.rfq_no ?? ''),
          status: normalizeRfqStatus(r?.status),
          pfs_type: String(r?.pfs_type ?? ''),
          new_part_name: r?.new_part_name || '',
          similar_part_name: r?.similar_part_name || '',
          code_act: String(r?.code_act ?? r?.statusactivity ?? ''),
        }))
        .filter((r) => Number.isFinite(r.id) && r.id > 0 && r.rfq_no);
      setAllRfqs(rfqs);

      if (rfqs.length > 0 && !selectedRfqId) {
        setSelectedRfqId(rfqs[0].id);
      }
    } catch (e) {
      console.error('Failed to load RFQs:', e);
      setAllRfqs([]);
    } finally {
      setRfqLoading(false);
    }
  };

  /* ===== FETCH ACTIVITY DATA ===== */
  const fetchActivityData = async (id: number) => {
    setActivityLoading(true);
    setActivityError('');
    try {
      const res = await api.get(`/rfqs/${id}/dashboard-activity`, {
        withCredentials: true,
      });
      const data = (res.data?.data as ActivityPlanRow[]) || [];
      const monthColsFromApi = Array.isArray(res.data?.month_columns)
        ? (res.data.month_columns as string[])
        : [];
      setActivityRows(data);
      setMonthColumns(monthColsFromApi);
    } catch (e: any) {
      setActivityError(e?.response?.data?.message || 'Gagal memuat activity dashboard');
      setActivityRows([]);
      setMonthColumns([]);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    fetchRfqs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRfqId) {
      fetchActivityData(selectedRfqId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRfqId]);

  /* ===== COMPUTED STATS ===== */
  const stats = useMemo(() => {
    const total = allRfqs.length;
    const draft = allRfqs.filter((r) => r.status === 'draft').length;
    const pending = allRfqs.filter((r) => isRfqPendingGroup(r.status)).length;
    const approved = allRfqs.filter((r) => r.status === 'approved').length;
    return { total, draft, pending, approved };
  }, [allRfqs]);

  const selectedRfq = useMemo(
    () => allRfqs.find((r) => r.id === selectedRfqId),
    [allRfqs, selectedRfqId]
  );

  /* ===== QUICK LINKS ===== */
  const quickLinks = useMemo(() => {
    const links: { label: string; path: string; icon: React.ElementType; roles?: string[] }[] = [
      { label: 'RFQ List', path: '/main/rfq-list', icon: ClipboardList },
      { label: 'Activity Dashboard', path: '/main/activity-dashboard', icon: Activity, roles: ['marketing', 'engineering', 'admin'] },
      { label: 'Engineering Activity', path: '/main/engineering-activity-dashboard', icon: BarChart3, roles: ['engineering', 'admin'] },
    ];
    if (!user) return links;
    return links.filter((l) => !l.roles || l.roles.includes(user.role));
  }, [user]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  }, []);

  /* ===== RENDER ===== */
  return (
    <div className="space-y-6">
      {/* ===== WELCOME BANNER ===== */}
      <div className="relative rounded-2xl bg-transparent px-2 py-2">
        <div className="relative z-10">
          <div className="text-2xl font-extrabold tracking-wide text-[#0D79BD] lg:text-[28px]">
            {greeting},{' '}
            <span className="text-[#0A5F96]">{user?.name || 'User'}</span>
          </div>
          <div className="mt-1 text-sm font-semibold tracking-[0.01em] text-slate-600">
            New Project Development Gate System — PT. Menara Terus Makmur
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#0D79BD]/20 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#0D79BD]">
            Role: <span className="rounded bg-[#0D79BD]/10 px-2 py-0.5 font-bold uppercase tracking-wider text-[#0A5F96]">{user?.role || '-'}</span>
          </div>
        </div>
        {/* Decorative logo */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg opacity-60">
          <img src="/MTMhd.png" alt="MTM" className="h-10 w-auto object-contain" />
        </div>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total */}
        <Link to="/main/rfq-list" className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-5 shadow-sm transition-all hover:shadow-md hover:border-blue-200">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-[#0D79BD] transition-colors group-hover:bg-blue-100">
            <FileText size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{rfqLoading ? '—' : stats.total}</div>
            <div className="text-xs font-medium text-gray-500">Total RFQ</div>
          </div>
        </Link>
        {/* Draft */}
        <Link to="/main/rfq-list?status=draft" className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-5 shadow-sm transition-all hover:shadow-md hover:border-amber-200">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100">
            <Clock size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{rfqLoading ? '—' : stats.draft}</div>
            <div className="text-xs font-medium text-gray-500">Draft</div>
          </div>
        </Link>
        {/* Pending */}
        <Link to="/main/rfq-list?status=pending" className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-5 shadow-sm transition-all hover:shadow-md hover:border-orange-200">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-orange-50 text-orange-600 transition-colors group-hover:bg-orange-100">
            <ClipboardList size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{rfqLoading ? '—' : stats.pending}</div>
            <div className="text-xs font-medium text-gray-500">Pending</div>
          </div>
        </Link>
        {/* Approved */}
        <Link to="/main/rfq-list?status=approved" className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-5 shadow-sm transition-all hover:shadow-md hover:border-emerald-200">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{rfqLoading ? '—' : stats.approved}</div>
            <div className="text-xs font-medium text-gray-500">Approved</div>
          </div>
        </Link>
      </div>

      {/* ===== QUICK LINKS ===== */}
      <div>
        <div className="mb-3 text-sm font-semibold text-gray-700">Quick Access</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-[#0D79BD]/30 hover:bg-blue-50/50 hover:text-[#0D79BD] hover:shadow-md"
              >
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-gray-50 text-gray-400 transition-colors group-hover:bg-[#0D79BD]/10 group-hover:text-[#0D79BD]">
                  <Icon size={18} />
                </div>
                <span className="flex-1">{link.label}</span>
                <ArrowRight size={16} className="text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#0D79BD]" />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        {/* ROW 1: Lead Time per Menu & Bottleneck */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Chart 1: Lead Time per Menu */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Lead Time per Menu (Target vs Actual)</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Analisis perbandingan waktu penyelesaian rata-rata</p>
                </div>
                <div className="relative">
                  <select
                    value={timeUnit}
                    onChange={(e) => setTimeUnit(e.target.value)}
                    className="appearance-none rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-8 text-xs font-semibold text-gray-700 hover:bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0D79BD]/40"
                  >
                    <option value="Hari">Hari</option>
                    <option value="Jam">Jam</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                </div>
              </div>

              {/* Chart Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-600 mb-6">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-[#2A75E6]"></span>
                  Target ({timeUnit})
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-[#52C41A]"></span>
                  Actual Avg ({timeUnit})
                </div>
                <div className="flex items-center gap-2">
                  <span className="border-t-2 border-dashed border-red-500 w-6"></span>
                  Target Total (7 Hari)
                </div>
              </div>

              {/* Custom CSS Bar Graph */}
              <div className="relative h-60 w-full mt-4 flex flex-col justify-end">
                {/* Horizontal Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 text-[10px] font-semibold text-gray-400">
                  <div className="border-b border-gray-100 w-full flex justify-between pb-0.5">
                    <span>4</span>
                    <span className="text-red-500 font-bold pr-2 bg-white pl-1 relative z-10">Total Target 8 Hari</span>
                  </div>
                  <div className="border-b border-gray-100 w-full pb-0.5">3</div>
                  <div className="border-b border-gray-100 w-full pb-0.5">2</div>
                  <div className="border-b border-gray-100 w-full pb-0.5">1</div>
                  <div className="border-b border-gray-200 w-full pb-0.5">0</div>
                </div>

                {/* Red dashed line running horizontally */}
                <div className="absolute w-full border-t-2 border-dashed border-red-500 top-0 pointer-events-none z-0"></div>

                {/* Columns Container */}
                <div className="relative z-10 w-full h-[85%] flex justify-around items-end px-6 pb-2">
                  {leadTimeData.map((d, index) => {
                    // Maximum target + actual value is 4
                    const targetHeight = `${(d.target / 4) * 100}%`;
                    const actualHeight = `${(d.actual / 4) * 100}%`;

                    return (
                      <div key={index} className="flex flex-col items-center group w-[15%]">
                        {/* Bars Pair */}
                        <div className="flex items-end gap-1.5 w-full justify-center h-40">
                          {/* Target Bar */}
                          <div className="relative w-5 rounded-t bg-[#2A75E6] hover:bg-blue-600 transition-all duration-300 flex justify-center group-hover:scale-105" style={{ height: targetHeight }}>
                            <span className="absolute -top-6 text-[10px] font-bold text-[#2A75E6]">{d.target}</span>
                          </div>
                          {/* Actual Bar */}
                          <div className="relative w-5 rounded-t bg-[#52C41A] hover:bg-emerald-600 transition-all duration-300 flex justify-center group-hover:scale-105" style={{ height: actualHeight }}>
                            <span className="absolute -top-6 text-[10px] font-bold text-[#52C41A]">{d.actual}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Labels beneath the columns */}
            <div className="w-full flex justify-around px-2 text-[10px] font-bold text-gray-500 text-center leading-snug">
              {leadTimeData.map((d, index) => (
                <div key={index} className="w-[18%] flex justify-center">
                  <span className="max-w-[70px] truncate-2-lines" title={d.label}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 2: Bottleneck */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-800">Bottleneck (Paling Sering Terlambat)</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-6">Persentase keterlambatan per modul tahapan</p>

              <div className="flex flex-col items-center justify-center py-4">
                {/* Conic-gradient Donut Chart */}
                <div 
                  className="relative w-40 h-40 rounded-full flex items-center justify-center shadow-inner transition-transform duration-500 hover:scale-105"
                  style={{
                    background: 'conic-gradient(#FF4D4F 0% 45%, #FFA940 45% 75%, #1890FF 75% 90%, #52C41A 90% 97%, #9254DE 97% 100%)'
                  }}
                >
                  <div className="absolute w-28 h-28 bg-white rounded-full flex flex-col items-center justify-center shadow-md">
                    <span className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">Total Terlambat</span>
                    <span className="text-xl font-extrabold text-gray-800 leading-tight">76 RFQ</span>
                  </div>
                </div>
              </div>

              {/* Legends */}
              <div className="mt-6 space-y-2">
                {bottleneckData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs font-semibold text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                      <span className="truncate max-w-[150px]">{item.label}</span>
                    </div>
                    <span className="text-gray-900 font-bold">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Insight Tip */}
            <div className="mt-6 rounded-xl bg-blue-50 border border-blue-100 p-3.5 flex gap-2.5 items-start">
              <Info className="text-blue-600 shrink-0 mt-0.5" size={16} />
              <p className="text-[11px] font-semibold text-blue-800 leading-relaxed">
                Feasibility Summary adalah tahapan yang paling sering menyebabkan keterlambatan.
              </p>
            </div>
          </div>
        </div>

        {/* ROW 2: Top Priority RFQ Table & RFQ by Priority Donut */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Table: Top Priority RFQ */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Top Priority RFQ (Berdasarkan Amount)</h3>
                  <p className="text-xs text-gray-500 mt-0.5">RFQ dengan nilai estimasi investasi tertinggi</p>
                </div>
                <Link
                  to="/main/rfq-list"
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white hover:border-gray-300 transition-all"
                >
                  Lihat Semua
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 font-semibold">
                      <th className="pb-3 pr-2">RFQ No</th>
                      <th className="pb-3 px-2">Customer</th>
                      <th className="pb-3 px-2">Department</th>
                      <th className="pb-3 px-2 text-right">Amount (Est.)</th>
                      <th className="pb-3 px-2 text-center">Priority</th>
                      <th className="pb-3 px-2">Current Stage</th>
                      <th className="pb-3 px-2 text-center">Lead Time</th>
                      <th className="pb-3 pl-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPriorityRfqs.map((rfq, idx) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors font-medium">
                        <td className="py-3.5 pr-2 font-bold text-gray-800">{rfq.rfqNo}</td>
                        <td className="py-3.5 px-2 text-gray-600">{rfq.customer}</td>
                        <td className="py-3.5 px-2 text-gray-500">{rfq.dept}</td>
                        <td className="py-3.5 px-2 text-right font-bold text-gray-900">{rfq.amount}</td>
                        <td className="py-3.5 px-2 text-center">
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider
                            ${rfq.priority === 'High' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}
                          >
                            {rfq.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: rfq.stageColor }}></span>
                            <span className="truncate max-w-[120px]">{rfq.stage}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-2 text-center text-gray-600 font-bold">{rfq.leadTime}</td>
                        <td className="py-3.5 pl-2 text-center">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide
                            ${rfq.statusColor === 'orange' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}
                          >
                            {rfq.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Chart 3: RFQ by Priority */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-gray-800">RFQ by Priority</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Sebaran RFQ berdasarkan skala prioritas</p>
                </div>
                <div className="relative">
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="appearance-none rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-8 text-xs font-semibold text-gray-700 hover:bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0D79BD]/40"
                  >
                    <option value="All">All</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-4">
                {/* Conic Donut Priority */}
                <div 
                  className="relative w-40 h-40 rounded-full flex items-center justify-center shadow-inner transition-transform duration-500 hover:scale-105"
                  style={{
                    background: 'conic-gradient(#FF4D4F 0% 9.4%, #FFA940 9.4% 39.1%, #52C41A 39.1% 100%)'
                  }}
                >
                  <div className="absolute w-28 h-28 bg-white rounded-full flex flex-col items-center justify-center shadow-md">
                    <span className="text-xl font-extrabold text-gray-800 leading-tight">128</span>
                    <span className="text-[10px] font-extrabold tracking-wider text-gray-400 uppercase">Total RFQ</span>
                  </div>
                </div>
              </div>

              {/* Legends for priorities */}
              <div className="mt-6 space-y-2">
                {priorityData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs font-semibold text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 font-extrabold">{item.count}</span>
                      <span className="text-gray-400 text-[10px]">({item.percentage})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: RFQ Timeline Progress */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base font-bold text-gray-800">RFQ Timeline Progress</h3>
            <p className="text-xs text-gray-500 mt-0.5">Jadwal target pengerjaan vs pencapaian aktual (Gantt-Style)</p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[950px] space-y-4">
              {/* Timeline Header Row */}
              <div className="grid grid-cols-12 text-center text-[10px] font-bold text-gray-500 border-b border-gray-100 pb-3">
                <div className="col-span-3 text-left">RFQ Info</div>
                <div className="col-span-7 grid grid-cols-5 text-center leading-tight">
                  <div className="px-1 border-r border-gray-100">
                    <div>PFS Study</div>
                    <div className="text-gray-400 mt-0.5 font-normal">(1 Hari)</div>
                  </div>
                  <div className="px-1 border-r border-gray-100">
                    <div>Standard Cost</div>
                    <div className="text-gray-400 mt-0.5 font-normal">(2 Hari)</div>
                  </div>
                  <div className="px-1 border-r border-gray-100">
                    <div>Feasibility Summary</div>
                    <div className="text-gray-400 mt-0.5 font-normal">(2 Hari)</div>
                  </div>
                  <div className="px-1 border-r border-gray-100">
                    <div>Price Quotation</div>
                    <div className="text-gray-400 mt-0.5 font-normal">(1 Hari)</div>
                  </div>
                  <div className="px-1">
                    <div>Letter of Intent</div>
                    <div className="text-gray-400 mt-0.5 font-normal">(1 Hari)</div>
                  </div>
                </div>
                <div className="col-span-2 text-right">Total Lead Time</div>
              </div>

              {/* Timeline Rows */}
              {timelineRfqs.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50/30 transition-colors font-medium">
                  {/* RFQ Info */}
                  <div className="col-span-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 text-xs">{row.rfqNo}</span>
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase
                        ${row.priority === 'High' ? 'bg-red-50 text-red-600' : row.priority === 'Medium' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}
                      >
                        {row.priority}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[180px]">{row.customer}</div>
                    <div className="text-[10px] text-gray-400 font-bold mt-0.5">{row.amount}</div>
                  </div>

                  {/* Horizontal Progress Graph */}
                  <div className="col-span-7 relative h-12 flex items-center">
                    {/* Background Progress Track */}
                    <div className="absolute w-[80%] left-[10%] h-1 bg-gray-100 rounded-full z-0"></div>

                    {/* Green active connector line */}
                    {row.connectorWidth && (
                      <div 
                        className={`absolute h-1 left-[10%] rounded-full z-0 
                          ${row.status === 'Overdue' ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: row.connectorWidth }}
                      ></div>
                    )}

                    {/* Interactive Milestone Nodes */}
                    <div className="absolute inset-0 grid grid-cols-5 z-10 text-center items-center">
                      {/* Step 1: PFS */}
                      <div className="flex flex-col items-center justify-center relative">
                        {row.step1.status === 'completed' ? (
                          <div className="h-5 w-5 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center text-white text-[8px] font-extrabold shadow-sm">✓</div>
                        ) : row.step1.status === 'error' ? (
                          <div className="h-5 w-5 rounded-full bg-red-500 border-4 border-white flex items-center justify-center text-white text-[8px] font-black shadow-sm">!</div>
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-white border-2 border-gray-200 shadow-inner"></div>
                        )}
                        <span className="absolute -bottom-4 text-[9px] font-bold text-gray-500">{row.step1.date}</span>
                      </div>

                      {/* Step 2: Standard Cost */}
                      <div className="flex flex-col items-center justify-center relative">
                        {row.step2.status === 'completed' ? (
                          <div className="h-5 w-5 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center text-white text-[8px] font-extrabold shadow-sm">✓</div>
                        ) : row.step2.status === 'active' ? (
                          <div className="h-5 w-5 rounded-full bg-white border-4 border-orange-500 shadow-md animate-pulse"></div>
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-white border-2 border-gray-200 shadow-inner"></div>
                        )}
                        <span className="absolute -bottom-4 text-[9px] font-bold text-gray-500">{row.step2.date}</span>
                      </div>

                      {/* Step 3: Feasibility Summary */}
                      <div className="flex flex-col items-center justify-center relative">
                        {row.step3.status === 'completed' ? (
                          <div className="h-5 w-5 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center text-white text-[8px] font-extrabold shadow-sm">✓</div>
                        ) : row.step3.status === 'active' ? (
                          <div className="h-5 w-5 rounded-full bg-white border-4 border-orange-500 shadow-md animate-pulse"></div>
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-white border-2 border-gray-200 shadow-inner"></div>
                        )}
                        <span className="absolute -bottom-4 text-[9px] font-bold text-gray-500">{row.step3.date}</span>
                      </div>

                      {/* Step 4: Price Quotation */}
                      <div className="flex flex-col items-center justify-center relative">
                        {row.step4.status === 'completed' ? (
                          <div className="h-5 w-5 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center text-white text-[8px] font-extrabold shadow-sm">✓</div>
                        ) : row.step4.status === 'active' ? (
                          <div className="h-5 w-5 rounded-full bg-white border-4 border-blue-500 shadow-md animate-pulse"></div>
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-white border-2 border-gray-200 shadow-inner"></div>
                        )}
                        <span className="absolute -bottom-4 text-[9px] font-bold text-gray-500">{row.step4.date}</span>
                      </div>

                      {/* Step 5: LOI */}
                      <div className="flex flex-col items-center justify-center relative">
                        {row.step5.status === 'completed' ? (
                          <div className="h-5 w-5 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center text-white text-[8px] font-extrabold shadow-sm">✓</div>
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-white border-2 border-gray-200 shadow-inner"></div>
                        )}
                        <span className="absolute -bottom-4 text-[9px] font-bold text-gray-500">{row.step5.date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Lead Time */}
                  <div className="col-span-2 text-right pl-4">
                    <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-gray-700">
                      <span>{row.leadTimeText}</span>
                      <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold uppercase
                        ${row.status === 'Overdue' ? 'bg-red-50 text-red-600' : row.status === 'On Track' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}
                      >
                        {row.status}
                      </span>
                    </div>
                    {/* Tiny Progress Bar */}
                    <div className="mt-1.5 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500
                          ${row.status === 'Overdue' ? 'bg-red-500' : row.status === 'On Track' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: row.progressWidth }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== ACTIVITY DASHBOARD SECTION ===== */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <Activity size={20} className="text-[#0D79BD]" />
              Activity Dashboard
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              Timeline view untuk RFQ activity dengan milestone per bulan
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* RFQ Selector */}
            {allRfqs.length > 0 && (
              <div className="min-w-[200px]">
                <label className="mb-1 block text-xs font-medium text-gray-500">Select RFQ</label>
                <div className="relative">
                  <select
                    value={selectedRfqId || ''}
                    onChange={(e) => setSelectedRfqId(Number(e.target.value))}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-800 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0D79BD]/40"
                  >
                    {allRfqs.map((rfq) => (
                      <option key={String(rfq.id)} value={String(rfq.id)}>
                        {rfq.rfq_no}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => selectedRfqId && fetchActivityData(selectedRfqId)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-white hover:border-gray-300"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Selected RFQ info pill */}
        {selectedRfq && (
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-6 py-3 text-xs">
            <span className="font-medium text-gray-500">RFQ:</span>
            <span className="font-semibold text-gray-800">{selectedRfq.rfq_no}</span>
            {selectedRfq.status && (
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize
                  ${getRfqStatusBadgeClass(selectedRfq.status)}`}>
                {selectedRfq.status}
              </span>
            )}
            {selectedRfq.new_part_name && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600">New: <span className="font-medium">{selectedRfq.new_part_name}</span></span>
              </>
            )}
            {selectedRfq.pfs_type && selectedRfq.pfs_type !== 'undefined' && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600">Type: <span className="font-medium capitalize">{selectedRfq.pfs_type}</span></span>
              </>
            )}
          </div>
        )}

        {/* Activity error */}
        {activityError && (
          <div className="mx-6 my-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {activityError}
          </div>
        )}

        {/* Activity loading */}
        {activityLoading && (
          <div className="flex items-center justify-center gap-3 px-6 py-20 text-gray-400">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm">Loading activity data...</span>
          </div>
        )}

        {/* No RFQs at all */}
        {!rfqLoading && allRfqs.length === 0 && !activityLoading && (
          <div className="px-6 py-20 text-center text-gray-400">
            <ClipboardList size={36} className="mx-auto mb-3 text-gray-300" />
            <div className="text-sm">Belum ada RFQ. Buat RFQ baru untuk melihat activity dashboard.</div>
          </div>
        )}

        {/* No activity data */}
        {!activityLoading && !activityError && activityRows.length === 0 && allRfqs.length > 0 && (
          <div className="px-6 py-20 text-center text-gray-400">
            <ClipboardList size={36} className="mx-auto mb-3 text-gray-300" />
            <div className="text-sm">Tidak ada activity data untuk RFQ ini.</div>
          </div>
        )}

        {/* ===== Activity Table ===== */}
        {!activityLoading && activityRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <th colSpan={4} className="border-r border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-600">
                    Main Activities
                  </th>
                  {monthColumns.map((m) => (
                    <th key={m} className="min-w-[48px] border-r border-gray-100 px-2 py-3 text-center text-xs font-semibold text-gray-600">
                      {m}
                    </th>
                  ))}
                  <th className="min-w-[140px] px-4 py-3 text-left text-xs font-semibold text-gray-600">
                    Remarks
                  </th>
                </tr>
                <tr className="border-b border-gray-200 bg-gray-100/70">
                  <th className="w-12 border-r border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500">Code</th>
                  <th className="border-r border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="w-24 border-r border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500">PIC</th>
                  <th className="w-20 border-r border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500">Target</th>
                  {monthColumns.map((m) => (
                    <th key={m} className="border-r border-gray-100 px-2 py-2 text-center text-xs font-medium text-gray-500">&nbsp;</th>
                  ))}
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map((row, idx) => (
                  <tr
                    key={`${row.code_act}-${idx}`}
                    className={`border-b border-gray-100 transition-colors hover:bg-blue-50/50
                      ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="border-r border-gray-200 px-3 py-3 text-xs font-semibold text-gray-800">
                      {row.code_act}
                    </td>
                    <td className="border-r border-gray-200 px-3 py-3 text-xs text-gray-700">
                      {row.activity_name}
                    </td>
                    <td className="border-r border-gray-200 px-3 py-3 text-xs text-gray-600">
                      {row.pic || row.pic_name || '-'}
                    </td>
                    <td className="border-r border-gray-200 px-3 py-3 text-xs">
                      {(row.target_dd || row.target_date) ? (
                        <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {row.target_dd || row.target_date}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    {monthColumns.map((month) => {
                      const filled = isMonthFilled(row[month]);
                      return (
                        <td key={month} className="border-r border-gray-100 px-2 py-3 text-center">
                          {filled ? (
                            <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                              ✔
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {row.remarks || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        {!activityLoading && activityRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-5 border-t border-gray-100 px-6 py-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-700">✔</span>
              Activity dijadwalkan pada bulan tersebut
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-300">-</span>
              Activity tidak dijadwalkan
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHome;
