// ─── Canonical Enums (Section 26) ───

export type Role = 'admin' | 'manager' | 'employee';

export type ExpenseStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'on_hold'
  | 'approved'
  | 'rejected'
  | 'reimbursed';

export type ApprovalActionType = 'approve' | 'reject' | 'hold' | 'resume';

export type ReimbursementStatus = 'not_ready' | 'ready' | 'batched' | 'paid';

export type RuleType = 'sequential' | 'percentage' | 'specific_approver' | 'combined';

export type SortOrder = 'asc' | 'desc';

// ─── Standard API Envelope (Section 26.7) ───

export interface Pagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ListResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface SingleResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

// ─── Filter & Pagination Params (Section 26.8) ───

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface SortParams {
  sort_by?: string;
  sort_order?: SortOrder;
}

export interface FilterParams {
  q?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}

export type ListParams = PaginationParams & SortParams & FilterParams;

// ─── Auth & Session (Section 27.1) ───

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Company {
  id: string;
  name: string;
  country_code: string;
  default_currency: string;
}

export interface AuthMe {
  user: User;
  company: Company;
  permissions: string[];
}

export interface SignupRequest {
  company_name: string;
  country_code: string;
  admin_name: string;
  admin_email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// ─── User Management (Section 27.2) ───

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  manager_id: string | null;
  manager_name: string | null;
}

export interface ManagerAssignment {
  id: string;
  employee_id: string;
  employee_name: string;
  manager_id: string;
  manager_name: string;
  is_active: boolean;
}

// ─── Approval Policy (Section 27.3) ───

export interface ApprovalStep {
  id: string;
  sequence: number;
  approver_type: string;
  approver_user_id: string | null;
  approver_role_label: string;
}

export interface ApprovalRule {
  id: string;
  type: RuleType;
  operator: 'AND' | 'OR' | null;
  percentage_threshold: string | null;
  specific_approver_user_id: string | null;
}

export interface ApprovalPolicy {
  id: string;
  name: string;
  description: string | null;
  is_manager_approver: boolean;
  steps: ApprovalStep[];
  rules: ApprovalRule[];
}

// ─── Expense (Section 27.5) ───

export interface ExpenseLineItem {
  source_line_id: string;
  name: string;
  amount: string;
  category: string;
  included: boolean;
  quantity?: string;
}

export interface ExpenseReceipt {
  id: string;
  file_name: string;
  ocr_status: string;
}

export interface ApprovalSummary {
  current_step_sequence: number;
  current_pending_approver_ids: string[];
  policy_id: string;
}

export interface ExpenseReimbursement {
  status: ReimbursementStatus;
  amount: string | null;
  currency: string | null;
  paid_at: string | null;
}

export interface Expense {
  id: string;
  employee_id: string;
  employee_name: string;
  status: ExpenseStatus;
  category: string;
  description: string;
  expense_date: string;
  original_currency: string;
  original_amount: string;
  company_currency: string;
  converted_amount: string;
  conversion_rate: string;
  conversion_rate_source: string;
  conversion_rate_timestamp: string;
  submitted_total_before_exclusions: string;
  final_included_total: string;
  receipt: ExpenseReceipt | null;
  line_items: ExpenseLineItem[];
  approval_summary: ApprovalSummary | null;
  reimbursement: ExpenseReimbursement | null;
}

export interface CreateExpenseRequest {
  category: string;
  description: string;
  expense_date: string;
  original_currency: string;
  original_amount: string;
  receipt_id?: string;
  line_items?: {
    source_line_id: string;
    name: string;
    amount: string;
    category: string;
    included: boolean;
  }[];
}

// ─── Timeline ───

export interface TimelineEvent {
  id: string;
  action: string;
  actor_name: string;
  actor_role: Role;
  comment: string | null;
  timestamp: string;
  step_sequence: number | null;
  details: Record<string, unknown> | null;
}

// ─── Approval Queue (Section 27.7) ───

