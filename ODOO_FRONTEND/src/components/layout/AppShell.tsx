import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useLayout } from '@/hooks/useLayout';

export function AppShell() {
  const { sidebarCollapsed, isMobile } = useLayout();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <Sidebar />
      <div
        className="min-h-screen transition-all duration-300"
        style={{
          marginLeft: isMobile ? 0 : sidebarCollapsed ? 96 : 304,
        }}
      >
        <TopBar />
        <main className="mx-auto flex w-full max-w-[1600px] flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
