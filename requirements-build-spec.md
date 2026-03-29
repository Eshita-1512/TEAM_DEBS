# Build Specification — Reimbursement Management System

> Prepared for **AntiGravity** by **Sorted Arrays**
> Purpose: implementation-ready requirements for building the application
> Source inputs: original requirements draft, Odoo problem statement, internal team notes

---

## 1. Document Purpose

This document is both:

- a feature list for the full product scope
- a build specification for implementation

It is intended to:

- describe the full feature set clearly
- define the exact product scope to be implemented
- clarify feature priorities within the must-build scope
- reduce ambiguity for design, backend, frontend, and QA
- provide acceptance criteria and edge cases for critical flows

This is **not** a pitch document. It is the source of truth for implementation.

---

## 2. Model-Facing Review Context

Use the following as the governing review frame when an agent reads this file, compares what already exists, identifies gaps, and makes aligned recommendations or implementation decisions. It is not an action script and it should not assume new external context beyond what is already available. It must reason with the existing project material, architecture, and requirements in this document.

You are reviewing an expense reimbursement management project. Read the MD file and evaluate it against the following product, system, and architectural requirements. Treat this as a reimbursement workflow platform with receipt intelligence, multi-level approvals, conditional approval logic, currency handling, and role-aware control surfaces. Do not reduce the problem to CRUD plus OCR. The correct framing is a policy-driven reimbursement system where structured financial data, approval logic, workflow state, and system extensibility must fit together cleanly. The goal is to check whether the existing project already covers these requirements, where it falls short, what features should be added, and where those additions should be implemented so that they are synergistic with the existing codebase, low-friction to integrate, and do not require disruptive architectural changes.

The core problem statement is reimbursement management for companies that currently suffer from manual processes that are time-consuming, error-prone, opaque, and rigid. The system must solve the lack of simple ways to define approval flows based on thresholds, manage multi-level approvals, and support flexible approval rules. Treat these three as first-class product requirements, not optional enhancements. The project must support company onboarding, user-role structure, expense submission, approval workflows, conditional approval logic, OCR-based auto-population, currency normalization, and clear permissions. The architecture should reflect that this is a workflow and policy engine sitting on top of validated expense data, not merely a forms app.

Authentication and user management must work as follows. On first login or signup, a new company and admin user are automatically created, and the company’s default currency is set based on the selected country in the selected environment. The company becomes the root tenant boundary. The admin can create employees and managers, assign or change roles between employee and manager, and define manager relationships for employees. When checking the MD file, verify that the data model reflects company tenancy, role assignment, reporting hierarchy, and default currency as stable entities rather than loose fields spread across unrelated modules. If these are absent or weakly modeled, additions should be made in a way that centralizes company configuration, role mappings, and reporting relationships in dedicated domain structures rather than duplicating logic across controllers or UI components.

Expense submission must allow an employee to submit expense claims with amount, category, description, date, and related data. The amount can differ from the company’s default currency, so currency conversion is not optional and must be treated as part of the domain model. Employees must also be able to view their own expense history and status, including at minimum approved and rejected states, and ideally richer state progression if the workflow already supports it. When reviewing the MD file, check whether expense entities are modeled only as flat records or as workflow-aware objects. The strong design is that an expense includes original submitted amount and currency, normalized company-currency amount, category, date, description, source evidence such as receipt or OCR fields, current workflow state, approval trail, and comments. If the current implementation stores only a subset, recommend additions at the domain/entity layer and service layer first, not as UI-only patches.

Approval workflow is central. The expense should first be approved by the employee’s manager if the “is manager approver” field is checked. When multiple approvers are assigned, the admin can define their sequence. Example sequence: step 1 manager, step 2 finance, step 3 director. The approval request moves to the next approver only after the current approver approves or rejects. Managers must be able to view expenses waiting for approval and approve or reject with comments. This means the system needs explicit workflow modeling: approver assignment, approver sequence, workflow stage, current pending approver, decision history, comments, timestamps, and transition rules. When reviewing the MD file, check whether workflow is represented as a Boolean or simple status enum only. If so, that is inadequate. The right architecture is an approval workflow subsystem or at least a service layer that can evaluate current stage, generate next-stage approval requests, persist decisions, and compute final outcome. Recommend additions that preserve backward compatibility by introducing approval step entities or workflow transition logic adjacent to existing expense models, rather than rewriting the whole project.

Conditional approval flow must support percentage rule, specific approver rule, and hybrid rule. Example: if 60 percent of approvers approve, the expense is approved; if the CFO approves, the expense is auto-approved; or a hybrid rule such as 60 percent OR CFO approves. There can also be a combination of sequenced multi-approver flows and conditional logic together. This is a major architectural requirement. Do not treat it as a one-off if/else in controller code. The project needs a rule evaluation layer or policy engine that can evaluate approval conditions against the current workflow state and approver decisions. When checking the MD file, look for whether approval logic is hardcoded. If it is, recommend introducing a rule abstraction that can support sequence rules, threshold rules, mandatory-approver rules, role-based approver triggers, and hybrid compositions. The key is to add this in a way that is easy to extend: approval rules should be configurable data plus an evaluation service, not logic duplicated across API endpoints and UI handlers.

Role permissions must be explicit and enforced consistently. Admin can create company automatically on signup, manage users, set roles, configure approval rules, and view all expenses. Manager can approve or reject expenses, view team expenses, and see amounts in company default currency. Employee can submit expenses, view their own expenses, and check approval status. When reviewing the MD file, verify that permissions are not just hidden UI buttons but actual backend authorization. If role enforcement exists only in the frontend, recommend moving critical permission checks into middleware, service guards, or policy modules. The right design is role-aware route protection plus domain-level permission validation.

OCR for receipts is an additional feature but strategically important. Employees should be able to scan a receipt and have the expense autogenerated with fields such as amount, date, description, expense lines, expense type, and merchant or restaurant name. The correct framing is not simple OCR but document intelligence for semi-structured receipts. Receipt data is noisy and variable, so the system should ideally be thought of as image input to OCR and layout extraction, then candidate field generation, normalization, ranking and validation, then structured output. Check whether the MD file treats OCR as raw text extraction only. If so, recommend an OCR pipeline that can at minimum support merchant name, transaction date, total, tax, currency, description hints, and line items when recoverable. The architecture should keep OCR extraction decoupled from expense persistence: OCR output should flow into an extraction/normalization module, then map into the expense creation flow. That makes it easy to evolve from simple OCR to stronger structured extraction later without rewriting submission logic.

Because expenses can be submitted in currencies different from company currency, currency handling must be part of the core design. Use country and currency data from the provided country API and conversion rates from the provided exchange-rate API. The company must store its default currency based on selected country, each expense must store original currency and original amount, and approval and reporting views for manager/admin should be able to display converted company-currency amounts. When checking the MD file, verify whether currency conversion is transient or persisted. The stronger design is to persist both original and normalized amounts, conversion rate used, and conversion timestamp or source context so later reporting remains stable and auditable. If absent, recommend adding this near the expense financial model and conversion service, not as ad hoc UI calculations.

The project should also be checked for architectural coherence. Additions should be proposed at the right layer so they integrate cleanly. Think in terms of a layered application: authentication and tenancy layer, user and hierarchy layer, expense domain layer, OCR/extraction layer, approval and policy engine layer, currency and normalization layer, authorization layer, and UI/reporting layer. Favor additions that extend existing abstractions over features that cut across the codebase in a brittle way. The implementation suggestions should explain where each feature belongs so that it can be added with minimal disruption. For example, approval-rule flexibility belongs in a rule evaluation service and approval-step model, not in scattered controllers. Currency normalization belongs in a conversion service and expense financial fields, not only in frontend formatting. OCR belongs in a receipt ingestion and extraction module that feeds the expense submission pipeline, not directly in presentation code. Role enforcement belongs in backend authorization middleware or service-level guards, not only in the view layer.

