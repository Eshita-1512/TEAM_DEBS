# Frontend Explanation

This file explains what the frontend for the Reimbursement Management System must contain.

It is a product-facing frontend reference derived from:

- [requirements-build-spec.md](/Users/sakshamtyagi/hackathon/oodo/requirements-build-spec.md)
- [frontend-build-prompts.md](/Users/sakshamtyagi/hackathon/oodo/frontend-build-prompts.md)

It also folds in design-system thinking, UX architecture, brand discipline, visual storytelling, product prioritization, and frontend engineering standards directly into this file so implementation does not depend on reading any other design or agency file.

The goal is to make the frontend scope easy to understand before implementation.

---

## 0. Inlined Skill Guidance

This section inlines the relevant guidance that would normally live in separate design, UX, product, and frontend skills. It is adapted for this project and should be treated as part of the source of truth for frontend work.

### Inlined UI Design Guidance

The interface must be built from a design system first, not screen by screen.

Core UI design rules:

- establish tokens before building pages
- build reusable visual primitives before custom screen variations
- maintain visual consistency across forms, tables, badges, timelines, and actions
- accessibility is required from the start, not as cleanup later
- responsive behavior must be part of the component design, not an afterthought

The UI must provide:

- consistent visual hierarchy
- readable typography at dense operational sizes
- states for hover, focus, disabled, loading, empty, success, and error
- clean handoff from visual structure to implementation

The UI should feel pixel-precise:

- alignment should be deliberate
- spacing should follow a system
- contrast should be intentional
- interactive states should feel designed, not default

### Inlined UX Architecture Guidance

The frontend must have a clear structural foundation before detailed page styling.

Core UX architecture rules:

- define information architecture by role
- define page layout patterns before building pages
- use mobile-first responsive rules
- create component boundaries that prevent design drift
- define clear route and screen responsibilities
- use one coherent pattern language for forms, lists, tables, and detail screens

The frontend should include:

- a container system
- spacing scale
- typography hierarchy
- layout patterns for list, form, dashboard, and detail screens
- clear interaction patterns for dialogs, drawers, tabs, and tables

The frontend should reduce developer ambiguity by making these decisions once and reusing them.

### Inlined Brand Guidance

The frontend must express a coherent brand, not just a functioning interface.

Brand rules:

- every screen should feel like part of the same product
- typography, color, tone, and component treatment should reinforce one identity
- the product should be visually differentiated from generic SaaS dashboards
- visual consistency matters as much as visual originality

Brand character for this product:

- precise
- controlled
- trustworthy
- quietly premium
- serious without feeling lifeless

Brand expression rules:

- financial trust must be visible in the interface
- approval and reimbursement flows must feel authoritative
- audit and compliance views must feel durable and procedural
- employee submission flows must feel careful and guided

### Inlined Strategic Delight Guidance

Delight is allowed only when it serves usability or emotional reassurance.

Good uses of delight:

- a refined upload state
- a satisfying OCR completion transition
- calm, polished success feedback
- elegant empty states
- subtle dashboard reveal motion

Bad uses of delight:

- playful rejection states
- decorative motion during destructive actions
- jokey audit interfaces
- cheerful reimbursement failure messaging
- random animation that adds no meaning

Delight should reduce friction or increase confidence. If it does neither, remove it.

### Inlined Visual Storytelling Guidance

Complex workflow screens must communicate a narrative.

Every important page should reveal:

- what happened before
- what state the record is in now
- what the user can do next
- what the consequence of action will be

Narrative rules by screen:

- expense detail should tell the story of submission, review, and status
- approval review should frame evidence, decision, and next state
- audit should read like a procedural record
- reimbursements should show movement from approved to ready to paid

The user should not have to infer the process from disconnected widgets.

### Inlined Product Management Guidance

The frontend should optimize for user outcomes, not feature count.

Product rules:

- lead with the user problem, not a decorative solution
- prioritize clarity in critical workflows
- protect scope from visual or interaction bloat
- make tradeoffs explicit
- avoid building UI that exists only because it looks modern

Primary user outcomes:

- employee can submit correctly
- manager can review quickly
- admin can configure and operate safely

Every screen should justify its existence by helping one of those outcomes.

### Inlined Frontend Engineering Guidance

The frontend must be production-grade in implementation, not just in appearance.

Engineering rules:

- use shared typed contracts for backend interaction
- isolate transport logic behind a shared API layer
- build reusable components with clear state handling
- support accessibility and keyboard use
- keep performance in mind from the start
- use route-level and feature-level code splitting where appropriate
- optimize tables, list rendering, and polling behavior

Quality expectations:

- no critical console errors
- resilient loading, empty, and error states
- stable behavior under long text, many rows, and unknown enum values
- predictable route transitions
- mobile support for employee-critical flows

This file should now be sufficient for design and implementation without opening the external skill files.

---

## 1. Frontend Purpose

The frontend is the user-facing application for a company reimbursement workflow system.

It must let three roles use the product end to end:

- `admin`
- `manager`
- `employee`

The frontend is responsible for:

- authentication flows
- role-aware navigation
- form handling and validation
- receipt upload and OCR review UX
- expense submission UX
- approval workflow UX
- budget, reimbursement, audit, and analytics screens
- polling-based refresh for workflow state changes

The frontend is not responsible for:

- deciding workflow truth locally
- enforcing final authorization rules
- recalculating approval outcomes independently from the backend
- inventing mock business states or fake workflow history

The backend is the source of truth for authorization, workflow state, normalized monetary values, audit events, and approval logic. The frontend renders that truth clearly.

---

## 2. Technology and Implementation Base

The frontend should be built with:

- React
- Vite
- TypeScript
- Tailwind CSS

The frontend should use:

- a shared typed API client layer
- shared form primitives
- shared table and filter primitives
- shared badges, timelines, comments, and status components
- centralized polling utilities

All backend-facing types must match the canonical contracts from the build spec exactly.

