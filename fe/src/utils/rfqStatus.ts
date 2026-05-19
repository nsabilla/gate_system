export type RfqStatusFilter = '' | 'draft' | 'pending' | 'submitted' | 'approved';

export const normalizeRfqStatus = (value: unknown): string => {
  return String(value ?? '').trim().toLowerCase();
};

export const normalizeRfqStatusFilter = (value: unknown): RfqStatusFilter => {
  const normalized = normalizeRfqStatus(value);
  if (normalized === 'draft' || normalized === 'pending' || normalized === 'submitted' || normalized === 'approved') {
    return normalized;
  }
  return '';
};

export const isRfqPendingGroup = (value: unknown): boolean => {
  const normalized = normalizeRfqStatus(value);
  return normalized === 'pending' || normalized === 'submitted';
};

export const getRfqStatusBadgeClass = (value: unknown): string => {
  const normalized = normalizeRfqStatus(value);
  switch (normalized) {
    case 'draft':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200';
    case 'pending':
    case 'submitted':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    case 'approved':
      return 'bg-green-50 text-green-700 ring-1 ring-green-200';
    default:
      return 'bg-gray-50 text-gray-600 ring-1 ring-gray-200';
  }
};