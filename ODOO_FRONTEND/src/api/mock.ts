/**
 * Mock auth data for frontend-only development.
 * Remove this file once the backend is connected.
 */
import type { AuthMe } from '@/types/api';

export const MOCK_USERS: Record<string, { password: string; data: AuthMe }> = {
  'admin@test.com': {
    password: 'admin123',
    data: {
      user: {
        id: 'mock-admin-001',
        name: 'Admin User',
        email: 'admin@test.com',
        role: 'admin',
      },
      company: {
        id: 'mock-company-001',
        name: 'Test Company',
        default_currency: 'INR',
        country_code: 'IN',
      },
      permissions: [
        'expenses:read', 'expenses:write',
        'approvals:read', 'approvals:write',
        'admin:read', 'admin:write',
        'analytics:read',
      ],
    },
  },
  'manager@test.com': {
    password: 'manager123',
    data: {
      user: {
        id: 'mock-manager-001',
        name: 'Manager User',
        email: 'manager@test.com',
        role: 'manager',
      },
      company: {
        id: 'mock-company-001',
        name: 'Test Company',
        default_currency: 'INR',
        country_code: 'IN',
      },
      permissions: [
        'expenses:read', 'expenses:write',
        'approvals:read', 'approvals:write',
      ],
    },
  },
  'employee@test.com': {
    password: 'employee123',
    data: {
      user: {
        id: 'mock-employee-001',
        name: 'Employee User',
        email: 'employee@test.com',
        role: 'employee',
      },
      company: {
        id: 'mock-company-001',
        name: 'Test Company',
        default_currency: 'INR',
        country_code: 'IN',
      },
      permissions: ['expenses:read', 'expenses:write'],
    },
  },
};

const MOCK_TOKEN_PREFIX = 'mock-token-';

export function isMockToken(token: string | null): boolean {
  return !!token?.startsWith(MOCK_TOKEN_PREFIX);
}

export function tryMockLogin(email: string, password: string): { token: string; user: AuthMe } | null {
  const entry = MOCK_USERS[email];
  if (entry && entry.password === password) {
    return {
      token: `${MOCK_TOKEN_PREFIX}${email}`,
      user: entry.data,
    };
  }
  return null;
}

export function getMockUser(token: string): AuthMe | null {
  if (!isMockToken(token)) return null;
  const email = token.replace(MOCK_TOKEN_PREFIX, '');
  return MOCK_USERS[email]?.data ?? null;
}