---

## 3. Core Frontend Principles

The frontend must follow these rules:

- no mock-only product logic
- no fake approval records
- no renaming of backend enums at the transport boundary
- no local derivation of approval truth
- safe handling of unknown future enum values
- accessible production-quality UI patterns
- deterministic validation and error states
- real empty states instead of placeholder data

The frontend should decode backend responses first, then optionally map them into UI-specific view models.

---

## 4. Frontend Design Layer

The frontend should not just be functional. It should be distinctive, production-grade, and intentionally designed.

Applied guidance in this document:

- design-system-first visual consistency
- foundation-first information architecture
- clear brand character and disciplined visual language
- strategic delight only where it helps the user
- visual storytelling for complex workflow screens
- role clarity and flow prioritization
- responsive, accessible, performance-aware frontend implementation

This project should follow a `frontend-design` mindset:

- plan the design direction before implementation starts
- commit to a clear aesthetic point of view
- avoid generic AI-looking interfaces
- build real working UI with strong visual craft
- match visual ambition to product seriousness and workflow complexity

### Design Planning Before Building

Before designing any page, component, or flow, the frontend should decide:

- purpose
- audience
- tone
- technical constraints
- the one memorable quality that makes the interface feel specific to this product

For this product, the frontend serves a workflow-heavy reimbursement system used by employees, managers, and admins. That means the UI should balance:

- operational clarity
- financial trust
- auditability
- workflow visibility
- polished visual identity

The design should not look like a generic SaaS template.

### Anti-AI-Slop Rules

This frontend must actively avoid patterns that make it feel machine-generated, generic, or forgettable.

The original design prompt for this project requires:

- planning the aesthetic before implementation
- committing to a bold and specific direction
- creating production-grade interfaces with high design quality
- avoiding generic AI aesthetics
- making unexpected but intentional choices
- matching implementation complexity to the design vision

This document adopts that standard directly.

Common AI-generated frontend mistakes:

- defaulting to a bland B2B dashboard look
- using generic fonts and safe but lifeless spacing
- overusing rounded cards with equal-weight sections everywhere
- relying on purple-blue gradients to signal “modern”
- creating repetitive feature tiles with no narrative or hierarchy
- making every page look like the same template with different labels
- adding random micro-animations with no product meaning
- using shallow empty-state copy and fake-friendly language
- making tables, forms, and dashboards visually interchangeable
- prioritizing visual trend mimicry over workflow clarity
- relying on one safe design move everywhere instead of designing each surface intentionally
- using oversized pill buttons, oversized border radius, and oversized shadows on every component
- centering everything instead of composing the page
- making charts, summaries, tables, and forms all look like the same card
- using cute language in serious financial contexts
- adding visual noise without any narrative purpose

For this project, do the opposite:

- make the interface feel specific to finance operations and reimbursement workflow
- choose typography with character and authority
- give different surfaces different visual density and rhythm
- use asymmetry, hierarchy, and pacing instead of uniform card grids
- let status, approval tension, and auditability shape the visual language
- make tables and review panels look purposeful, not generic
- keep motion tied to state change, confirmation, and progression
- use microcopy that is calm, precise, and professional
- build one memorable visual signature and repeat it consistently
- make forms look controlled and editorial, not app-template generic
- make dense screens feel composed, not cluttered and not flat
- vary emphasis between hero areas, operations areas, and record-detail areas
- design buttons, filters, tables, and status blocks as if they belong to a finance workflow product specifically

If a design choice looks like something an AI assistant would generate by default, reject it and make a more specific decision.

### Concrete Anti-AI Design Rules

These are mandatory quality rules, not optional inspiration.

#### Typography Rules

Never:

- use Inter, Roboto, Arial, or raw system fonts as the main identity
- use the same font treatment for headlines, labels, table text, and metrics
- use oversized, vague marketing headlines inside operational screens

Do instead:

- use a display face with visible character for page titles and major numbers
- use a sober, highly readable body face for controls and dense content
- create visible contrast between:
  - page title
  - section heading
  - label text
  - data text
  - annotation text

Typography should signal authority, not startup sameness.

#### Layout Rules

Never:

- stack equal cards in a uniform grid for every page
- center content by default on operational pages
- let every page have the same hero, same cards, same spacing rhythm
- use too much symmetry when the page contains process-heavy information

Do instead:

- create strong left alignment and reading structure for dense screens
- use asymmetry where it improves hierarchy
- allow detail pages to have a primary information column and a secondary context column
- let spacing breathe differently on:
  - auth
  - dashboard
  - form
  - review
  - audit

Layout should look authored, not auto-generated.

#### Surface Rules

Never:

- put every section in the same white rounded rectangle
- rely on soft shadows alone to define hierarchy
- make filters, charts, tables, and comments panels all use the same treatment

Do instead:

- combine crisp borders, selective elevation, and tonal surfaces
- use inset panels for procedural or dense data areas
- give primary action areas stronger contrast and clearer boundaries
- treat audit, approval, OCR, and reimbursement surfaces differently based on function

Surfaces should communicate meaning, not just containment.

#### Color Rules

Never:

- use trendy gradients as the main identity system
- use many equally loud accent colors at once
- make warning and danger colors decorative

Do instead:

- build the system around one dominant accent and disciplined neutrals
- reserve stronger colors for workflow states and high-value actions
- let financial seriousness lead the palette

Color should support trust first, style second.

#### Motion Rules

Never:

- animate everything
- add motion that does not correspond to state, navigation, or confirmation
- use playful motion in rejection, audit, or reimbursement-risk contexts

Do instead:

- animate page entry, refresh, OCR completion, and action confirmation with restraint
- use motion to help the user understand change
- respect reduced-motion settings

Motion should clarify, not decorate.

#### Copy Rules

Never:

- use quirky startup copy in financial operations
- celebrate destructive actions
- use filler empty-state copy with no instruction

