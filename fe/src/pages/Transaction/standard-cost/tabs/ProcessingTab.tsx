import React, { useEffect } from 'react';
import type { StandardCostMasterRow, StandardCostPercentageSale, StandardCostProcessingRow, StandardCostRateDetik, StandardCostRatePCS, StandardCostTotalProcessing } from '../../../../api/standardCost';

type Props = {
  rows: StandardCostProcessingRow[];
  totalProcessing: StandardCostTotalProcessing;
  percentageSale: StandardCostPercentageSale;
  salesPrice: string;
  wcMasterRows: StandardCostMasterRow[];
  rejectionRate: string;
  onChangeRows: (rows: StandardCostProcessingRow[]) => void;
  onChangeTotalProcessing: (data: StandardCostTotalProcessing) => void;
  onChangePercentageSale: (data: StandardCostPercentageSale) => void;
};

/**
 * A helper component to handle numeric inputs with a '0' placeholder
 * so that the UI looks cleaner when values are zero.
 */

const NumericInput: React.FC<{
  value: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  label?: string;
  theme?: 'blue' | 'orange' | 'gray' | 'emerald';
}> = ({ value, onChange, placeholder = "0", readOnly, className = "", label, theme = 'gray' }) => {
  const themes = {
    gray: 'border-slate-200 focus:border-slate-400 focus:ring-slate-100',
    blue: 'border-blue-100 focus:border-blue-400 focus:ring-blue-50 bg-blue-50/10',
    orange: 'border-orange-100 focus:border-orange-400 focus:ring-orange-50 bg-orange-50/10',
    emerald: 'border-emerald-100 focus:border-emerald-400 focus:ring-emerald-50 bg-emerald-50/10',
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // Normalize comma to dot for decimal inputs
    val = val.replace(',', '.');

    // Allow empty, minus sign, digits, and one decimal point
    if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
      onChange?.(val);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <span className={`text-[10px] font-bold uppercase tracking-tight ${theme === 'orange' ? 'text-orange-600' : theme === 'blue' ? 'text-blue-600' : theme === 'emerald' ? 'text-emerald-600' : 'text-slate-500'}`}>{label}</span>}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={handleChange}
        className={`w-full rounded-md border px-2.5 py-1.5 text-sm transition-all focus:outline-none focus:ring-2 ${readOnly ? 'bg-slate-50/50 cursor-default font-semibold' : themes[theme]} ${className}`}
      />
    </div>
  );
};