export interface TriggerEvaluation {
  state: 'pending' | 'passed' | 'failed';
  passed_conditions: string[];
  failed_conditions: string[];
}

export interface ApprovalQueueItem {
  id: string;
  expense_id: string;
  employee_name: string;
  category: string;
  status: ExpenseStatus;
  company_currency: string;
  company_currency_amount: string;
  original_amount: string;
  original_currency: string;
  submitted_at: string;
  current_step_sequence: number;
  trigger_evaluation: TriggerEvaluation;
}

export interface ApprovalActionRequest {
  comment: string;
  reason_code: string | null;
}

// ─── Approval Instance ───

export interface ApprovalInstanceStep {
  sequence: number;
  approver_user_id: string;
  approver_name: string;
  approver_role: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  acted_at: string | null;
  comment: string | null;
}

export interface ApprovalInstance {
  expense_id: string;
  policy_id: string;
  policy_name: string;
  steps: ApprovalInstanceStep[];
  rules: ApprovalRule[];
  trigger_evaluation: TriggerEvaluation;
}

// ─── Audit Log (Section 27.8) ───

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: Role;
  action_type: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  details_before: Record<string, unknown> | null;
  details_after: Record<string, unknown> | null;
  compliance_note: string | null;
}

// ─── Compliance Export ───

export interface ComplianceExport {
  id: string;
  requested_by_name: string;
  date_from: string;
  date_to: string;
  filters: Record<string, unknown>;
  status: 'pending' | 'completed' | 'failed';
  file_url: string | null;
  created_at: string;
}

// ─── Budget ───

export interface Budget {
  id: string;
  name: string;
  scope_type: 'department' | 'category' | 'period' | 'company';
  scope_value: string;
  allocated_amount: string;
  spent_amount: string;
  currency: string;
  period_start: string;
  period_end: string;
  threshold_warning: number;
  threshold_critical: number;
  created_at: string;
}

export interface CreateBudgetRequest {
  name: string;
  scope_type: string;
  scope_value: string;
  allocated_amount: string;
  currency: string;
  period_start: string;
  period_end: string;
  threshold_warning: number;
  threshold_critical: number;
}

// ─── Reimbursement ───

export interface ReimbursementItem {
  id: string;
  expense_id: string;
  employee_name: string;
  amount: string;
  currency: string;
  status: ReimbursementStatus;
  batch_id: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface CreateBatchRequest {
  expense_ids: string[];
}

export interface ReimbursementBatch {
  id: string;
  expense_count: number;
  total_amount: string;
  currency: string;
  status: ReimbursementStatus;
  created_at: string;
}

// ─── Analytics (Section 27.8) ───

export interface AnalyticsOverview {
  total_expenses: number;
  total_amount: string;
  currency: string;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  reimbursed_count: number;
  avg_approval_time_hours: number | null;
  expenses_by_category: { category: string; count: number; amount: string }[];
  expenses_by_status: { status: ExpenseStatus; count: number; amount: string }[];
  monthly_trend: { month: string; count: number; amount: string }[];
}

export interface SpendPattern {
  id: string;
  type: 'anomaly' | 'trend' | 'threshold_breach';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  metric_value: string;
  threshold_value: string | null;
  detected_at: string;
}

// ─── OCR (Section 27.6) ───

export interface OcrStructuredFields {
  merchant_name: string;
  expense_date: string;
  currency: string;
  total_amount: string;
  description_hint: string;
}

export interface OcrLineItem {
  id: string;
  name: string;
  amount: string;
  quantity: string;
  category: string;
  included: boolean;
}

export interface OcrResult {
  receipt_id: string;
  status: 'processing' | 'completed' | 'failed';
  confidence: string;
  raw_text: string;
  structured_fields: OcrStructuredFields;
  line_items: OcrLineItem[];
  warnings: string[];
}

// ─── Health & Capabilities ───

export interface Capabilities {
  ocr_available: boolean;
  ollama_available: boolean;
  export_available: boolean;
}
