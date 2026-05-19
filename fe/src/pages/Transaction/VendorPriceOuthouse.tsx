import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import {
  getPFSBundle,
  deletePFSOutHouseAttachment,
  getPFSOutHouseAttachments,
  getPFSDrawings,
  uploadPFSOutHouseAttachment,
  type PFSBundle,
  type PFSDrawing,
  type PFSOutHouseAttachment,
} from '../../api/pfs';
import { formatDateTimeInAppTZ } from '../../utils/datetime';

type RFQOption = {
  id: number;
  rfq_no: string;
  status: string;
};

type PFSKind = 'forging' | 'jack' | 'toolset';

type InputStatusRow = {
  key: string;
  category: string;
  item: string;
  status: 'Sudah diinput' | 'Belum diinput';
  detail: string;
};

const EMPTY_BUNDLE: PFSBundle = {
  overview: {},
  process_plan: [],
  process_equipment: [],
  technical_spec: {},
  investments: [],
  investment_summary: {},
};

const hasValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((v) => hasValue(v));
  }
  return false;
};

const statusRow = (key: string, category: string, item: string, filled: boolean, detail: string): InputStatusRow => ({
  key,
  category,
  item,
  status: filled ? 'Sudah diinput' : 'Belum diinput',
  detail,
});

const isAllowedOutHouseAttachmentFile = (fileName: string): boolean => {
  const lower = String(fileName || '').trim().toLowerCase();
  return lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.doc') || lower.endsWith('.docx');
};

