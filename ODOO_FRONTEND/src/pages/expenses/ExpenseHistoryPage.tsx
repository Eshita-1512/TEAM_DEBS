import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Receipt, Clock, RefreshCw, Wallet, ArrowRight } from 'lucide-react';
import { expenses } from '@/api/client';
import { usePolling } from '@/hooks/usePolling';
import { useAuth } from '@/hooks/useAuth';
import { DataTable, type Column, FilterBar, EXPENSE_STATUS_OPTIONS, EmptyState, PageHeader, StatCard, StatusBadge } from '@/components/shared';
import type { Expense, ListParams, SortOrder } from '@/types/api';

const POLL_INTERVAL = 15000;

function formatMoney(currency: string, value: string): string {
  const parsed = Number.parseFloat(value || '0');
  if (Number.isNaN(parsed)) return `${currency} 0.00`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(parsed);
}

export function ExpenseHistoryPage() {
  const navigate = useNavigate();
  const { isEmployee } = useAuth();

  const [params, setParams] = useState<ListParams>({
    page: 1,
    page_size: 20,
    sort_by: 'expense_date',
    sort_order: 'desc',
  });

  const fetcher = useCallback(() => expenses.list(params), [params]);

  const { data, loading, refresh, lastUpdated } = usePolling({
    fetcher,
    interval: POLL_INTERVAL,
    enabled: true,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const pendingCount = items.filter(item => item.status === 'pending_approval').length;
  const reimbursedCount = items.filter(item => item.reimbursement?.status === 'paid' || item.status === 'reimbursed').length;
  const visibleCount = items.length;

  const columns: Column<Expense>[] = [
    {
      key: 'expense_date',
      label: 'Date',
      sortable: true,
      render: (expense) => (
        <span className="text-[var(--text-secondary)] tabular-nums">
          {new Date(expense.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Expense',
      render: (expense) => (
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)] truncate">
            {expense.description}
          </p>
          <p className="text-xs mt-1 text-[var(--text-tertiary)]">
            {expense.category}
          </p>
        </div>
      ),
    },
    {
      key: 'original_amount',
      label: 'Amount',
      sortable: true,
      className: 'text-right',
      render: (expense) => (
        <div className="text-right">
          <p className="font-semibold tabular-nums text-[var(--text-primary)]">
            {formatMoney(expense.original_currency, expense.original_amount)}
          </p>
          {expense.original_currency !== expense.company_currency && (
            <p className="text-xs mt-1 text-[var(--text-tertiary)]">
              {formatMoney(expense.company_currency, expense.converted_amount)} company currency
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Workflow',
      render: (expense) => (
        <div className="space-y-1">
          <StatusBadge status={expense.status} pulse={expense.status === 'pending_approval'} />
          <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>
            Reimbursement {expense.reimbursement ? expense.reimbursement.status.replace(/_/g, ' ') : 'not ready'}
          </p>
        </div>
      ),
    },
    {
      key: 'submitted_total_before_exclusions',
      label: 'Evidence',
      render: (expense) => (
        <div className="text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>{expense.receipt ? expense.receipt.file_name : 'No receipt attached'}</p>
          <p className="mt-1 text-[var(--text-tertiary)]">
            {expense.approval_summary ? `Step ${expense.approval_summary.current_step_sequence}` : 'Draft context unavailable'}
          </p>
        </div>
      ),
    },
  ];

  const handleSort = (key: string, order: SortOrder) => {
    setParams(prev => ({ ...prev, sort_by: key, sort_order: order, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title={isEmployee ? 'My expenses' : 'Expense history'}
        subtitle={
          isEmployee
            ? 'Track submission status, conversion context, and reimbursement state in one place.'
            : 'Review the company expense trail with the workflow state intact.'
        }
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Expenses' }]}
        actions={
          <button
            onClick={() => navigate('/app/expenses/new')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={15} />
            New expense
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Matching expenses"
          value={pagination?.total_items ?? visibleCount}
          icon={<Receipt size={18} />}
          accent="blue"
        />
        <StatCard
          label="Pending on page"
          value={pendingCount}
          icon={<Clock size={18} />}
          accent="amber"
        />
        <StatCard
          label="Reimbursed on page"
          value={reimbursedCount}
          icon={<Wallet size={18} />}
          accent="emerald"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] p-4" style={{ background: 'rgba(255,255,255,0.56)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ background: 'var(--bg-inset)' }}>
            <ArrowRight size={14} />
            {pagination?.total_items ?? 0} matching records
          </span>
          {lastUpdated && (
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ background: 'var(--bg-inset)' }}>
              <Clock size={14} />
              Synced {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              <button
                onClick={refresh}
                className="ml-1 inline-flex items-center justify-center rounded-full p-1 transition-colors"
                style={{ color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <RefreshCw size={11} />
              </button>
            </span>
          )}
        </div>
        {isEmployee && (
          <button
            id="new-expense-btn"
            onClick={() => navigate('/app/expenses/new')}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Plus size={15} />
            Start a submission
          </button>
        )}
      </div>

      <FilterBar
        searchPlaceholder="Search expense description..."
        statusOptions={EXPENSE_STATUS_OPTIONS}
        currentSearch={params.q || ''}
        currentStatus={params.status || ''}
        currentDateFrom={params.date_from || ''}
        currentDateTo={params.date_to || ''}
        onSearch={q => setParams(prev => ({ ...prev, q, page: 1 }))}
        onStatusChange={status => setParams(prev => ({ ...prev, status, page: 1 }))}
        onDateFromChange={date_from => setParams(prev => ({ ...prev, date_from, page: 1 }))}
        onDateToChange={date_to => setParams(prev => ({ ...prev, date_to, page: 1 }))}
        onReset={() => setParams({ page: 1, page_size: 20, sort_by: 'expense_date', sort_order: 'desc' })}
      />

      {!loading && items.length === 0 ? (
        <EmptyState
          icon={<Receipt size={32} className="text-[var(--text-tertiary)]" />}
          title={isEmployee ? 'No expenses yet' : 'No expenses found'}
          description={isEmployee ? 'Submit a receipt or manual expense to begin the workflow.' : 'Try adjusting the search, status, or date filters.'}
          action={isEmployee ? (
            <button
              onClick={() => navigate('/app/expenses/new')}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus size={14} />
              Create expense
            </button>
          ) : undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          pagination={pagination}
          onPageChange={handlePageChange}
          onSort={handleSort}
          currentSort={{ key: params.sort_by ?? 'expense_date', order: params.sort_order ?? 'desc' }}
          onRowClick={(item) => navigate(`/app/expenses/${item.id}`)}
          loading={loading}
          getRowId={(item) => item.id}
          emptyMessage="No expenses match your filters"
        />
      )}
    </div>
  );
}
