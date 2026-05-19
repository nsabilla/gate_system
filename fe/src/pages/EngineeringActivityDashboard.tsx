import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../api/axios';

interface EngineeringRow {
  code_act: string;
  activity_name: string;
  pic?: string | null;
  target_dd?: string | null;
  remarks?: string | null;
  [key: string]: any;
}

const ENGINEERING_MONTH_HEADERS = Array.from({ length: 12 }, (_, index) => (index === 0 ? 'M' : `M+${index}`));

const isMonthFilled = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  if (['-', '0', 'false', 'null', 'undefined', 'no'].includes(normalized)) return false;
  return true;
};

const EngineeringActivityDashboard: React.FC = () => {
  const [rows, setRows] = useState<EngineeringRow[]>([]);
  const [monthColumns, setMonthColumns] = useState<string[]>(ENGINEERING_MONTH_HEADERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await api.get('/rfq-activities/engineering-template', { withCredentials: true });
      const data = (res.data?.data as EngineeringRow[]) || [];
      const monthColsFromApi = Array.isArray(res.data?.month_columns)
        ? (res.data.month_columns as string[])
        : [];

      setRows(data);
      setMonthColumns(monthColsFromApi.length > 0 ? monthColsFromApi : ENGINEERING_MONTH_HEADERS);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat engineering activity dashboard');
      setRows([]);
      setMonthColumns(ENGINEERING_MONTH_HEADERS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-lg font-semibold text-gray-800">Engineering Activity Dashboard</div>
          <div className="text-sm text-gray-500">Template timeline activity engineering (terpisah dari Activity Dashboard RFQ).</div>
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
          Tidak ada data engineering activity.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white border border-gray-200 ring-1 ring-gray-100">
          <table className="w-full min-w-[1120px] border-collapse text-xs">
            <thead>
              <tr className="bg-[#8ca9bc] border-b border-[#5f7d95]">
                <th colSpan={4} className="px-3 py-2 text-left font-semibold text-[#1f3f55] border border-[#5f7d95]">
                  Time Frame
                </th>
                <th colSpan={monthColumns.length} className="px-3 py-2 text-center font-semibold text-[#1f3f55] border border-[#5f7d95]">
                  Years
                </th>
                <th rowSpan={2} className="px-3 py-2 text-center font-semibold text-[#1f3f55] border border-[#5f7d95] min-w-32">
                  Remark
                </th>
              </tr>

              <tr className="bg-[#9bb6c8] border-b border-[#5f7d95]">
                <th className="px-2 py-2 text-center font-semibold text-[#1f3f55] border border-[#5f7d95] w-10">
                  No
                </th>
                <th className="px-3 py-2 text-left font-semibold text-[#1f3f55] border border-[#5f7d95] min-w-56">
                  Main Activities
                </th>
                <th className="px-2 py-2 text-center font-semibold text-[#1f3f55] border border-[#5f7d95] w-20">
                  PIC
                </th>
                <th className="px-2 py-2 text-center font-semibold text-[#1f3f55] border border-[#5f7d95] w-24">
                  Due Date
                </th>
                {monthColumns.map((m) => (
                  <th
                    key={m}
                    className="px-2 py-2 text-center font-semibold text-[#1f3f55] border border-[#5f7d95] min-w-10"
                  >
                    {m}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.code_act}-${idx}`} className="border-b border-[#7f9bb0]">
                  <td className="px-2 py-2 text-center font-medium text-[#15354b] border border-[#7f9bb0] bg-[#d0deeb]">
                    {idx + 1}
                  </td>

                  <td className="px-2 py-2 text-left text-[#0f3e31] border border-[#7f9bb0] bg-[#80b27a]">
                    {row.activity_name}
                  </td>

                  <td className="px-2 py-2 text-center font-medium text-[#20450e] border border-[#7f9bb0] bg-[#b1db45]">
                    {row.pic || '-'}
                  </td>

                  <td className="px-2 py-2 text-center font-medium text-[#20450e] border border-[#7f9bb0] bg-[#b1db45]">
                    {row.target_dd || '-'}
                  </td>

                  {monthColumns.map((month) => {
                    const filled = isMonthFilled(row[month]);
                    return (
                      <td
                        key={month}
                        className={`h-8 border border-[#7f9bb0] ${filled ? 'bg-[#5e7f98]' : 'bg-[#d9e7f1]'}`}
                      />
                    );
                  })}

                  <td className="px-2 py-2 text-left text-[#2a4a63] border border-[#7f9bb0] bg-[#b9d2e4]">
                    {row.remarks || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EngineeringActivityDashboard;
