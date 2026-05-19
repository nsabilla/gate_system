const APP_TIME_ZONE = 'Asia/Jakarta';
const APP_LOCALE = 'id-ID';

const parseBackendDate = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00+07:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(raw)) {
    const parsed = new Date(raw.replace(' ', 'T') + '+07:00');
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateTimeInAppTZ = (value: unknown, fallback = '-'): string => {
  const date = parseBackendDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
};

export const formatDayMonthInAppTZ = (value: unknown, fallback = '-'): string => {
  const date = parseBackendDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: 'short',
  }).format(date);
};
