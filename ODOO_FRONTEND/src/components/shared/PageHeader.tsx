import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="page-hero mb-8 animate-fade-in">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
                  {crumb.href ? (
                    <Link
                      to={crumb.href}
                      className="font-medium transition-colors duration-150 hover:text-[var(--accent)]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }} className="font-medium">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <div className="section-kicker mb-3">Workspace</div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3 lg:justify-end">{actions}</div>}
      </div>
    </div>
  );
}