Do instead:

- use calm, exact, useful language
- write empty states that explain what the user can do next
- keep tone supportive during guidance and neutral during risk or compliance actions

The interface voice should sound precise and composed.

#### Component Rules

Never:

- create a generic design system and reuse it blindly everywhere
- let all buttons have the same visual weight
- let tables feel like default admin boilerplate

Do instead:

- give buttons distinct hierarchy by consequence
- make filters feel integrated into the page, not bolted on
- design tables with typographic rhythm, row clarity, and operational scanability
- make timelines, action panels, and approval summaries unmistakably product-specific

The component system should feel like it belongs to this exact product.

### Anti-AI Self-Review

Before accepting any page design, review it against these questions:

- If all labels were removed, would the page still look distinctive?
- Does this page have a specific visual rhythm, or is it just cards in a grid?
- Does the typography create real hierarchy, or just size differences?
- Does the page look like a finance workflow tool, or like a startup template?
- Are the action areas clearly more intentional than default buttons on a card?
- Is there at least one memorable compositional choice on the page?
- Would a designer think this was authored, or generated?

If the answer to several of these is weak, redesign the page before building further.

### Page-Specific Aesthetic Direction

Different pages must avoid collapsing into one house style with no nuance.

#### Auth Pages

Should feel:

- atmospheric
- branded
- slightly dramatic
- high-trust

Should not feel:

- like a default split-screen SaaS login
- like a startup marketing template reused as auth

#### Expense List and Approval Queue

Should feel:

- operational
- fast to scan
- typographically strong
- structured

Should not feel:

- like a gallery of cards
- like a generic CRM table

#### Expense Submission

Should feel:

- careful
- guided
- reassuring
- precise

Should not feel:

- noisy
- overly decorative
- like a generic multi-step checkout

#### Expense Review and Approval

Should feel:

- authoritative
- evidence-based
- high-clarity
- consequence-aware

Should not feel:

- playful
- soft
- visually ambiguous

#### Audit and Reimbursements

Should feel:

- procedural
- dense
- clean
- trustworthy

Should not feel:

- celebratory
- trendy
- filled with decorative fluff

### Recommended Design Direction for This Product

A strong direction for this system is:

- editorial-operational
- high-trust
- crisp and data-legible
- modern but not sterile
- distinctive without compromising usability

That means:

- expressive typography with a refined body font and a more characterful display font
- deliberate spacing and hierarchy
- strong status contrast for approval and reimbursement states
- structured layouts for dense workflow information
- subtle but memorable motion
- atmospheric backgrounds or texture accents used with restraint

### Recommended Design System for This Product

To keep implementation decisions concrete, the frontend should default to this design system unless the product team chooses a better one intentionally.

#### Typography

Recommended font pairing:

- display: `Fraunces`
- body and UI: `IBM Plex Sans`
- data or dense numeric areas: `IBM Plex Mono` used sparingly

Why this works:

- `Fraunces` gives headlines personality and authority
- `IBM Plex Sans` stays readable in dense operational screens
- `IBM Plex Mono` makes rates, IDs, timestamps, and audit fragments feel precise

Typography usage:

- large page titles use the display face
- navigation, forms, tables, and long reading use the body face
- raw values such as conversion rates, export IDs, and audit references can use mono accents

#### Color System

The palette should feel trustworthy and operational, not playful SaaS-default.

Recommended core palette direction:

- base background: warm off-white or mineral light tone
- primary text: charcoal ink
- surface color: soft paper or stone
- primary accent: deep petrol or dark teal
- secondary accent: oxidized copper, rust, or muted gold
- success: dense green
- warning: amber ochre
- destructive: brick red
- info: slate blue used minimally

Suggested token categories:

- `--bg`
- `--bg-elevated`
- `--surface`
- `--text`
- `--text-muted`
- `--accent`
- `--accent-strong`
- `--border`
- `--success`
- `--warning`
- `--danger`

The palette should use one dominant accent and let workflow statuses carry the sharper contrast.

Suggested status mapping:

- pending approval: deep teal or slate accent
- on hold: warm amber
- approved: dense green
- rejected: brick red
- reimbursed: muted green-blue or inked emerald

#### Layout and Composition

The interface should avoid flat, interchangeable dashboard composition.

Recommended layout behavior:

- asymmetric header areas
- strong page titles with supporting context
- dense operational modules framed by deliberate whitespace
- subtle overlap or panel layering in hero or overview zones
- disciplined grids for tables and forms

The overall feel should be:

- serious
- structured
- slightly editorial
- visually authored

#### Design Tokens

The frontend should define a reusable token system before building screens.

Minimum token groups:

- color
- typography
- spacing
- radius
- border
- shadow
- motion
- layout widths
- z-index and overlay layers

This prevents screen-by-screen drift and makes the design system scalable.

#### Surfaces and Components

Component styling should favor:

- crisp borders over heavy shadows
- occasional inset panels for dense information
- rounded corners used consistently but not excessively
- grouped data blocks with deliberate headings
- visually distinct action zones for approve, reject, hold, and resume

#### Motion

Motion should be present but disciplined.

Recommended motion style:

- short easing-based fades and slides for page entry
- staggered reveal for dashboard summaries
- subtle expansion for timelines and audit details
- clear transition on OCR state changes
- tactile hover and press feedback on primary actions

Animation should communicate system state, not decorate every element.

#### Memorable Product Detail

The most memorable design quality should be:

- reimbursement and approval workflows feel like a premium editorial control room instead of a generic admin dashboard

That means the product should be remembered for:

- strong hierarchy
- beautiful status presentation
- polished review screens
- confident typography
- high-trust financial UX

### Brand Character

The frontend should express a clear product personality.

Recommended brand character:

- precise
- calm
- composed
- serious without being cold
- quietly premium

The product should feel like:

- a trusted operations desk
- a financial workflow instrument
- a controlled system with human sensitivity

