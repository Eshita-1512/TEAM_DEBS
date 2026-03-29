import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { LayoutProvider } from '@/hooks/useLayout';
import { AppShell } from '@/components/layout/AppShell';
import { CursorField } from '@/components/layout/CursorField';
import { getDefaultAppRoute } from '@/lib/navigation';
import type { Role } from '@/types/api';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import('@/pages/auth/SignupPage').then((module) => ({ default: module.SignupPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const ExpenseHistoryPage = lazy(() => import('@/pages/expenses/ExpenseHistoryPage').then((module) => ({ default: module.ExpenseHistoryPage })));
const ExpenseDetailPage = lazy(() => import('@/pages/expenses/ExpenseDetailPage').then((module) => ({ default: module.ExpenseDetailPage })));
const NewExpensePage = lazy(() => import('@/pages/expenses/NewExpensePage').then((module) => ({ default: module.NewExpensePage })));
const ApprovalQueuePage = lazy(() => import('@/pages/approvals/ApprovalQueuePage').then((module) => ({ default: module.ApprovalQueuePage })));
const ExpenseReviewPage = lazy(() => import('@/pages/approvals/ExpenseReviewPage').then((module) => ({ default: module.ExpenseReviewPage })));
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage').then((module) => ({ default: module.UserManagementPage })));
const ManagerAssignmentsPage = lazy(() => import('@/pages/admin/ManagerAssignmentsPage').then((module) => ({ default: module.ManagerAssignmentsPage })));
const ApprovalPoliciesPage = lazy(() => import('@/pages/admin/ApprovalPoliciesPage').then((module) => ({ default: module.ApprovalPoliciesPage })));
const BudgetsPage = lazy(() => import('@/pages/admin/BudgetsPage').then((module) => ({ default: module.BudgetsPage })));
const ReimbursementsPage = lazy(() => import('@/pages/admin/ReimbursementsPage').then((module) => ({ default: module.ReimbursementsPage })));
const AuditLogPage = lazy(() => import('@/pages/admin/AuditLogPage').then((module) => ({ default: module.AuditLogPage })));
const ComplianceExportPage = lazy(() => import('@/pages/admin/ComplianceExportPage').then((module) => ({ default: module.ComplianceExportPage })));
const AnalyticsPage = lazy(() => import('@/pages/admin/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const ExpenseOversightPage = lazy(() => import('@/pages/admin/ExpenseOversightPage').then((module) => ({ default: module.ExpenseOversightPage })));

function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="surface-panel flex items-center gap-3 px-5 py-4 text-sm text-[var(--text-secondary)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          Loading session
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireRole({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.user.role as Role)) {
    return <Navigate to={getDefaultAppRoute(user.user.role)} replace />;
  }
  return <Outlet />;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to={getDefaultAppRoute(user.user.role)} replace />;
  return <>{children}</>;
}

function RoleLanding() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getDefaultAppRoute(user.user.role)} replace />;
}

function AppLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="surface-panel flex items-center gap-3 px-5 py-4 text-sm text-[var(--text-secondary)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        Loading operational surface
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LayoutProvider>
          <CursorField />
          <Suspense fallback={<AppLoading />}>
            <Routes>
              <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
              <Route path="/signup" element={<GuestOnly><SignupPage /></GuestOnly>} />

              <Route element={<RequireAuth />}>
                <Route path="/app" element={<AppShell />}>
                  <Route index element={<RoleLanding />} />
                  <Route path="overview" element={<DashboardPage />} />

                  <Route path="expenses" element={<ExpenseHistoryPage />} />
                  <Route path="expenses/new" element={<NewExpensePage />} />
                  <Route path="expenses/:expenseId" element={<ExpenseDetailPage />} />

                  <Route element={<RequireRole roles={['admin', 'manager']} />}>
                    <Route path="approvals" element={<ApprovalQueuePage />} />
                    <Route path="approvals/:expenseId" element={<ExpenseReviewPage />} />
                  </Route>

                  <Route element={<RequireRole roles={['admin']} />}>
                    <Route path="admin/users" element={<UserManagementPage />} />
                    <Route path="admin/managers" element={<ManagerAssignmentsPage />} />
                    <Route path="admin/policies" element={<ApprovalPoliciesPage />} />
                    <Route path="admin/expenses" element={<ExpenseOversightPage />} />
                    <Route path="admin/budgets" element={<BudgetsPage />} />
                    <Route path="admin/reimbursements" element={<ReimbursementsPage />} />
                    <Route path="admin/analytics" element={<AnalyticsPage />} />
                    <Route path="admin/audit" element={<AuditLogPage />} />
                    <Route path="admin/compliance" element={<ComplianceExportPage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </Suspense>
        </LayoutProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
