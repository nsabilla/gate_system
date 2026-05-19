import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Search } from 'lucide-react';
import { getRfqStatusBadgeClass } from '../../utils/rfqStatus';

/* ================= TYPES ================= */
type RFQItem = {
  rfq_no: string;
  status: string;
  created_by: string;
  created_at: string;
  new_part_name: string | null;
  similar_part_name: string | null;
  pfs_type: string | null;
};

const RFQList: React.FC = () => {
  const [data, setData] = useState<RFQItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');

  /* ================= FETCH DATA ================= */
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rfqs', {
        params: {
          status: status || undefined,
          q: keyword || undefined,
        },
        withCredentials: true,
      });
      setData(res.data.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div>
        {/* <h1 className="text-2xl font-semibold text-gray-800">
          RFQ List
        </h1> */}
       
      </div>

      {/* ================= FILTER ================= */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="
            rounded-xl
            border border-gray-200
            bg-white
            px-3 py-2 text-sm
            text-gray-700
            focus:outline-none focus:ring-2 focus:ring-blue-100
          "
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
        </select>

        <div className="relative sm:col-span-2">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            placeholder="Search RFQ No / Product"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="
              w-full rounded-xl
              border border-gray-200
              bg-gray-50
              pl-9 pr-3 py-2 text-sm
              text-gray-700
              focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100
            "
          />
        </div>

        <button
          onClick={fetchData}
          className="
            rounded-xl bg-[#0D79BD]
            px-4 py-2 text-sm font-semibold text-white
            hover:bg-[#0B6BA8]
            active:scale-[0.98]
            transition
          "
        >
          Apply Filter
        </button>
      </div>

      {/* ================= DESKTOP TABLE ================= */}
      <div className="hidden md:block overflow-x-auto rounded-2xl bg-white border border-gray-200 ring-1 ring-gray-100">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-5 py-4 text-left font-medium">
                RFQ No
              </th>
              <th className="px-5 py-4 text-left font-medium">
                New Product
              </th>
              <th className="px-5 py-4 text-left font-medium">
                Similar Product
              </th>
              <th className="px-5 py-4 text-left font-medium">
                Type
              </th>
              <th className="px-5 py-4 text-left font-medium">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-gray-500"
                >
                  Loading data...
                </td>
              </tr>
            )}

            {!loading && data.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-gray-500"
                >
                  Tidak ada data RFQ
                </td>
              </tr>
            )}

            {!loading &&
              data.map((row) => (
                <tr
                  key={row.rfq_no}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-5 py-4 font-medium text-blue-600">
                    {row.rfq_no}
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    {row.new_part_name || '-'}
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    {row.similar_part_name || '-'}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">
                      {row.pfs_type || 'FG'}
                    </span>
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
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ================= MOBILE CARD ================= */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-gray-100 animate-pulse"
            />
          ))}

        {!loading &&
          data.map((row) => (
            <div
              key={row.rfq_no}
              className="rounded-2xl bg-white p-4 space-y-2 ring-1 ring-gray-200"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-600">
                  {row.rfq_no}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getRfqStatusBadgeClass(
                    row.status
                  )}`}
                >
                  {row.status}
                </span>
                {row.pfs_type && (
                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                    {row.pfs_type}
                  </span>
                )}
              </div>

              <div className="text-sm text-gray-600">
                <p>
                  <span className="font-medium text-gray-500">
                    New:
                  </span>{' '}
                  {row.new_part_name || '-'}
                </p>
                <p>
                  <span className="font-medium text-gray-500">
                    Similar:
                  </span>{' '}
                  {row.similar_part_name || '-'}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default RFQList;
