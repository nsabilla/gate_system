import React from 'react';
import type { StandardCostAttachment, StandardCostOverview } from '../../../../api/standardCost';

type Props = {
  overview: StandardCostOverview;
  onChange: (next: StandardCostOverview) => void;
  feasibilityFiles: StandardCostAttachment[];
  selectedFeasibilityFile: File | null;
  onSelectFeasibilityFile: (file: File | null) => void;
  onUploadFeasibilityFile: () => void;
  uploadingFeasibility: boolean;
  canUploadFeasibility: boolean;
  formatDateTime: (value: string) => string;
  buildFileUrl: (value: string) => string;
};

const OverviewTab: React.FC<Props> = ({
  overview,
  onChange,
  feasibilityFiles,
  selectedFeasibilityFile,
  onSelectFeasibilityFile,
  onUploadFeasibilityFile,
  uploadingFeasibility,
  canUploadFeasibility,
  formatDateTime,
  buildFileUrl,
}) => {
  const setField = (key: keyof StandardCostOverview, value: string) => {
    onChange({ ...overview, [key]: value });
  };

  const inputClass = "w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50 transition-all";
  const labelClass = "text-[10px] font-bold uppercase text-slate-500 mb-1 tracking-tight";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-lg bg-slate-100/80 px-4 py-3 border border-slate-200">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">General Overview</h3>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col">
            <span className={labelClass}>Company Name</span>
            <input 
              value={overview.company_name} 
              onChange={(e) => setField('company_name', e.target.value)} 
              className={inputClass} 
              placeholder="Enter company..." 
            />
          </div>
          <div className="flex flex-col">
            <span className={labelClass}>Part Number</span>
            <input 
              value={overview.part_number} 
              onChange={(e) => setField('part_number', e.target.value)} 
              className={inputClass} 
              placeholder="P/N..." 
            />
          </div>
          <div className="flex flex-col">
            <span className={labelClass}>Part Name</span>
            <input 
              value={overview.part_name} 
              onChange={(e) => setField('part_name', e.target.value)} 
              className={inputClass} 
              placeholder="Name..." 
            />
          </div>
          <div className="flex flex-col">
            <span className={labelClass}>Customer</span>
            <input 
              value={overview.customer} 
              onChange={(e) => setField('customer', e.target.value)} 
              className={inputClass} 
              placeholder="Customer name..." 
            />
          </div>
          <div className="flex flex-col">
            <span className={`${labelClass} text-orange-600`}>Rejection Rate (%)</span>
            <input 
              value={overview.rejection_rate} 
              onChange={(e) => setField('rejection_rate', e.target.value)} 
              className={`${inputClass} border-orange-200 bg-orange-50/20 font-semibold text-orange-900`} 
              placeholder="0.00" 
            />
          </div>
          <div className="flex flex-col">
            <span className={labelClass}>Similar Product</span>
            <input 
              value={overview.similar_product} 
              onChange={(e) => setField('similar_product', e.target.value)} 
              className={inputClass} 
              placeholder="..." 
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Feasibility Study (Optional)</h3>
        <p className="mt-2 text-xs text-gray-500">
          Upload file feasibility study untuk referensi standard cost (format .xls atau .xlsx).
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Upload Feasibility Study</label>
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={(e) => onSelectFeasibilityFile(e.target.files?.[0] || null)}
              disabled={uploadingFeasibility || !canUploadFeasibility}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="text-sm text-gray-600">
              File dipilih: <span className="font-medium text-gray-800">{selectedFeasibilityFile?.name || '-'}</span>
            </p>
          </div>

          <button
            type="button"
            disabled={!selectedFeasibilityFile || uploadingFeasibility || !canUploadFeasibility}
            onClick={onUploadFeasibilityFile}
            className="rounded-lg bg-[#0D79BD] px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {uploadingFeasibility ? 'Uploading...' : 'Upload Feasibility Study'}
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Feasibility Study Files</h4>
          {feasibilityFiles.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada file feasibility study.</p>
          ) : (
            feasibilityFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-800">{file.file_name}</div>
                  <div className="text-xs text-gray-500">
                    Upload by {file.uploaded_by || '-'} • {formatDateTime(file.created_at)}
                  </div>
                </div>
                <a
                  href={buildFileUrl(file.file_path)}
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
    </div>
  );
};

export default OverviewTab;