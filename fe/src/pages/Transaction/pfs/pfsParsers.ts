export const parseTabKey = (value: string | null) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'estimation' || v === 'drawing' || v === 'timeframe') return v as any;
  return 'overview' as any;
};

export const parseNumberOrNull = (value: string): number | null => {
  const clean = String(value || '').trim();
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
};

export const parseIntOrNull = (value: string): number | null => {
  const clean = String(value || '').trim();
  if (!clean) return null;
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
};

export const parseCutQtyWithRM = (value: string) => {
  const clean = String(value || '').trim();
  if (!clean) return { cutQty: null as number | null, rmWeight: null as number | null };

  if (clean.includes('/')) {
    const parts = clean.split('/').map((part) => part.trim());
    const left = Number(parts[0]);
    const right = Number(parts[1]);
    return {
      cutQty: Number.isFinite(left) ? Math.trunc(left) : null,
      rmWeight: Number.isFinite(right) ? right : null,
    };
  }

  const onlyCutQty = Number(clean);
  return {
    cutQty: Number.isFinite(onlyCutQty) ? Math.trunc(onlyCutQty) : null,
    rmWeight: null,
  };
};

export const parseActivityCodeNumber = (value: string): number | null => {
  const v = String(value || '').trim();
  if (!v) return null;

  const direct = Number(v);
  if (Number.isFinite(direct) && direct >= 0) return Math.trunc(direct);

  const digitsOnly = v.replace(/\D+/g, '');
  if (!digitsOnly) return null;
  const n = Number(digitsOnly);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
};

export const toInputValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

export const toNumeric = (value: unknown): number => parseNumberOrNull(toInputValue(value)) ?? 0;

export const parseDate = (value: string): string | null => {
  const clean = String(value || '').trim();
  if (!clean) return null;
  return clean;
};
