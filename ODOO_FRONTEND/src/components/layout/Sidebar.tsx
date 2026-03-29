import { NavLink, useLocation } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLayout } from '@/hooks/useLayout';
import { getDefaultAppRoute, getNavSections } from '@/lib/navigation';

export function Sidebar() {
  const { user } = useAuth();
  const { sidebarCollapsed, toggleSidebar, isMobile, mobileNavOpen, setMobileNavOpen } = useLayout();
  const location = useLocation();
  const role = user?.user.role ?? 'employee';
  const sections = getNavSections(role);
  const defaultRoute = getDefaultAppRoute(role);

  return (
    <>
      {isMobile && mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[rgba(21,28,28,0.35)] backdrop-blur-[2px]"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/8 bg-[#0F172A] text-white shadow-[24px_0_48px_rgba(15,23,42,0.22)] transition-all duration-300',
          isMobile
            ? mobileNavOpen
              ? 'translate-x-0 w-[20rem]'
              : '-translate-x-full w-[20rem]'
            : sidebarCollapsed
              ? 'w-24'
              : 'w-[19rem]',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-5">
          <NavLink to={defaultRoute} className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-blue-600 text-white shadow-[0_16px_36px_rgba(37,99,235,0.28)]">
              <Sparkles size={18} />
            </div>
            {(!sidebarCollapsed || isMobile) && (
              <div className="min-w-0">
                <div className="text-lg font-semibold tracking-[-0.03em] text-white">Oodo</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Expense operations</div>
              </div>
            )}
          </NavLink>

          {isMobile && (
            <button type="button" className="btn-ghost !p-2" onClick={() => setMobileNavOpen(false)}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="border-b border-white/8 px-5 py-4">
          {(!sidebarCollapsed || isMobile) && (
            <>
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Workspace</div>
              <div className="mt-2 font-medium text-white">{user?.company.name ?? 'Company'}</div>
              <div className="mt-1 text-sm text-slate-400">
                {user?.company.default_currency ?? 'USD'} operating currency
              </div>
            </>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {sections.map((section) => (
            <div key={section.label}>
              {(!sidebarCollapsed || isMobile) && <div className="mb-3 px-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">{section.label}</div>}
              <div className="space-y-1.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.to === '/app'
                    ? location.pathname === '/app'
                    : location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={sidebarCollapsed && !isMobile ? item.label : undefined}
                      onClick={() => {
                        if (isMobile) setMobileNavOpen(false);
                      }}
                      className="group flex items-center gap-3 rounded-[1rem] px-3 py-3 transition-all duration-200 hover:bg-white/5"
                      style={{
                        background: active ? 'rgba(37,99,235,0.2)' : 'transparent',
                        color: active ? '#60a5fa' : '#cbd5e1',
                        border: `1px solid ${active ? 'rgba(96, 165, 250, 0.22)' : 'transparent'}`,
                      }}
                    >
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] text-current"
                        style={{ background: active ? 'rgba(37,99,235,0.24)' : 'rgba(255,255,255,0.06)' }}
                      >
                        <Icon size={17} />
                      </span>
                      {(!sidebarCollapsed || isMobile) && (
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{item.label}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {!isMobile && (
          <div className="border-t border-white/8 p-4">
            <button type="button" className="btn-secondary w-full justify-center" onClick={toggleSidebar}>
              {sidebarCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