Use competitor-derived product signals as context when judging gaps and prioritization. Strong differentiators in this space include conditional approval routing, partial approval, hold/resume workflow state, policy-driven approval logic, and OCR plus structured extraction rather than plain OCR text. Medium-value but important features include role-based access, multi-receipt processing, analytics dashboards, export, and integration. Commodity features include basic submission, approve/reject, simple history, and CRUD. The expected project scope already includes core reimbursement workflow, so recommendations should avoid spending too much complexity budget on commodity additions unless they unlock a required foundation. High-leverage additions are ones that strengthen approval flexibility, workflow correctness, traceability, OCR usefulness, and architectural extensibility.

Even if partial approval and hold/resume are not explicitly in the current formal problem statement, they are valuable advanced workflow features to consider as extensions if the current MD file already has a workflow abstraction that can support them without distortion. If the project already models expense lines, approval stages, and persistent workflow state, suggest partial approval as a natural extension at the expense-line and workflow-decision level. If it already has nonterminal workflow states or pause/resume semantics, suggest hold/resume as an extension in the approval state machine. If the current implementation is much simpler, do not force these features in a way that destabilizes the core scope; instead identify them as higher-order extensions contingent on stronger workflow modeling. The key requirement is to reason about complexity honestly. Additions should be proposed only where they fit naturally into the architecture and improve the product without causing disproportionate refactoring.

When reading the MD file, evaluate it along these dimensions: tenant and company setup correctness; role and reporting hierarchy modeling; expense schema completeness; original-currency and normalized-currency support; OCR ingestion and structured extraction integration; approval-step modeling; sequence-based approval transitions; conditional and hybrid rule capability; backend authorization; auditability of comments and decisions; manager/admin visibility boundaries; and extensibility of the code structure. Identify what is already present, what is missing, what is partially implemented, and what should be added. For each suggested addition, reason about where it should be implemented so that the change is synergistic and localized. Good examples are adding an ApprovalRule model and ApprovalEvaluator service instead of hardcoding threshold logic; adding ExpenseApprovalStep records instead of stretching a single status field; adding a CurrencyConversion service plus normalized amount fields instead of calculating conversions only at render time; adding ReceiptExtractionResult and mapping it into expense creation rather than tightly coupling OCR output to UI fields.

The output of your review should therefore be grounded in this integrated understanding: this is a reimbursement management system with company onboarding, role hierarchy, expense submission, multi-stage approval sequences, conditional approval rules including threshold and specific-approver logic, currency-aware amounts, OCR-driven expense autogeneration, and strong permission separation. Recommendations should improve the project at the correct architectural insertion points, preserve extensibility, reduce future rework, and keep the system coherent. Always prefer changes that compose with the existing design rather than changes that introduce isolated hacks. The standard to apply is not “does the feature exist somewhere,” but “is the feature represented in the right place in the architecture, with the right domain model, the right workflow semantics, and the right extensibility for future additions.”

---

## 3. Product Summary

The Reimbursement Management System is a company expense workflow product that helps employees submit expenses, managers approve or reject them, and admins monitor approvals, budgets, reimbursements, and audit history.

The product must support:

- employee expense submission
- OCR-assisted receipt extraction
- line-item receipt parsing and employee line selection
- multi-step approvals
- conditional approval rules
- reimbursement status tracking
- reporting and analytics
- multi-currency handling
- role-based access control

---

## 4. Feature List

This section lists the complete feature set at a product level before implementation detail.

### Core Product Features

- company bootstrap on first signup
- role-based access control
- employee expense submission
- receipt upload
- OCR-assisted prefill
- bill-level and line-level expense modeling
- editable line-item inclusion before submission
- multi-currency expense entry
- locked submission-time conversion rate
- sequential approval workflow
- conditional approval workflow
- hold / resume / reject / approve actions
- comments on workflow actions
- trigger evaluation visibility and deterministic workflow handling
- expense status tracking
- reimbursement status tracking
- audit logs
- compliance-oriented text log export
- budget tracking
- analytics and reporting
- spend pattern highlighting
- bulk operations for approvals and reimbursements
- real-time status updates

### AI / OCR Feature Pipeline

- receipt image ingestion
- OCR text extraction
- local LLM interpretation of OCR output
- second LLM pass for parsing and formatting into structured fields
- regex validation and correction
- receipt line extraction and normalization
- user review before final submission

---

## 5. Build Priorities

All items below are in the must-build scope, but implementation priority must be different.

### P0 — Core Build First

- authentication and company bootstrap
- role-based access control
- employee expense submission
- expense status tracking
- sequential approval workflow
- manager approval actions: approve, reject, hold, comment
- editable OCR line-item review
- admin user and role management
- currency conversion with locked submission-time conversion rate
- audit logging
- OCR-assisted receipt upload with employee review before submit

### P1 — Build After Core Flow Is Stable

- conditional approval rules
- hybrid approval logic
- bulk approve
- budget tracking
- manager budget visibility for subordinate employees
- reimbursement stage tracking
- real-time status updates

### P2 — Build Last, But Still In Scope

- spend pattern highlighting
- advanced analytics breakdowns
- bulk reimbursement
- deeper anomaly surfacing

---

## 6. User Roles

| Role | Core Responsibility |
|---|---|
| **Admin** | Company setup, user management, workflow configuration, audit and budget visibility |
| **Manager / Approver** | Review and act on expenses assigned in the approval workflow, supervise subordinate spend, and manage exceptions within delegated authority |
| **Employee** | Submit expenses and track reimbursement progress |

---

## 7. User Experience by Role

This section defines what each role sees, what actions each role can take, and what responsibilities they have in the system.

### 7.1 Admin Experience

#### What Admin Sees

- company setup and configuration screens
- user management screens
- manager-employee mapping view
- approver chain configuration for roles such as manager, finance, CFO, director, and CEO
- approval workflow configuration
- conditional rule configuration
- expense overview across the company
- audit log view
- compliance log export view
- budget dashboards
- reimbursement management view
- reporting and analytics dashboards

#### What Admin Can Do

- create, edit, and delete users
- assign roles
- define reporting hierarchy
- configure sequential approval flows
- configure conditional approval rules
- configure multi-level approver chains across multiple people and roles
- bulk approve eligible expenses
- bulk reimburse approved expenses
- inspect audit records
- export compliance history as text files
- define and monitor budgets
- review trends and highlighted anomalies

#### Admin Responsibilities

- maintain company structure and access
- maintain approval policies
- ensure reimbursement workflow remains functional
- ensure high-risk actions are traceable via audit logs

### 7.2 Manager / Approver Experience

#### What Manager Sees

- assigned approval queue
- expense details page
- comments and workflow history
- converted amount in company default currency
- receipt image, extracted bill summary, and extracted line items
- which extracted lines are included vs excluded from submission
- workflow trigger evaluation results, including failed or bypassed trigger conditions
- hold / reject / approve controls
- subordinate budget visibility for employees below them in the hierarchy
- team expense visibility if permitted

#### What Manager Can Do

- approve an expense
- reject an expense
- put an expense on hold
- resume an expense if they held it
- leave comments on decisions
- leave comments on specific bill lines or the full bill where supported
- review status and workflow step history
- inspect subordinate budget consumption and threshold variance

#### Manager Responsibilities

- review claims assigned in the workflow
- provide comments when rejecting or holding expenses
- move valid expenses forward without unnecessary delays

### 7.3 Employee Experience

#### What Employee Sees

