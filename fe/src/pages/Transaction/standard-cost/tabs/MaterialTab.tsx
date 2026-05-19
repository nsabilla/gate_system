import React, { useEffect } from 'react';
import type { StandardCostMaterialRow, StandardCostMaterialSummary } from '../../../../api/standardCost';

type Props = {
  rows: StandardCostMaterialRow[];
  summary: StandardCostMaterialSummary;
  salesPrice: string;
  rejectionRate: string;
  onChangeRows: (rows: StandardCostMaterialRow[]) => void;
  onChangeSummary: (summary: StandardCostMaterialSummary) => void;
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

const emptyRow = (rowNo: number): StandardCostMaterialRow => ({
  row_no: rowNo,
  raw_material: '',
  top_value: '',
  material_code: '',
  product: '',
  process: '',
  qty_per_parent: '',
  uom: '',
  qty_req_by_parent: '',
  qty_req_bj_1_fg: '',
  top_imp_loc: '',
  import_flag: '',
  currency: 'IDR',
  exchange_rate: '',
  rp_uom_material: '',
  cost_pcs_fg: '',
});

const MaterialTab: React.FC<Props> = ({ rows, summary, salesPrice, rejectionRate, onChangeRows, onChangeSummary }) => {
  const updateRow = (index: number, key: keyof StandardCostMaterialRow, value: string) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    onChangeRows(next);
  };

  useEffect(() => {
    let hasRowChanges = false;
    const rejRateVal = parseFloat(rejectionRate) || 0;

    // qty_req_by_parent = 1 + (Rejection Rate / 100)
    const qtyReqByParent = 1 + (rejRateVal / 100);
    const qtyReqByParentStr = String(parseFloat(qtyReqByParent.toFixed(4)));

    const nextRows = rows.map((row) => {
      const qtyParentVal = parseFloat(row.qty_per_parent) || 0;

      // qty_req_bj_1_fg = qty_per_parent * qty_req_by_parent
      const calculatedQtyReq = qtyParentVal * qtyReqByParent;
      const newQtyReqStr = calculatedQtyReq === 0 ? '' : String(parseFloat(calculatedQtyReq.toFixed(4)));

      const rpUom = parseFloat(row.rp_uom_material) || 0;
      const qty = calculatedQtyReq;
      let exRate = parseFloat(row.exchange_rate) || 0;
      if (exRate === 0) exRate = 1;

      const calcCost = rpUom * qty * exRate;
      const newCost = calcCost === 0 ? '' : String(calcCost.toFixed(2));

      if (row.qty_req_by_parent !== qtyReqByParentStr || row.qty_req_bj_1_fg !== newQtyReqStr || row.cost_pcs_fg !== newCost) {
        hasRowChanges = true;
        return { ...row, qty_req_by_parent: qtyReqByParentStr, qty_req_bj_1_fg: newQtyReqStr, cost_pcs_fg: newCost };
      }
      return row;
    });

    if (hasRowChanges) {
      onChangeRows(nextRows);
      return;
    }

    let totalMaterial = 0;
    rows.forEach((row) => {
      totalMaterial += parseFloat(row.cost_pcs_fg || '0') || 0;
    });

    const fmt = (n: number) => n === 0 ? '' : String(n.toFixed(2));
    const newTotalMaterialStr = fmt(totalMaterial);

    const sale = parseFloat(salesPrice) || 0;
    const calcPct = (val: number) => (sale > 0 ? String(((val / sale) * 100).toFixed(2)) : '');
    const newPctStr = calcPct(totalMaterial);

    if (summary.total_row_material !== newTotalMaterialStr || summary.presentase_terhadap_sale !== newPctStr) {
      onChangeSummary({
        ...summary,
        total_row_material: newTotalMaterialStr,
        presentase_terhadap_sale: newPctStr,
      });
    }
  }, [rows, summary, salesPrice, rejectionRate, onChangeRows, onChangeSummary]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between rounded-lg bg-slate-100/80 px-4 py-3 border border-slate-200">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Material Cost Breakdown</h3>
      </div>

      <div className="flex flex-col gap-6">
        {rows.map((row, idx) => (
          <div key={idx} className="group relative flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md">
            <div className="absolute -left-3 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow-md">
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Raw Material</span>
                <input value={row.raw_material} onChange={(e) => updateRow(idx, 'raw_material', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-50" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Top</span>
                <input value={row.top_value} onChange={(e) => updateRow(idx, 'top_value', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Material Code</span>
                <input value={row.material_code} onChange={(e) => updateRow(idx, 'material_code', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Product</span>
                <input value={row.product} onChange={(e) => updateRow(idx, 'product', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Proses</span>
                <input value={row.process} onChange={(e) => updateRow(idx, 'process', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
              </div>
              <NumericInput label="Qty per Parent" theme="blue" value={row.qty_per_parent} onChange={(v) => updateRow(idx, 'qty_per_parent', v)} />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">UOM</span>
                <input value={row.uom} onChange={(e) => updateRow(idx, 'uom', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
              </div>
              <NumericInput label="Qty Req by Parent" theme="emerald" readOnly value={row.qty_req_by_parent} />
              <NumericInput label="Qty Req by 1 FG" theme="emerald" readOnly value={row.qty_req_bj_1_fg} />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Top (Import/Local)</span>
                <input value={row.top_imp_loc} onChange={(e) => updateRow(idx, 'top_imp_loc', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Import</span>
                <input value={row.import_flag} onChange={(e) => updateRow(idx, 'import_flag', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
              </div>
              <NumericInput label="Rp/UOM Material" theme="emerald" value={row.rp_uom_material} onChange={(v) => updateRow(idx, 'rp_uom_material', v)} />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Currency</span>
                <input value={row.currency} onChange={(e) => updateRow(idx, 'currency', e.target.value)} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm" />
              </div>
              <NumericInput label="Exchange Rate" value={row.exchange_rate} onChange={(v) => updateRow(idx, 'exchange_rate', v)} />
              <div className="lg:col-span-4">
                <NumericInput label="Cost / Pcs FG" theme="emerald" readOnly value={row.cost_pcs_fg} className="bg-emerald-50/30 font-bold text-emerald-900" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChangeRows([...rows, emptyRow(rows.length + 1)])}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-95 flex items-center gap-2"
        >
          <span>+</span> Add Material Row
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="h-4 w-1 bg-emerald-600 rounded-full"></div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Material Summary</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <NumericInput label="Total Row Material" value={summary.total_row_material} onChange={(v) => onChangeSummary({ ...summary, total_row_material: v })} />
          <NumericInput label="Percentage Against Sale (%)" theme="emerald" value={summary.presentase_terhadap_sale} onChange={(v) => onChangeSummary({ ...summary, presentase_terhadap_sale: v })} />
        </div>
      </div>
    </div>
  );
};

export default MaterialTab;