# Oodo Frontend Design System

## Product Frame

Oodo is not a generic expense tracker. It is a policy-driven reimbursement command center where employees submit receipts, managers resolve decisions, and admins audit the financial workflow. The interface should feel controlled, exact, and operational.

## Aesthetic Direction

The design direction is **Editorial Control Room**.

- Base mood: premium finance operations desk, not startup SaaS softness
- Visual blend: printed ledger, operations console, compliance dossier
- Theme: light-first with deep carbon utility panels and sharp signal accents
- Memory hook: a persistent workflow ribbon that makes state progression visible at a glance

## Visual Principles

- Use bold serif typography for section identity and a disciplined sans-serif for controls and tables.
- Keep layouts asymmetrical where it helps hierarchy, but maintain strict data legibility.
- Make workflow state, policy evaluation, and auditability the visual center of gravity.
- Prefer dense, high-value information blocks over oversized empty cards.
- Use texture, ruled lines, and layered panels to create atmosphere without reducing clarity.

## Typography

- Display: `Fraunces`
- Body/UI: `IBM Plex Sans`
- Mono/data: `IBM Plex Mono`

Why:

- `Fraunces` gives authority and editorial character.
- `IBM Plex Sans` and `IBM Plex Mono` keep dense operational UI precise and readable.

## Color System

```txt
Paper: #f6f1e8
Paper deep: #e8dece
Ink: #171717
Carbon: #20242b
Carbon soft: #2b3038
Rule line: #c3b8a5
Gold accent: #b98532
Signal red: #b5473c
Signal amber: #d1992f
Signal green: #2c7a62
Signal blue: #2f5fa7
```

Usage:

- Warm paper is the primary canvas.
- Carbon panels are reserved for navigation, summary strips, and critical action zones.
- Signal colors are semantic and should stay concentrated.
- Gold is for guidance, metrics emphasis, and premium framing rather than status.

## Motion

- Initial page reveal should stagger key modules into place.
- Workflow ribbons and status markers should animate with restrained directional movement.
- Hover states should feel mechanical and precise, not floaty.

## Components

- App shell with fixed left rail and top operations strip
- Workflow ribbon badges for cross-screen state continuity
- Dossier cards for expenses, users, policies, and audits
- Ledger tables with strong headers, subtle ruled dividers, and sticky utility bars
- Timeline modules styled like annotated case files
- Signal panels for hold, reject, reimburse, and export actions

## Screen Strategy

- Admin areas should feel like configuration and oversight desks.
- Manager views should prioritize queue speed, risk signals, and decision confidence.
- Employee views should feel slightly calmer while preserving the same visual language.
- OCR review must clearly separate extracted values, confidence, and included totals.

## Accessibility

- Maintain strong contrast on all status colors.
- Avoid color-only status indication; pair with labels and shape/border cues.
- Preserve keyboard focus visibility with strong outlined focus rings.
- Keep motion subtle and short enough to avoid operational drag.