It should not feel like:

- a startup template
- a crypto dashboard
- a playful consumer app
- a rainbow analytics toy

### Visual Storytelling in Workflow Screens

Important screens should communicate a narrative, not just show data.

Examples:

- expense detail should tell the story from submission to current decision point
- approval review should show what happened, what matters now, and what happens next
- audit history should read like a clean procedural record
- reimbursement views should communicate movement from approved to paid clearly

Every dense page should answer three questions immediately:

- what is this
- where is it in the process
- what can this user do now

### Strategic Delight

Whimsy should be used sparingly and only where it improves the experience.

Good places for subtle delight:

- polished upload states
- satisfying OCR completion feedback
- elegant success confirmation after a valid action
- refined empty states
- tasteful motion on dashboard summary reveals

Bad places for whimsy:

- rejection messages
- audit logs
- reimbursement records
- policy configuration warnings
- destructive confirmation flows

The rule is simple:

- delight belongs in progress, assistance, and completion
- seriousness belongs in money, risk, and accountability

### Design Rules

The frontend should:

- choose fonts intentionally and avoid default generic stacks
- use CSS variables for color, spacing, and theme consistency
- create clear visual hierarchy for actions, statuses, and workflow state
- use motion for meaningful moments such as page entry, OCR completion, and action confirmation
- use layered surfaces, depth, borders, or texture to create atmosphere
- favor layouts that feel designed, not assembled from defaults

The frontend should avoid:

- purple-on-white default gradients
- cookie-cutter dashboard layouts
- repetitive card grids with no hierarchy
- generic fonts such as Arial, Roboto, Inter, or raw system defaults unless an existing design system requires them
- decorative choices that reduce readability of financial or workflow data

### Aesthetic Execution Guidance

Different pages should still feel part of one system, but not visually dead.

The frontend should create:

- a memorable app shell
- stronger visual focus on key workflows
- high-contrast, immediately readable status systems
- refined table, form, and timeline styling
- richer empty states and loading states
- polished transitions between workflow states

Maximal visual experimentation should not interfere with:

- accessibility
- speed
- clarity of approval actions
- readability of money values
- comprehension of timelines and audit trails

### Design Complexity Rule

Visual complexity should match the screen purpose.

Examples:

- auth pages can have a stronger brand atmosphere
- dashboards can use richer composition and overview panels
- expense forms should stay disciplined and readable
- approval review pages should prioritize legibility and confidence
- audit views should be dense but highly scannable

In short, the product should feel designed by intention, not generated by habit.

---

## 5. Product Goals and Frontend Success

The frontend exists to make reimbursement operations clear, fast, and trustworthy.

Primary user outcomes:

- employees can submit expenses without ambiguity
- managers can review and act quickly with confidence
- admins can configure policy and operate the system without getting lost

Primary frontend success metrics:

- critical task completion without needing external explanation
- low confusion around status and next-step ownership
- high scannability in approval and audit-heavy screens
- strong mobile behavior for employee flows
- accessible operation across keyboard and assistive technology use

Non-goals for the frontend:

- inventing product scope outside the build spec
- using visual novelty that harms operational clarity
- overbuilding decorative UI at the expense of workflow efficiency

---

## 6. Main Route Map

The frontend route structure must include:

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

Expected route behavior:

- unauthenticated users are sent to login or signup
- authenticated users enter the app shell
- route visibility changes by role
- backend authorization still decides whether access is allowed

---

## 7. Full Website Flow

This section describes the actual flow of the website from first visit through the main role-based journeys.

### Global Entry Flow

1. Unauthenticated user lands on `/login` or `/signup`.
2. After successful auth, the frontend fetches session data from `GET /api/v1/auth/me`.
3. The frontend determines:
   - current user
   - current role
   - company context
   - permissions
4. The user is routed into `/app`.
5. The app shell renders role-aware navigation.
6. The default landing inside `/app` depends on role:
   - employee: `/app/expenses`
   - manager: `/app/approvals`
   - admin: company operations view, usually `/app/admin/users` or the most important operational page

### Employee Flow

1. Employee enters `/app/expenses`.
2. Employee can view history, filter by status, or open an expense detail page.
3. Clicking `New Expense` goes to `/app/expenses/new`.
4. Employee can:
   - fill fields manually
   - upload a receipt
   - wait for OCR
   - review and edit OCR suggestions
   - include or exclude lines
   - confirm totals
   - submit expense
5. After submit, the frontend navigates to the created expense detail page or refreshed history list.
6. Employee watches status changes from:
   - submitted
   - pending approval
   - on hold
   - approved
   - rejected
   - reimbursed

### Manager Flow

1. Manager enters `/app/approvals`.
2. Manager sees actionable queue items.
3. Clicking a queue row opens the expense review page.
4. Manager reviews:
   - expense summary
   - converted amount
   - receipt
   - lines
   - comments
   - workflow history
   - trigger evaluation state
5. Manager can approve, reject, hold, or resume where allowed.
6. After action, the detail view and queue refresh.

### Admin Flow

1. Admin enters the app shell.
2. Admin navigates between:
   - users
   - policies
   - budgets
   - audit
   - reimbursements
   - analytics
3. Admin configures users and approval policies.
4. Admin reviews company-wide activity.
5. Admin operates reimbursements and compliance exports.

The whole website should feel like one coherent system rather than separate mini-apps.

---

## 8. Page-by-Page Interaction Map

This section explains what clicking each major component should do.

### `/login`

Components and click behavior:

- email input: updates local form state
- password input: updates local form state
- `Log In` button:
  - validates fields
  - sends login request
  - on success fetches session
  - routes into `/app`
- `Go to Sign Up` link:
  - routes to `/signup`

### `/signup`

Components and click behavior:

- company name input: updates form state
- country selector:
  - updates selected country
  - may preview default currency if reference data is available