- expense submission form
- receipt upload area
- OCR-prefilled draft form
- personal expense history
- expense detail page
- approval status timeline
- rejection / hold comments
- reimbursement status

#### What Employee Can Do

- create draft expenses
- upload receipt images
- review and edit AI-extracted fields
- submit expenses
- track expense status
- view comments from approvers

#### Employee Responsibilities

- provide accurate expense details
- review extracted receipt data before submission
- upload receipts when available

---

## 8. Authentication and Company Bootstrap

### Requirements

- On first signup/login, the system creates:
  - a new `Company`
  - the first `Admin User`
- The company default currency is determined from the selected country.
- The application must use a single authentication system with role-based authorization.
- Admin can:
  - create employee and manager accounts
  - delete employee and manager accounts
  - change user roles
  - define manager-employee relationships

### External Dependency

**Countries and currencies API**
```http
GET https://restcountries.com/v3.1/all?fields=name,currencies
```

### Acceptance Criteria

- Given a new company signup, when setup completes, then one admin user and one company record exist.
- Given a selected country, when company setup completes, then the company default currency is set.
- Given a non-admin user, when they try to access admin-only pages, then access is denied.

### Edge Cases

- If country/currency API fails, admin must manually select company currency.
- If the first admin setup is interrupted, the system must avoid duplicate company bootstrap records.

---

## 9. Roles and Permissions

| Role | Permissions |
|---|---|
| **Admin** | Create/delete Employees & Managers, assign/change roles, define manager relationships, configure approval rules and approval sequences, view all expenses, bulk approve, track budgets, access full audit log, view reimbursement and reporting data |
| **Manager / Approver** | Approve or reject expenses, view assigned/team expenses, add comments, put expenses on hold, resume held expenses if they were the one who held them, view expense amount in company default currency |
| **Employee** | Submit expense claims, upload receipts, review OCR prefill, edit extracted values, view own expense history, track status, view rejection/hold comments |

### Permission Notes

- Only Admin can configure approval logic.
- Only Employee submits their own normal claims.
- Managers do not get unrestricted access to all company expenses unless explicitly configured by role rules.

---

## 10. Employee Flow: Expense Submission

### Requirements

Expense submission is employee-driven and begins from the employee dashboard or expense history screen.

Each expense must capture:

| Field | Requirement |
|---|---|
| Amount | Required |
| Currency | Required; may differ from company currency |
| Category | Required |
| Description | Required |
| Expense Date | Required |
| Receipt | Optional image upload |

### What Employee Sees During Submission

- blank expense form for manual entry
- upload button for receipt image
- OCR processing state
- pre-filled draft once extraction completes
- editable bill summary and editable extracted expense lines
- extracted line items shown in form format with per-line editable fields such as item name, quantity where available, unit price where available, line total, category, and description
- include/exclude control for each extracted line before final submission
- editable fields before final submit
- validation errors if data is incomplete

### What Employee Can Do During Submission

- enter all fields manually
- upload a receipt
- use AI-prefilled data
- edit any extracted field
- review each detected bill line separately
- edit the item name, price, category, description, and included/excluded state for each detected bill line before submission
- remove a bill line or extracted expense line before submission
- save as draft if that capability is implemented in the first version
- submit the final reviewed expense

### Bill and Line-Item Rules

- A receipt or bill is the source document uploaded by the employee.
- A bill may contain one or more line items.
- A line item is a specific expense candidate extracted from the bill.
- The employee must be able to decide which extracted line items are included in the final submission.
- Each extracted line item must be editable before submission, including at minimum item label or description, amount, and category.
- Excluded lines must not be counted toward the submitted amount.
- The final submitted expense must preserve the relationship between the source bill, included lines, excluded lines, edited values, and the employee-confirmed totals.
- The canonical submitted amount is the sum of the included line-item totals after employee edits; if no line items are used, the canonical submitted amount is the final amount confirmed in the bill-level form.
- If the edited included-line total does not match the extracted bill total, the system must show the difference and require explicit employee confirmation before submit.

### Currency Rules

- Employee may submit in any supported currency.
- A conversion rate must be fetched at submission time.
- The converted company-currency amount must be stored with the expense.
- The conversion rate used at submission must be locked and must not change later during approval.
- The system must persist the rate source, rate timestamp, base currency, target currency, and rounding precision used for normalization.
- Reimbursement defaults to company currency for v1.
- Reimbursement in a currency different from the company currency is out of scope for v1 unless explicitly added later as a controlled extension.

### Status Visibility

Employees must be able to view their expenses filtered by:

- Draft
- Submitted
- Pending Approval
- On Hold
- Rejected
- Approved
- Reimbursed

### External Dependency

**Currency conversion API**
```http
GET https://api.exchangerate-api.com/v4/latest/{BASE_CURRENCY}
```

### Acceptance Criteria

- Given an expense in a foreign currency, when the employee submits it, then the system stores both the original amount and converted company-currency amount.
- Given an expense already submitted, when exchange rates later change, then the stored converted value does not change.
- Given a submitted expense, when the employee opens history, then the current workflow status is visible.
- Given edited line items, when the employee submits, then the saved canonical amount equals the sum of included edited lines or the explicitly confirmed bill-level amount.
- Given a mismatch between included-line total and extracted bill total, when the employee submits, then the system requires explicit confirmation and stores the mismatch context for auditability.

### Edge Cases

- If currency API fails, system may use the last cached successful rate and must store that rate timestamp.
- If neither live nor cached rate is available, submission must be blocked with a clear error.
- Duplicate submission from repeated clicks must not create multiple expense records.

---

## 11. OCR Receipt Extraction

### Requirements

Employees may upload a receipt image to pre-fill the expense form.

Pipeline:

```text
Receipt Image -> OCR Engine -> Local LLM Interpretation -> LLM Parsing and Formatting -> Regex Validation / Correction -> Bill Summary and Extracted Line Items -> Employee Review and Line Selection -> Final Submission
```

### Pipeline Stages

1. **OCR Engine**
   - extract raw text from uploaded receipt image
2. **Local LLM Interpretation**
   - use a local model to interpret noisy OCR output and recover likely semantic meaning
3. **LLM Parsing and Formatting**
   - send the interpreted output to an LLM that converts it into structured fields and normalized formatting
4. **Regex Validation**
   - validate and correct date, amount, currency symbol, numeric formatting, and structural inconsistencies
5. **Bill and Line Structuring**
   - structure the receipt into bill-level metadata and line-level expense candidates
   - identify subtotal, tax, total, merchant, and recoverable individual spend lines where possible
6. **Employee Review**
   - employee must confirm or edit extracted data before final submission
   - employee must be able to include or exclude individual extracted lines
   - employee must be able to edit each extracted line in form format before final submission

### Fields to Extract

- amount
- date
- description
- category / expense type
- vendor name
- line items, if available
- subtotal
- tax
- total

### Storage and Editability Rules

- OCR and AI outputs are draft suggestions only and must be stored separately from the final submitted expense fields.
- The system must preserve stage outputs for OCR text, intermediate interpretation, structured extraction, validation corrections, and final employee-confirmed values.
- Bill-level fields and line-level fields must remain independently editable until submission.
- Employee edits become the source of truth for the final expense record; raw OCR and model outputs remain attached only as audit and debug artifacts.

### Reliability Rules

- OCR extraction must never auto-submit an expense.
- Employee review is mandatory before submission.
- Missing or low-confidence fields should remain editable and visibly flagged.
- Every extracted field and line item should carry a confidence indicator where the pipeline can provide one; low-confidence outputs must be highlighted for review.
- The local model stage and formatting LLM stage must both be treated as assistive, not authoritative.
- Regex validation is the final automated validation layer before user review, not a replacement for user confirmation.
- Bill-level and line-level extraction outputs must remain editable independently.
- The system must preserve which extracted lines were excluded by the employee for auditability.
- If the pipeline cannot extract a trustworthy amount, date, or currency, the system must leave that field blank or flagged rather than inventing a value.

