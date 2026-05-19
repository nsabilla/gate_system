import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { formatDayMonthInAppTZ } from '../utils/datetime';

interface RFQInfo {
  id: number;
  rfq_id?: number;
  rfq_no: string;
}

interface ActivityPlanRow {
  rfq_id?: number;
  rfq_no?: string;
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
  [key: string]: any; // Allow dynamic month columns
}

const FIXED_COLUMNS = ['code_act', 'activity_name', 'pic', 'target_dd', 'start_date', 'end_date', 'remarks', 'rfq_id', 'rfq_no'];

const formatTarget = (row: ActivityPlanRow) => {
  if (row.target_dd && String(row.target_dd).trim() !== '') return String(row.target_dd);
  if (row.target_date && String(row.target_date).trim() !== '') {
    return formatDayMonthInAppTZ(row.target_date, String(row.target_date));
  }
  return '';
};

const formatPic = (row: ActivityPlanRow) => {
  const picValue = String(row.pic || '').trim();
  if (picValue) return picValue;

  const fallback = String(row.pic_name || '').trim();
  return fallback || '-';
};

const getRollingMonthOrder = () => {
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    out.push(d.toLocaleString('en-US', { month: 'short' }));
  }
  return out;
};

const getMonthColumns = (row: ActivityPlanRow): string[] => {
  const keys = Object.keys(row).filter((key) => !FIXED_COLUMNS.includes(key));
  const rolling = getRollingMonthOrder();
  const pos = new Map<string, number>();
  rolling.forEach((month, index) => pos.set(month, index));
  return keys.sort((a, b) => (pos.get(a) ?? 999) - (pos.get(b) ?? 999));
};

const isMonthFilled = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  if (['-', '0', 'false', 'null', 'undefined', 'no'].includes(normalized)) return false;
  return true;
};

