# TEAM_DEBS
<div align="center">

# 🧾 Reimbursement Management System

[![Status](https://img.shields.io/badge/Status-In%20Development-blue.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)]()

*A policy-driven reimbursement system featuring dynamic workflow routing, receipt intelligence, and multi-currency handling.*

</div>

## 📖 Table of Contents
- [About the Project](#about-the-project)
- [Key Features](#key-features)
- [User Roles](#user-roles)
- [Core Architecture](#core-architecture)
- [Getting Started](#getting-started)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## 🚀 About the Project

The **Reimbursement Management System** is a comprehensive company expense workflow product designed to eliminate manual, error-prone, and opaque reimbursement processes. 

It enables employees to submit expenses seamlessly, empowers managers to review and act on them through structured approval workflows, and allows administrators to monitor budgets, reimbursements, and audit histories. The system acts as a robust policy engine that sits on top of validated expense data, supporting conditional logic, multi-currency models, and OCR-capable document extraction.

---

## ✨ Key Features

### 🏢 Organization & Access
- **Company Tenancy**: Seamless bootstrap upon initial signup linking standard operations to a root company tenant.
- **Granular RBAC**: Explicit separation between Admin, Manager, and Employee surfaces to protect sensitive expense flows dynamically.
- **Reporting Hierarchy**: Flexible manager-employee relationship definitions.

### 💳 Expense & Receipt Intelligence
- **Intelligent Pre-filling**: A dedicated OCR and LLM-assisted document pipeline for auto-populating receipts with extracted merchant names, line-items, taxes, and totals.
- **Line-Item Customization**: Editable extraction fields where employees explicitly select whether to include/exclude scanned line items.
- **Multi-Currency Normalization**: Automatic fetch of conversion rates at submission time locking the converted amount accurately into the company's default currency.

### 🔀 Policy Engine & Dynamic Workflows
- **Visual Policy Builder**: UI capability for administrators to compose complex custom routing structures graphically.
- **Sequential Approvals**: Multi-tier hierarchy chains enforcing structured approval order (e.g., *Manager* -> *Finance* -> *Director*).
- **Conditional Triggers**: Complex routing logics including `Percentage thresholds` (e.g., 2 of 3 managers), `Specific Roles` (e.g., CFO), and compounded `AND/OR` directives.

---

## 👥 User Roles

| Role | Key Capabilities |
| :--- | :--- |
| 🛡️ **Admin** | Manages company setup, configures sequential and conditional approval workflows *(via visual policy builder)*, manages users, and tracks company-wide audits and budgets. |
| 👔 **Manager** | Reviews assigned workflow item queues, acts on expenses *(Approve, Reject, Hold)*, requests changes, provides comments, and monitors subordinate expense trends. |
| 👨‍💻 **Employee** | Uploads receipts for OCR pre-filling, submits expense claims in various currencies, and tracks approval/reimbursement progression real-time. |

---

## 🏗️ Core Architecture

This system is built as a layered application enforcing clean separation of concerns:
1.  **AI / OCR Extraction Layer**: Image Ingestion ➡️ Text Extraction ➡️ LLM Document Interpretation ➡️ Result Regex Validation.
2.  **Domain Layer**: Handles the financial models tracking original amounts and locked converted amounts alongside currency exchange statuses.
3.  **Approval / Policy Engine Layer**: Evaluates live boolean expressions for transition outcomes continuously evaluating sequence completion against edge-case conditions dynamically evaluated at request time.
4.  **Authorization Layer**: High compliance RBAC and tenancy middleware securing all data end-to-end.

---

## 🏁 Getting Started

*(Wait for initial repository initialization. The following steps are placeholders pending actual source code availability.)*

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- API Keys: 
  - RestCountries API *(for Country setup)*
  - ExchangeRate API *(for local conversions)*

### Installation
1. Clone the repo
   ```sh
   git clone https://github.com/your-username/reimbursement-management-system.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Set up environment variables locally using `.env.example`.
4. Run migrations and start the dev server
   ```sh
   npm run dev
   ```

---

## 🗺️ Roadmap

- [x] Phase 1 - Product Ideation and Build Spec
- [x] Phase 2 - Company Tenancy & Auth Bootstrap
- [x] Phase 3 - Expense Submission & RBAC Enforcement
- [x] Phase 4 - Implementation of Sequential Approval Engine
- [x] Phase 5 - Integration of Conditional Workflow Triggers
- [x] Phase 6 - AI/OCR Pipeline Launch

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