const getBackendOrigin = (): string => {
  const base = String(api.defaults.baseURL || '').trim();
  if (!base) return window.location.origin;

  try {
    return new URL(base, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

const toFileUrl = (filePath: string): string => {
  const raw = String(filePath || '').trim();
  if (!raw) return '#';
  if (/^https?:\/\//i.test(raw)) return raw;

  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '');
  const relativeToUploads = normalized.replace(/^uploads\//i, '');
  return `${getBackendOrigin()}/uploads/${relativeToUploads}`;
};

const toDisplayLabel = (raw: string): string => {
  return String(raw || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
};

const toDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') {
    const v = value.trim();
    return v || '-';
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length === 0 ? '-' : JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const getNonEmptyEntries = (obj: Record<string, unknown>): Array<[string, unknown]> => {
  return Object.entries(obj || {}).filter(([, v]) => hasValue(v));
};

const getRowColumns = (rows: Array<Record<string, unknown>>): string[] => {
  const set = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      set.add(key);
    }
  }
  return Array.from(set);
};

const isImageFile = (filePath: string): boolean => {
  const clean = String(filePath || '').split('?')[0].split('#')[0].toLowerCase();
  return clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.endsWith('.gif') || clean.endsWith('.webp');
};

const VendorPriceOuthouse: React.FC = () => {
  const [rfqOptions, setRfqOptions] = useState<RFQOption[]>([]);
  const [loadingRFQ, setLoadingRFQ] = useState(false);
  const [selectedRFQId, setSelectedRFQId] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPFSType, setSelectedPFSType] = useState<PFSKind>('forging');
  const [drawingsByType, setDrawingsByType] = useState<Record<PFSKind, PFSDrawing[]>>({
    forging: [],
    jack: [],
    toolset: [],
  });
  const [attachmentsByType, setAttachmentsByType] = useState<Record<PFSKind, PFSOutHouseAttachment[]>>({
    forging: [],
    jack: [],
    toolset: [],
  });
  const [bundleByType, setBundleByType] = useState<Record<PFSKind, PFSBundle>>({
    forging: EMPTY_BUNDLE,
    jack: EMPTY_BUNDLE,
    toolset: EMPTY_BUNDLE,
  });
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeStatusKey, setActiveStatusKey] = useState<string | null>(null);

  const selectedRFQ = useMemo(() => {
    if (!selectedRFQId) return null;
    return rfqOptions.find((item) => item.id === selectedRFQId) || null;
  }, [rfqOptions, selectedRFQId]);

  const drawings = useMemo(() => drawingsByType[selectedPFSType] || [], [drawingsByType, selectedPFSType]);
  const attachments = useMemo(() => attachmentsByType[selectedPFSType] || [], [attachmentsByType, selectedPFSType]);

  const inputStatusRows = useMemo<InputStatusRow[]>(() => {
    const kinds: PFSKind[] = ['forging', 'jack', 'toolset'];
    const rows: InputStatusRow[] = [];

    for (const kind of kinds) {
      const b = bundleByType[kind] || EMPTY_BUNDLE;
      const label = kind.toUpperCase();

      rows.push(
        statusRow(
          `${kind}-overview`,
          label,
          'Overview',
          hasValue(b.overview),
          hasValue(b.overview) ? 'Data tersedia' : 'Belum ada data'
        )
      );
      rows.push(
        statusRow(
          `${kind}-technical`,
          label,
          'Technical Spec',
          hasValue(b.technical_spec),
          hasValue(b.technical_spec) ? 'Data tersedia' : 'Belum ada data'
        )
      );
      rows.push(
        statusRow(
          `${kind}-plan`,
          label,
          'Process Plan',
          b.process_plan.length > 0,
          `${b.process_plan.length} baris`
        )
      );
      rows.push(
        statusRow(
          `${kind}-equipment`,
          label,
          'Process Equipment',
          b.process_equipment.length > 0,
          `${b.process_equipment.length} baris`
        )
      );
      rows.push(
        statusRow(
          `${kind}-investments`,
          label,
          'Investments',
          b.investments.length > 0,
          `${b.investments.length} baris`
        )
      );
      rows.push(
        statusRow(
          `${kind}-summary`,
          label,
          'Investment Summary',
          hasValue(b.investment_summary),
          hasValue(b.investment_summary) ? 'Data tersedia' : 'Belum ada data'
        )
      );
    }

    for (const kind of kinds) {
      const label = kind.toUpperCase();
      const drawingCount = (drawingsByType[kind] || []).length;
      const attachmentCount = (attachmentsByType[kind] || []).length;

      rows.push(
        statusRow(
          `${kind}-drawing`,
          label,
          'Drawing',
          drawingCount > 0,
          `${drawingCount} file`
        )
      );

      rows.push(
        statusRow(
          `${kind}-vendor-price`,
          label,
          'Vendor Price Attachment',
          attachmentCount > 0,
          `${attachmentCount} file`
        )
      );
    }

    return rows;
  }, [bundleByType, drawingsByType, attachmentsByType]);

  const activeStatusRow = useMemo(() => {
    if (!activeStatusKey) return null;
    return inputStatusRows.find((row) => row.key === activeStatusKey) || null;
  }, [activeStatusKey, inputStatusRows]);

  const renderObjectTable = (entries: Array<[string, unknown]>) => {
    if (entries.length === 0) {
      return <p className="text-sm text-gray-500">Belum ada data.</p>;
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Field</th>
              <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Value</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={`obj-${k}`} className="odd:bg-white even:bg-gray-50/40">
                <td className="border-b border-gray-100 px-3 py-2 text-gray-700">{toDisplayLabel(k)}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-gray-600">{toDisplayValue(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderArrayTable = (rows: Array<Record<string, unknown>>) => {
    if (!rows || rows.length === 0) {
      return <p className="text-sm text-gray-500">Belum ada data.</p>;
    }

    const cols = getRowColumns(rows);
    if (cols.length === 0) {
      return <p className="text-sm text-gray-500">Data kosong.</p>;
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr>
              {cols.map((col) => (
                <th key={`arr-col-${col}`} className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                  {toDisplayLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`arr-row-${idx}`} className="odd:bg-white even:bg-gray-50/40">
                {cols.map((col) => (
                  <td key={`arr-cell-${idx}-${col}`} className="border-b border-gray-100 px-3 py-2 text-gray-600">
                    {toDisplayValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderStatusDetail = () => {
    if (!activeStatusKey) return null;

    const firstDashIdx = activeStatusKey.indexOf('-');
    const kindRaw = firstDashIdx > 0 ? activeStatusKey.slice(0, firstDashIdx) : '';
    const sectionRaw = firstDashIdx > 0 ? activeStatusKey.slice(firstDashIdx + 1) : '';
    const kind = (kindRaw === 'forging' || kindRaw === 'jack' || kindRaw === 'toolset') ? kindRaw as PFSKind : null;

    if (kind && sectionRaw === 'drawing') {
      const rows = drawingsByType[kind] || [];
      return (
        <div className="space-y-2">
          {rows.map((file) => (
            <div key={`modal-drawing-${file.id}`} className="rounded-lg border border-gray-200 p-3">
              <a href={toFileUrl(file.file_path)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#0D79BD] hover:underline">
                {file.file_name}
              </a>
              <p className="mt-1 text-xs text-gray-500">
                Uploaded by {file.uploaded_by || '-'} | {formatDateTimeInAppTZ(file.created_at)}
              </p>
              {isImageFile(file.file_name || file.file_path) && (
                <a href={toFileUrl(file.file_path)} target="_blank" rel="noreferrer" className="mt-2 block">
                  <img
                    src={toFileUrl(file.file_path)}
                    alt={file.file_name}
                    className="max-h-64 w-full rounded-lg border border-gray-200 object-contain"
                    loading="lazy"
                  />
                </a>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (kind && sectionRaw === 'vendor-price') {
      const rows = attachmentsByType[kind] || [];
      return (
        <div className="space-y-2">
          {rows.map((file) => (
            <div key={`modal-attachment-${file.id}`} className="rounded-lg border border-gray-200 p-3">
              <a href={toFileUrl(file.file_path)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#0D79BD] hover:underline">
                {file.file_name}
              </a>
              <p className="mt-1 text-xs text-gray-500">
                Uploaded by {file.uploaded_by || '-'} | {formatDateTimeInAppTZ(file.created_at)}
              </p>
            </div>
          ))}
        </div>
      );
    }

    if (!kind || !sectionRaw) return null;

    const bundle = bundleByType[kind] || EMPTY_BUNDLE;

    if (sectionRaw === 'overview') {
      return renderObjectTable(getNonEmptyEntries((bundle.overview || {}) as Record<string, unknown>));
    }
    if (sectionRaw === 'technical') {
      return renderObjectTable(getNonEmptyEntries((bundle.technical_spec || {}) as Record<string, unknown>));
    }
    if (sectionRaw === 'summary') {
      return renderObjectTable(getNonEmptyEntries((bundle.investment_summary || {}) as Record<string, unknown>));
    }
    if (sectionRaw === 'plan') {
      return renderArrayTable((bundle.process_plan || []) as Array<Record<string, unknown>>);
    }
    if (sectionRaw === 'equipment') {
      return renderArrayTable((bundle.process_equipment || []) as Array<Record<string, unknown>>);
    }
    if (sectionRaw === 'investments') {
      return renderArrayTable((bundle.investments || []) as Array<Record<string, unknown>>);
    }

    return null;
  };

  const fetchRFQ = async () => {
    setLoadingRFQ(true);
    try {
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
        .filter((item): item is RFQOption => item !== null);

      setRfqOptions(mapped);
      if (!selectedRFQId && mapped.length > 0) {
        setSelectedRFQId(mapped[0].id);
      }
    } catch {
      setError('Daftar RFQ belum bisa dimuat. Silakan coba lagi.');
      setRfqOptions([]);
    } finally {
      setLoadingRFQ(false);
    }
  };

  const fetchFiles = async (rfqId: number) => {
    setLoadingFiles(true);
    try {
      const [drawingRows, attachmentRows, forgingRes, jackRes, toolsetRes] = await Promise.all([
        Promise.all([
          getPFSDrawings(rfqId, 'forging').catch(() => [] as PFSDrawing[]),
          getPFSDrawings(rfqId, 'jack').catch(() => [] as PFSDrawing[]),
          getPFSDrawings(rfqId, 'toolset').catch(() => [] as PFSDrawing[]),
        ]),
        Promise.all([
          getPFSOutHouseAttachments(rfqId, 'forging').catch(() => [] as PFSOutHouseAttachment[]),
          getPFSOutHouseAttachments(rfqId, 'jack').catch(() => [] as PFSOutHouseAttachment[]),
          getPFSOutHouseAttachments(rfqId, 'toolset').catch(() => [] as PFSOutHouseAttachment[]),
        ]),
        getPFSBundle(rfqId, 'forging').catch(() => EMPTY_BUNDLE),
        getPFSBundle(rfqId, 'jack').catch(() => EMPTY_BUNDLE),
        getPFSBundle(rfqId, 'toolset').catch(() => EMPTY_BUNDLE),
      ]);
      setDrawingsByType({
        forging: drawingRows[0] || [],
        jack: drawingRows[1] || [],
        toolset: drawingRows[2] || [],
      });
      setAttachmentsByType({
        forging: attachmentRows[0] || [],
        jack: attachmentRows[1] || [],
        toolset: attachmentRows[2] || [],
      });
      setBundleByType({
        forging: forgingRes || EMPTY_BUNDLE,
        jack: jackRes || EMPTY_BUNDLE,
        toolset: toolsetRes || EMPTY_BUNDLE,
      });
    } catch {
      setDrawingsByType({ forging: [], jack: [], toolset: [] });
      setAttachmentsByType({ forging: [], jack: [], toolset: [] });
      setBundleByType({
        forging: EMPTY_BUNDLE,
        jack: EMPTY_BUNDLE,
        toolset: EMPTY_BUNDLE,
      });
      setError('Data dokumen belum bisa dimuat untuk RFQ ini.');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] || null;
    if (!next) {
      setSelectedFile(null);
      return;
    }

    if (!isAllowedOutHouseAttachmentFile(next.name)) {
      setError('File harus .xls, .xlsx, .doc, atau .docx');
      setSelectedFile(null);
      return;
    }

    setError('');
    setSelectedFile(next);
  };

  const handleUpload = async () => {
    if (!selectedRFQId) {
      setError('Pilih RFQ terlebih dahulu.');
      return;
    }
    if (!selectedFile) {
      setError('Pilih file yang akan diunggah.');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');
    try {
      await uploadPFSOutHouseAttachment(selectedRFQId, selectedFile, selectedPFSType);
      setSelectedFile(null);
      setMessage('File vendor price berhasil diunggah.');
      await fetchFiles(selectedRFQId);
    } catch {
      setError('Unggah file vendor price belum berhasil.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: number) => {
    if (!selectedRFQId) return;
    if (!confirm('Yakin ingin menghapus file ini?')) return;

    setError('');
    setMessage('');
    try {
      await deletePFSOutHouseAttachment(selectedRFQId, fileId, selectedPFSType);
      setMessage('File berhasil dihapus.');
      await fetchFiles(selectedRFQId);
    } catch {
      setError('File belum bisa dihapus.');
    }
  };

  useEffect(() => {
    fetchRFQ().catch(() => {
      setError('Daftar RFQ belum bisa dimuat. Silakan coba lagi.');
    });
  }, []);

  useEffect(() => {
    if (!selectedRFQId) return;
    fetchFiles(selectedRFQId).catch(() => {
      setError('Data dokumen belum bisa dimuat untuk RFQ ini.');
    });
  }, [selectedRFQId]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h1 className="text-lg font-semibold text-gray-800">Vendor Price Outhouse</h1>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-gray-700">Pilih RFQ</span>
            <select
              value={selectedRFQId}
              onChange={(e) => setSelectedRFQId(Number(e.target.value || 0))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              disabled={loadingRFQ || rfqOptions.length === 0}
            >
              {rfqOptions.length === 0 && <option value={0}>Belum ada data RFQ</option>}
              {rfqOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.rfq_no} ({row.status || '-'})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">PFS Type</span>
            <select
              value={selectedPFSType}
              onChange={(e) => setSelectedPFSType(e.target.value as PFSKind)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="forging">Forging</option>
              <option value="jack">Jack</option>
              <option value="toolset">Toolset</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Upload Vendor Price</span>
            <input
              type="file"
              accept=".xls,.xlsx,.doc,.docx"
              onChange={handleSelectFile}
              disabled={!selectedRFQId || uploading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedRFQId || !selectedFile || uploading}
            className="rounded-lg bg-[#0D79BD] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
          <span className="text-xs text-gray-500">Format file: .xls, .xlsx, .doc, .docx</span>
        </div>

        {selectedFile && (
          <p className="mt-2 text-sm text-gray-700">File dipilih: {selectedFile.name}</p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-800">Engineering Drawing ({selectedPFSType.toUpperCase()})</h2>

          {loadingFiles ? (
            <p className="mt-4 text-sm text-gray-500">Memuat drawing...</p>
          ) : drawings.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Belum ada drawing pada RFQ ini.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {drawings.map((file) => (
                <div key={file.id} className="rounded-lg border border-gray-200 p-3">
                  <a
                    href={toFileUrl(file.file_path)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[#0D79BD] hover:underline"
                  >
                    {file.file_name}
                  </a>
                  <p className="mt-1 text-xs text-gray-500">
                    Uploaded by {file.uploaded_by || '-'} | {formatDateTimeInAppTZ(file.created_at)}
                  </p>
                  {isImageFile(file.file_name || file.file_path) && (
                    <a href={toFileUrl(file.file_path)} target="_blank" rel="noreferrer" className="mt-2 block">
                      <img
                        src={toFileUrl(file.file_path)}
                        alt={file.file_name}
                        className="max-h-48 w-full rounded-lg border border-gray-200 object-contain"
                        loading="lazy"
                      />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-800">Vendor Price Files ({selectedPFSType.toUpperCase()})</h2>

          {loadingFiles ? (
            <p className="mt-4 text-sm text-gray-500">Memuat file...</p>
          ) : attachments.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Belum ada file vendor price pada RFQ ini.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {attachments.map((file) => (
                <div key={file.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3">
                  <div>
                    <a
                      href={toFileUrl(file.file_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-[#0D79BD] hover:underline"
                    >
                      {file.file_name}
                    </a>
                    <p className="mt-1 text-xs text-gray-500">
                      Uploaded by {file.uploaded_by || '-'} | {formatDateTimeInAppTZ(file.created_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(file.id)}
                    className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-800">Status Input Engineering & Purchasing</h2>

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Category</th>
                <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Item</th>
                <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Detail</th>
              </tr>
            </thead>
            <tbody>
              {inputStatusRows.map((row) => (
                <tr
                  key={row.key}
                  className={`odd:bg-white even:bg-gray-50/40 ${row.status === 'Sudah diinput' ? 'cursor-pointer hover:bg-blue-50/60' : ''}`}
                  onClick={() => {
                    if (row.status !== 'Sudah diinput') return;
                    setActiveStatusKey(row.key);
                  }}
                >
                  <td className="border-b border-gray-100 px-3 py-2 text-gray-700">{row.category}</td>
                  <td className="border-b border-gray-100 px-3 py-2 text-gray-700">{row.item}</td>
                  <td className="border-b border-gray-100 px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        row.status === 'Sudah diinput'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="border-b border-gray-100 px-3 py-2 text-gray-600">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {activeStatusKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800">
                {activeStatusRow ? `${activeStatusRow.category} - ${activeStatusRow.item}` : 'Detail Data'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveStatusKey(null)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(85vh-56px)] overflow-auto px-4 py-4">
              {renderStatusDetail()}
            </div>
          </div>
        </div>
      )}

      {selectedRFQ && (
        <p className="text-xs text-gray-500">
          RFQ aktif: {selectedRFQ.rfq_no} ({selectedRFQ.status || '-'})
        </p>
      )}
    </div>
  );
};

export default VendorPriceOuthouse;