const ActivityDashboard: React.FC = () => {
  const { rfqId } = useParams<{ rfqId?: string }>();
  const [allRfqs, setAllRfqs] = useState<RFQInfo[]>([]);
  const [selectedRfqId, setSelectedRfqId] = useState<number | null>(null);
  const [rows, setRows] = useState<ActivityPlanRow[]>([]);
  const [monthColumns, setMonthColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const parsePositiveId = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const id = Number(String(value).trim());
    if (!Number.isFinite(id) || id <= 0) return null;
    return id;
  };

  const fetchAllRfqs = async () => {
    try {
      const res = await api.get('/rfqs', { withCredentials: true });
      const raw = (res.data?.data as RFQInfo[]) || [];
      const rfqs: RFQInfo[] = raw
        .map((r) => ({
          id: Number(r?.id ?? r?.rfq_id ?? 0),
          rfq_no: String(r?.rfq_no ?? ''),
        }))
        .filter((r) => Number.isFinite(r.id) && r.id > 0 && r.rfq_no);
      setAllRfqs(rfqs);

      const paramId = parsePositiveId(rfqId);
      if (paramId) {
        setSelectedRfqId(paramId);
        return;
      }

      if (rfqs.length > 0) {
        setSelectedRfqId(Number(rfqs[0].id));
        return;
      }

      setSelectedRfqId(null);
      setRows([]);
      setMonthColumns([]);
      setLoading(false);
    } catch (e: any) {
      console.error('Failed to fetch RFQs:', e);
      setAllRfqs([]);
      setSelectedRfqId(null);
      setRows([]);
      setMonthColumns([]);
      setLoading(false);
    }
  };

  const fetchActivityData = async (id: number) => {
    setLoading(true);
    setError('');

    try {
      const res = await api.get(`/rfqs/${id}/dashboard-activity`, {
        withCredentials: true,
      });
      const data = (res.data?.data as ActivityPlanRow[]) || [];
      const monthColsFromApi = Array.isArray(res.data?.month_columns)
        ? (res.data.month_columns as string[])
        : [];
      // Add rfq_id to each row for reference
      const enrichedData = data.map((r) => ({ ...r, rfq_id: id }));
      setRows(enrichedData);
      setMonthColumns(monthColsFromApi.length > 0 ? monthColsFromApi : (enrichedData[0] ? getMonthColumns(enrichedData[0]) : []));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat activity dashboard');
      setRows([]);
      setMonthColumns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (selectedRfqId) {
      await fetchActivityData(selectedRfqId);
    }
  };

  useEffect(() => {
    fetchAllRfqs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  useEffect(() => {
    if (selectedRfqId) {
      fetchActivityData(selectedRfqId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRfqId]);

  const handleRfqChange = (id: string) => {
    setSelectedRfqId(Number(id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-lg font-semibold text-gray-800">Activity Dashboard</div>
          <div className="text-sm text-gray-500">Timeline view untuk RFQ activity dengan milestone per bulan.</div>
          
          {/* RFQ Selector */}
          {allRfqs.length > 0 && (
            <div className="mt-4 w-80">
              <label className="block text-xs font-medium text-gray-600 mb-1">Select RFQ</label>
              <div className="relative">
                <select
                  value={selectedRfqId || ''}
                  onChange={(e) => handleRfqChange(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2 px-3 text-sm text-gray-800 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {allRfqs.map((rfq) => (
                    <option key={String(rfq.id)} value={String(rfq.id)}>
                      {rfq.rfq_no}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => fetchData()}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl bg-white border border-gray-200 px-6 py-20 text-center text-gray-500">
          Loading...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 px-6 py-20 text-center text-gray-500">
          Tidak ada activity data untuk RFQ ini.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white border border-gray-200 ring-1 ring-gray-100">
          {(() => {
            const monthCols = monthColumns.length > 0 ? monthColumns : getMonthColumns(rows[0]);

            return (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th colSpan={4} className="px-4 py-3 text-left font-semibold text-gray-600 border-r border-gray-200">
                      Main Activities
                    </th>

                    {monthCols.map((m) => (
                      <th
                        key={m}
                        className="px-3 py-3 text-center font-semibold text-gray-600 border-r border-gray-100 min-w-12"
                      >
                        {m}
                      </th>
                    ))}

                    <th className="px-4 py-3 text-left font-semibold text-gray-600 min-w-40">
                      Remarks
                    </th>
                  </tr>

                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs border-r border-gray-200 w-12">
                      Code
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs border-r border-gray-200 flex-1">
                      Name
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs border-r border-gray-200 w-20">
                      PIC
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs border-r border-gray-200 w-20">
                      Target
                    </th>
                    {monthCols.map((m) => (
                      <th key={m} className="px-3 py-2 text-center font-medium text-gray-600 text-xs border-r border-gray-100">
                        &nbsp;
                      </th>
                    ))}
                    <th className="px-4 py-2 text-left font-medium text-gray-600 text-xs">
                      &nbsp;
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={`${row.code_act}-${idx}`}
                      className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}
                    >
                      <td className="px-3 py-3 font-semibold text-gray-800 border-r border-gray-200">
                        {row.code_act}
                      </td>

                      <td className="px-3 py-3 text-gray-700 border-r border-gray-200 text-xs">
                        {row.activity_name}
                      </td>

                      <td className="px-3 py-3 text-gray-600 border-r border-gray-200 text-xs">
                        {formatPic(row)}
                      </td>

                      <td className="px-3 py-3 text-gray-600 border-r border-gray-200 text-xs font-medium">
                        {formatTarget(row) ? (
                          <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">
                            {formatTarget(row)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {monthCols.map((month) => {
                        const filled = isMonthFilled(row[month]);
                        return (
                          <td
                            key={month}
                            className="px-3 py-3 text-center border-r border-gray-100"
                          >
                            {filled ? (
                              <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                                ✔
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {row.remarks || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1">
        <div>✔ = Activity dijadwalkan pada bulan tersebut</div>
        <div>- = Activity tidak dijadwalkan atau tidak applicable</div>
      </div>
    </div>
  );
};

export default ActivityDashboard;
