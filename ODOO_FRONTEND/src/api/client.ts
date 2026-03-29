import type {
  ListResponse,
  SingleResponse,
  ListParams,
  AuthMe,
  LoginRequest,
  LoginResponse,
  SignupRequest,
  ApprovalQueueItem,
  ApprovalActionRequest,
  Expense,
  CreateExpenseRequest,
  TimelineEvent,
  ApprovalInstance,
  AuditLogEntry,
  ComplianceExport,
  Budget,
  CreateBudgetRequest,
  ReimbursementItem,
  ReimbursementBatch,
  CreateBatchRequest,
  AnalyticsOverview,
  SpendPattern,
  OcrResult,
  ExpenseReceipt,
  UserDetail,
  ManagerAssignment,
  ApprovalPolicy,
  Role,
} from '@/types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('access_token');
}

let accessToken: string | null = readStoredToken();

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem('access_token', token);
  } else {
    window.localStorage.removeItem('access_token');
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, String(val));
      }
    });
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({
      error: { code: 'unknown', message: res.statusText, details: {} },
    }));
    throw errorBody;
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

function buildListParams(params?: ListParams): Record<string, string | number | undefined> {
  if (!params) return {};
  return {
    page: params.page,
    page_size: params.page_size,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
    q: params.q,
    status: params.status,
    date_from: params.date_from,
    date_to: params.date_to,
  };
}

type BackendBudget = {
  id: string;
  name: string;
  scope_type: 'department' | 'category' | 'period' | 'company';
  scope_value: string;
  amount: string;
  currency: string;
  period_start: string;
  period_end: string;
  spent?: string;
  remaining?: string;
};

type BackendReimbursementItem = {
  expense_id: string;
  employee_name: string;
  company_currency?: string | null;
  company_currency_amount: string;
  reimbursement_status: string;
  reimbursement_amount?: string | null;
  reimbursement_currency?: string | null;
  batch_id?: string | null;
  paid_at?: string | null;
};

type BackendAnalyticsOverview = {
  total_expenses: number;
  total_submitted: number;
  total_approved: number;
  total_rejected: number;
  total_pending: number;
  total_on_hold: number;
  total_reimbursed: number;
  total_original_amount: string;
  total_converted_amount: string;
  currency: string;
};

type BackendSpendPatternResponse = {
  by_category: Array<{
    category: string;
    count: number;
    total_amount: string;
    percentage: string;
  }>;
  by_time_period: Array<{
    period: string;
    count: number;
    total_amount: string;
  }>;
  anomalies: Array<{
    type?: string;
    category?: string;
    user_id?: string;
    user_name?: string;
    amount?: string;
    threshold?: string;
    message?: string;
  }>;
};

function normalizeBudget(budget: BackendBudget): Budget {
  return {
    id: budget.id,
    name: budget.name,
    scope_type: budget.scope_type,
    scope_value: budget.scope_value,
    allocated_amount: budget.amount,
    spent_amount: budget.spent ?? '0',
    currency: budget.currency,
    period_start: budget.period_start,
    period_end: budget.period_end,
    threshold_warning: 70,
    threshold_critical: 90,
    created_at: budget.period_start,
  };
}

function normalizeReimbursementItem(item: BackendReimbursementItem): ReimbursementItem {
  const amount = item.reimbursement_amount ?? item.company_currency_amount;
  return {
    id: item.expense_id,
    expense_id: item.expense_id,
    employee_name: item.employee_name,
    amount,
    currency: item.reimbursement_currency ?? item.company_currency ?? 'USD',
    status: item.reimbursement_status as ReimbursementItem['status'],
    batch_id: item.batch_id ?? null,
    paid_at: item.paid_at ?? null,
    created_at: item.paid_at ?? new Date().toISOString(),
  };
}

function normalizeAnalyticsOverview(data: BackendAnalyticsOverview): AnalyticsOverview {
  return {
    total_expenses: data.total_expenses,
    total_amount: data.total_converted_amount,
    currency: data.currency,
    pending_count: data.total_pending + data.total_on_hold + data.total_submitted,
    approved_count: data.total_approved,
    rejected_count: data.total_rejected,
    reimbursed_count: data.total_reimbursed,
    avg_approval_time_hours: null,
    expenses_by_category: [],
    expenses_by_status: [
      { status: 'submitted', count: data.total_submitted, amount: '0' },
      { status: 'pending_approval', count: data.total_pending, amount: '0' },
      { status: 'on_hold', count: data.total_on_hold, amount: '0' },
      { status: 'approved', count: data.total_approved, amount: '0' },
      { status: 'rejected', count: data.total_rejected, amount: '0' },
      { status: 'reimbursed', count: data.total_reimbursed, amount: '0' },
    ],
    monthly_trend: [],
  };
}

