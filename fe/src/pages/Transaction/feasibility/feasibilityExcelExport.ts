import ExcelJS from 'exceljs';
import type { FeasibilityData } from '../../../api/feasibility';
import type { StandardCostDocument } from '../../../api/standardCost';

type ExportOptions = {
  reportTitle: string;
  fileName: string;
  rfqNo?: string;
  pfsType?: string;
  formData: FeasibilityData;
  standardCostDocument: StandardCostDocument | null;
};

const safeText = (value: unknown) => {
  if (value === null || value === undefined) return '-';
  const text = String(value).trim();
  return text === '' ? '-' : text;
};

const numericText = (value: unknown, fractionDigits = 0) => {
  const text = safeText(value);
  const cleaned = String(text).replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return text;

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return text;

  return parsed.toLocaleString('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

const normalizeFileName = (value: string) =>
  value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const setCell = (
  cell: ExcelJS.Cell,
  value: unknown,
  options: {
    font?: Partial<ExcelJS.Font>;
    fill?: Partial<ExcelJS.Fill>;
    border?: Partial<ExcelJS.Borders>;
    alignment?: Partial<ExcelJS.Alignment>;
  } = {},
) => {
  cell.value = value as ExcelJS.CellValue;
  if (options.font) cell.font = options.font;
  if (options.fill) cell.fill = options.fill;
  if (options.border) cell.border = options.border;
  if (options.alignment) cell.alignment = options.alignment;
};

const applyThinBorder = (cell: ExcelJS.Cell) => {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };
};

const styleTableHeader = (cell: ExcelJS.Cell) => {
  setCell(cell, cell.value ?? '', {
    font: { bold: true, color: { argb: 'FF334155' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  });
  applyThinBorder(cell);
};

const styleTableCell = (cell: ExcelJS.Cell, align: 'left' | 'center' | 'right' = 'left') => {
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  applyThinBorder(cell);
};

const addKeyValue = (
  worksheet: ExcelJS.Worksheet,
  row: number,
  colLabel: number,
  colValue: number,
  label: string,
  value: unknown,
) => {
  setCell(worksheet.getCell(row, colLabel), label, {
    font: { bold: true, color: { argb: 'FF475569' } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  setCell(worksheet.getCell(row, colValue), value, {
    font: { color: { argb: 'FF0F172A' } },
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
  });
};

const writeSectionTable = (
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  columns: Array<{ key: string; label: string; width?: number; align?: 'left' | 'center' | 'right' }>,
  rows: Array<Record<string, unknown>>,
) => {
  worksheet.mergeCells(startRow, 1, startRow, 8);
  setCell(worksheet.getCell(startRow, 1), title, {
    font: { bold: true, color: { argb: 'FF0F172A' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  const headerRow = startRow + 1;
  columns.forEach((column, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    setCell(cell, column.label, { font: { bold: true } });
    styleTableHeader(cell);
    worksheet.getColumn(index + 1).width = column.width || worksheet.getColumn(index + 1).width || 16;
  });

  rows.forEach((row, rowIndex) => {
    const excelRow = worksheet.getRow(headerRow + 1 + rowIndex);
    excelRow.height = 20;
    columns.forEach((column, index) => {
      const cell = excelRow.getCell(index + 1);
      const raw = row[column.key];
      const value = column.key.includes('total') || column.key.includes('cost') || column.key.includes('pct')
        ? numericText(raw)
        : safeText(raw);
      setCell(cell, value, {
        alignment: {
          horizontal: column.align || (index === 0 ? 'center' : 'left'),
          vertical: 'middle',
          wrapText: true,
        },
      });
      applyThinBorder(cell);
    });
  });

  return headerRow + 1 + rows.length;
};

const writeSignatureBox = (worksheet: ExcelJS.Worksheet, startRow: number, standardCostDocument: StandardCostDocument | null) => {
  const signatures = standardCostDocument?.signature_cells || [];
  const rowTitle = startRow;
  const rowBody = startRow + 1;

  worksheet.mergeCells(rowTitle, 1, rowTitle, 8);
  setCell(worksheet.getCell(rowTitle, 1), 'SIGNATURE', {
    font: { bold: true, color: { argb: 'FF0F172A' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  const labels = signatures.slice(0, 5).map((cell) => `${cell.badge} ${cell.name}`);
  while (labels.length < 5) labels.push('-');

  labels.forEach((label, index) => {
    const startCol = index + 1;
    const endCol = index === 4 ? 8 : startCol;
    worksheet.mergeCells(rowBody, startCol, rowBody + 2, endCol);
    const cell = worksheet.getCell(rowBody, startCol);
    setCell(cell, label, {
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      font: { bold: index < 3, color: { argb: 'FF0F172A' } },
      border: {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      },
    });
  });
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportFeasibilitySummaryExcel = async ({
  reportTitle,
  fileName,
  rfqNo,
  pfsType,
  formData,
  standardCostDocument,
}: ExportOptions) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Copilot';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Feasibility Summary', {
    views: [{ showGridLines: false, zoomScale: 80 }],
  });

  worksheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.2,
      right: 0.2,
      top: 0.25,
      bottom: 0.25,
      header: 0.1,
      footer: 0.1,
    },
  };

  worksheet.columns = [
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  worksheet.getRow(1).height = 24;
  worksheet.mergeCells('A1:H1');
  setCell(worksheet.getCell('A1'), reportTitle, {
    font: { bold: true, size: 16, color: { argb: 'FF0F172A' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  worksheet.mergeCells('A2:H2');
  setCell(worksheet.getCell('A2'), safeText(standardCostDocument?.report_code), {
    font: { bold: true, size: 11, color: { argb: 'FF475569' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  worksheet.mergeCells('A4:D4');
  worksheet.mergeCells('E4:H4');
  setCell(worksheet.getCell('A4'), 'FEASIBILITY INPUT', {
    font: { bold: true, color: { argb: 'FF0F172A' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  setCell(worksheet.getCell('E4'), 'STANDARD COST OVERVIEW', {
    font: { bold: true, color: { argb: 'FF0F172A' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  addKeyValue(worksheet, 5, 1, 2, 'RFQ No', rfqNo);
  addKeyValue(worksheet, 6, 1, 2, 'Customer', formData.customer);
  addKeyValue(worksheet, 7, 1, 2, 'Project', formData.project);
  addKeyValue(worksheet, 8, 1, 2, 'Part Name', formData.part_name);
  addKeyValue(worksheet, 9, 1, 2, 'Part Number', formData.part_number);
  addKeyValue(worksheet, 10, 1, 2, 'Revision', formData.revision);
  addKeyValue(worksheet, 11, 1, 2, 'Qty / Month', numericText(formData.qty_month));
  addKeyValue(worksheet, 12, 1, 2, 'Masspro', formData.masspro);
  addKeyValue(worksheet, 13, 1, 2, 'Revenue / Year', numericText(formData.revenue_y));

  addKeyValue(worksheet, 5, 5, 6, 'Company', standardCostDocument?.overview?.company_name);
  addKeyValue(worksheet, 6, 5, 6, 'Customer', standardCostDocument?.overview?.customer);
  addKeyValue(worksheet, 7, 5, 6, 'Part Name', standardCostDocument?.overview?.part_name);
  addKeyValue(worksheet, 8, 5, 6, 'Part Number', standardCostDocument?.overview?.part_number);
  addKeyValue(worksheet, 9, 5, 6, 'Rejection Rate', standardCostDocument?.overview?.rejection_rate);
  addKeyValue(worksheet, 10, 5, 6, 'Similar Product', standardCostDocument?.overview?.similar_product);
  addKeyValue(worksheet, 11, 5, 6, 'PFS Type', pfsType);
  addKeyValue(worksheet, 12, 5, 6, 'Data Source', 'STANDARD COST');
  addKeyValue(worksheet, 13, 5, 6, 'Report Code', standardCostDocument?.report_code);

  let currentRow = 15;
  worksheet.mergeCells(currentRow, 1, currentRow, 8);
  setCell(worksheet.getCell(currentRow, 1), 'SUMMARY METRICS', {
    font: { bold: true, color: { argb: 'FF0F172A' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  currentRow += 1;
  const metricGroups = [
    { label: 'MFG COST', value: standardCostDocument?.direct_summary?.total_cost_per_product, fill: 'FFF3E8FF' },
    { label: 'SELLING PRICE', value: standardCostDocument?.direct_summary?.sales, fill: 'FFDCFCE7' },
    { label: 'GPM (%)', value: standardCostDocument?.direct_summary?.gross_profit_pct, fill: 'FFDCFCE7' },
    { label: 'UCM (Rp)', value: standardCostDocument?.direct_summary?.unit_contribution_margin, fill: 'FFDCFCE7' },
    { label: 'UCM (%)', value: standardCostDocument?.direct_summary?.unit_contribution_margin_pct, fill: 'FFDCFCE7' },
  ];

  metricGroups.forEach((metric, index) => {
    const startCol = index * 2 + 1;
    const endCol = index === 4 ? 8 : startCol + 1;
    worksheet.mergeCells(currentRow, startCol, currentRow, endCol);
    worksheet.mergeCells(currentRow + 1, startCol, currentRow + 1, endCol);

    setCell(worksheet.getCell(currentRow, startCol), metric.label, {
      font: { bold: true, size: 10, color: { argb: 'FF475569' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: metric.fill } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    setCell(worksheet.getCell(currentRow + 1, startCol), numericText(metric.value), {
      font: { bold: true, size: 12, color: { argb: 'FF0F172A' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: metric.fill } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });

    for (let col = startCol; col <= endCol; col += 1) {
      applyThinBorder(worksheet.getCell(currentRow, col));
      applyThinBorder(worksheet.getCell(currentRow + 1, col));
    }
  });

  currentRow += 3;
  currentRow = writeSectionTable(
    worksheet,
    currentRow,
    'PROCESSING COST',
    [
      { key: 'row_no', label: 'No', width: 8, align: 'center' },
      { key: 'wc', label: 'WC', width: 14, align: 'left' },
      { key: 'processing', label: 'Process', width: 34, align: 'left' },
      { key: 'rate_pcs.total_cost', label: 'Cost', width: 16, align: 'right' },
      { key: 'rate_pcs.mdepr', label: 'MDepr', width: 14, align: 'right' },
      { key: 'rate_pcs.labor', label: 'Labor', width: 14, align: 'right' },
      { key: 'rate_pcs.fohfd', label: 'FOHFD', width: 14, align: 'right' },
      { key: 'rate_pcs.fohfi', label: 'FOHFI', width: 14, align: 'right' },
    ],
    standardCostDocument?.processing_rows || [],
  ) + 2;

  currentRow = writeSectionTable(
    worksheet,
    currentRow,
    'MATERIAL COST',
    [
      { key: 'row_no', label: 'No', width: 8, align: 'center' },
      { key: 'raw_material', label: 'Raw Material', width: 24, align: 'left' },
      { key: 'process', label: 'Process', width: 24, align: 'left' },
      { key: 'top_value', label: 'Top Value', width: 12, align: 'right' },
      { key: 'material_code', label: 'Material Code', width: 18, align: 'left' },
      { key: 'qty_per_parent', label: 'Qty / Parent', width: 14, align: 'right' },
      { key: 'qty_req_by_parent', label: 'Qty Req Parent', width: 14, align: 'right' },
      { key: 'cost_pcs_fg', label: 'Cost / Pc', width: 14, align: 'right' },
    ],
    standardCostDocument?.material_rows || [],
  ) + 2;

  currentRow = writeSectionTable(
    worksheet,
    currentRow,
    'DIRECT COST',
    [
      { key: 'row_no', label: 'No', width: 8, align: 'center' },
      { key: 'direct_cost_name', label: 'Cost Name', width: 28, align: 'left' },
      { key: 'used_in_process_wc', label: 'WC', width: 16, align: 'left' },
      { key: 'value_amount', label: 'Value Amount', width: 16, align: 'right' },
      { key: 'qty_per_month', label: 'Qty / Month', width: 12, align: 'right' },
      { key: 'lifetime_month', label: 'Lifetime Month', width: 12, align: 'right' },
      { key: 'lifetime', label: 'Lifetime', width: 12, align: 'right' },
      { key: 'cost_pcs_fg', label: 'Cost / Pc', width: 14, align: 'right' },
    ],
    standardCostDocument?.direct_rows || [],
  ) + 2;

  worksheet.mergeCells(currentRow, 1, currentRow, 8);
  setCell(worksheet.getCell(currentRow, 1), 'NOTES', {
    font: { bold: true, color: { argb: 'FF0F172A' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  currentRow += 1;
  const notes = standardCostDocument?.report_notes || [];
  if (notes.length === 0) {
    worksheet.mergeCells(currentRow, 1, currentRow, 8);
    setCell(worksheet.getCell(currentRow, 1), 'No report notes available.', {
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      font: { italic: true, color: { argb: 'FF64748B' } },
    });
    currentRow += 1;
  } else {
    notes.forEach((note) => {
      worksheet.mergeCells(currentRow, 1, currentRow, 8);
      setCell(worksheet.getCell(currentRow, 1), `- ${note}`, {
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      });
      currentRow += 1;
    });
  }

  currentRow += 1;
  writeSignatureBox(worksheet, currentRow, standardCostDocument);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const saveFilePicker = typeof window.showSaveFilePicker === 'function'
    ? await window.showSaveFilePicker({
        suggestedName: normalizeFileName(fileName),
        types: [
          {
            description: 'Excel Workbook',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            },
          },
        ],
      })
    : null;

  if (saveFilePicker) {
    const writable = await saveFilePicker.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  downloadBlob(blob, normalizeFileName(fileName));
};