- admin name input: updates form state
- admin email input: updates form state
- password input: updates form state
- `Create Company` button:
  - validates fields
  - submits signup payload
  - on success fetches session
  - routes into `/app`
- `Go to Login` link:
  - routes to `/login`

### App Shell

Components and click behavior:

- logo or product mark:
  - routes to role-default landing page
- sidebar nav item:
  - routes to matching page
  - visually highlights active route
- user menu:
  - opens account menu
- `Logout` action:
  - calls logout endpoint
  - clears session
  - routes to `/login`

### `/app/expenses`

Components and click behavior:

- search input:
  - updates query state
  - triggers filtered fetch or debounced fetch
- status filter:
  - reloads list with selected status
- sort controls:
  - reload list with selected sort
- expense row:
  - routes to `/app/expenses/:expenseId`
- `New Expense` button:
  - routes to `/app/expenses/new`
- pagination controls:
  - fetch next or previous page

### `/app/expenses/new`

Components and click behavior:

- amount input: updates amount state
- currency select: updates currency state
- category select: updates category state
- description input: updates description state
- expense date input: updates date state
- receipt upload area:
  - opens file picker or accepts drop
  - uploads receipt
  - shows upload state
  - stores `receipt_id`
- `Reprocess OCR` action where available:
  - calls OCR reprocess endpoint
  - resets OCR state
- OCR line include toggle:
  - updates included total
- OCR line amount or name fields:
  - update editable line state
- mismatch confirmation checkbox or acknowledgement:
  - required when totals differ
- `Submit Expense` button:
  - validates full payload
  - sends create expense request
  - on success routes to detail page or refreshed history
- `Cancel` button:
  - returns to `/app/expenses`

### `/app/expenses/:expenseId`

Components and click behavior:

- back button:
  - returns to previous list or `/app/expenses`
- timeline item:
  - may expand to reveal more detail
- receipt preview:
  - opens larger preview if supported
- comments section:
  - displays workflow comments
- refresh or auto-refresh indicator:
  - reflects polling state

### `/app/approvals`

Components and click behavior:

- queue row:
  - routes to the approval review detail for that expense
- filter controls:
  - refetch queue with selected filters
- search:
  - refetch queue with search query
- polling indicator:
  - shows queue freshness

### Approval Review Page

Components and click behavior:

- `Approve` button:
  - opens confirmation state if needed
  - submits approve action
  - refreshes detail and queue
- `Reject` button:
  - requires comment
  - submits reject action
  - refreshes detail and queue
- `Hold` button:
  - requires comment
  - submits hold action
  - refreshes detail and queue
- `Resume` button:
  - only appears if allowed
  - submits resume action
  - refreshes detail and queue
- comment input:
  - updates action payload state
- trigger evaluation section:
  - expands to show passed and failed conditions

### `/app/admin/users`

Components and click behavior:

- user row:
  - opens detail drawer, modal, or edit page
- `Create User` button:
  - opens create form
- role selector:
  - updates selected role
- manager selector:
  - updates manager assignment
- save action:
  - persists change
  - refreshes users list
- delete action:
  - opens confirmation
  - deletes user if confirmed

### `/app/admin/policies`

Components and click behavior:

- policy row:
  - opens policy detail or edit view
- `Create Policy` button:
  - opens empty policy form
- `Add Step` button:
  - inserts approval step row
- `Add Rule` button:
  - inserts rule row
- sequence controls:
  - reorder steps
- operator control:
  - switches between `AND` and `OR`
- preview action:
  - calls preview endpoint if available
- save action:
  - persists policy changes

### `/app/admin/budgets`

Components and click behavior:

- budget row:
  - opens budget detail or edit state
- `Create Budget`:
  - opens form
- filters:
  - refetch budgets

### `/app/admin/audit`

Components and click behavior:

- log row:
  - expands or opens detail view
- filters:
  - refetch logs
- export history item:
  - opens metadata or download state
- `Create Compliance Export`:
  - submits export creation request
  - refreshes export history

### `/app/admin/reimbursements`

Components and click behavior:

- reimbursement row:
  - opens detail
- selectable row checkbox:
  - marks expense for batch operation
- `Create Batch` button:
  - submits selected reimbursement batch
  - refreshes list

### `/app/admin/analytics`

Components and click behavior:

- date range controls:
  - refetch analytics
- filter controls:
  - refetch overview and spend patterns
- chart segment or category item:
  - may drill into filtered data if implemented

Every clickable element should have one clear purpose and one predictable result.

---

## 9. Connection Verification Rules

This section exists so an implementation model can verify that the frontend is wired correctly.

### Navigation Verification

The model should verify:

- login success routes into `/app`
- signup success routes into `/app`
- sidebar items route to the correct page
- clicking an expense row opens the correct expense detail
- clicking an approval row opens the correct review screen
- role-restricted nav items are hidden or disabled appropriately

### Session Verification

The model should verify:

- session bootstrap runs before protected pages render fully
- logout clears session and returns to `/login`
- route guards react correctly when `auth/me` fails

### Expense Submission Verification

The model should verify:

- uploading a receipt stores a real `receipt_id`
- OCR polling uses the correct receipt identifier
- included and excluded line items affect displayed totals correctly
- mismatch confirmation is required when totals do not align
- submit sends canonical backend field names
- successful submit routes to the correct next view

### Approval Verification

The model should verify:

- approve calls the approve endpoint for the correct expense
- reject calls the reject endpoint and includes comment
- hold calls the hold endpoint and includes comment
- resume is shown only when allowed
- successful action refreshes both detail and queue state

### Admin Verification

The model should verify:

- user save refreshes the user list
- manager assignment changes persist and re-render correctly
- policy save preserves steps and rules as configured
- policy preview calls the preview endpoint with the correct policy
- compliance export creation refreshes export history
- reimbursement batch creation refreshes reimbursement state

### Polling Verification

The model should verify:

- OCR screens poll until terminal OCR state
- expense detail polling updates timeline and status
- approval queue polling updates actionable rows
- reimbursements polling updates status progression
- polling stops on unmount

### Data Contract Verification

The model should verify:

- money values are treated as decimal strings, not floats
- unknown enum values render safe fallback labels
- transport models use canonical backend field names
- UI mapping happens after decoding, not before

---

## 10. Screen Completion Checklists

Each major screen should be considered incomplete until all of these are true.

### Checklist for Any List Screen

- real backend fetch implemented
- loading state exists
- empty state exists
- error state exists
- pagination works
- filters work
- row click works
- refresh behavior is correct

### Checklist for Any Form Screen

- required fields validated
- backend field names preserved
- submission loading state exists
- submission error state exists
- cancel behavior is clear
- success path is clear

### Checklist for Any Detail Screen

- record loads from route ID
- loading and error states exist
- core summary fields render
- timeline or history renders where required
- action area is present only when allowed
- polling works if screen depends on live state

### Checklist for Any Action Button

- button is visible only when valid
- disabled state is correct
- payload is correct
- success feedback is clear
- related views refresh after action

---

## 11. Information Architecture by Role

The frontend should be organized around what each role needs to accomplish most often.

### Employee Navigation

Primary sections:

- expenses
- new expense
- expense detail

Employee-first priorities:

- submit quickly
- understand OCR output
- track status
- understand comments and reimbursement progress

### Manager Navigation

Primary sections:

- approvals queue
- expense review
- team visibility where allowed

Manager-first priorities:

- triage quickly
- understand workflow context fast
- act confidently
- avoid accidental mistakes on hold or reject actions

### Admin Navigation

Primary sections:

- users
- manager assignments
- approval policies
- budgets
- reimbursements
- audit
- analytics

Admin-first priorities:

- configure rules safely
- understand company-wide state
- operate reimbursements
- inspect and export audit data

The IA should reflect usage frequency and operational importance, not just feature count.

---

## 8. App Shell and Shared UI

The frontend needs a shared application shell with:

- top-level session bootstrap
- role-aware sidebar or navigation
- route guards
- company context display
- current user context
- global loading and error states

Shared UI primitives should include:

- page headers
- tables
- filters
- pagination controls
- search inputs
- status badges
- money display components
- date/time display helpers
- comments panels
- audit/event timeline
- modal or drawer patterns for confirmation actions
- empty states
- inline form validation
- upload dropzone or file picker
- segmented controls and tabs where density requires them
- metric tiles for dashboards
- diff or before-after views where audit detail benefits from comparison
- skeleton loading states for lists, dashboards, and detail panes

Important shared display patterns:

- monetary values must show original and company-currency values when relevant
- statuses must be clearly color-coded and text-labeled
- timelines must show action, actor, timestamp, and comment
- warnings from OCR or policy evaluation must be visually distinct
- the shell and navigation should establish a recognizable visual identity instead of looking like a stock admin template

Component system expectations from the agency guidance:

- reusable components must be defined before screen-by-screen customization
- accessibility must be built into primitives, not patched later
- component states must include loading, empty, error, disabled, hover, focus, and success where relevant
- dense operational views should share one coherent table and filter language

---

## 9. Authentication and Session Experience

The frontend must support:

- signup
- login
- session bootstrap from `GET /api/v1/auth/me`
- logout

### Signup

Signup should capture:

- company name
- country code
- admin name
- admin email
- password

The signup flow must explain that the first signup creates:

- the company
- the first admin user

### Login

Login should support:

- email/password entry
- loading state
- authentication error handling
- redirect into the app shell after success

### Session Bootstrap

On app load, the frontend should request the current authenticated user and store:

- user
- role
- company
- permissions

This session data drives:

- visible routes
- visible actions
- empty-state messaging
- protected screens
- role-specific navigation tone and emphasis

---

## 10. Role-Based Frontend Experience

### Admin Experience

Admin UI must include:

- user management
- manager assignment management
- approval policy configuration
- full company expense oversight
- budgets
- audit logs
- compliance export history and creation
- reimbursements
- analytics and spend patterns

Admin actions include:

- create, edit, and delete users
- assign or change roles
- define manager relationships
- configure approval sequences
- configure conditional approval rules
- inspect company-wide expenses and logs
- create budgets
- trigger compliance exports
- create reimbursement batches

### Manager Experience

Manager UI must include:

- approval queue
- expense detail review
- workflow history
- comments
- trigger evaluation visibility
- subordinate spend context
- budget visibility where permitted

Manager actions include:

- approve
- reject
- hold
- resume if permitted
- comment on decisions

### Employee Experience

Employee UI must include:

- expense history
- new expense submission
- receipt upload
- OCR review
- line-item editing
- expense detail timeline
- reimbursement visibility

Employee actions include:

- create an expense
- upload a receipt
- review extracted fields
- edit extracted values
- include or exclude extracted lines
- submit the final expense
- track status and approver comments

---

## 11. Experience Design by Surface

To keep the interface distinctive and coherent, different frontend surfaces should have different visual emphasis.

### Auth Screens

Auth should make the strongest first impression.

It should feel:

- branded
- confident
- high-trust
- intentional

Good places for stronger visual design:

- typography
- background treatment
- spatial composition
- motion on first load

### Employee Flows

Employee surfaces should feel:

- clear
- calm
- guided
- reassuring

The design emphasis here is:

- form clarity
- OCR guidance
- line-item editability
- visible progress and status

### Manager Approval Flows

Manager surfaces should feel:

- decisive
- focused
- operational

The design emphasis here is:

- queue scannability
- detail review confidence
- strong action hierarchy
- visible workflow consequences

### Admin Operations Surfaces

Admin surfaces should feel:

- powerful
- structured
- information-rich

The design emphasis here is:

- data density with good hierarchy
- readable tables and filters
- durable navigation patterns
- clear segmentation between configuration and operations

---