function normalizeSpendPatterns(data: BackendSpendPatternResponse): SpendPattern[] {
  const categoryPatterns: SpendPattern[] = data.by_category.map((category, index) => ({
    id: `category-${category.category}-${index}`,
    type: 'trend',
    severity: Number(category.percentage) >= 40 ? 'high' : Number(category.percentage) >= 20 ? 'medium' : 'low',
    title: `${category.category} spend trend`,
    description: `${category.count} expenses make up ${category.percentage}% of tracked spend.`,
    entity_type: 'category',
    entity_id: category.category,
    entity_name: category.category,
    metric_value: category.total_amount,
    threshold_value: category.percentage,
    detected_at: new Date().toISOString(),
  }));

  const anomalyPatterns: SpendPattern[] = data.anomalies.map((anomaly, index) => ({
    id: `anomaly-${index}`,
    type: 'anomaly',
    severity: 'high',
    title: anomaly.type === 'high_individual_spend' ? 'High individual spend' : 'High category spend',
    description: anomaly.message ?? 'Potential spend anomaly detected.',
    entity_type: anomaly.user_id ? 'user' : 'category',
    entity_id: anomaly.user_id ?? anomaly.category ?? `anomaly-${index}`,
    entity_name: anomaly.user_name ?? anomaly.category ?? 'Unknown',
    metric_value: anomaly.amount ?? '0',
    threshold_value: anomaly.threshold ?? null,
    detected_at: new Date().toISOString(),
  }));

  return [...anomalyPatterns, ...categoryPatterns];
}

// ─── Auth ───

export const auth = {
  signup: (data: SignupRequest) =>
    request<SingleResponse<LoginResponse>>('POST', '/auth/signup', data),
  login: (data: LoginRequest) =>
    request<SingleResponse<LoginResponse>>('POST', '/auth/login', data),
  me: () => request<SingleResponse<AuthMe>>('GET', '/auth/me'),
  logout: () => request<void>('POST', '/auth/logout'),
};

// ─── Approval Queue & Actions (FE-3 Primary) ───

export const approvals = {
  getQueue: (params?: ListParams) =>
    request<ListResponse<ApprovalQueueItem>>('GET', '/approvals/queue', undefined, buildListParams(params)),

  approve: (expenseId: string, data: ApprovalActionRequest) =>
    request<SingleResponse<{ success: boolean }>>('POST', `/approvals/${expenseId}/approve`, data),

  reject: (expenseId: string, data: ApprovalActionRequest) =>
    request<SingleResponse<{ success: boolean }>>('POST', `/approvals/${expenseId}/reject`, data),

  hold: (expenseId: string, data: ApprovalActionRequest) =>
    request<SingleResponse<{ success: boolean }>>('POST', `/approvals/${expenseId}/hold`, data),

  resume: (expenseId: string, data: ApprovalActionRequest) =>
    request<SingleResponse<{ success: boolean }>>('POST', `/approvals/${expenseId}/resume`, data),
};

// ─── Expenses ───

export const expenses = {
  list: (params?: ListParams) =>
    request<ListResponse<Expense>>('GET', '/expenses', undefined, buildListParams(params)),

  create: (data: CreateExpenseRequest) =>
    request<SingleResponse<Expense>>('POST', '/expenses', data),

  get: (expenseId: string) =>
    request<SingleResponse<Expense>>('GET', `/expenses/${expenseId}`),

  getTimeline: (expenseId: string) =>
    request<SingleResponse<TimelineEvent[]>>('GET', `/expenses/${expenseId}/timeline`),

  getApprovalInstance: (expenseId: string) =>
    request<SingleResponse<ApprovalInstance>>('GET', `/expenses/${expenseId}/approval-instance`),
};

// ─── Receipts & OCR (FE-2 Primary) ───

export const receipts = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<SingleResponse<ExpenseReceipt>>('POST', '/receipts', formData);
  },

  get: (receiptId: string) =>
    request<SingleResponse<ExpenseReceipt>>('GET', `/receipts/${receiptId}`),

  getOcr: (receiptId: string) =>
    request<SingleResponse<OcrResult>>('GET', `/receipts/${receiptId}/ocr`),

  reprocess: (receiptId: string) =>
    request<SingleResponse<ExpenseReceipt>>('POST', `/receipts/${receiptId}/reprocess`),
};

// ─── Reference Data ───

export const reference = {
  currencies: () =>
    request<SingleResponse<{ code: string; name: string; symbol: string }[]>>('GET', '/reference/currencies'),

  exchangeRates: (baseCurrency: string) =>
    request<SingleResponse<Record<string, string>>>('GET', '/reference/exchange-rates', undefined, { base_currency: baseCurrency }),
};

