import type { ReactNode } from 'react';
import clsx from 'clsx';

interface PolicyCanvasBlockProps {
  title: string;
  subtitle?: string;
  family: 'start' | 'sequence' | 'rule' | 'outcome' | 'notes';
  selected?: boolean;
  children?: ReactNode;
  rightSlot?: ReactNode;
  onClick?: () => void;
}

const familyClasses: Record<PolicyCanvasBlockProps['family'], string> = {
  start:
    'border-sky-200/80 bg-linear-to-br from-sky-50 to-white',
  sequence:
    'border-indigo-200/80 bg-linear-to-br from-white to-indigo-50/80',
  rule:
    'border-amber-200/80 bg-linear-to-br from-amber-50 to-white',
  outcome:
    'border-emerald-200/80 bg-linear-to-br from-emerald-50 to-white',
  notes:
    'border-slate-200/80 bg-linear-to-br from-slate-50 to-white',
};

export function PolicyCanvasBlock({
  title,
  subtitle,
  family,
  selected,
  children,
  rightSlot,
  onClick,
}: PolicyCanvasBlockProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full rounded-2xl border p-4 text-left shadow-sm transition-all duration-200',
        familyClasses[family],
        selected
          ? 'ring-2 ring-[var(--primary)] shadow-[0_12px_30px_rgba(74,124,255,0.14)]'
          : 'hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            {family}
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</div>
          ) : null}
        </div>
        {rightSlot}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </button>
  );
}
