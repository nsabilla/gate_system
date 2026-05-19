import { parseNumberOrNull } from './pfsParsers';

export const computeToolingTotalPerPc = (row: any, technicalSpecCutQty: unknown) => {
  const total = (Number(row.cost_idr || 0) || 0) + (Number(row.opm_total_dep || 0) || 0);
  const cutQty = Number(technicalSpecCutQty || 0) || 0;
  if (cutQty > 0) return total / cutQty;
  return total;
};

export const computeToolsetPackagingCostPerPc = (row: any) => {
  const price = Number(row.price_idr || 0) || 0;
  const costPerBox = Number(row.cost_per_box_idr || 0) || 0;
  const qtyPerBox = Number(row.qty_per_box || 0) || 0;

  if (price > 0) return price;
  if (costPerBox > 0 && qtyPerBox > 0) return costPerBox / qtyPerBox;
  return 0;
};

export const jackRawMaterialTotal = (rows: any[]) =>
  rows.reduce((sum, row) => {
    const val = parseNumberOrNull(row.weight_unit_kg) ?? 0;
    if (String(row.part_name || '').toLowerCase().includes('screw shaft') || String(row.material || '').toLowerCase().includes('screw shaft')) {
      return sum;
    }
    return sum + val;
  }, 0);

export const jackComponentPurchaseTotal = (rows: any[]) => rows.reduce((sum, row) => sum + (parseNumberOrNull(row.price_idr) ?? 0), 0);

export const jackDiesJigTotal = (rows: any[]) => rows.reduce((sum, row) => sum + (parseNumberOrNull(row.cost_per_pcs) ?? 0), 0);

export const jackAssemblingTotal = (rows: any[]) => rows.reduce((sum, row) => sum + (parseNumberOrNull(row.cost_idr) ?? 0), 0);

export const jackDevelopmentCostTotal = (rows: any[]) => {
  const totalAmount = rows.reduce((sum, row) => sum + (parseNumberOrNull(row.amount_idr) ?? 0), 0);
  const finalTotal = totalAmount / 43200;
  return Math.round(finalTotal * 100) / 100;
};

export const jackPackingDeliveryTotal = (rows: any[]) => rows.reduce((sum, row) => sum + (parseNumberOrNull(row.cost_pcs) ?? 0), 0);