// ─── Audit & Compliance ───

export const audit = {
  getLogs: (params?: ListParams & { action_type?: string }) =>
    request<ListResponse<AuditLogEntry>>('GET', '/audit-logs', undefined, {
      ...buildListParams(params),
      action_type: params?.action_type,
    }),

  getExports: (params?: ListParams) =>
    request<ListResponse<ComplianceExport>>('GET', '/compliance-exports', undefined, buildListParams(params)),

  createExport: (data: { date_from: string; date_to: string; filters?: Record<string, unknown> }) =>
    request<SingleResponse<ComplianceExport>>('POST', '/compliance-exports', data),
};

// ─── Budgets ───

export const budgets = {
  list: async (params?: ListParams) => {
    const response = await request<ListResponse<BackendBudget>>('GET', '/budgets', undefined, buildListParams(params));
    return {
      ...response,
      items: response.items.map(normalizeBudget),
    };
  },

  create: async (data: CreateBudgetRequest) => {
    const response = await request<SingleResponse<BackendBudget>>('POST', '/budgets', {
      name: data.name,
      scope_type: data.scope_type,
      scope_value: data.scope_value,
      amount: data.allocated_amount,
      currency: data.currency,
      period_start: data.period_start,
      period_end: data.period_end,
    });

    return {
      ...response,
      data: normalizeBudget(response.data),
    };
  },
};

// ─── Reimbursements ───

export const reimbursements = {
  list: async (params?: ListParams) => {
    const response = await request<ListResponse<BackendReimbursementItem>>('GET', '/reimbursements', undefined, buildListParams(params));
    return {
      ...response,
      items: response.items.map(normalizeReimbursementItem),
    };
  },

  createBatch: (data: CreateBatchRequest) =>
    request<SingleResponse<ReimbursementBatch>>('POST', '/reimbursements/batches', data),
};

// ─── Analytics ───

export const analytics = {
  overview: async (params?: { date_from?: string; date_to?: string }) => {
    const response = await request<SingleResponse<BackendAnalyticsOverview>>('GET', '/analytics/overview', undefined, params);
    return {
      ...response,
      data: normalizeAnalyticsOverview(response.data),
    };
  },

  spendPatterns: async (params?: ListParams) => {
    const response = await request<SingleResponse<BackendSpendPatternResponse>>('GET', '/analytics/spend-patterns', undefined, buildListParams(params));
    const items = normalizeSpendPatterns(response.data);
    return {
      items,
      pagination: {
        page: 1,
        page_size: items.length || 1,
        total_items: items.length,
        total_pages: 1,
      },
    };
  },
};

// ─── Users ───

export const users = {
  list: (params?: ListParams) =>
    request<ListResponse<UserDetail>>('GET', '/users', undefined, buildListParams(params)),

  create: (data: { name: string; email: string; role: Role; password: string }) =>
    request<SingleResponse<UserDetail>>('POST', '/users', data),

  update: (userId: string, data: { name?: string; role?: Role; password?: string; is_active?: boolean }) =>
    request<SingleResponse<UserDetail>>('PATCH', `/users/${userId}`, data),

  delete: (userId: string) =>
    request<void>('DELETE', `/users/${userId}`),
};

// ─── Manager Assignments ───

export const managerAssignments = {
  list: (params?: ListParams) =>
    request<ListResponse<ManagerAssignment>>('GET', '/manager-assignments', undefined, buildListParams(params)),

  create: (data: { employee_id: string; manager_id: string }) =>
    request<SingleResponse<ManagerAssignment>>('POST', '/manager-assignments', data),

  update: (assignmentId: string, data: { manager_id?: string; is_active?: boolean }) =>
    request<SingleResponse<ManagerAssignment>>('PATCH', `/manager-assignments/${assignmentId}`, data),
};

// ─── Approval Policies ───

export const approvalPolicies = {
  list: (params?: ListParams) =>
    request<ListResponse<ApprovalPolicy>>('GET', '/approval-policies', undefined, buildListParams(params)),

  create: (data: Record<string, unknown>) =>
    request<SingleResponse<ApprovalPolicy>>('POST', '/approval-policies', data),

  update: (policyId: string, data: Record<string, unknown>) =>
    request<SingleResponse<ApprovalPolicy>>('PATCH', `/approval-policies/${policyId}`, data),

  delete: (policyId: string) =>
    request<void>('DELETE', `/approval-policies/${policyId}`),
};

// ─── Countries ───

export const countries = {
  list: () =>
    request<{ name: { common: string }; currencies: Record<string, { name: string; symbol: string }> }[]>(
      'GET', '/reference/countries'
    ),
};

// ─── Health ───

export const health = {
  check: () => request<{ status: string }>('GET', '/health'),
};
