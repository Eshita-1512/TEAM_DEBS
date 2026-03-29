import { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="surface-panel flex flex-col items-center justify-center rounded-[1.5rem] px-6 py-20 text-center animate-fade-in">
      <div
        className="mb-6 rounded-2xl p-5"
        style={{
          background: 'var(--surface-sunken)',
          border: '1px dashed var(--border-strong)',
        }}
      >
        {icon || <Inbox size={28} style={{ color: 'var(--text-muted)' }} />}
      </div>
      <h3 className="mb-2 text-[1.3rem] font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      {description && (
        <p
          className="max-w-md text-sm leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
