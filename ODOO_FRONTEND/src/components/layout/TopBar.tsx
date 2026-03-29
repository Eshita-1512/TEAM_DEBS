import { Menu, LogOut, Bell, Building2, ChevronRight } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLayout } from '@/hooks/useLayout';
import { formatRole, initials } from '@/lib/formatters';
import { getPathBreadcrumbs } from '@/lib/navigation';

export function TopBar() {
  const { user, logout } = useAuth();
  const { isMobile, setMobileNavOpen } = useLayout();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const role = user?.user.role ?? 'employee';
  const breadcrumbs = getPathBreadcrumbs(location.pathname, role);
  const currentLabel = breadcrumbs[breadcrumbs.length - 1]?.label ?? 'Workspace';
  const parentLabel = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2]?.label : undefined;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button type="button" className="btn-ghost !p-2.5" onClick={() => setMobileNavOpen(true)}>
              <Menu size={17} />
            </button>
          )}

          <div className="hidden h-10 w-10 items-center justify-center rounded-[1rem] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text-secondary)] sm:flex">
            <Building2 size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-[var(--text-primary)]">{currentLabel}</div>
            <div className="text-xs text-[var(--text-muted)]">
              {parentLabel ? `${parentLabel} · ` : ''}{user?.company.name ?? 'Company'} · {formatRole(role)}
            </div>
            <nav className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                  {index > 0 && <ChevronRight size={11} className="text-[var(--text-muted)]" />}
                  {crumb.to ? (
                    <Link
                      to={crumb.to}
                      className="rounded-full border border-transparent px-2 py-0.5 transition-colors duration-150 hover:border-[var(--border)] hover:bg-[var(--surface)] hover:text-[var(--accent)]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[var(--text-secondary)]">
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-[0.9rem] border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] md:flex">
            <Bell size={14} />
            System healthy
          </div>

          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-3 rounded-[1rem] border border-[var(--border)] bg-white px-2.5 py-2 shadow-[var(--shadow-soft)]"
              onClick={() => setOpen((value) => !value)}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-blue-600 text-xs font-semibold text-white">
                {initials(user?.user.name)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium text-[var(--text-primary)]">{user?.user.name}</span>
                <span className="block text-xs text-[var(--text-muted)]">{user?.user.email}</span>
              </span>
            </button>

            {open && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                />
                <div className="surface-panel absolute right-0 z-20 mt-3 min-w-[16rem] p-2">
                  <div className="rounded-[1rem] bg-[var(--surface-sunken)] px-3 py-3">
                    <div className="text-sm font-medium text-[var(--text-primary)]">{user?.company.name}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {formatRole(user?.user.role ?? 'employee')} · {user?.company.default_currency ?? 'USD'}
                    </div>
                  </div>
                  <button type="button" className="btn-ghost mt-2 w-full justify-start" onClick={handleLogout}>
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
