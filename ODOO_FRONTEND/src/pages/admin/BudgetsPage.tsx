import { useState, useCallback, type FormEvent } from 'react';
import { AlertTriangle, Plus, Wallet } from 'lucide-react';
import { budgets } from '@/api/client';
import { EmptyState, FilterBar, PageHeader, StatCard } from '@/components/shared';
import { useAuth } from '@/hooks/useAuth';
import { usePolling } from '@/hooks/usePolling';
import type { Budget, CreateBudgetRequest, ListParams } from '@/types/api';

const SCOPE_TYPES = ['department', 'category', 'period', 'company'] as const;

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${currency} ${amount}`;

  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function BudgetsPage() {
  const { user } = useAuth();
  const [params, setParams] = useState<ListParams>({ page: 1, page_size: 50 });
  const [modalOpen, setModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<CreateBudgetRequest>({
    name: '',
    scope_type: 'department',
    scope_value: '',
    allocated_amount: '',
    currency: user?.company.default_currency || 'USD',
    period_start: '',
    period_end: '',
    threshold_warning: 70,
    threshold_critical: 90,
  });

  const fetcher = useCallback(() => budgets.list(params), [params]);
  const { data, loading, refresh } = usePolling({ fetcher, enabled: true });

  const items = data?.items ?? [];

  const totals = items.reduce(
    (acc, budget) => {
      acc.total += 1;
      const spend = Number(budget.spent_amount);
      const allocated = Number(budget.allocated_amount) || 1;
      const usage = (spend / allocated) * 100;
      if (usage >= budget.threshold_critical) acc.critical += 1;
      else if (usage >= budget.threshold_warning) acc.warning += 1;
      return acc;
    },
    { total: 0, warning: 0, critical: 0 },
  );

  const resetForm = () => {
    setForm({
      name: '',
      scope_type: 'department',
      scope_value: '',
      allocated_amount: '',
      currency: user?.company.default_currency || 'USD',
      period_start: '',
      period_end: '',
      threshold_warning: 70,
      threshold_critical: 90,
    });
    setFormError('');
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.allocated_amount || !form.period_start || !form.period_end) {
      setFormError('Please fill in the required budget fields.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      await budgets.create(form);
      setModalOpen(false);
      await refresh();
    } catch (error: unknown) {
      const err = error as { error?: { message?: string } };
      setFormError(err?.error?.message || 'Failed to create budget.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        subtitle="Track spend against limits and make budget pressure visible before it becomes a problem."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Admin' }, { label: 'Budgets' }]}
        actions={
          <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus size={16} />
            New budget
          </button>
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard label="Budgets" value={totals.total} icon={<Wallet size={18} />} accent="blue" />
        <StatCard label="Warning" value={totals.warning} icon={<AlertTriangle size={18} />} accent="amber" />
        <StatCard label="Critical" value={totals.critical} icon={<AlertTriangle size={18} />} accent="rose" />
        <StatCard label="Default currency" value={user?.company.default_currency || 'USD'} icon={<Wallet size={18} />} accent="emerald" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_.75fr] gap-6">
        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Search budget names..."
            currentSearch={params.q}
            onSearch={(q) => setParams(prev => ({ ...prev, q, page: 1 }))}
            showStatus={false}
            showDates={false}
          />

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="glass-card h-48 shimmer" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Wallet size={32} className="text-[var(--text-tertiary)]" />}
              title="No budgets active"
              description="Create a budget to start surfacing spend pressure and variance."
              action={<button onClick={openCreate} className="btn-primary text-sm inline-flex items-center gap-2"><Plus size={14} /> Create budget</button>}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {items.map((budget) => (
                <BudgetCard key={budget.id} budget={budget} />
              ))}
            </div>
          )}
        </div>

        <aside className="glass-card p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Budget posture
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Budget panels should make thresholds obvious, not just show numeric totals.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.78)' }}>
            <div className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
              Review rules
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <li>Keep scope values specific enough to be actionable.</li>
              <li>Use critical thresholds for escalations, not only warnings.</li>
              <li>Keep the currency aligned with company defaults unless a budget intentionally differs.</li>
            </ul>
          </div>
        </aside>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative glass-card w-full max-w-lg p-6 animate-fade-in-scale">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Create budget
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Budget setup should be terse and auditable.
            </p>

            <form onSubmit={handleCreate} className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Budget name
                </span>
                <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="input-field" placeholder="Q1 Engineering" required />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Scope type
                </span>
                <select value={form.scope_type} onChange={e => setForm(prev => ({ ...prev, scope_type: e.target.value as CreateBudgetRequest['scope_type'] }))} className="input-field">
                  {SCOPE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Scope value
                </span>
                <input type="text" value={form.scope_value} onChange={e => setForm(prev => ({ ...prev, scope_value: e.target.value }))} className="input-field" placeholder="Engineering" required />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Allocated amount
                </span>
                <input type="number" min="0" step="0.01" value={form.allocated_amount} onChange={e => setForm(prev => ({ ...prev, allocated_amount: e.target.value }))} className="input-field" placeholder="100000" required />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Currency
                </span>
                <input type="text" value={form.currency} onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))} className="input-field" placeholder="USD" required />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Period start
                </span>
                <input type="date" value={form.period_start} onChange={e => setForm(prev => ({ ...prev, period_start: e.target.value }))} className="input-field" required />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Period end
                </span>
                <input type="date" value={form.period_end} onChange={e => setForm(prev => ({ ...prev, period_end: e.target.value }))} className="input-field" required />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Warning threshold
                </span>
                <input type="number" min="0" max="100" value={form.threshold_warning} onChange={e => setForm(prev => ({ ...prev, threshold_warning: Number(e.target.value) || 0 }))} className="input-field" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Critical threshold
                </span>
                <input type="number" min="0" max="100" value={form.threshold_critical} onChange={e => setForm(prev => ({ ...prev, threshold_critical: Number(e.target.value) || 0 }))} className="input-field" />
              </label>

              {formError && <p className="md:col-span-2 text-sm" style={{ color: 'var(--color-accent-rose)' }}>{formError}</p>}

              <div className="md:col-span-2 flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={formLoading} className="btn-primary flex-1">{formLoading ? 'Creating...' : 'Create budget'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetCard({ budget }: { budget: Budget }) {
  const spent = Number(budget.spent_amount);
  const allocated = Number(budget.allocated_amount) || 1;
  const percent = (spent / allocated) * 100;
  const isWarning = percent >= budget.threshold_warning && percent < budget.threshold_critical;
  const isCritical = percent >= budget.threshold_critical;

  const barColor = isCritical
    ? 'bg-[var(--color-accent-rose)]'
    : isWarning
    ? 'bg-[var(--color-accent-amber)]'
    : 'bg-[var(--color-accent-emerald)]';

  return (
    <div className="glass-card p-6 group transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {budget.name}
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {budget.scope_type} · {budget.scope_value}
          </p>
        </div>
        <Wallet size={16} style={{ color: 'var(--text-tertiary)' }} />
      </div>

      <div className="flex items-end justify-between mb-2">
        <div>
          <span className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {formatMoney(budget.spent_amount, budget.currency)}
          </span>
          <span className="text-sm ml-2" style={{ color: 'var(--text-tertiary)' }}>spent</span>
        </div>
        <div className="text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
          <div>of</div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatMoney(budget.allocated_amount, budget.currency)}</div>
        </div>
      </div>

      <div className="h-2 w-full rounded-full overflow-hidden bg-[rgba(15,23,42,0.06)] mb-3">
        <div className={`h-full transition-all duration-700 ${barColor}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span style={{ color: 'var(--text-tertiary)' }}>
          {new Date(budget.period_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(budget.period_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
        <span className={`font-medium ${isCritical ? 'text-[var(--color-accent-rose)]' : isWarning ? 'text-[var(--color-accent-amber)]' : 'text-[var(--color-accent-emerald)]'}`}>
          {isCritical && <AlertTriangle size={10} className="inline-block mr-1" />}
          {percent.toFixed(1)}% used
        </span>
      </div>
    </div>
  );
}
