import type { RFQDetailRow, OverviewProductInfo } from './pfsTypes';

export const findByType = (rows: RFQDetailRow[], productType: 'new' | 'similar') => {
  const found = rows.find(
    (row) => String(row.product_type || '').trim().toLowerCase() === productType
  );
  return found || null;
};

export const fromRow = (row: RFQDetailRow | null): OverviewProductInfo => {
  if (!row) return { customer: '', partNo: '', product: '', qtyMonth: '', line: '' };

  return {
    customer: String(row.customer || ''),
    partNo: String(row.part_no || ''),
    product: String(row.part_name || ''),
    qtyMonth: String(row.volume_month || ''),
    line: String(row.line || ''),
  };
};
