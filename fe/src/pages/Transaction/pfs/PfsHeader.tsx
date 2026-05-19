import React from 'react';
import type { RFQOption, TabKey } from './pfsTypes';

type Props = {
  rfqOptions: RFQOption[];
  selectedRFQId: number | null;
  onSelectRFQ: (id: number, rfqNo: string) => void;
  userLevel: number | null;
  activeTab: TabKey;
  setActiveTabInUrl: (tab: TabKey) => void;
};

const PfsHeader: React.FC<Props> = ({
  rfqOptions,
  selectedRFQId,
  onSelectRFQ,
  userLevel,
  activeTab,
  setActiveTabInUrl,
}) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">RFQ List</label>
          <select
            value={selectedRFQId || ''}
            onChange={(e) => {
              const id = Number(e.target.value || 0);
              const selectedOption = rfqOptions.find((row) => row.id === id);
              if (id > 0 && selectedOption) onSelectRFQ(id, selectedOption.rfq_no);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Pilih RFQ</option>
            {rfqOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.rfq_no}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">Pilih RFQ terlebih dahulu, lalu isi per tab dari kiri ke kanan.</p>
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-800">
            <span className="font-semibold">User Level</span>
            <span>L{userLevel ?? '-'}</span>
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              <button type="button" onClick={() => setActiveTabInUrl('overview')} className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'overview' ? 'bg-[#0D79BD] text-white' : 'bg-gray-100 text-gray-700'}`}>
                Overview
              </button>
              <button type="button" onClick={() => setActiveTabInUrl('estimation')} className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'estimation' ? 'bg-[#0D79BD] text-white' : 'bg-gray-100 text-gray-700'}`}>
                Estimation Process Plan
              </button>
              <button type="button" onClick={() => setActiveTabInUrl('drawing')} className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'drawing' ? 'bg-[#0D79BD] text-white' : 'bg-gray-100 text-gray-700'}`}>
                Drawing
              </button>
              <button type="button" onClick={() => setActiveTabInUrl('timeframe')} className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'timeframe' ? 'bg-[#0D79BD] text-white' : 'bg-gray-100 text-gray-700'}`}>
                Time Frame
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">Tab aktif: <span className="font-medium text-gray-700">{activeTab}</span></p>
        </div>
      </div>
    </div>
  );
};

export default PfsHeader;