const ProcessingTab: React.FC<Props> = ({
  rows,
  totalProcessing,
  percentageSale,
  salesPrice,
  wcMasterRows,
  // rejectionRate,
  onChangeRows,
  onChangeTotalProcessing,
  onChangePercentageSale
}) => {
  const calculateRatePCS = (rd: StandardCostRateDetik | undefined, ctStr: string, qtyStr: string): StandardCostRatePCS => {
    const ct = parseFloat(ctStr) || 0;
    const qty = parseFloat(qtyStr) || 0;
    if (!rd) return { mdepr: '', labor: '', fohfd: '', fohfi: '', fohvd: '', fohvi: '', total_cost: '' };

    const mdepr = (parseFloat(rd.mdepr) || 0) * ct * qty;
    const labor = (parseFloat(rd.labor) || 0) * ct * qty;
    const fohfd = (parseFloat(rd.fohfd) || 0) * ct * qty;
    const fohfi = (parseFloat(rd.fohfi) || 0) * ct * qty;
    const fohvd = (parseFloat(rd.fohvd) || 0) * ct * qty;
    const fohvi = (parseFloat(rd.fohvi) || 0) * ct * qty;
    const total_cost = mdepr + labor + fohfd + fohfi + fohvd + fohvi;

    const fmt = (n: number) => n === 0 ? '' : String(n.toFixed(2));

    return {
      mdepr: fmt(mdepr),
      labor: fmt(labor),
      fohfd: fmt(fohfd),
      fohfi: fmt(fohfi),
      fohvd: fmt(fohvd),
      fohvi: fmt(fohvi),
      total_cost: fmt(total_cost),
    };
  };

  const updateRow = (index: number, key: keyof StandardCostProcessingRow, value: string) => {
    let nextRows = rows.map((row, i) => (i === index ? { ...row, [key]: value } : row));

    if (key === 'wc') {
      const master = wcMasterRows.find(m => m.wc.toLowerCase().trim() === value.toLowerCase().trim());
      if (master) {
        nextRows = nextRows.map((row, i) => {
          if (i !== index) return row;
          const rd: StandardCostRateDetik = {
            mdepr: String(master.mdepr),
            labor: String(master.labor),
            fohfd: String(master.fd),
            fohfi: String(master.fi),
            fohvd: String(master.vd),
            fohvi: String(master.vi),
            total_rate: row.rate_detik?.total_rate || '', // Will be updated by useEffect
          };
          return { ...row, standard_cost_master_id: master.id, rate_detik: rd };
        });
      }
    }

    if (key === 'qty_per_parent') {
      // If user hasn't manually tweaked Qty Req yet, or if it's empty, we might want to sync?
      // Actually, let's keep it manual as requested.
    }

    onChangeRows(nextRows);
  };

  const updateRateDetik = (index: number, key: keyof StandardCostRateDetik, value: string) => {
    const nextRows = rows.map((row, i) => {
      if (i !== index) return row;
      const rd = { ...(row.rate_detik || {}), [key]: value } as StandardCostRateDetik;
      return { ...row, rate_detik: rd };
    });
    onChangeRows(nextRows);
  };

  // Automated Row Synchronization & Summary Calculation
  useEffect(() => {
    let rawRowsChanged = false;

    const synchronizedRows = rows.map(row => {
      const rd = row.rate_detik || { mdepr: '', labor: '', fohfd: '', fohfi: '', fohvd: '', fohvi: '', total_rate: '' };

      // Calculate Total Rate Per Detik
      const totalDetik = (parseFloat(rd.mdepr) || 0) + (parseFloat(rd.labor) || 0) + (parseFloat(rd.fohfd) || 0) + (parseFloat(rd.fohfi) || 0) + (parseFloat(rd.fohvd) || 0) + (parseFloat(rd.fohvi) || 0);
      const newTotalRate = totalDetik === 0 ? '' : String(totalDetik.toFixed(2));

      // Qty Req BJ 1 FG is now manual (no longer from rejection rate)
      // but we still use it for rate_pcs calculation
      const currentQtyReq = row.qty_req_bj_1_fg || '0';

      // Calculate Rate Per PCS
      const newRatePCS = calculateRatePCS(rd, row.cycle_time, currentQtyReq);

      if (rd.total_rate !== newTotalRate || JSON.stringify(row.rate_pcs) !== JSON.stringify(newRatePCS)) {
        rawRowsChanged = true;
        return {
          ...row,
          rate_detik: { ...rd, total_rate: newTotalRate },
          rate_pcs: newRatePCS
        };
      }
      return row;
    });

    if (rawRowsChanged) {
      onChangeRows(synchronizedRows);
      return; // Wait for the next render with updated rows to calculate summary
    }

    // Now calculate Summary using the synchronized rows
    const totalsRaw = { mdepr: 0, labor: 0, fohfd: 0, fohfi: 0, fohvd: 0, fohvi: 0 };

    rows.forEach(row => {
      // Sum rounding strings to ensure vertical sum matches user expectation
      totalsRaw.mdepr += parseFloat(row.rate_pcs?.mdepr || '0') || 0;
      totalsRaw.labor += parseFloat(row.rate_pcs?.labor || '0') || 0;
      totalsRaw.fohfd += parseFloat(row.rate_pcs?.fohfd || '0') || 0;
      totalsRaw.fohfi += parseFloat(row.rate_pcs?.fohfi || '0') || 0;
      totalsRaw.fohvd += parseFloat(row.rate_pcs?.fohvd || '0') || 0;
      totalsRaw.fohvi += parseFloat(row.rate_pcs?.fohvi || '0') || 0;
    });

    const fmt = (n: number) => n === 0 ? '' : String(n.toFixed(2));

    // Grand Total is the sum of the vertical sums to avoid horizontal-vertical discrepancy
    const grandTotalRaw = totalsRaw.mdepr + totalsRaw.labor + totalsRaw.fohfd + totalsRaw.fohfi + totalsRaw.fohvd + totalsRaw.fohvi;

    const newTotalProcessing: StandardCostTotalProcessing = {
      mdepr: fmt(totalsRaw.mdepr),
      labor: fmt(totalsRaw.labor),
      fohfd: fmt(totalsRaw.fohfd),
      fohfi: fmt(totalsRaw.fohfi),
      fohvd: fmt(totalsRaw.fohvd),
      fohvi: fmt(totalsRaw.fohvi),
      total_cost: fmt(grandTotalRaw),
    };

    // Calculate Percentages
    const sale = parseFloat(salesPrice) || 0;
    const calcPct = (val: number) => (sale > 0 ? String(((val / sale) * 100).toFixed(2)) : '');

    const newPercentageSale: StandardCostPercentageSale = {
      mdepr: calcPct(totalsRaw.mdepr),
      labor: calcPct(totalsRaw.labor),
      fohfd: calcPct(totalsRaw.fohfd),
      fohfi: calcPct(totalsRaw.fohfi),
      fohvd: calcPct(totalsRaw.fohvd),
      fohvi: calcPct(totalsRaw.fohvi),
      total_cost: calcPct(grandTotalRaw),
    };

    // Only trigger update if values actually changed to avoid infinite loops
    if (JSON.stringify(newTotalProcessing) !== JSON.stringify(totalProcessing)) {
      onChangeTotalProcessing(newTotalProcessing);
    }
    if (JSON.stringify(newPercentageSale) !== JSON.stringify(percentageSale)) {
      onChangePercentageSale(newPercentageSale);
    }
  }, [rows, salesPrice, totalProcessing, percentageSale, onChangeTotalProcessing, onChangePercentageSale, onChangeRows]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between rounded-lg bg-slate-100/80 px-4 py-3 border border-slate-200">
        <h3 className="bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">Processing Cost</h3>
      </div>

      {/* ROWS SECTION */}
      <div className="flex flex-col gap-6">
        {rows.map((row, idx) => (
          <div key={idx} className="group relative flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md">
            {/* ROW COUNTER & DELETE */}
            <div className="absolute -left-3 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white shadow-md">
              {idx + 1}
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onChangeRows(rows.filter((_, i) => i !== idx))}
                className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500 border border-red-100 shadow-sm hover:bg-red-500 hover:text-white group-hover:flex transition-all"
                title="Remove row"
              >
                &times;
              </button>
            )}

            {/* PRIMARY DATA GRID */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">WC</span>
                <select
                  value={row.wc}
                  onChange={(e) => updateRow(idx, 'wc', e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50 bg-white"
                >
                  <option value="">Select WC...</option>
                  {wcMasterRows.map((master) => (
                    <option key={master.id} value={master.wc}>
                      {master.wc}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Processing</span>
                <input
                  value={row.processing}
                  onChange={(e) => updateRow(idx, 'processing', e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">OPS Nomor</span>
                <input value={row.ops_no} onChange={(e) => updateRow(idx, 'ops_no', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Product</span>
                <input value={row.product} onChange={(e) => updateRow(idx, 'product', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Part Nomor</span>
                <input value={row.part_number} onChange={(e) => updateRow(idx, 'part_number', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Qty per Parent</span>
                <input value={row.qty_per_parent} onChange={(e) => updateRow(idx, 'qty_per_parent', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Start Factor</span>
                <input value={row.start_factor} onChange={(e) => updateRow(idx, 'start_factor', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-blue-600">Qty Req BJ 1 FG</span>
                <input
                  value={row.qty_req_bj_1_fg}
                  onChange={(e) => updateRow(idx, 'qty_req_bj_1_fg', e.target.value)}
                  className="w-full rounded-md border border-blue-200 bg-blue-50/20 px-2.5 py-1.5 text-sm font-semibold text-blue-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">% NG</span>
                <input value={row.percent_ng} onChange={(e) => updateRow(idx, 'percent_ng', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-blue-600 font-black">Cycle Time</span>
                <input value={row.cycle_time} onChange={(e) => updateRow(idx, 'cycle_time', e.target.value)} className="w-full rounded-md border-2 border-blue-400 bg-blue-50/40 px-2.5 py-1.5 text-sm font-bold text-blue-900 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-inner" placeholder="0" />
              </div>
            </div>

            {/* RATE COMPARISON BOX */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {/* RATE PER DETIK GROUP */}
              <div className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/30 p-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600">Rate Per Detik</h4>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumericInput label="MDepr" theme="blue" value={row.rate_detik?.mdepr || ''} onChange={(v) => updateRateDetik(idx, 'mdepr', v)} />
                  <NumericInput label="Labor" theme="blue" value={row.rate_detik?.labor || ''} onChange={(v) => updateRateDetik(idx, 'labor', v)} />
                  <NumericInput label="FOH FD" theme="blue" value={row.rate_detik?.fohfd || ''} onChange={(v) => updateRateDetik(idx, 'fohfd', v)} />
                  <NumericInput label="FOH FI" theme="blue" value={row.rate_detik?.fohfi || ''} onChange={(v) => updateRateDetik(idx, 'fohfi', v)} />
                  <NumericInput label="FOH VD" theme="blue" value={row.rate_detik?.fohvd || ''} onChange={(v) => updateRateDetik(idx, 'fohvd', v)} />
                  <NumericInput label="FOH VI" theme="blue" value={row.rate_detik?.fohvi || ''} onChange={(v) => updateRateDetik(idx, 'fohvi', v)} />
                </div>
                <div className="mt-2 flex items-center justify-between rounded bg-blue-600 px-3 py-2 text-white shadow-sm">
                  <span className="text-[10px] font-black uppercase tracking-wider">Total Rate/dtk</span>
                  <span className="font-mono text-sm font-bold">{row.rate_detik?.total_rate || '0.000'}</span>
                </div>
              </div>

              {/* RATE PER PCS GROUP */}
              <div className="flex flex-col gap-3 rounded-lg border border-orange-100 bg-orange-50/40 p-4">
                <div className="flex items-center gap-2 border-b border-orange-200 pb-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-orange-600">Rate Per PCS</h4>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumericInput label="MDepr" theme="orange" readOnly value={row.rate_pcs?.mdepr || ''} />
                  <NumericInput label="Labor" theme="orange" readOnly value={row.rate_pcs?.labor || ''} />
                  <NumericInput label="FOH FD" theme="orange" readOnly value={row.rate_pcs?.fohfd || ''} />
                  <NumericInput label="FOH FI" theme="orange" readOnly value={row.rate_pcs?.fohfi || ''} />
                  <NumericInput label="FOH VD" theme="orange" readOnly value={row.rate_pcs?.fohvd || ''} />
                  <NumericInput label="FOH VI" theme="orange" readOnly value={row.rate_pcs?.fohvi || ''} />
                </div>
                <div className="mt-2 flex items-center justify-between rounded bg-orange-500 px-3 py-2 text-white shadow-sm">
                  <span className="text-[10px] font-black uppercase tracking-wider">Total Cost/PCS</span>
                  <span className="font-mono text-sm font-bold">{row.rate_pcs?.total_cost || '0.000'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChangeRows([...rows, {
            row_no: rows.length + 1,
            wc: '',
            ops_no: '',
            part_number: '',
            start_factor: '',
            percent_ng: '',
            processing: '',
            product: '',
            qty_per_parent: '',
            qty_req_bj_1_fg: '',
            cycle_time: '',
            rate_detik: { mdepr: '', labor: '', fohfd: '', fohfi: '', fohvd: '', fohvi: '', total_rate: '' },
            rate_pcs: { mdepr: '', labor: '', fohfd: '', fohfi: '', fohvd: '', fohvi: '', total_cost: '' },
          }])}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95 flex items-center gap-2"
        >
          <span>+</span>
          <span>Add Row</span>
        </button>
      </div>

      {/* SUMMARY SECTION */}
      <div className="mt-4 flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="h-4 w-1 bg-slate-800 rounded-full"></div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Processing Summary</h3>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* TOTAL PROCESSING COST */}
          <div className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/30 p-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600">Total Processing Cost</h4>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumericInput label="MDepr" theme="blue" readOnly value={totalProcessing.mdepr} />
              <NumericInput label="Labor" theme="blue" readOnly value={totalProcessing.labor} />
              <NumericInput label="FOH FD" theme="blue" readOnly value={totalProcessing.fohfd} />
              <NumericInput label="FOH FI" theme="blue" readOnly value={totalProcessing.fohfi} />
              <NumericInput label="FOH VD" theme="blue" readOnly value={totalProcessing.fohvd} />
              <NumericInput label="FOH VI" theme="blue" readOnly value={totalProcessing.fohvi} />
            </div>
            <div className="mt-2 flex items-center justify-between rounded bg-slate-800 px-3 py-2 text-white shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider">Grand Total Processing</span>
              <span className="font-mono text-sm font-bold">{totalProcessing.total_cost || '0.00'}</span>
            </div>
          </div>

          {/* PERCENTAGE AGAINST SALE */}
          <div className="flex flex-col gap-3 rounded-lg border border-emerald-100 bg-emerald-50/20 p-4">
            <div className="flex items-center gap-2 border-b border-emerald-200 pb-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
              <h4 className="text-[11px] font-black uppercase tracking-widest text-emerald-600">Percentage Against Sale</h4>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumericInput label="MDepr %" theme="emerald" readOnly value={percentageSale.mdepr ? `${percentageSale.mdepr}%` : ''} />
              <NumericInput label="Labor %" theme="emerald" readOnly value={percentageSale.labor ? `${percentageSale.labor}%` : ''} />
              <NumericInput label="FOH FD %" theme="emerald" readOnly value={percentageSale.fohfd ? `${percentageSale.fohfd}%` : ''} />
              <NumericInput label="FOH FI %" theme="emerald" readOnly value={percentageSale.fohfi ? `${percentageSale.fohfi}%` : ''} />
              <NumericInput label="FOH VD %" theme="emerald" readOnly value={percentageSale.fohvd ? `${percentageSale.fohvd}%` : ''} />
              <NumericInput label="FOH VI %" theme="emerald" readOnly value={percentageSale.fohvi ? `${percentageSale.fohvi}%` : ''} />
            </div>
            <div className="mt-2 flex items-center justify-between rounded bg-emerald-600 px-3 py-2 text-white shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider">Total % vs Sale</span>
              <span className="font-mono text-sm font-bold">{percentageSale.total_cost ? `${percentageSale.total_cost}%` : '0.00%'}</span>
            </div>
          </div>
        </div>
      </div>

      <datalist id="wc-master-options">
        {wcMasterRows.map((row) => (
          <option key={row.id} value={row.wc}>{`${row.cost_center} - ${row.wc}`}</option>
        ))}
      </datalist>
    </div>
  );
};

export default ProcessingTab;