### User-Facing Behavior

- user uploads a receipt image
- system shows processing state
- system returns a structured bill summary and extracted line list
- employee sees editable fields
- employee can remove or keep each extracted line before submission
- employee confirms or corrects data
- only then can the expense be submitted

### Acceptance Criteria

- Given a readable receipt image, when OCR processing finishes, then the system pre-fills supported fields.
- Given extracted fields, when validation detects malformed data, then the corrected or flagged value is shown to the employee.
- Given an itemized receipt, when extraction completes, then the employee can choose which lines to include in the submission.
- Given OCR output, when the employee edits values and submits, then the final saved expense uses the employee-confirmed values.

### Edge Cases

- blurry or low-quality receipt
- multiple totals present on receipt
- missing currency symbol
- itemized receipts with conflicting totals
- shared bill where only some lines are reimbursable
- handwritten or partially cropped receipts

---

## 12. Manager / Approver Flow: Approval Workflow

## 12.1 Sequential Approval Flow

### Requirements

- Each expense follows a configured approval sequence.
- If the employee's manager has `IS_MANAGER_APPROVER` enabled, the manager becomes the first approver before the configured chain.
- Example sequence:
  - Step 1 -> Manager
  - Step 2 -> Finance
  - Step 3 -> CFO
  - Step 4 -> CEO
- The next approver can act only after the current approver has acted.
- No skipping is allowed in the normal sequential chain.
- Approvers see the amount in the company default currency.
- The configured chain must support multiple approvers across the organizational hierarchy, including more than one manager-level or executive approver.

### Acceptance Criteria

- Given a 3-step approval chain, when step 1 approves, then the expense moves to step 2.
- Given a pending step 1 approval, when step 2 opens their queue, then that expense is not actionable yet.

## 12.2 Approval Actions

Approvers can:

- Approve
- Reject
- Put On Hold
- Add Comments

### What Approver Sees

- expense submitter
- original currency amount
- converted company-currency amount
- category and description
- receipt and extracted data, where available
- included and excluded bill lines, where available
- current workflow step
- prior comments and audit trail summary

### What Approver Can Do on an Expense

- approve
- reject
- hold
- resume if permitted
- comment

### Rules

- **Approve**: move to next step or mark fully approved if final step
- **Reject**: stop the workflow and mark expense as rejected
- **On Hold**: pause workflow without rejection
- **Comments**: required for reject and hold; managers and other approvers must be able to add comments on approvals as well
- Only the approver who put the expense on hold or an Admin can resume it
- When conditional triggers are evaluated, the approver must be able to see which trigger passed and which failed
- Reject is terminal for the current workflow instance and dominates pending or future approval conditions.
- While an expense is On Hold, no further approval-step progression or conditional auto-approval may occur until the expense is resumed.

### Acceptance Criteria

- Given an expense on hold, when an unrelated approver tries to resume it, then access is denied.
- Given a rejection, when the employee views the expense, then rejection status and comment are visible.

## 12.3 Conditional Approval Rules

All rule types are in scope.

| Rule Type | Description | Example |
|---|---|---|
| Percentage Rule | A threshold condition based on configured approvals | 2 of 3 approvers must approve |
| Specific Approver Rule | A named approver condition | CFO approval is required |
| Combined Logic Rule | Admin-defined boolean composition of rule conditions | 2 of 3 approvals AND CFO approval |

### Requirements

- Admin must be able to configure which rule applies per policy or expense type.
- Conditional logic may exist alongside the sequential chain.
- System must evaluate conditional logic on every approval event.
- Trigger evaluation results must be visible to the acting approver.
- Admin must be able to choose whether configured conditions are combined with `AND` or `OR`.
- Sequential approval remains the primary workflow structure; conditional logic decides whether the workflow is complete, not whether sequence can be skipped unless the configured sequence itself allows that actor to act at the current step.

### Implementation Rules

- Different employees may report to different managers, and manager resolution must be per employee rather than global for the company.
- Reporting hierarchy and approval policy must be modeled separately.
- If `IS_MANAGER_APPROVER` is enabled for the employee's manager relationship, that employee's resolved manager must be inserted before the configured sequence.
- The backend must resolve the employee's manager and applicable policy at submission time and snapshot the resulting workflow instance.
- Later manager or policy changes must not silently mutate already-submitted expense workflows.
- Conditional rules must be represented as explicit boolean expressions over approval conditions rather than implicit precedence between rule types.
- If an expense is On Hold, conditional rules are frozen and must not transition the expense until resume.
- If any acting approver records a rejection, the workflow becomes Rejected immediately and unresolved rule expressions fail for that workflow instance.
- If an approver is present both in the sequential chain and in a specific-approver rule, a single approval action from that approver satisfies both contexts and must not require duplicate action.
- If a percentage threshold becomes mathematically impossible because of one or more rejections, that condition fails immediately.
- Rule evaluation must check the current boolean expression state after every approval or rejection event.
- For `AND` logic, every configured condition must be satisfied before the expense can become Approved.
- For `OR` logic, satisfying any configured condition is enough to complete the policy, provided the acting approver was allowed to act in the current sequential step.

- **Percentage rule**
  - Example: 2 of 3 configured approvers approve.
  - The approver set used in the percentage calculation must be explicit and deterministic.
  - Rejected approvers remain part of the denominator unless the policy explicitly defines another denominator model.
  - The engine must detect when the remaining pending approvers can no longer satisfy the threshold and mark that condition as failed rather than leaving it indefinitely pending.

- **Specific approver rule**
  - Example: CFO approval is required.
  - The specific approver condition is satisfied when that named approver records an approval in the valid workflow step.
  - If the specific approver rejects instead of approves, the expense is rejected unless policy explicitly defines a non-terminal objection model, which is not the default for v1.

- **Combined logic rule**
  - Example: 2 of 3 approvers approve AND CFO approves.
  - Example: 2 of 3 approvers approve OR CFO approves.
  - All referenced conditions must be evaluated on every approval event.
  - For `AND`, the workflow remains pending until all required conditions are satisfied.
  - For `OR`, the workflow may complete as soon as any configured condition is satisfied.
  - If one branch in an `OR` expression becomes impossible but another branch remains valid, the workflow may continue pending the remaining branch.
  - If any required branch in an `AND` expression becomes impossible, the workflow fails immediately.

## 12.4 Combined Approval Flows

### Requirements

- Sequential and conditional logic can coexist.
- Example:
  - 3-step chain exists
  - CFO is one step in the chain
  - Admin may require `2 of 3 approvals AND CFO approval`
  - Admin may alternatively configure `2 of 3 approvals OR CFO approval`
- There is no hidden precedence between threshold and specific-approver conditions; the admin-configured boolean operator is the source of truth.

### Acceptance Criteria

- Given an `AND` rule, when the percentage threshold is met but the CFO has not approved, then the expense remains pending.
- Given an `AND` rule, when both the percentage threshold and CFO approval are satisfied, then the expense is approved.
- Given an `OR` rule, when either the percentage threshold is met or the CFO approval condition is satisfied, then the expense is approved.
- Given two employees with different managers, when both submit expenses under the same policy, then each expense resolves to that employee's own manager as the manager-approver step.
- Given a manager change after submission, when viewing an already-submitted expense, then the original resolved approval path remains unchanged.
- Given an `OR` rule where the threshold condition becomes impossible after a rejection, when another valid branch still remains, then the workflow remains pending that remaining branch.
- Given an `AND` rule where the threshold condition becomes impossible after a rejection, when the rejection is recorded, then the workflow fails immediately.
- Given a CFO who is both in the sequence and a specific-approver condition, when the CFO approves once in the valid step, then the engine records one action and evaluates both the step completion and the CFO condition.
- Given an expense on hold, when another approver action or background rule evaluation would otherwise approve it, then the expense remains on hold until resumed.

