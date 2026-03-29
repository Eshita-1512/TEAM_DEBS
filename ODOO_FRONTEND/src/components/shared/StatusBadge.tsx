import { clsx } from 'clsx';
import type { ExpenseStatus, ReimbursementStatus } from '@/types/api';
import { formatStatus } from '@/lib/formatters';

const statusConfig: Record<string, { label: string; color: string; bg: string; borderColor: string }> = {
  draft: { label: 'Draft', color: 'var(--color-status-neutral)', bg: 'var(--surface-tint-neutral)', borderColor: 'rgba(148, 163, 184, 0.24)' },
  submitted: { label: 'Submitted', color: 'var(--color-status-info)', bg: 'var(--surface-tint-info)', borderColor: 'rgba(56, 189, 248, 0.24)' },
  pending_approval: { label: 'Pending', color: 'var(--color-status-pending)', bg: 'var(--surface-tint-pending)', borderColor: 'rgba(245, 158, 11, 0.24)' },
  on_hold: { label: 'Hold', color: 'var(--color-status-hold)', bg: 'var(--surface-tint-hold)', borderColor: 'rgba(148, 163, 184, 0.24)' },
  approved: { label: 'Approved', color: 'var(--color-status-approved)', bg: 'var(--surface-tint-approved)', borderColor: 'rgba(34, 197, 94, 0.24)' },
  rejected: { label: 'Rejected', color: 'var(--color-status-danger)', bg: 'var(--surface-tint-danger)', borderColor: 'rgba(239, 68, 68, 0.24)' },
  reimbursed: { label: 'Reimbursed', color: 'var(--color-status-info)', bg: 'var(--surface-tint-info)', borderColor: 'rgba(56, 189, 248, 0.24)' },
  not_ready: { label: 'Not Ready', color: 'var(--color-status-neutral)', bg: 'var(--surface-tint-neutral)', borderColor: 'rgba(148, 163, 184, 0.24)' },
  ready: { label: 'Ready', color: 'var(--color-status-approved)', bg: 'var(--surface-tint-approved)', borderColor: 'rgba(34, 197, 94, 0.24)' },
  batched: { label: 'Batched', color: 'var(--color-status-info)', bg: 'var(--surface-tint-info)', borderColor: 'rgba(56, 189, 248, 0.24)' },
  paid: { label: 'Paid', color: 'var(--color-status-approved)', bg: 'var(--surface-tint-approved)', borderColor: 'rgba(34, 197, 94, 0.24)' },
};

interface StatusBadgeProps {
  status: ExpenseStatus | ReimbursementStatus | string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export function StatusBadge({ status, size = 'md', pulse = false }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: formatStatus(status),
    color: 'var(--color-status-neutral)',
    bg: 'var(--surface-tint-neutral)',
    borderColor: 'var(--border-strong)',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-semibold',
        size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]',
        pulse && 'animate-pulse-glow'
      )}
      style={{
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.borderColor}`,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      <span
        className={clsx(
          'rounded-full',
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
        )}
        style={{ background: config.color }}
      />
      {config.label}
    </span>
  );
}
