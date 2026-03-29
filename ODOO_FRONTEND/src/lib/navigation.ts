import {
  BarChart3,
  ClipboardCheck,
  FileDown,
  FileText,
  GitBranch,
  LayoutDashboard,
  Receipt,
  ScrollText,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { Role } from '@/types/api';

export interface AppNavItem {
  to: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
  section: string;
}

export interface NavigationCrumb {
  label: string;
  to?: string;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    to: '/app',
    label: 'Command Center',
    description: 'Role-specific operational overview',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'employee'],
    section: 'Overview',
  },
  {
    to: '/app/expenses',
    label: 'Expenses',
    description: 'Submission history and live workflow state',
    icon: Receipt,
    roles: ['admin', 'manager', 'employee'],
    section: 'Workflow',
  },
  {
    to: '/app/approvals',
    label: 'Approvals',
    description: 'Actionable approval queue and reviews',
    icon: ClipboardCheck,
    roles: ['admin', 'manager'],
    section: 'Workflow',
  },
  {
    to: '/app/admin/users',
    label: 'Users',
    description: 'Users, roles, and account states',
    icon: Users,
    roles: ['admin'],
    section: 'Administration',
  },
  {
    to: '/app/admin/managers',
    label: 'Manager Lines',
    description: 'Reporting structure and ownership',
    icon: GitBranch,
    roles: ['admin'],
    section: 'Administration',
  },
  {
    to: '/app/admin/policies',
    label: 'Policies',
    description: 'Approval sequences and rule logic',
    icon: ShieldCheck,
    roles: ['admin'],
    section: 'Administration',
  },
  {
    to: '/app/admin/expenses',
    label: 'Oversight',
    description: 'Company-wide expense operations',
    icon: FileText,
    roles: ['admin'],
    section: 'Operations',
  },
  {
    to: '/app/admin/budgets',
    label: 'Budgets',
    description: 'Threshold pressure and allocation posture',
    icon: Wallet,
    roles: ['admin'],
    section: 'Operations',
  },
  {
    to: '/app/admin/reimbursements',
    label: 'Reimbursements',
    description: 'Batching and payout control',
    icon: Receipt,
    roles: ['admin'],
    section: 'Operations',
  },
  {
    to: '/app/admin/analytics',
    label: 'Analytics',
    description: 'Spend intelligence and trends',
    icon: BarChart3,
    roles: ['admin'],
    section: 'Reporting',
  },
  {
    to: '/app/admin/audit',
    label: 'Audit Log',
    description: 'Immutable action history',
    icon: ScrollText,
    roles: ['admin'],
    section: 'Reporting',
  },
  {
    to: '/app/admin/compliance',
    label: 'Compliance',
    description: 'Exports and evidence packages',
    icon: FileDown,
    roles: ['admin'],
    section: 'Reporting',
  },
];

export function getDefaultAppRoute(role: Role) {
  if (role === 'admin') return '/app/admin/users';
  if (role === 'manager') return '/app/approvals';
  return '/app/expenses';
}

export function getNavSections(role: Role) {
  const items = APP_NAV_ITEMS.filter((item) => item.roles.includes(role));
  const sections = new Map<string, AppNavItem[]>();

  items.forEach((item) => {
    const existing = sections.get(item.section) ?? [];
    existing.push(item);
    sections.set(item.section, existing);
  });

  return Array.from(sections.entries()).map(([label, navItems]) => ({ label, items: navItems }));
}

function findNavItemForPath(pathname: string, role: Role) {
  const items = APP_NAV_ITEMS.filter((item) => item.roles.includes(role));

  return items.find((item) => {
    if (item.to === '/app') {
      return pathname === '/app' || pathname === '/app/overview';
    }

    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  });
}

export function getPathBreadcrumbs(pathname: string, role: Role): NavigationCrumb[] {
  const crumbs: NavigationCrumb[] = [
    {
      label: 'Workspace',
      to: getDefaultAppRoute(role),
    },
  ];

  const navItem = findNavItemForPath(pathname, role);
  if (!navItem) return crumbs;

  if (navItem.section !== 'Overview') {
    crumbs.push({ label: navItem.section });
  }

  crumbs.push({
    label: navItem.label,
    to: navItem.to,
  });

  if (pathname === '/app/overview') {
    crumbs[crumbs.length - 1] = { label: 'Command Center', to: '/app/overview' };
  }

  if (pathname === '/app/expenses/new') {
    crumbs.push({ label: 'New expense' });
  } else if (/^\/app\/expenses\/[^/]+$/.test(pathname)) {
    crumbs.push({ label: 'Expense detail' });
  } else if (/^\/app\/approvals\/[^/]+$/.test(pathname)) {
    crumbs.push({ label: 'Review' });
  }

  return crumbs;
}