### Edge Cases

- approver appears in both sequential and conditional rules
- approval threshold becomes impossible after rejection
- approver role changes while expense is mid-flow
- policy changes after submission must not retroactively mutate historical approval records unless explicitly designed

---

## 13. Admin Flow: Configuration and Operations

### Core Requirements

- configure approval sequences
- configure conditional approval rules
- manage users and reporting relationships
- bulk approve expenses
- access all expense records
- access full audit logs
- export compliance logs as text files
- monitor budgets
- view spend trends and highlighted anomalies

### What Admin Sees in Daily Use

- pending company-wide expenses
- configuration panels
- visual policy builder for approval workflows
- reimbursement queue
- budget summaries
- audit stream
- compliance export history
- reporting dashboard

### What Admin Operates

- org structure
- policy configuration
- visual composition of approval policies
- exception handling
- reimbursement processing
- reporting review
- compliance and audit export

### Visual Policy Builder Requirements

The admin policy configuration experience must include a visual policy builder in the React application. This builder is a constrained business-rule composition tool, not a general programming environment.

#### Purpose

- allow admins to build approval policies by composing reusable policy components
- make complex approval logic understandable to non-technical admins
- reduce ambiguity between sequential approval flow and conditional approval logic
- generate a stable saved policy definition that backend services can evaluate

#### Core UX Structure

The visual policy builder should include:

- a left-side component palette
- a central policy canvas
- a right-side inspector / configuration panel
- a policy summary panel
- a validation panel
- a simulation / preview panel

#### Builder Components

At minimum, the builder must support these policy components:

- `Start`
- `Manager Approver`
- `Fixed Approver`
- `Role Approver`
- `Sequential Stage`
- `Percentage Rule`
- `Specific Approver Rule`
- `Hybrid OR Rule`
- `Approve Outcome`
- `Policy Notes`

#### Builder Behavior

- Admin must be able to drag or insert components from the palette into the policy canvas.
- Admin must be able to reorder sequential approval stages.
- Admin must be able to select any policy component and edit its properties in the inspector.
- Admin must be able to save the visual builder output as a structured policy schema.
- Admin must be able to load an existing policy schema back into the builder.
- The UI must generate a live human-readable summary of the configured policy.
- The builder must show validation errors and warnings before save.
- The builder must support previewing how a policy resolves for example employees.

#### Rule Builder Semantics

- `Manager Approver` means the submitting employee's resolved manager at runtime, not a hardcoded user id.
- `Fixed Approver` means a named user such as CFO.
- `Role Approver` means an approver derived from a configured organizational role or group.
- `Percentage Rule` means the expense is approved when the configured percentage threshold is met.
- `Specific Approver Rule` means the expense is approved when the named approver approves.
- `Hybrid OR Rule` means the expense is approved when either the percentage rule or the named approver rule is satisfied.

#### Validation Requirements

- policy name is required
- at least one valid approver path is required
- percentage threshold must be between 1 and 100
- specific approver references must resolve to a valid configured user
- hybrid rule must contain valid child conditions
- builder must warn on ambiguous or impossible rule setups
- builder must prevent hardcoding a manager user into the `Manager Approver` component
- serialization output must be deterministic and versionable

#### Simulation Requirements

The builder must support policy simulation with example input values:

- employee
- employee's current manager
- expense amount
- category
- department

The simulation result must show:

- resolved sequential approval path
- resolved manager in place of manager-approver blocks
- configured conditional rules
- what happens if the specific approver acts
- what happens if the percentage threshold is met
- final human-readable policy narrative

#### Frontend Implementation Expectations

The visual policy builder should be implemented as a dedicated feature module in the React + Vite application with clear separation between:

- policy schema types
- builder state management
- serialization / deserialization
- validation logic
- policy summary generation
- policy simulation logic
- presentational React components

The UI layer must not contain the actual workflow execution engine. It is responsible only for policy composition, validation, persistence, and preview.

### Priority Breakdown

| Capability | Priority |
|---|---|
| User management | P0 |
| Approval rule configuration | P0 |
| Visual policy builder | P0 |
| Audit log access | P0 |
| Bulk approve | P1 |
| Budget tracking | P1 |
| Spend pattern highlighting | P2 |

### Acceptance Criteria

- Given an admin user, when they update a workflow rule, then the change is stored and audit-logged.
- Given multiple expenses in an approvable state, when bulk approve is triggered, then all selected valid expenses are processed correctly.
- Given an admin user, when they build a policy visually and save it, then a stable structured policy definition is persisted.
- Given an existing saved policy, when the admin reopens it in the visual builder, then the same policy structure and configuration are restored.
- Given an admin configuring a manager-approver block, when they save the policy, then the saved schema stores manager resolution semantics rather than a hardcoded manager user id.

---

## 14. Reimbursement Lifecycle

The system must support the full lifecycle:

```text
Submission -> Approval -> Reimbursement -> Reporting
```

### Requirements

- Approved expenses must enter a reimbursement-ready state.
- Admin or finance role must be able to mark expenses as reimbursed.
- Bulk reimbursement must be supported.
- Reimbursement status must be visible to employees.
- Reimbursement amount defaults to the approved company-currency amount stored at submission or approval time.
- Reimbursement records must store payout amount, payout currency, payout timestamp, payout batch reference if any, and payout status.
- Reimbursement currency is the company currency in v1.

### Acceptance Criteria

- Given an approved expense, when finance processes reimbursement, then status changes to `Reimbursed`.
- Given multiple approved expenses, when bulk reimbursement runs, then all selected valid expenses are updated together.
- Given a reimbursed expense, when an employee or admin views it, then the payout amount and payout currency are visible.

### Edge Cases

- reimbursement attempted on rejected expense
- reimbursement attempted twice
- partial failure during bulk reimbursement
- reimbursement attempted in a non-company currency in v1

---

## 15. Reporting, Analytics, and Monitoring

### Requirements

- real-time expense status updates
- category-wise spend analytics
- department-wise spend analytics
- time-period analysis
- individual-level analysis
- budget tracking by department, category, or period
- manager-facing subordinate budget visibility
- spend pattern highlighting / anomaly surfacing

### Priority Breakdown

| Capability | Priority |
|---|---|
| Real-time status tracking | P1 |
| Budget tracking | P1 |
| Basic analytics breakdowns | P2 |
| Spend anomaly highlighting | P2 |

### Acceptance Criteria

- Given new approvals or rejections, when dashboards refresh, then updated statuses are reflected.
- Given budget thresholds, when spend approaches or exceeds them, then the system surfaces the variance.

---

## 16. Audit Logging

### Requirements

Every important system action must be audit-logged with:

- actor
- action type
- timestamp
- entity affected
- details before/after when relevant
- free-text compliance note where applicable

### Events That Must Be Logged

- expense submission
- OCR extraction confirmation
- approval
- rejection
- hold
- resume
- trigger evaluation result
- reimbursement
- role change
- approval rule change
- manager relationship change
- line inclusion / exclusion confirmation
- compliance log export

### Acceptance Criteria

- Given any approval workflow action, when it is completed, then an audit log entry exists.
- Given an admin rule change, when it is saved, then old and new values are traceable.
- Given a compliance export request, when the export completes, then a text file containing the selected audit history is generated and logged.

---

## 17. Status Model

