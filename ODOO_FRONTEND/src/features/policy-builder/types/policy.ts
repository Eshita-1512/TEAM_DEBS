export const POLICY_SCHEMA_VERSION = 1;

export type PolicyApproverKind =
  | 'manager_approver'
  | 'fixed_approver'
  | 'role_approver';

export type PolicyRuleKind =
  | 'percentage_rule'
  | 'specific_approver_rule'
  | 'hybrid_or_rule';

export interface PolicyMetadata {
  version: number;
  lastEditedAt?: string;
}

export interface StartBlock {
  id: string;
  type: 'start';
  label: string;
}

export interface PolicyNotesBlock {
  id: string;
  type: 'policy_notes';
  notes: string;
}

export interface ApproveOutcomeBlock {
  id: string;
  type: 'approve_outcome';
  outcome: 'approve';
}

export interface ManagerApproverBlock {
  id: string;
  type: 'manager_approver';
  label: string;
  required: boolean;
  helpText?: string;
}

export interface FixedApproverBlock {
  id: string;
  type: 'fixed_approver';
  userId: string;
  label: string;
  required: boolean;
}

export interface RoleApproverBlock {
  id: string;
  type: 'role_approver';
  role: string;
  label: string;
  required: boolean;
}

export type ApproverBlock =
  | ManagerApproverBlock
  | FixedApproverBlock
  | RoleApproverBlock;

export interface SequentialStageBlock {
  id: string;
  type: 'sequential_stage';
  order: number;
  name: string;
  approver: ApproverBlock;
}

export interface PercentageRuleBlock {
  id: string;
  type: 'percentage_rule';
  outcome: 'approve';
  threshold: number;
  scope: 'all_configured_approvers';
}

export interface SpecificApproverRuleBlock {
  id: string;
  type: 'specific_approver_rule';
  outcome: 'approve';
  userId: string;
  label: string;
}

export type HybridCondition =
  | PercentageRuleBlock
  | SpecificApproverRuleBlock;

export interface HybridOrRuleBlock {
  id: string;
  type: 'hybrid_or_rule';
  outcome: 'approve';
  operator: 'OR' | 'AND';
  conditions: HybridCondition[];
}

export type PolicyRuleBlock =
  | PercentageRuleBlock
  | SpecificApproverRuleBlock
  | HybridOrRuleBlock;

export interface PolicyDefinition {
  id: string;
  name: string;
  description: string;
  start: StartBlock;
  sequence: SequentialStageBlock[];
  rules: PolicyRuleBlock[];
  notes: PolicyNotesBlock;
  outcome: ApproveOutcomeBlock;
  metadata: PolicyMetadata;
}

export type BlockSelection =
  | { kind: 'policy' }
  | { kind: 'stage'; id: string }
  | { kind: 'rule'; id: string }
  | { kind: 'notes' };

export interface PolicyValidationIssue {
  id: string;
  level: 'error' | 'warning';
  message: string;
  path: string;
}

export interface PolicyValidationResult {
  valid: boolean;
  errors: PolicyValidationIssue[];
  warnings: PolicyValidationIssue[];
}

export interface PolicySimulationInput {
  employeeName: string;
  employeeId?: string;
  managerId: string;
  managerName: string;
  expenseAmount: number;
  category: string;
  department: string;
}

export interface PolicySimulationResolvedStep {
  id: string;
  label: string;
  approverType: PolicyApproverKind;
  resolvedTo: string;
}

export interface PolicySimulationResult {
  resolvedPath: PolicySimulationResolvedStep[];
  conditionalRules: string[];
  cfoApprovalWouldAutoApprove: boolean;
  percentageThresholdWouldAutoApprove: boolean;
  narrative: string;
}
