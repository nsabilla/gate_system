import type { AxiosError } from 'axios';
import api from '../../../api/axios';

export const formatCutQtyInput = (cutQty: unknown, rmWeight: unknown): string => {
  const cut = parseInt(String(cutQty || '').trim() || '') || NaN;
  const rm = Number(String(rmWeight || '').trim() || '') || NaN;
  if (Number.isNaN(cut)) return '';
  if (Number.isNaN(rm)) return String(cut);
  return `${cut} / ${rm}`;
};

export const formatAutoNumber = (value: number): string => {
  const rounded = Number(value.toFixed(2));
  return Number.isFinite(rounded) ? String(rounded) : '0';
};

export const isAllowedOutHouseAttachmentFile = (fileName: string): boolean => {
  const lower = String(fileName || '').trim().toLowerCase();
  return lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.doc') || lower.endsWith('.docx');
};

export const hasFilledText = (value: unknown): boolean => String(value || '').trim() !== '';

export const toErrorMessage = (error: unknown, fallback: string): string => {
  const ax = error as AxiosError<{ message?: string }>;
  return ax?.response?.data?.message || fallback;
};

export const getBackendOrigin = (): string => {
  const base = String(api.defaults.baseURL || '').trim();
  if (!base) return window.location.origin;

  try {
    return new URL(base, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

export const buildDrawingFileUrl = (filePath: string): string => {
  const raw = String(filePath || '').trim();
  if (!raw) return '#';
  if (/^https?:\/\//i.test(raw)) return raw;

  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '');
  const relativeToUploads = normalized.replace(/^uploads\//i, '');
  return `${getBackendOrigin()}/uploads/${relativeToUploads}`;
};
