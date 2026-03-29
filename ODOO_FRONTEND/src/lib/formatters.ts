import type { ExpenseStatus, ReimbursementStatus, Role, RuleType } from '@/types/api';

const FALLBACK_LOCALE = 'en-IN';

export function formatMoney(amount: string | number | null | undefined, currency = 'USD') {
  const numeric = Number(amount ?? 0);
  if (!Number.isFinite(numeric)) {
    return `${currency} ${amount ?? '0'}`;
  }

  return new Intl.NumberFormat(FALLBACK_LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return 'Unavailable';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(
    FALLBACK_LOCALE,
    options ?? { day: 'numeric', month: 'short', year: 'numeric' },
  ).format(parsed);
}

export function formatDateTime(value: string | null | undefined) {
  return formatDate(value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatLabel(value: string | null | undefined) {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (segment) => segment.toUpperCase());
}

export function formatRole(role: Role | string) {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    manager: 'Manager',
    employee: 'Employee',
  };

  return labels[role] ?? formatLabel(role);
}

export function formatStatus(status: ExpenseStatus | ReimbursementStatus | string) {
  return formatLabel(status);
}

export function formatRuleType(ruleType: RuleType | string) {
  return formatLabel(ruleType);
}

export function initials(value: string | null | undefined) {
  if (!value) return '??';

  const tokens = value.trim().split(/\s+/).slice(0, 2);
  return tokens.map((token) => token[0]?.toUpperCase() ?? '').join('');
}

export function relativeFreshness(date: Date | null) {
  if (!date) return 'Waiting for first refresh';

  const delta = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (delta < 10) return 'Updated just now';
  if (delta < 60) return `Updated ${delta}s ago`;
  if (delta < 3600) return `Updated ${Math.round(delta / 60)}m ago`;
  return `Updated ${Math.round(delta / 3600)}h ago`;
}