Every expense must follow a clear state model.

### Required States

- `Draft`
- `Submitted`
- `Pending Approval`
- `On Hold`
- `Rejected`
- `Approved`
- `Reimbursed`

### Transition Rules

| From | Action | To |
|---|---|---|
| Draft | Submit | Submitted / Pending Approval |
| Submitted | Workflow starts | Pending Approval |
| Pending Approval | Hold | On Hold |
| On Hold | Resume | Pending Approval |
| Pending Approval | Reject | Rejected |
| Pending Approval | Final approve | Approved |
| Approved | Reimburse | Reimbursed |

### Rules

- Rejected expenses are terminal unless resubmission/edit flow is explicitly implemented later.
- On Hold does not reset previous approvals.
- Approved expenses cannot return to pending in v1.
- On Hold freezes workflow progression and conditional evaluation until a valid resume action occurs.
- Rejection dominates all unresolved approval branches in the active workflow instance.

---

## 18. Data Model Summary

The implementation should support at least the following entities:

| Entity | Purpose |
|---|---|
| `Company` | Tenant/company configuration including default currency |
| `User` | System user with role and company linkage |
| `Role` | Admin / Manager / Employee permissions |
| `ManagerAssignment` | Employee-to-manager reporting relationship with active/effective assignment state |
| `Expense` | Core expense record |
| `ExpenseReceipt` | Uploaded receipt file and OCR metadata |
| `ExpenseReceiptLine` | Extracted line item from a source bill/receipt, including inclusion state |
| `OcrProcessingRecord` | OCR output, local LLM output, formatting LLM output, regex validation output |
| `ApprovalPolicy` | Reusable approval policy definition for a policy scope or expense type |
| `ApprovalStep` | Sequential approval step definition |
| `ApprovalRule` | Conditional approval rule definition |
| `ExpenseApprovalInstance` | Snapshotted resolved workflow instance created when an expense is submitted |
| `ApprovalTriggerEvaluation` | Stored result of conditional rule evaluation and pass/fail details |
| `ApprovalAction` | Recorded approval/reject/hold/resume event |
| `AuditLog` | Immutable action history |
| `ComplianceExport` | Generated compliance log export metadata and file reference |
| `Budget` | Budget configuration and tracking target |
| `ReimbursementBatch` | Optional bulk reimbursement grouping |

### Approval Modeling Notes

- `ManagerAssignment` must support different managers for different employees.
- `ApprovalPolicy` stores reusable workflow definitions.
- `ExpenseApprovalInstance` stores the resolved, immutable workflow path for a submitted expense.
- `ApprovalRule` must support:
  - percentage threshold rules
  - specific approver conditions
  - boolean composition with `AND` and `OR`

### Minimum Expense Record Fields

- expense id
- employee id
- original amount
- original currency
- locked conversion rate
- conversion rate source
- conversion rate timestamp
- converted company-currency amount
- category
- description
- expense date
- status
- submitted at
- reimbursement at
- source receipt id
- submitted total before exclusions
- final included total
- reimbursement amount
- reimbursement currency
- reimbursement batch id

---

## 19. Non-Functional Requirements

### Security

- role-based access control must be enforced at API and UI level
- audit logs must not be editable by standard users
- receipt uploads must be validated by file type and size
- compliance text exports must be access-controlled and immutable after generation

### Reliability

- failed external API calls must degrade gracefully where possible
- duplicate actions should be idempotent where practical
- system must preserve locked currency and approval history after submission
- OCR / AI pipeline stages must be recoverable and observable for debugging
- pipeline output should be traceable per stage for validation and QA
- line inclusion and exclusion decisions must be preserved exactly as confirmed by the employee
- trigger evaluation failures must be traceable for later review

### Usability

- employees should be able to complete the core submission flow quickly
- approval actions should be low-friction for managers
- comments and statuses must be easily visible

### Transparency

- every workflow state must be visible to the relevant actor
- reasons for rejection and hold must be visible to employees
- managers must be able to see subordinate budget context when reviewing expenses
- approvers must be able to see which conditional triggers passed or failed

---

## 20. Feature-to-Flow Mapping

This section connects the feature list to actual user activity.

| Feature | Primary User | What the User Does |
|---|---|---|
| Company bootstrap | Admin | Creates company context and default setup |
| User management | Admin | Adds users, assigns roles, maps managers |
| Expense submission | Employee | Enters or reviews expense data and submits |
| Receipt OCR | Employee | Uploads receipt and reviews extracted draft |
| Sequential approvals | Manager / Approver | Reviews assigned claims in order |
| Conditional approvals | Admin / Approver | Admin configures rules, approver actions trigger them |
| Hold / reject / approve | Manager / Approver | Takes workflow decisions with comments |
| Audit logs | Admin | Reviews action history |
| Budget tracking | Admin | Monitors spend against configured budgets |
| Reimbursement lifecycle | Admin / Finance | Marks approved expenses as reimbursed |
| Reporting and analytics | Admin | Reviews operational and financial insights |
| Real-time updates | All users | Sees status changes without ambiguity |

---

## 21. MVP Delivery Guidance

All listed features are must-build, but build order matters.

### Recommended Delivery Sequence

1. Authentication and company bootstrap
2. User roles and permissions
3. Expense submission with multi-currency
4. Sequential approval workflow
5. Audit log
6. OCR extraction and employee review
7. Conditional approval rules
8. Budget tracking and reimbursement flow
9. Real-time status updates
10. Analytics, anomaly highlighting, bulk operations

This sequence should be used unless implementation constraints require a different order.

---

## 22. API and External Integration Handling

| Purpose | Endpoint | Handling Rule |
|---|---|---|
| Countries and currencies | Local seed data first; optional provider abstraction for remote sync later | Must work offline with a checked-in ISO country/currency seed; remote lookup is optional and must never be required for core product behavior |
| Live exchange rates | Local exchange-rate table first; optional provider abstraction for remote sync later | Must work offline with stored rates and admin-managed updates; the rate used at submission must be persisted on the expense record |

---

## 23. Open Decisions for Implementation

These defaults are now resolved for implementation and should be treated as binding unless explicitly changed later:

- Draft save is not required in v1.
- Comments are mandatory on reject and hold, optional on approve.
- Rejected expenses are not edited in place in v1; a later resubmission flow may create a new expense from prior data.
- Finance is modeled as an approver capability within configured approval chains, not as a separate core platform role in v1.
- Real-time updates should use polling first. WebSockets are optional only if they do not increase deployment complexity materially.
- Spend anomaly highlighting in v1 should be deterministic and rule-based, not ML-driven.
- OCR plus local-model extraction should run asynchronously through a backend job boundary even if the first implementation uses a simple in-process worker.
- All inference must use Ollama-hosted local models through a backend adapter. No hosted LLM dependency is required for v1.
- All country, currency, and exchange-rate logic must function without mandatory third-party runtime dependencies.

---

## 24. Reference Inputs

- **UI Mockup:** https://link.excalidraw.com/l/65VNwvy7c4X/4WSLZDTrhkA
- **Problem Statement Source:** Odoo Reimbursement Management (provided PDF)
- **Team Notes Source:** Sorted Arrays internal brainstorming doc (provided `.docx`)

---

## 25. Authoritative Build Decisions for Split Frontend and Backend Development

This file is the single source of truth for both independently developed systems.

The frontend and backend will be developed on different machines and must not rely on live coordination during implementation. They may only rely on this document. When both projects are later brought into the same environment, an agent should be able to connect them using the contracts, schemas, route behavior, and state definitions in this file without needing additional product clarification.

Binding implementation decisions:

