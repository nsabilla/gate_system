import React, { useEffect } from 'react';
import type { StandardCostDirectRow, StandardCostDirectSummary, StandardCostTotalProcessing, StandardCostMaterialSummary } from '../../../../api/standardCost';

type Props = {
  rows: StandardCostDirectRow[];
  summary: StandardCostDirectSummary;
  totalProcessing: StandardCostTotalProcessing;
  materialSummary: StandardCostMaterialSummary;
  onChangeRows: (rows: StandardCostDirectRow[]) => void;
  onChangeSummary: (summary: StandardCostDirectSummary) => void;
};

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
    let val = e.target.value.replace(',', '.');
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

const emptyRow = (rowNo: number): StandardCostDirectRow => ({
  row_no: rowNo,
  direct_cost_name: '',
  kode_ce: '',
  used_in_process_wc: '',
  qty_req_bj_1_fg: '',
  value_amount: '',
  qty_per_month: '',
  lifetime_month: '',
  lifetime: '',
  cost_pcs_fg: '',
});

const DirectCostTab: React.FC<Props> = ({ rows, summary, totalProcessing, materialSummary, onChangeRows, onChangeSummary }) => {
  const updateRow = (index: number, key: keyof StandardCostDirectRow, value: string) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    onChangeRows(next);
  };

  useEffect(() => {
    let hasRowChanges = false;
    const nextRows = rows.map((row) => {
      const valAmt = parseFloat(row.value_amount) || 0;
      const qtyPerMonth = parseFloat(row.qty_per_month) || 0;
      const lifetimeMonth = parseFloat(row.lifetime_month) || 0;

      // lifetime = qty_per_month * lifetime_month
      const lifetime = qtyPerMonth * lifetimeMonth;
      const newLifetimeStr = lifetime === 0 ? '' : String(lifetime);

      // cost_pcs_fg = value_amount / lifetime
      let calcCost = 0;
      if (lifetime !== 0) {
        calcCost = valAmt / lifetime;
      }
      const newCost = calcCost === 0 ? '' : String(calcCost.toFixed(2));

      if (row.lifetime !== newLifetimeStr || row.cost_pcs_fg !== newCost) {
        hasRowChanges = true;
        return { ...row, lifetime: newLifetimeStr, cost_pcs_fg: newCost };
      }
      return row;
    });

    if (hasRowChanges) {
      onChangeRows(nextRows);
      return;
    }

    let totalDirect = 0;
    rows.forEach((row) => {
      totalDirect += parseFloat(row.cost_pcs_fg || '0') || 0;
    });

    const fmt = (n: number) => n === 0 ? '' : String(n.toFixed(2));
    const newTotalDirectStr = fmt(totalDirect);

    const sale = parseFloat(summary.sales) || 0;
    const calcPct = (val: number) => (sale > 0 ? String(((val / sale) * 100).toFixed(2)) : '');
    const newPctStr = calcPct(totalDirect);

    const processingTotal = parseFloat(totalProcessing.total_cost || '0') || 0;
    const materialTotal = parseFloat(materialSummary.total_row_material || '0') || 0;

    const totalCostPerProduct = processingTotal + materialTotal + totalDirect;
    const newTotalCostPerProductStr = fmt(totalCostPerProduct);

    const ucm = sale > 0 ? sale - totalCostPerProduct : 0;
    const newUcmStr = fmt(ucm);
    const newUcmPctStr = calcPct(ucm);

    // Assuming gross profit equals UCM unless overridden
    const newGrossProfitStr = newUcmStr;
    const newGrossProfitPctStr = newUcmPctStr;

    if (
      summary.total_direct_cost_to_product !== newTotalDirectStr ||
      summary.presentase_terhadap_sale !== newPctStr ||
      summary.total_cost_per_product !== newTotalCostPerProductStr ||
      summary.unit_contribution_margin !== newUcmStr ||
      summary.unit_contribution_margin_pct !== newUcmPctStr ||
      summary.gross_profit !== newGrossProfitStr ||
      summary.gross_profit_pct !== newGrossProfitPctStr
    ) {
      onChangeSummary({
        ...summary,
        total_direct_cost_to_product: newTotalDirectStr,
        presentase_terhadap_sale: newPctStr,
        total_cost_per_product: newTotalCostPerProductStr,
        unit_contribution_margin: newUcmStr,
        unit_contribution_margin_pct: newUcmPctStr,
        gross_profit: newGrossProfitStr,
        gross_profit_pct: newGrossProfitPctStr,
      });
    }
  }, [rows, summary, totalProcessing, materialSummary, onChangeRows, onChangeSummary]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between rounded-lg bg-slate-100/80 px-4 py-3 border border-slate-200">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Direct Cost To Product</h3>
      </div>

      <div className="flex flex-col gap-6">
        {rows.map((row, idx) => (
          <div key={idx} className="group relative flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md">
            <div className="absolute -left-3 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white shadow-md">
              {idx + 1}
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onChangeRows(rows.filter((_, i) => i !== idx))}
                className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500 border border-red-100 shadow-sm hover:bg-red-500 hover:text-white group-hover:flex transition-all"
              >
                &times;
              </button>
            )}

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              <div className="flex flex-col gap-1 lg:col-span-2">
                <span className="text-[10px] font-bold uppercase text-slate-500">Direct Cost Name</span>
                <input value={row.direct_cost_name} onChange={(e) => updateRow(idx, 'direct_cost_name', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Kode CE</span>
                <input value={row.kode_ce} onChange={(e) => updateRow(idx, 'kode_ce', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Used In Process/WC</span>
                <input value={row.used_in_process_wc} onChange={(e) => updateRow(idx, 'used_in_process_wc', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
              </div>
              <NumericInput label="Qty Req BJ 1 FG" theme="blue" value={row.qty_req_bj_1_fg} onChange={(v) => updateRow(idx, 'qty_req_bj_1_fg', v)} />
              <NumericInput label="Value Amount" theme="blue" value={row.value_amount} onChange={(v) => updateRow(idx, 'value_amount', v)} />
              <NumericInput label="Qty Per Month" theme="blue" value={row.qty_per_month} onChange={(v) => updateRow(idx, 'qty_per_month', v)} />
              <NumericInput label="Lifetime Month" theme="blue" value={row.lifetime_month} onChange={(v) => updateRow(idx, 'lifetime_month', v)} />
              <NumericInput label="Lifetime" theme="emerald" readOnly value={row.lifetime} />
              <NumericInput label="Cost/Pcs FG" theme="emerald" readOnly value={row.cost_pcs_fg} className="bg-emerald-50/30 font-bold" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChangeRows([...rows, emptyRow(rows.length + 1)])}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95 flex items-center gap-2"
        >
          <span>+</span> Add Direct Cost
        </button>
      </div>

      {/* COMPREHENSIVE FINAL SUMMARY */}
      <div className="mt-4 flex flex-col gap-6 rounded-xl border-2 border-slate-800 bg-white p-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="h-4 w-1 bg-slate-800 rounded-full"></div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Financial Performance Summary</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="space-y-4">
            <NumericInput label="Total Direct Cost" theme="blue" readOnly value={summary.total_direct_cost_to_product} />
            <NumericInput label="Percentage vs Sale (%)" theme="blue" readOnly value={summary.presentase_terhadap_sale} />
          </div>

          <div className="space-y-4 border-x border-slate-100 px-0 md:px-8">
            <NumericInput label="Sales Price" theme="emerald" className="text-lg font-black text-emerald-700" value={summary.sales} onChange={(v) => onChangeSummary({ ...summary, sales: v })} />
            <NumericInput label={summary.summary_title || 'Total Cost Per Product'} readOnly value={summary.total_cost_per_product} />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <NumericInput label="UCM" readOnly value={summary.unit_contribution_margin} />
              <NumericInput label="UCM %" theme="emerald" readOnly value={summary.unit_contribution_margin_pct} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumericInput label="Gross Profit" readOnly value={summary.gross_profit} />
              <NumericInput label="GP %" theme="emerald" readOnly value={summary.gross_profit_pct} />
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-slate-500">Remark / Notes</span>
          <textarea
            value={summary.remark}
            onChange={(e) => onChangeSummary({ ...summary, remark: e.target.value })}
            className="w-full rounded-md border border-slate-200 p-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all"
            rows={3}
            placeholder="Add internal notes here..."
          />
        </div>
      </div>
    </div>
  );
};
export default DirectCostTab;