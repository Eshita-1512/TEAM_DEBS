import { Search, Calendar, RotateCcw } from 'lucide-react';
import type { ExpenseStatus, ReimbursementStatus } from '@/types/api';

interface FilterBarProps {
  onSearch?: (query: string) => void;
  onStatusChange?: (status: string) => void;
  onDateFromChange?: (date: string) => void;
  onDateToChange?: (date: string) => void;
  onReset?: () => void;
  statusOptions?: { value: string; label: string }[];
  searchPlaceholder?: string;
  showStatus?: boolean;
  showDates?: boolean;
  currentSearch?: string;
  currentStatus?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
  extraFilters?: React.ReactNode;
}

const EXPENSE_STATUS_OPTIONS: { value: ExpenseStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'reimbursed', label: 'Reimbursed' },
];

const REIMBURSEMENT_STATUS_OPTIONS: { value: ReimbursementStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'not_ready', label: 'Not ready' },
  { value: 'ready', label: 'Ready' },
  { value: 'batched', label: 'Batched' },
  { value: 'paid', label: 'Paid' },
];

export { EXPENSE_STATUS_OPTIONS, REIMBURSEMENT_STATUS_OPTIONS };

export function FilterBar({
  onSearch,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
  onReset,
  statusOptions = EXPENSE_STATUS_OPTIONS,
  searchPlaceholder = 'Search records',
  showStatus = true,
  showDates = true,
  currentSearch = '',
  currentStatus = '',
  currentDateFrom = '',
  currentDateTo = '',
  extraFilters,
}: FilterBarProps) {
  const hasActive = Boolean(currentSearch || currentStatus || currentDateFrom || currentDateTo);

  return (
    <section className="surface-panel space-y-4 rounded-[1.5rem] p-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <label className="field-shell flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
            <Search size={16} className="text-[var(--text-muted)]" />
            <input
              type="search"
              value={currentSearch}
              onChange={(event) => onSearch?.(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </label>

          {showStatus && (
            <label className="field-shell flex items-center gap-3 px-4 py-3 lg:min-w-[15rem]">
              <span className="section-kicker">Status</span>
              <select
                value={currentStatus}
                onChange={(event) => onStatusChange?.(event.target.value)}
                className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {(hasActive || extraFilters) && (
          <div className="flex flex-wrap items-center gap-3">
            {extraFilters}
            {hasActive && onReset && (
              <button type="button" className="btn-secondary" onClick={onReset}>
                <RotateCcw size={14} />
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {showDates && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="field-shell flex items-center gap-3 px-4 py-3">
            <Calendar size={15} className="text-[var(--text-muted)]" />
            <div className="min-w-0 flex-1">
              <div className="section-kicker mb-1">Date From</div>
              <input
                type="date"
                value={currentDateFrom}
                onChange={(event) => onDateFromChange?.(event.target.value)}
                className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
              />
            </div>
          </label>

          <label className="field-shell flex items-center gap-3 px-4 py-3">
            <Calendar size={15} className="text-[var(--text-muted)]" />
            <div className="min-w-0 flex-1">
              <div className="section-kicker mb-1">Date To</div>
              <input
                type="date"
                value={currentDateTo}
                onChange={(event) => onDateToChange?.(event.target.value)}
                className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
              />
            </div>
          </label>
        </div>
      )}
    </section>
  );
}