## 12. Developer-Ready Design Foundation

To make implementation easier and more consistent, the frontend should define these foundations up front.

### Layout Foundation

Recommended layout system:

- mobile-first
- constrained content widths
- reusable page container
- reusable two-column detail layout for dense review screens
- reusable dashboard grid
- reusable table-with-filters pattern

Suggested container behavior:

- mobile: full width with sensible horizontal padding
- tablet: centered constrained layout
- desktop: wider operational layout with persistent navigation
- large desktop: expanded but still bounded reading widths for forms and detail views

### Component Hierarchy

Suggested build order:

1. tokens
2. typography and base surfaces
3. buttons, inputs, selects, textareas
4. badges, alerts, empty states, skeletons
5. layout primitives
6. tables, filters, pagination, drawers, modals
7. domain components for expenses, approvals, OCR, audit, and reimbursements

### Theme Strategy

If theming is added, it should be systematic.

Recommended approach:

- light theme first
- optional dark theme only if it stays equally legible for financial workflows
- never allow theme choices to reduce status clarity or data readability

---

## 13. Employee Expense Frontend

---

## 10. Employee Expense Frontend

This is one of the largest frontend surfaces.

### Expense History Screen

The employee expense list should show:

- expense category
- description
- expense date
- original amount and currency
- company-currency amount
- current status
- reimbursement status
- submission date

History should support:

- filtering by status
- search
- pagination
- sorting

Important employee-visible statuses:

- `submitted`
- `pending_approval`
- `on_hold`
- `approved`
- `rejected`
- `reimbursed`

If draft mode is introduced later, `draft` must be tolerated safely.

### New Expense Screen

The manual expense form must capture:

- amount
- currency
- category
- description
- expense date
- optional receipt

It must support:

- field validation
- submit loading state
- blocking duplicate submits
- clear error messaging

### Receipt Upload Flow

The receipt upload experience must support:

- file picker or drag and drop
- multipart upload
- file type validation
- upload progress or pending indicator
- OCR processing state

Accepted file types:

- `image/jpeg`
- `image/png`
- `application/pdf` if enabled

### OCR Review Experience

Once OCR completes, the frontend should show:

- extracted bill summary
- merchant name
- expense date
- currency
- total amount
- description hint
- extracted line items
- confidence information where available
- warnings returned by OCR

The OCR review UI must make it obvious that extracted data is only a suggestion.

The user must be able to:

- edit bill-level fields
- edit line item fields
- include or exclude extracted lines
- remove extracted lines before submit
- confirm mismatches explicitly

### Line Item Editing

For each extracted line, the frontend should support:

- name or label editing
- amount editing
- category editing
- quantity display where available
- included toggle

The frontend must recalculate and display:

- extracted total
- included total
- mismatch amount if totals differ

If included total and extracted total do not match, the frontend must:

- show the difference clearly
- require explicit confirmation before submission

### Expense Detail Screen

The employee expense detail page should show:

- summary fields
- receipt info
- included and excluded lines
- workflow status
- approval timeline
- comments from approvers
- reimbursement section

This page should poll for updated status and timeline changes.

---

## 14. Approval Frontend

This is the core manager-facing workflow UI.

### Approval Queue

The approvals list must show:

- employee name
- category
- status
- original amount and currency
- company-currency amount
- submitted timestamp
- current step sequence
- trigger evaluation summary

The queue should support:

- filtering
- search
- sorting
- pagination
- polling refresh

### Expense Review Screen for Approvers

Approvers need a detailed review screen with:

- submitter information
- category and description
- original amount and converted amount
- receipt preview or metadata
- extracted bill summary if available
- included and excluded lines
- current workflow step
- prior approval actions
- comments history
- trigger evaluation details

### Approval Actions

The frontend must support these actions:

- approve
- reject
- hold
- resume

Action UX rules:

- reject requires comment
- hold requires comment
- approve should allow comment
- resume must only appear when permitted
- disabled states must reflect permission or workflow restrictions

The UI must make it visible when:

- an expense is on hold
- the current user cannot act
- trigger conditions passed
- trigger conditions failed
- a rejection ended the workflow

---

## 15. Admin Configuration Frontend

### User Management

The admin users screen should include:

- list of users
- user detail or edit form
- role display
- active state
- manager relationship summary

Admin must be able to:

- create user
- edit user
- delete user
- activate or deactivate if supported by backend
- change role

### Manager Assignment Management

This area should let admin:

- view employee-manager relationships
- create assignment
- update assignment

The UI should make reporting hierarchy obvious and avoid ambiguous manager selection.

### Approval Policy Configuration

This screen is critical. It should allow admin to configure:

- policy name
- whether manager approver is enabled
- sequential approval steps
- conditional rules
- boolean operator logic

The UI must support rule types:

- `sequential`
- `percentage`
- `specific_approver`
- `combined`

The UI should show:

- step order
- approver type
- approver role label
- specific approver selection where relevant
- percentage threshold where relevant
- operator choice of `AND` or `OR`

The admin should also be able to preview policy behavior where the backend exposes preview support.

---

## 16. Budget, Reimbursement, Audit, and Analytics Frontend

### Budgets

The budgets area should let admin:

- view configured budgets
- create budgets
- inspect spend against targets
- see variance or threshold pressure

Budget views should be easy to scan and tie back to:

- department
- category
- period

### Reimbursements

The reimbursements area should show:

- reimbursement status
- reimbursement amount
- payout currency
- payout timestamp
- batch information where available

The admin or finance experience must support:

- viewing reimbursement-ready expenses
- creating reimbursement batches
- monitoring batched or paid states

Canonical reimbursement statuses:

- `not_ready`
- `ready`
- `batched`
- `paid`

### Audit Logs

The audit view should expose immutable action history with:

- actor
- action type
- timestamp
- affected entity
- before and after details where relevant
- compliance note where available

The audit stream should support:

- filtering
- search
- pagination
- readable event detail expansion

