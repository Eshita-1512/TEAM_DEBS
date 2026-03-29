import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  accent?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan';
}

const accentStyles: Record<string, { iconBg: string; iconColor: string; glow: string }> = {
  blue: {
    iconBg: 'rgba(37, 99, 235, 0.12)',
    iconColor: 'var(--accent)',
    glow: 'rgba(37, 99, 235, 0.12)',
  },
  emerald: {
    iconBg: 'rgba(34, 197, 94, 0.12)',
    iconColor: 'var(--success)',
    glow: 'rgba(34, 197, 94, 0.12)',
  },
  amber: {
    iconBg: 'rgba(245, 158, 11, 0.12)',
    iconColor: 'var(--warning)',
    glow: 'rgba(245, 158, 11, 0.12)',
  },
  rose: {
    iconBg: 'rgba(239, 68, 68, 0.12)',
    iconColor: 'var(--danger)',
    glow: 'rgba(239, 68, 68, 0.12)',
  },
  purple: {
    iconBg: 'rgba(148, 163, 184, 0.16)',
    iconColor: '#64748b',
    glow: 'rgba(148, 163, 184, 0.14)',
  },
  cyan: {
    iconBg: 'rgba(56, 189, 248, 0.12)',
    iconColor: 'var(--info)',
    glow: 'rgba(56, 189, 248, 0.12)',
  },
};

export function StatCard({ label, value, icon, trend, accent = 'blue' }: StatCardProps) {
  const s = accentStyles[accent] || accentStyles.blue;

  return (
    <div
      className="surface-panel surface-panel-interactive group relative cursor-default overflow-hidden rounded-[1.5rem] p-6 transition-all duration-300"
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `var(--shadow-soft), 0 20px 32px ${s.glow}`;
        e.currentTarget.style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-soft)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div
        className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-40 transition-opacity duration-300 group-hover:opacity-60"
        style={{ background: s.iconBg }}
      />

      <div className="relative mb-4 flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
        {icon && (
          <div
            className="rounded-xl p-3 transition-transform duration-300 group-hover:scale-110"
            style={{ background: s.iconBg, color: s.iconColor }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="relative flex items-end justify-between">
        <div className="text-[32px] font-semibold leading-none tracking-tight text-[var(--text-primary)]">
          {value}
        </div>
        {trend && (
          <div
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full mb-1"
            style={{
              color: trend.value > 0 ? '#10B981' : trend.value < 0 ? '#EF4444' : 'var(--text-tertiary)',
              background: trend.value > 0 ? 'var(--surface-tint-approved)' : trend.value < 0 ? 'var(--surface-tint-danger)' : 'var(--surface-tint-neutral)',
            }}
          >
            {trend.value > 0 ? <TrendingUp size={11} /> : trend.value < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {Math.abs(trend.value)}%
            {trend.label && (
              <span style={{ color: 'var(--text-tertiary)' }}>{trend.label}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
