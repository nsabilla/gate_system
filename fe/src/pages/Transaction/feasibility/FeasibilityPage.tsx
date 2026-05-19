import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import { getFeasibility, getFeasibilitySummary, upsertFeasibility } from '../../../api/feasibility';
import { getStandardCostDocument } from '../../../api/standardCost';
import type { FeasibilityData } from '../../../api/feasibility';
import type { StandardCostDocument } from '../../../api/standardCost';
import type { RFQOption } from '../pfs/pfsTypes';
import { toErrorMessage } from '../pfs/pfsFormatters';
import { exportFeasibilitySummaryExcel } from './feasibilityExcelExport';

const FeasibilityPage: React.FC = () => {
  const { rfqId: paramRFQId } = useParams<{ rfqId: string }>();
  const navigate = useNavigate();

  const [selectedRFQId, setSelectedRFQId] = useState<number | null>(paramRFQId ? Number(paramRFQId) : null);
  const [rfqOptions, setRfqOptions] = useState<RFQOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string>('');
  const [summaryMeta, setSummaryMeta] = useState<{ rfq_no?: string; pfs_type?: string }>({});
  const [standardCostDocument, setStandardCostDocument] = useState<StandardCostDocument | null>(null);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const normalizePfsType = (value?: string) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'FG') return 'forging';
    if (normalized === 'TLS') return 'toolset';
    if (normalized === 'JCK') return 'jack';
    return String(value || '').trim().toLowerCase();
  };

  const [formData, setFormData] = useState<FeasibilityData>({
    customer: '',
    part_name: '',
    date_of_issued: new Date().toISOString().split('T')[0],
    project: '',
    part_number: '',
    revision: '',
    qty_month: 0,
    masspro: '',
    revenue_y: 0,
    specification: '',
    source: '',
    basic_price: 0,
    import_duty: 0,
    inclaring: 0,
    inventory: 0,
    cost_of_money: 0,
    material_price: 0,
    product_weight: 0,
    matl_weight: 0,
    rejection: 0,
    material_cost: 0,
    scrap_cost: 0,
  });

  const fetchRFQs = async () => {
    try {
      const res = await api.get('/rfqs', { withCredentials: true });
      const rows = (res.data?.data || []) as any[];
      const mapped = rows
        .map((row): RFQOption | null => {
          const id = Number(row.id ?? row.rfq_id);
          const rfq_no = String(row.rfq_no || '').trim();
          if (!id || !rfq_no) return null;
          return { id, rfq_no, status: row.status, statusactivity: row.statusactivity, pfs_approver_username: '', pfs_approver_badge: '' };
        })
        .filter((item): item is RFQOption => item !== null);
      setRfqOptions(mapped);
    } catch (err) {
      setError('Gagal memuat daftar RFQ');
    }
  };

  const loadData = async (id: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await getFeasibility(id);
      if (data) {
        setFormData({
          customer: data.customer || '',
          part_name: data.part_name || '',
          date_of_issued: data.date_of_issued || new Date().toISOString().split('T')[0],
          project: data.project || '',
          part_number: data.part_number || '',
          revision: data.revision || '',
          qty_month: Number(data.qty_month) || 0,
          masspro: data.masspro || '',
          revenue_y: Number(data.revenue_y) || 0,
          specification: data.specification || '',
          source: data.source || '',
          basic_price: Number(data.basic_price) || 0,
          import_duty: Number(data.import_duty) || 0,
          inclaring: Number(data.inclaring) || 0,
          inventory: Number(data.inventory) || 0,
          cost_of_money: Number(data.cost_of_money) || 0,
          material_price: Number(data.material_price) || 0,
          product_weight: Number(data.product_weight) || 0,
          matl_weight: Number(data.matl_weight) || 0,
          rejection: Number(data.rejection) || 0,
          material_cost: Number(data.material_cost) || 0,
          scrap_cost: Number(data.scrap_cost) || 0,
        });
      }
    } catch (err) {
      setError(toErrorMessage(err, 'Gagal memuat data feasibility'));
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async (id: number) => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const data = await getFeasibilitySummary(id);
      setSummaryMeta({ rfq_no: data?.rfq_no, pfs_type: data?.pfs_type });

      const pfsType = normalizePfsType(data?.pfs_type);
      if (pfsType === 'forging' || pfsType === 'jack' || pfsType === 'toolset') {
        const document = await getStandardCostDocument(id, pfsType);
        setStandardCostDocument(document);
      } else {
        setStandardCostDocument(null);
      }
    } catch (err) {
      setSummaryMeta({});
      setStandardCostDocument(null);
      setSummaryError(toErrorMessage(err, 'Gagal memuat feasibility summary'));
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchRFQs();
  }, []);

  useEffect(() => {
    if (selectedRFQId) {
      loadData(selectedRFQId);
      loadSummary(selectedRFQId);
      navigate(`/main/feasibility/${selectedRFQId}`, { replace: true });
    } else {
      setSummaryMeta({});
      setStandardCostDocument(null);
      setSummaryError('');
    }
  }, [selectedRFQId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericFields = [
      'qty_month', 'revenue_y', 'basic_price', 'import_duty', 'inclaring', 
      'inventory', 'cost_of_money', 'material_price', 'product_weight', 
      'matl_weight', 'rejection', 'material_cost', 'scrap_cost'
    ];
    setFormData(prev => ({
      ...prev,
      [name]: numericFields.includes(name) ? Number(value) : value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRFQId) {
      setError('Pilih RFQ terlebih dahulu');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await upsertFeasibility(selectedRFQId, formData);
      await Promise.all([
        loadData(selectedRFQId),
        loadSummary(selectedRFQId),
      ]);
      setMessage('Data feasibility berhasil disimpan');
    } catch (err) {
      setError(toErrorMessage(err, 'Gagal menyimpan data feasibility'));
    } finally {
      setSaving(false);
    }
  };

  const handlePrintReport = () => {
    const reportNode = reportRef.current;
    if (!reportNode) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const reportHtml = reportNode.outerHTML;
    const iframeDocument = iframe.contentDocument;
    if (!iframeDocument) {
      document.body.removeChild(iframe);
      return;
    }

    iframeDocument.open();
    iframeDocument.write(`
      <!doctype html>
      <html>
        <head>
          <title>Feasibility Summary</title>
          <meta charset="utf-8" />
          <style>
            @page { size: landscape; margin: 0; }
            html, body { margin: 0; padding: 0; background: #fff; overflow: hidden; scrollbar-width: none; -ms-overflow-style: none; }
            html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
            * { box-sizing: border-box; }
            body { padding: 24px; }
            .report-print { width: 100%; overflow: visible !important; scrollbar-width: none; -ms-overflow-style: none; }
            .report-print::-webkit-scrollbar { width: 0; height: 0; display: none; }
            .report-print .no-print { display: none !important; }
            .report-print table { border-collapse: collapse; }
            .report-print input, .report-print select, .report-print button { border: 0 !important; outline: 0 !important; background: transparent !important; color: #111827 !important; }
          </style>
          ${Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((node) => node.outerHTML).join('')}
        </head>
        <body>
          ${reportHtml}
        </body>
      </html>
    `);
    iframeDocument.close();

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
      document.body.removeChild(iframe);
      return;
    }

    window.setTimeout(() => {
      iframeWindow.focus();
      iframeWindow.print();
      window.setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 250);
  };

  const formatReportValue = (value: unknown) => {
    if (value === null || value === undefined) return '-';
    const text = String(value).trim();
    return text === '' ? '-' : text;
  };

  const formatReportMetric = (value: unknown, fractionDigits = 0) => {
    const text = formatReportValue(value);
    const numericText = String(text).replace(/[^0-9.-]/g, '');
    if (!numericText || numericText === '-' || numericText === '.') {
      return text;
    }

    const numericValue = Number(numericText);
    if (!Number.isFinite(numericValue)) {
      return text;
    }

    return numericValue.toLocaleString('id-ID', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  };

  const handleExportExcel = async () => {
    if (!selectedRFQId) return;

    setExportingExcel(true);
    setError('');
    try {
      await exportFeasibilitySummaryExcel({
        reportTitle: 'FEASIBILITY SUMMARY (COST EVALUATION)',
        fileName: `Feasibility_Summary_${summaryMeta.rfq_no || selectedRFQId}_${summaryMeta.pfs_type || 'report'}`,
        rfqNo: summaryMeta.rfq_no,
        pfsType: summaryMeta.pfs_type,
        formData,
        standardCostDocument,
      });
      setMessage('Excel feasibility summary berhasil diunduh');
    } catch (err) {
      setError(toErrorMessage(err, 'Gagal export Excel feasibility summary'));
    } finally {
      setExportingExcel(false);
    }
  };

  const renderKeyValueGrid = (items: Array<[string, unknown]>) => (
    <div className="grid grid-cols-[120px_14px_1fr] gap-y-1 text-[11px] text-slate-700">
      {items.map(([label, value]) => (
        <React.Fragment key={label}>
          <div>{label}</div>
          <div>:</div>
          <div className="font-medium">{formatReportValue(value)}</div>
        </React.Fragment>
      ))}
    </div>
  );

  const renderRows = (
    rows: Array<Record<string, unknown>>,
    columns: Array<{ key: string; label: string; className?: string }>
  ) => {
    if (!rows || rows.length === 0) {
      return <div className="px-3 py-4 text-[11px] text-slate-500">Belum ada data.</div>;
    }

    return (
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider">
            {columns.map((column) => (
              <th key={column.key} className={`border-b border-slate-200 px-3 py-2 ${column.className || 'text-left'}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="odd:bg-white even:bg-slate-50/60">
              {columns.map((column) => (
                <td key={column.key} className={`border-b border-slate-100 px-3 py-2 ${column.className || 'text-left'}`}>
                  {formatReportValue(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <style>{`
        .report-print {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .report-print::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }

        @media print {
          .report-print {
            overflow: visible !important;
          }

          .report-print-shell {
            min-width: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
          }

          .print-desktop-header {
            grid-template-columns: 240px minmax(0, 1fr) !important;
          }

          .print-desktop-summary {
            grid-template-columns: 0.95fr 1.1fr 1fr !important;
          }

          .print-desktop-metrics {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }

          .print-desktop-body {
            grid-template-columns: 1.05fr 1fr 1fr !important;
          }

          .print-desktop-footer {
            grid-template-columns: 1.15fr 0.95fr !important;
          }

          .print-desktop-signature-head {
            grid-template-columns: 3fr 1fr 1fr 1fr 1fr !important;
          }

          .print-desktop-signature-body {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }

          .print-desktop-signature-cell {
            min-height: 76px !important;
          }
        }
      `}</style>
      <div className="p-6 min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Feasibility Summary</h1>
          </div>
          <div className="flex gap-4 items-center">
            <select
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={selectedRFQId || ''}
              onChange={(e) => setSelectedRFQId(Number(e.target.value))}
            >
              <option value="">Pilih RFQ...</option>
              {rfqOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.rfq_no}</option>
              ))}
            </select>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 rounded-r-lg shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <p className="font-medium">Berhasil</p>
            <p className="text-sm">{message}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 font-medium">Memuat data...</p>
            </div>
          ) : !selectedRFQId ? (
            <div className="p-20 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-700">Tidak ada RFQ terpilih</p>
                <p className="text-slate-500 max-w-xs mx-auto">Silakan pilih nomor RFQ dari dropdown di atas untuk memulai analisis feasibility</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Product & Spec</h3>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Customer</label>
                    <input
                      type="text"
                      name="customer"
                      value={formData.customer}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Part Name</label>
                    <input
                      type="text"
                      name="part_name"
                      value={formData.part_name}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Specification</label>
                    <input
                      type="text"
                      name="specification"
                      value={formData.specification}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g. Material Grade, Heat Treatment..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Product Weight (kg)</label>
                      <input
                        type="number"
                        name="product_weight"
                        value={formData.product_weight}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        step="0.0001"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Mat'l Weight (kg)</label>
                      <input
                        type="number"
                        name="matl_weight"
                        value={formData.matl_weight}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        step="0.0001"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Part Number</label>
                      <input
                        type="text"
                        name="part_number"
                        value={formData.part_number}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Revision</label>
                      <input
                        type="text"
                        name="revision"
                        value={formData.revision}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Project Name</label>
                    <input
                      type="text"
                      name="project"
                      value={formData.project}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Costs & Financials</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Source</label>
                      <input
                        type="text"
                        name="source"
                        value={formData.source}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                        placeholder="Local / Import"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Basic Price</label>
                      <input
                        type="number"
                        name="basic_price"
                        value={formData.basic_price}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Import Duty (%)</label>
                      <input
                        type="number"
                        name="import_duty"
                        value={formData.import_duty}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Inclaring</label>
                      <input
                        type="number"
                        name="inclaring"
                        value={formData.inclaring}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Inventory</label>
                      <input
                        type="number"
                        name="inventory"
                        value={formData.inventory}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Cost of Money</label>
                      <input
                        type="number"
                        name="cost_of_money"
                        value={formData.cost_of_money}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Material Price</label>
                      <input
                        type="number"
                        name="material_price"
                        value={formData.material_price}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Rejection (%)</label>
                      <input
                        type="number"
                        name="rejection"
                        value={formData.rejection}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Material Cost</label>
                      <input
                        type="number"
                        name="material_cost"
                        value={formData.material_cost}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Scrap Cost</label>
                      <input
                        type="number"
                        name="scrap_cost"
                        value={formData.scrap_cost}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Qty / Month</label>
                      <input
                        type="number"
                        name="qty_month"
                        value={formData.qty_month}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Masspro Date</label>
                      <input
                        type="text"
                        name="masspro"
                        value={formData.masspro}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Revenue / Year (IDR)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-slate-400 font-medium text-sm">Rp</span>
                      </div>
                      <input
                        type="number"
                        name="revenue_y"
                        value={formData.revenue_y}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div ref={reportRef} className="mb-8 report-print overflow-visible">
                <div className="report-print-shell w-full max-w-full rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
                  <div className="print-desktop-header grid grid-cols-1 md:grid-cols-[240px_1fr] border-b border-slate-300">
                    <div className="flex h-full items-center gap-3 border-b border-slate-300 md:border-b-0 md:border-r bg-slate-50 px-4 py-4">
                      <img src="/MTMhd.png" alt="MTM Logo" className="h-14 w-auto object-contain drop-shadow-sm" />
                    </div>
                    <div className="flex flex-col justify-center px-6 py-3 text-center">
                      <div className="text-xl font-black uppercase tracking-wide text-slate-900">FEASIBILITY SUMMARY (COST EVALUATION)</div>
                      <div className="text-[11px] font-semibold text-slate-500">{standardCostDocument?.report_code || '-'}</div>
                    </div>
                  </div>

                  <div className="print-desktop-summary grid grid-cols-1 xl:grid-cols-[0.95fr_1.1fr_1fr] border-b border-slate-300 text-[11px] text-slate-700">
                    <div className="border-b border-slate-300 xl:border-b-0 xl:border-r px-4 py-3 bg-rose-50/30">
                      {renderKeyValueGrid([
                        ['Customer', formData.customer],
                        ['Project', formData.project],
                        ['Qty/Month', formData.qty_month ? formData.qty_month.toLocaleString('id-ID') : '-'],
                        ['Part Name', formData.part_name],
                        ['Part No.', formData.part_number],
                        ['Masspro', formData.masspro],
                        ['Date', formData.date_of_issued],
                        ['Revision', formData.revision],
                        ['Revenue/Y', formData.revenue_y ? `Rp${formData.revenue_y.toLocaleString('id-ID')}` : '-'],
                        ['Similar Product', standardCostDocument?.overview?.similar_product],
                      ])}
                    </div>
                    <div className="border-b border-slate-300 xl:border-b-0 xl:border-r px-4 py-3 bg-white">
                      {renderKeyValueGrid([
                        ['Company Name', standardCostDocument?.overview?.company_name],
                        ['Customer', standardCostDocument?.overview?.customer],
                        ['Part Name', standardCostDocument?.overview?.part_name],
                        ['Part Number', standardCostDocument?.overview?.part_number],
                        ['Rejection Rate', standardCostDocument?.overview?.rejection_rate],
                        ['PFS Type', summaryMeta.pfs_type],
                        ['Data Source', 'STANDARD COST'],
                      ])}
                    </div>
                    <div className="px-4 py-3 bg-emerald-50/30">
                      {renderKeyValueGrid([
                        ['RFQ No', summaryMeta.rfq_no],
                        ['Material Rows', String(standardCostDocument?.material_rows?.length || 0)],
                        ['Processing Rows', String(standardCostDocument?.processing_rows?.length || 0)],
                        ['Direct Rows', String(standardCostDocument?.direct_rows?.length || 0)],
                        ['Total Material', standardCostDocument?.material_summary?.total_row_material],
                        ['Total Direct', standardCostDocument?.direct_summary?.total_direct_cost_to_product],
                        ['Total Cost/Product', standardCostDocument?.direct_summary?.total_cost_per_product],
                        ['Gross Profit', standardCostDocument?.direct_summary?.gross_profit],
                      ])}
                    </div>
                  </div>

                  <div className="print-desktop-metrics grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 border-b border-slate-300">
                    {[
                      { label: 'MFG COST', value: standardCostDocument?.direct_summary?.total_cost_per_product, highlight: false, tone: 'bg-violet-100' },
                      { label: 'SELLING PRICE', value: standardCostDocument?.direct_summary?.sales, highlight: true, tone: 'bg-emerald-100' },
                      { label: 'GPM (%)', value: standardCostDocument?.direct_summary?.gross_profit_pct, highlight: false, tone: 'bg-emerald-100' },
                      { label: 'UCM (Rp)', value: standardCostDocument?.direct_summary?.unit_contribution_margin, highlight: false, tone: 'bg-emerald-100' },
                      { label: 'UCM (%)', value: standardCostDocument?.direct_summary?.unit_contribution_margin_pct, highlight: false, tone: 'bg-emerald-100' },
                    ].map((metric) => (
                      <div key={metric.label} className={`${metric.tone} border-b sm:border-r sm:border-b-0 sm:last:border-r-0 xl:border-r xl:border-b-0 border-slate-300 last:border-r-0 px-4 py-2 text-center`}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">{metric.label}</div>
                        <div className={`mt-1 text-lg font-black ${metric.highlight ? 'text-slate-950' : 'text-slate-800'}`}>
                          {metric.label.includes('%') ? `${formatReportMetric(metric.value, 1)}%` : formatReportMetric(metric.value)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {summaryLoading ? (
                    <div className="py-16 flex items-center justify-center text-sm text-slate-500">Memuat feasibility summary...</div>
                  ) : summaryError ? (
                    <div className="p-6">
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{summaryError}</div>
                    </div>
                  ) : standardCostDocument ? (
                    <div className="print-desktop-body grid grid-cols-1 xl:grid-cols-[1.05fr_1fr_1fr]">
                      <div className="border-b border-slate-300 xl:border-b-0 xl:border-r bg-rose-50/20">
                        <div className="border-b border-slate-300 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">OVERVIEW</div>
                        <div className="p-4">{renderKeyValueGrid([
                          ['Company', standardCostDocument.overview.company_name],
                          ['Part Number', standardCostDocument.overview.part_number],
                          ['Part Name', standardCostDocument.overview.part_name],
                          ['Customer', standardCostDocument.overview.customer],
                          ['Rejection Rate', standardCostDocument.overview.rejection_rate],
                          ['Similar Product', standardCostDocument.overview.similar_product],
                        ])}</div>
                        <div className="border-t border-slate-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">MATERIAL SUMMARY</div>
                        <div className="p-4 text-[11px]">{renderKeyValueGrid([
                          ['Total Row Material', standardCostDocument.material_summary.total_row_material],
                          ['% terhadap sale', standardCostDocument.material_summary.presentase_terhadap_sale],
                          ['Total Processing', standardCostDocument.total_processing.total_cost],
                          ['Percentage Sale', standardCostDocument.percentage_sale.total_cost],
                        ])}</div>
                      </div>

                      <div className="border-b border-slate-300 xl:border-b-0 xl:border-r bg-white">
                        <div className="border-b border-slate-300 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">PROCESSING COST</div>
                        {renderRows(standardCostDocument.processing_rows as Array<Record<string, unknown>>, [
                          { key: 'row_no', label: 'No' },
                          { key: 'wc', label: 'WC' },
                          { key: 'processing', label: 'Process' },
                          { key: 'rate_pcs.total_cost', label: 'Cost', className: 'text-right' },
                        ])}
                        <div className="border-t border-slate-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">TOTAL PROCESSING</div>
                        <div className="p-4 text-[11px]">{renderKeyValueGrid([
                          ['MDepr', standardCostDocument.total_processing.mdepr],
                          ['Labor', standardCostDocument.total_processing.labor],
                          ['FOHFD', standardCostDocument.total_processing.fohfd],
                          ['FOHFI', standardCostDocument.total_processing.fohfi],
                          ['FOHVD', standardCostDocument.total_processing.fohvd],
                          ['FOHVI', standardCostDocument.total_processing.fohvi],
                          ['Total Cost', standardCostDocument.total_processing.total_cost],
                        ])}</div>
                      </div>

                      <div className="bg-emerald-50/20">
                        <div className="border-b border-slate-300 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">MATERIAL / DIRECT COST</div>
                        <div className="border-b border-slate-300">
                          {renderRows(standardCostDocument.material_rows as Array<Record<string, unknown>>, [
                            { key: 'row_no', label: 'No' },
                            { key: 'raw_material', label: 'Raw Material' },
                            { key: 'process', label: 'Process' },
                            { key: 'cost_pcs_fg', label: 'Cost', className: 'text-right' },
                          ])}
                        </div>
                        <div className="border-b border-slate-300">
                          <div className="border-b border-slate-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">DIRECT COST</div>
                          {renderRows(standardCostDocument.direct_rows as Array<Record<string, unknown>>, [
                            { key: 'row_no', label: 'No' },
                            { key: 'direct_cost_name', label: 'Cost Name' },
                            { key: 'used_in_process_wc', label: 'WC' },
                            { key: 'cost_pcs_fg', label: 'Cost', className: 'text-right' },
                          ])}
                        </div>
                        <div className="p-4 text-[11px]">{renderKeyValueGrid([
                          ['Total Material', standardCostDocument.material_summary.total_row_material],
                          ['Direct Summary', standardCostDocument.direct_summary.total_direct_cost_to_product],
                          ['Total Cost/Product', standardCostDocument.direct_summary.total_cost_per_product],
                          ['Sales', standardCostDocument.direct_summary.sales],
                          ['UCM', standardCostDocument.direct_summary.unit_contribution_margin],
                          ['Gross Profit', standardCostDocument.direct_summary.gross_profit],
                        ])}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-sm text-slate-500">Belum ada data summary untuk RFQ ini.</div>
                  )}
                    <div className="print-desktop-footer grid grid-cols-1 xl:grid-cols-[1.15fr_0.95fr] border-t border-slate-300">
                    <div className="border-b border-slate-300 xl:border-b-0 xl:border-r px-4 py-3 text-[11px] text-slate-700">
                      <div className="mb-2 font-semibold text-slate-900">Note :</div>
                      <div className="space-y-1">
                        {(standardCostDocument?.report_notes || []).map((note) => (
                          <div key={note} className="leading-snug">- {note}</div>
                        ))}
                        {(!standardCostDocument?.report_notes || standardCostDocument.report_notes.length === 0) && (
                          <div className="leading-snug">- No report notes available.</div>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-2 rounded-lg border border-slate-300 bg-white p-3 text-[11px]">
                        <div>
                          <div className="font-semibold text-slate-900">Selected Price</div>
                          <div className="text-slate-600">{formatReportMetric(standardCostDocument?.direct_summary?.sales)}</div>
                        </div>
                        <div className="self-center text-slate-400">=</div>
                        <div>
                          <div className="font-semibold text-slate-900">MFG cost / UCM reference</div>
                          <div className="text-slate-600">{formatReportMetric(standardCostDocument?.direct_summary?.total_cost_per_product)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 text-[11px] text-slate-700">
                      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
                        <div className="print-desktop-signature-head grid grid-cols-1 sm:grid-cols-5 border-b border-slate-300 text-center font-semibold text-slate-700">
                          <div className="col-span-3 border-r border-slate-300 px-2 py-1">Approved</div>
                          <div className="border-r border-slate-300 px-2 py-1">Checked</div>
                          <div className="px-2 py-1">Prepared</div>
                        </div>
                        <div className="print-desktop-signature-body grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 text-center min-h-[76px]">
                          {(standardCostDocument?.signature_cells || []).slice(0, 5).map((cell, index) => (
                            <div
                              key={`${cell.label}-${cell.name}-${index}`}
                              className={`print-desktop-signature-cell flex flex-col justify-between border-b sm:border-r sm:border-b-0 border-slate-300 px-2 py-2 last:border-r-0 ${index < 3 ? 'col-span-1' : ''}`}
                            >
                              <div className="min-h-[28px] text-[10px] font-semibold uppercase tracking-wider text-slate-500">{cell.badge}</div>
                              <div className="font-medium text-slate-900">{cell.name}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="no-print flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                    {/* <div className="text-xs text-slate-500">Gunakan tombol print untuk PDF atau export Excel untuk file .xlsx.</div> */}
                    <div className="flex items-center gap-2">
                      {/* <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={!selectedRFQId || !standardCostDocument || exportingExcel}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {exportingExcel ? 'Exporting...' : 'Export Excel'}
                      </button> */}
                      <button
                        type="button"
                        onClick={handlePrintReport}
                        disabled={!selectedRFQId}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Print / Save PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 flex justify-end items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`
                    px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300 transition-all flex items-center gap-2
                    ${saving ? 'opacity-70 cursor-not-allowed' : ''}
                  `}
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Simpan Analisis
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default FeasibilityPage;