### Compliance Exports

The compliance export UI should support:

- viewing export history
- creating new exports
- downloading generated files when available

### Analytics

The analytics section should include:

- overview metrics
- spend by category
- spend by department
- spend by period
- individual-level analysis
- spend pattern or anomaly highlighting

These views should emphasize legibility over decoration.

---

## 17. Motion, Visual Detail, and Atmosphere

The frontend should use motion and detail intentionally.

Recommended motion usage:

- staggered page-entry reveals
- smooth state transitions after approval actions
- clear upload and OCR processing transitions
- subtle hover responses on actionable items
- visible but restrained success and error confirmations

Recommended visual detail usage:

- soft grain or texture overlays where appropriate
- layered panels and subtle depth
- refined borders and dividers
- meaningful accent colors
- visual treatment for warning and mismatch states

Motion and atmosphere should enhance trust and memorability, not distract from the workflow.

---

## 18. Performance and Quality Standards

Agency-driven frontend quality standards:

- mobile-first responsive behavior
- WCAG AA baseline
- keyboard-operable core flows
- no critical console errors
- strong loading-state coverage
- no layout collapse on long names, comments, or amounts
- stable rendering for large operational lists

Performance expectations:

- code splitting at route or major feature boundaries
- lazy loading for heavy admin and analytics surfaces
- optimized receipt previews and image rendering
- centralized polling to avoid redundant request storms
- avoid expensive re-renders in tables and detail views

Implementation quality expectations:

- shared TypeScript contracts for all API transport models
- strong separation between API models and UI view models
- reusable component patterns instead of page-specific one-offs
- deterministic validation and action feedback

---

## 19. Statuses, Enums, and Labels the Frontend Must Support

### Roles

- `admin`
- `manager`
- `employee`

### Expense Statuses

- `draft` if introduced later
- `submitted`
- `pending_approval`
- `on_hold`
- `approved`
- `rejected`
- `reimbursed`

### Approval Actions

- `approve`
- `reject`
- `hold`
- `resume`

### Reimbursement Statuses

- `not_ready`
- `ready`
- `batched`
- `paid`

### Rule Types

- `sequential`
- `percentage`
- `specific_approver`
- `combined`

The frontend must gracefully display unknown future enum values instead of crashing.

---

## 20. Frontend Data and API Expectations

The frontend must be designed around these backend patterns:

- JSON API responses for normal endpoints
- multipart upload for receipt creation
- standard list response envelope
- standard single-resource response envelope
- standard error envelope
- ISO 8601 UTC timestamps
- UUID identifiers
- decimal strings for money values

Important frontend integration rules:

- do not use floating-point assumptions for money
- do not hardcode fake workflow or OCR states
- do not scatter API calls directly inside arbitrary components
- keep receipt upload, OCR polling, approvals, analytics, and reimbursements inside a shared API layer

Primary frontend-compatible endpoints include:

- auth and session endpoints
- user endpoints
- manager assignment endpoints
- approval policy endpoints
- reference data endpoints
- expense endpoints
- receipt and OCR endpoints
- approval queue and action endpoints
- audit endpoints
- budget endpoints
- reimbursement endpoints
- analytics endpoints
- health and capability endpoints

---

## 21. Polling and Live Update Behavior

Realtime behavior in v1 is polling-based.

Polling should be centralized and configurable.

Frontend polling targets:

- approval queue
- expense detail timeline
- employee expense history
- reimbursements
- OCR processing state

The polling system should:

- avoid duplicate overlapping requests
- stop when a screen unmounts
- respect terminal states when appropriate
- refresh lists and details predictably

---

## 22. Validation and Error Handling

The frontend must show clear validation and operational feedback for:

- missing required form fields
- invalid receipt file types
- upload failures
- OCR processing failures
- low-confidence OCR results
- included-total mismatch
- exchange-rate unavailable errors
- forbidden actions
- stale or no-longer-allowed approval actions

Error handling should separate:

- field-level validation
- action failure
- permission denial
- network failure
- backend business-rule rejection

---

## 23. Accessibility and Usability Expectations

The frontend should be production-quality and accessible.

That means at minimum:

- keyboard-accessible forms and actions
- visible focus states
- readable error messages
- clear status labeling
- strong contrast for status and warning states
- obvious loading and pending states
- no workflow ambiguity for end users
- semantic structure for tables, lists, forms, and dialogs
- screen-reader-friendly labels for upload, OCR warnings, and approval actions
- reduced-motion respect where animations are used

Workflow-heavy screens should prioritize clarity:

- employees should always know current expense state
- managers should always know whether they can act
- admins should always know what configuration they are changing

---

## 24. Suggested Frontend File or Module Areas

A clean frontend implementation will likely need modules for:

- app shell and navigation
- auth and session
- route guards
- typed API client
- reference data fetching
- expense flows
- OCR flows
- approvals
- admin configuration
- budgets
- reimbursements
- analytics
- audit and exports
- design tokens and theme configuration
- shared layout system
- shared UI primitives
- validation and formatting helpers
- polling utilities

This is not a required folder structure. It is the frontend capability map that needs to exist somewhere in the implementation.

---

## 25. Definition of a Complete Frontend

The frontend is complete when:

- a real admin can sign up and bootstrap a company
- a real employee can submit an expense manually or from receipt upload
- OCR review and line inclusion work before final submission
- a real manager can review and act on approvals
- approval history and comments are legible
- admins can manage users, reporting hierarchy, and approval policies
- admins can inspect budgets, reimbursements, audit logs, and analytics
- polling keeps workflow state current without confusion
- the app works against the documented backend contracts without renegotiating data shapes
- the UI feels distinctive, intentional, and production-grade rather than generic

In short, the frontend is not just a set of pages. It is the full role-aware operating surface for a reimbursement workflow system with OCR-assisted intake, approval orchestration, reimbursement tracking, and operational reporting.