- Frontend stack: React + Vite + TypeScript + Tailwind CSS.
- Backend stack: Python + FastAPI.
- Database: PostgreSQL.
- Inference and extraction: Ollama local models only, behind a backend adapter.
- Default runtime posture: no mandatory external network dependencies for core product behavior.
- Country/currency metadata must be stored locally in checked-in seed data.
- Exchange rates must be available locally from seeded or admin-maintained tables.
- The backend is the sole source of truth for authorization, workflow state, currency normalization, and audit events.
- The frontend is responsible for user flows, view-state management, and validation feedback against the exact contracts in this document.
- No mock data, fake seeded workflow records, or fabricated approval history should be assumed in either system.
- Real users from the team should be able to sign up, log in, create records, and progress the workflow using persisted database data.
- PostgreSQL must be treated as the real system of record, with proper relational modeling, migrations, constraints, and foreign keys.
- If there is any conflict between frontend convenience and backend enforcement, backend enforcement wins.

---

## 26. Cross-System Contract for Later Integration

This section exists specifically so frontend and backend can be built separately and still connect cleanly later.

### 26.1 Global Rules

- All API payloads are JSON unless the endpoint is explicitly multipart for receipt upload or file download for exports.
- All timestamps must be ISO 8601 UTC strings.
- All IDs should be UUID strings.
- Monetary values must be represented as decimal strings in APIs, not floating-point numbers.
- Every expense response must include both original submitted currency values and normalized company-currency values.
- Frontend must never derive workflow truth locally; it renders backend workflow state.
- Backend must never depend on frontend-only validation for permission, approval logic, or status transition correctness.
- Unknown enum values from future backend versions must not crash the frontend; show safe fallback labels.

### 26.2 Canonical Roles

- `admin`
- `manager`
- `employee`

### 26.3 Canonical Expense Statuses

- `draft` only if ever introduced later; not required in v1
- `submitted`
- `pending_approval`
- `on_hold`
- `approved`
- `rejected`
- `reimbursed`

### 26.4 Canonical Approval Actions

- `approve`
- `reject`
- `hold`
- `resume`

### 26.5 Canonical Reimbursement Statuses

- `not_ready`
- `ready`
- `batched`
- `paid`

### 26.6 Canonical Rule Types

- `sequential`
- `percentage`
- `specific_approver`
- `combined`

### 26.7 Standard API Envelope

Successful list responses:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 0,
    "total_pages": 0
  }
}
```

Successful single-resource responses:

```json
{
  "data": {}
}
```

Error responses:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### 26.8 Pagination, Filtering, and Sorting

- Pagination params: `page`, `page_size`
- Sorting params: `sort_by`, `sort_order`
- Standard sort order values: `asc`, `desc`
- Filtering should use explicit query params, not opaque blobs
- Date filtering params: `date_from`, `date_to`
- Status filtering param: `status`
- Text search param: `q`

### 26.9 Authentication Contract

- Backend should issue bearer-token-based authentication for v1.
- Frontend stores only the access token required for active session use.
- Current authenticated user response must include user, role, company, and permissions summary.
- Role-driven route access in the frontend is advisory UX behavior; authorization remains backend-enforced.

### 26.10 File Upload Contract

- Receipt upload endpoint must accept `multipart/form-data`.
- Allowed receipt types: `image/jpeg`, `image/png`, `application/pdf` if PDF support is added.
- Upload response must return receipt record ID plus OCR processing state.
- OCR processing must be pollable by receipt ID or OCR job ID.

### 26.11 Realtime Contract

- v1 should use polling.
- Frontend polling targets: approval queue, expense detail timeline, employee history, reimbursements, OCR processing state.
- Polling interval should be configurable.

---

## 27. Backend API Surface Required for Frontend Compatibility

The frontend must build against these endpoints and shapes exactly and must not depend on invented mock contracts.

### 27.1 Auth and Session

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

`POST /api/v1/auth/signup` request:

```json
{
  "company_name": "Acme Inc",
  "country_code": "IN",
  "admin_name": "Jane Doe",
  "admin_email": "jane@example.com",
  "password": "strong-password"
}
```

`GET /api/v1/auth/me` response:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "admin"
    },
    "company": {
      "id": "uuid",
      "name": "Acme Inc",
      "country_code": "IN",
      "default_currency": "INR"
    },
    "permissions": [
      "users.manage",
      "expenses.read_all",
      "approval_policies.manage"
    ]
  }
}
```

### 27.2 Admin User and Hierarchy Management

- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/users/{user_id}`
- `PATCH /api/v1/users/{user_id}`
- `DELETE /api/v1/users/{user_id}`
- `GET /api/v1/manager-assignments`
- `POST /api/v1/manager-assignments`
- `PATCH /api/v1/manager-assignments/{assignment_id}`

User shape:

```json
{
  "id": "uuid",
  "name": "Alex Manager",
  "email": "alex@example.com",
  "role": "manager",
  "is_active": true,
  "manager_id": "uuid",
  "manager_name": "Priya Lead"
}
```

### 27.3 Approval Policy and Rule Management

- `GET /api/v1/approval-policies`
- `POST /api/v1/approval-policies`
- `GET /api/v1/approval-policies/{policy_id}`
- `PATCH /api/v1/approval-policies/{policy_id}`
- `GET /api/v1/approval-policies/{policy_id}/preview`

Approval policy shape:

```json
{
  "id": "uuid",
  "name": "Default Travel Policy",
  "is_manager_approver": true,
  "steps": [
    {
      "id": "uuid",
      "sequence": 1,
      "approver_type": "manager",
      "approver_user_id": null,
      "approver_role_label": "manager"
    }
  ],
  "rules": [
    {
      "id": "uuid",
      "type": "combined",
      "operator": "AND",
      "percentage_threshold": "0.67",
      "specific_approver_user_id": "uuid"
    }
  ]
}
```

### 27.4 Country, Currency, and Rate Data

- `GET /api/v1/reference/countries`
- `GET /api/v1/reference/currencies`
- `GET /api/v1/reference/exchange-rates?base_currency=USD`
- `POST /api/v1/reference/exchange-rates`

These endpoints should read primarily from local persisted data, not remote APIs.

### 27.5 Expense Submission and Employee History

- `GET /api/v1/expenses`
- `POST /api/v1/expenses`
- `GET /api/v1/expenses/{expense_id}`
- `PATCH /api/v1/expenses/{expense_id}` only for fields allowed before submission if draft mode is ever added later
- `GET /api/v1/expenses/{expense_id}/timeline`
- `GET /api/v1/expenses/{expense_id}/approval-instance`

Create expense request:

```json
{
  "category": "Meals",
  "description": "Client lunch",
  "expense_date": "2026-03-29",
  "original_currency": "USD",
  "original_amount": "48.60",
  "receipt_id": "uuid",
  "line_items": [
    {
      "source_line_id": "uuid",
      "name": "Pasta",
      "amount": "22.00",
      "category": "Meals",
      "included": true
    }
  ]
}
```

Expense detail response:

```json
{
  "data": {
    "id": "uuid",
    "employee_id": "uuid",
    "employee_name": "Neha Employee",
    "status": "pending_approval",
    "category": "Meals",
    "description": "Client lunch",
    "expense_date": "2026-03-29",
    "original_currency": "USD",
    "original_amount": "48.60",
    "company_currency": "INR",
    "converted_amount": "4058.22",
    "conversion_rate": "83.50",
    "conversion_rate_source": "manual_seed",
    "conversion_rate_timestamp": "2026-03-29T09:00:00Z",
    "submitted_total_before_exclusions": "60.00",
    "final_included_total": "48.60",
    "receipt": {
      "id": "uuid",
      "file_name": "receipt.jpg",
      "ocr_status": "completed"
    },
    "line_items": [],
    "approval_summary": {
      "current_step_sequence": 1,
      "current_pending_approver_ids": ["uuid"],
      "policy_id": "uuid"
    },
    "reimbursement": {
      "status": "not_ready",
      "amount": null,
      "currency": null,
      "paid_at": null
    }
  }
}
```

### 27.6 Receipt Upload and OCR Pipeline

- `POST /api/v1/receipts`
- `GET /api/v1/receipts/{receipt_id}`
- `GET /api/v1/receipts/{receipt_id}/ocr`
- `POST /api/v1/receipts/{receipt_id}/reprocess`

OCR response shape:

```json
{
  "data": {
    "receipt_id": "uuid",
    "status": "completed",
    "confidence": "0.82",
    "raw_text": "string",
    "structured_fields": {
      "merchant_name": "Cafe Blue",
      "expense_date": "2026-03-28",
      "currency": "USD",
      "total_amount": "48.60",
      "description_hint": "Restaurant receipt"
    },
    "line_items": [
      {
        "id": "uuid",
        "name": "Pasta",
        "amount": "22.00",
        "quantity": "1",
        "included": true
      }
    ],
    "warnings": [
      "Total does not match sum of extracted line items"
    ]
  }
}
```

### 27.7 Approval Queue and Approval Actions

- `GET /api/v1/approvals/queue`
- `POST /api/v1/approvals/{expense_id}/approve`
- `POST /api/v1/approvals/{expense_id}/reject`
- `POST /api/v1/approvals/{expense_id}/hold`
- `POST /api/v1/approvals/{expense_id}/resume`

Action request shape:

```json
{
  "comment": "Looks valid",
  "reason_code": null
}
```

Queue item shape:

```json
{
  "id": "uuid",
  "expense_id": "uuid",
  "employee_name": "Neha Employee",
  "category": "Meals",
  "status": "pending_approval",
  "company_currency_amount": "4058.22",
  "original_amount": "48.60",
  "original_currency": "USD",
  "submitted_at": "2026-03-29T09:10:00Z",
  "current_step_sequence": 1,
  "trigger_evaluation": {
    "state": "pending",
    "passed_conditions": [],
    "failed_conditions": []
  }
}
```

### 27.8 Audit, Budgets, Reimbursements, and Analytics

- `GET /api/v1/audit-logs`
- `GET /api/v1/compliance-exports`
- `POST /api/v1/compliance-exports`
- `GET /api/v1/budgets`
- `POST /api/v1/budgets`
- `GET /api/v1/reimbursements`
- `POST /api/v1/reimbursements/batches`
- `GET /api/v1/analytics/overview`
- `GET /api/v1/analytics/spend-patterns`

### 27.9 Health and Capability Endpoints

- `GET /api/v1/health`
- `GET /api/v1/capabilities`

`GET /api/v1/capabilities` should expose whether OCR, Ollama parsing, and export generation are available in the current deployment.

---

## 28. Frontend Delivery Contract

The frontend must be fully implementable against the real contracts in Section 27 and must not be designed around mock-only or fake-data-only workflows.

### 28.1 Frontend Route Map

- `/login`
- `/signup`
- `/app`
- `/app/expenses`
- `/app/expenses/new`
- `/app/expenses/:expenseId`
- `/app/approvals`
- `/app/admin/users`
- `/app/admin/policies`
- `/app/admin/budgets`
- `/app/admin/audit`
- `/app/admin/reimbursements`
- `/app/admin/analytics`

### 28.2 Frontend State Rules

- All backend-facing logic must be isolated behind typed API clients.
- Views must be built against generated or hand-maintained TypeScript contracts that match this spec exactly.
- Permissions must drive route visibility, action visibility, and empty states.
- Polling behavior must be centralized so production and integration behavior remain consistent.
- Forms must support deterministic validation messages aligned with backend constraints.

### 28.3 Frontend Data Rules

- Frontend screens must assume data is created by real users and persisted by the backend.
- No frontend component may directly embed ad hoc response shapes.
- Empty states must represent real absence of data, not placeholder fake records.
- Demo-only fixtures are out of scope for the product workflow.

### 28.4 Frontend Integration Boundary

- The frontend may define UI-specific view models, but only after decoding canonical API responses.
- The frontend must never rename or reshape backend enums at the transport boundary.
- Receipt upload, OCR polling, approval queue polling, and analytics retrieval must all pass through a shared API layer.

---

## 29. Backend Delivery Contract

The backend must be fully implementable without a live frontend and must expose the interfaces in Section 27.

### 29.1 Backend Module Boundaries

- Auth and tenancy module
- Users, roles, and manager hierarchy module
- Reference data and currency module
- Expense submission and receipt module
- OCR and Ollama extraction module
- Approval workflow and rule engine module
- Audit and compliance export module
- Budget, reimbursement, and analytics module

### 29.2 Backend Design Rules

- FastAPI routers should remain thin.
- Business rules must live in service and domain layers.
- PostgreSQL is the system of record for all workflow, currency, audit, and reimbursement data.
- OCR extraction stages and approval evaluations must be persisted for auditability.
- Ollama integration must sit behind an adapter interface so the system can run with real local inference infrastructure and still be testable with deterministic internal test doubles where necessary.
- Every mutating endpoint must emit audit events.
- Every authorization check must happen server-side.

### 29.3 Backend Integration Boundary

- Endpoint paths, request shapes, and response shapes must remain stable unless this document is updated.
- If the backend adds fields, it must do so in a backward-compatible way.
- The backend should tolerate frontend polling and duplicate submissions with idempotency protections where reasonable.

---

## 30. Parallel-Agent Delivery Plan

Each side will use three agents in parallel. Their ownership is intentionally narrow to minimize overlap and merge risk while still covering the entire feature set.

### 30.1 Frontend Agent Ownership

| Agent | Area | Owned Scope |
|---|---|---|
| FE-1 | App shell, auth, admin structure | Auth screens, session bootstrap, role-aware routing, app shell, user management UI, manager assignment UI, approval policy configuration UI, shared API client foundation |
| FE-2 | Employee expense flow | Expense submission, receipt upload, OCR draft review, line-item editing, employee expense history, expense detail timeline, validation and polling for OCR state |
| FE-3 | Approvals, finance ops, reporting | Approval queue, approve/reject/hold/resume UX, admin expense oversight, budgets, reimbursements, analytics, audit/compliance screens, shared table/filter patterns for operations views |

### 30.2 Backend Agent Ownership

| Agent | Area | Owned Scope |
|---|---|---|
| BE-1 | Auth, tenancy, users, reference data | Signup/login/me, company bootstrap, roles, manager assignments, local country/currency data, local exchange-rate management, permission framework |
| BE-2 | Expense intake and OCR | Receipt upload, OCR pipeline orchestration, Ollama adapter, extraction persistence, expense creation, line-item normalization, employee history/detail endpoints |
| BE-3 | Workflow and operations | Approval policy and rule engine, approval queue/actions, audit logs, budgets, reimbursements, analytics, compliance exports, capability/health endpoints |

### 30.3 Shared Ownership Rules

- Each agent may read the entire codebase for context.
- Each agent should avoid changing another agent's primary modules unless required for integration.
- Shared contract changes must be made in the documented API schema layer first, then propagated.
- If an agent must touch another area, it should do the minimum required and preserve the owning area’s public interfaces.

---

## 31. Prompt File Split

Frontend and backend prompts have been intentionally separated from this shared requirements file so they can be copied to different development machines without carrying unnecessary instructions.

Use these files alongside this requirements document:

- `frontend-build-prompts.md`
- `backend-build-prompts.md`

This file remains the shared source of truth for product scope, contracts, workflow rules, entities, and integration behavior.
