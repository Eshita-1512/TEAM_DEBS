import { useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Activity, BarChart3, Clock, Receipt, Search, TrendingUp, Wallet, XCircle } from 'lucide-react';
import { analytics } from '@/api/client';
import { EmptyState, PageHeader, StatCard } from '@/components/shared';
import type { AnalyticsOverview, SpendPattern } from '@/types/api';
import { usePolling } from '@/hooks/usePolling';

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${currency} ${amount}`;

  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [patterns, setPatterns] = useState<SpendPattern[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, patternsRes] = await Promise.all([
        analytics.overview(),
        analytics.spendPatterns(),
      ]);
      setOverview(overviewRes.data);
      setPatterns(patternsRes.items);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling({ fetcher: fetchData, enabled: true });

  const statusMap = useMemo(() => {
    if (!overview) return [];
    return overview.expenses_by_status;
  }, [overview]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass-card h-28 shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, index) => <div key={index} className="glass-card h-32 shimmer" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-6">
          <div className="glass-card h-[420px] shimmer" />
          <div className="glass-card h-[420px] shimmer" />
        </div>
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics and intelligence"
        subtitle="Insights into spend shape, workflow pressure, and the anomalies that deserve attention."
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Admin' }, { label: 'Analytics' }]}
      />

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard label="Monthly spend" value={formatMoney(overview.total_amount, overview.currency)} icon={<Wallet size={18} />} accent="blue" />
        <StatCard label="Total expenses" value={overview.total_expenses} icon={<Receipt size={18} />} accent="emerald" />
        <StatCard label="Avg approval time" value={overview.avg_approval_time_hours ? `${overview.avg_approval_time_hours}h` : '—'} icon={<Clock size={18} />} accent="purple" />
        <StatCard label="Rejected claims" value={overview.rejected_count} icon={<XCircle size={18} />} accent="rose" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_.85fr] gap-6">
        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Spend by category
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Category bars should make the large shapes obvious before the exact numbers matter.
                </p>
              </div>
              <BarChart3 size={18} style={{ color: 'var(--text-tertiary)' }} />
            </div>

            <div className="space-y-4">
              {overview.expenses_by_category.map((category) => {
                const percentage = Number(overview.total_amount) > 0 ? (Number(category.amount) / Number(overview.total_amount)) * 100 : 0;
                return (
                  <div key={category.category}>
                    <div className="flex items-center justify-between gap-4 text-sm mb-1.5">
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {category.category}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        {formatMoney(category.amount, overview.currency)} · {category.count}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-[rgba(15,23,42,0.06)]">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, percentage))}%`, background: 'linear-gradient(90deg, rgba(74,124,255,0.92), rgba(139,92,246,0.92))' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Monthly trend
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  A compact trend line helps spot whether spend is moving or flattening.
                </p>
              </div>
              <TrendingUp size={18} style={{ color: 'var(--text-tertiary)' }} />
            </div>

            <div className="space-y-3">
              {overview.monthly_trend.map((month) => (
                <div key={month.month}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span style={{ color: 'var(--text-secondary)' }}>{month.month}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{formatMoney(month.amount, overview.currency)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-[rgba(15,23,42,0.06)]">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(6, Math.min(100, (Number(month.amount) / Math.max(1, Number(overview.total_amount))) * 100))}%`, background: 'linear-gradient(90deg, rgba(16,185,129,0.92), rgba(74,124,255,0.92))' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Spend by status
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Status mix should expose workflow pressure, not just accounting totals.
                </p>
              </div>
              <Activity size={18} style={{ color: 'var(--text-tertiary)' }} />
            </div>

            <div className="space-y-3">
              {statusMap.map((status) => {
                const percentage = Number(overview.total_amount) > 0 ? (Number(status.amount) / Number(overview.total_amount)) * 100 : 0;
                return (
                  <div key={status.status}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {status.status.replace(/_/g, ' ')}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        {status.count} · {formatMoney(status.amount, overview.currency)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-[rgba(15,23,42,0.06)]">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, percentage))}%`, background: 'linear-gradient(90deg, rgba(245,158,11,0.92), rgba(239,68,68,0.92))' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                  Spend intelligence
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Patterns and anomalies should read like operational signals, not decoration.
                </p>
              </div>
              <Search size={18} style={{ color: 'var(--text-tertiary)' }} />
            </div>

            {patterns.length === 0 ? (
              <EmptyState
                icon={<Search size={28} className="text-[var(--text-tertiary)]" />}
                title="No abnormal spend patterns"
                description="The current period does not contain obvious anomalies."
              />
            ) : (
              <div className="space-y-3">
                {patterns.map((pattern) => (
                  <div key={pattern.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.78)' }}>
                    <div className="flex items-start gap-3">
                      <div className={`rounded-xl p-2 ${pattern.severity === 'high' ? 'bg-[rgba(239,68,68,0.1)]' : 'bg-[rgba(245,158,11,0.1)]'}`}>
                        {pattern.type === 'anomaly' ? (
                          <AlertTriangle size={16} className={pattern.severity === 'high' ? 'text-[var(--color-accent-rose)]' : 'text-[var(--color-accent-amber)]'} />
                        ) : (
                          <TrendingUp size={16} className="text-[var(--color-accent-amber)]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {pattern.title}
                          </h3>
                          <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}>
                            {pattern.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-6" style={{ color: 'var(--text-secondary)' }}>
                          {pattern.description}
                        </p>
                        <div className="mt-3 rounded-lg border px-2.5 py-1 text-[11px] font-mono" style={{ borderColor: 'var(--border-default)', background: 'rgba(255,255,255,0.72)', color: 'var(--text-secondary)' }}>
                          {pattern.entity_name}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
