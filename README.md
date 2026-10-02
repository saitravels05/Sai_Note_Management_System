# AI-Powered Notes, Data & Month-End Accounting Management System

A production-oriented business accounting, notes, CRM, reporting, document-management, and AI-assisted financial management application.

The system is designed to help businesses manage daily financial records, income, expenses, customers, suppliers, receivables, payables, payments, documents, Excel imports/exports, PDF reports, month-end closing, audit history, and AI-powered data queries from one application.

> **Important:** The AI assistant is an interpretation and query layer. The accounting engine remains the authoritative source for financial calculations.

---

## 📌 Project Overview

Traditional spreadsheets can become difficult to manage as business data grows.

This application provides a structured alternative combining:

- Smart business notes
- Accounting records
- Income & expense management
- Customer and supplier management
- Receivables & payables
- Payment tracking
- Excel/CSV import and export
- PDF reporting
- Month-end closing
- AI-powered search and filters
- Document management
- Custom reports
- Audit logs
- Backup and recovery architecture
- Role-based access control

The primary interface is designed to be more user-friendly than a traditional spreadsheet while still supporting detailed financial reporting and data exports.

---

# ✨ Core Features

## 📊 Dashboard

Business overview with:

- Total income
- Total expenses
- Net result
- Money received
- Money paid
- Outstanding receivables
- Outstanding payables
- Transaction counts
- Recent activity
- Monthly comparisons
- Charts and analytics

---

## 📝 Smart Records & Notes

Create and manage:

- Income
- Expenses
- Payments
- Receivables
- Payables
- General notes
- Business records

Records can include:

- Date
- Customer/Supplier
- Category
- Description
- Amount
- Payment method
- Due date
- Status
- Tags
- Notes
- Attachments

---

# 💰 Accounting Engine

The application includes a dedicated accounting service responsible for authoritative financial calculations.

It separates:

### Recognized Financial Result

```text
Net Result = Recognized Income - Recognized Expenses
```

from:

### Cash Movement

```text
Cash Movement = Money Received - Money Paid
```

This prevents cash collections from being incorrectly treated as additional income.

The accounting engine supports:

- Income
- Expenses
- Opening balances
- Closing balances
- Receivables
- Payables
- Payments
- Payment allocations
- Partial payments
- Full payments
- Outstanding balances
- Customer ledgers
- Supplier ledgers
- Payment-method summaries
- Category summaries
- Period-based reporting

Decimal-safe financial calculations should be used throughout the system.

---

# 💳 Payments & Allocations

Payments can be allocated against receivables and payables.

Example:

```text
Customer Receivable: ₹50,000
Payment Received:    ₹20,000
Outstanding:         ₹30,000
Status:              PARTIALLY_PAID
```

When the remaining ₹30,000 is received:

```text
Outstanding: ₹0
Status:      PAID
```

The system is designed to prevent double counting between recognized financial activity and payment settlement.

---

# 👥 Customer Management

Customer profiles can include:

- Contact information
- Transactions
- Receivables
- Payments
- Outstanding balance
- Ledger
- Follow-ups
- Promises
- Documents
- Notes
- Activity history

---

# 🏢 Supplier Management

Supplier profiles provide similar functionality for:

- Expenses
- Payables
- Payments
- Outstanding amounts
- Supplier ledger
- Follow-ups
- Documents
- Notes

---

# 📞 CRM & Follow-Ups

The CRM layer supports:

- Customer follow-ups
- Supplier follow-ups
- Due dates
- Assignments
- Follow-up status
- Internal notes
- Promises to pay
- Follow-up history

### Important Accounting Rule

A promise to pay does **not** modify the financial outstanding balance.

Likewise, marking a follow-up as:

```text
Payment Received
```

does not create an accounting payment automatically.

A real payment must be recorded through the payment workflow.

---

# 📥 Excel / CSV Import

Import business data from:

- `.xlsx`
- `.xls` where supported
- `.csv`

The import workflow supports:

```text
Upload
   ↓
Detect Sheet / Headers
   ↓
Map Columns
   ↓
Validate
   ↓
Preview
   ↓
Review Errors / Duplicates
   ↓
Confirm
   ↓
Commit
```

Validation can detect:

- Missing dates
- Invalid amounts
- Missing required fields
- Duplicate records
- Invalid categories
- Date-format problems
- Number-format problems
- Closed-period conflicts

Import preview should not create financial records until the user confirms the import.

---

# 📤 Excel / CSV Export

Reports and accounting data can be exported to Excel/CSV.

Typical Excel worksheets may include:

- Summary
- Income
- Expenses
- Transactions
- Receivables
- Payables
- Customer Summary
- Supplier Summary
- Category Summary
- Payment Summary
- Monthly Analysis

Exports support structured formatting, totals, filters, and Unicode/Tamil data where configured.

---

# 📄 PDF Reporting

The reporting engine supports professional PDF generation for:

- Financial summaries
- Income reports
- Expense reports
- Receivable reports
- Payable reports
- Customer ledgers
- Supplier ledgers
- Month-end reports
- Custom management reports

Reports can include:

- Business information
- Reporting period
- Financial summary
- Tables
- Charts
- Page numbers
- Generated timestamp

---

# 📅 Month-End Closing

The application provides a formal month-end workflow:

```text
Review
   ↓
Validate
   ↓
Reconcile
   ↓
Preview
   ↓
Resolve Warnings
   ↓
Confirm
   ↓
Create Snapshot
   ↓
Close
   ↓
Lock
   ↓
Generate Final Reports
```

Month-end snapshots preserve historical financial state.

---

## Current vs As-Closed

The application distinguishes between:

### Current

The live financial position today.

### As-Closed

The historical financial position when a month was closed.

Example:

```text
September Receivable: ₹50,000
September Payment:    ₹20,000

September As-Closed Outstanding:
₹30,000
```

If the customer pays the remaining ₹30,000 in October:

```text
Current Outstanding:
₹0

September As-Closed Outstanding:
₹30,000
```

Historical snapshots remain unchanged.

---

# 🤖 AI Accounting Assistant

The application includes an AI-assisted natural-language interface.

Example questions:

```text
Show September expenses.
```

```text
Show unpaid customers.
```

```text
Show UPI payments above ₹10,000.
```

```text
Compare this month with last month.
```

Tamil and mixed-language queries can also be supported.

Example:

```text
இந்த மாத செலவு எவ்வளவு?
```

---

## AI Safety Architecture

The AI does **not** receive unrestricted database access.

Architecture:

```text
User
 ↓
Authentication
 ↓
Business Context
 ↓
Permission Validation
 ↓
AI Intent Detection
 ↓
Structured Request
 ↓
Schema Validation
 ↓
Authorized Service
 ↓
Accounting / Reporting Engine
 ↓
Verified Result
 ↓
AI Explanation
```

The following architecture is intentionally prohibited:

```text
AI → Raw SQL → Database
```

The AI assistant must not independently invent authoritative financial figures.

---

# 🔎 Advanced Search & Filters

Search can include:

- Customer
- Supplier
- Phone
- Reference
- Description
- Notes
- Amount
- Date
- Category
- Tags
- Document metadata

Advanced filters and saved filters can be used for frequently accessed views.

---

# 📊 Advanced Report Builder

The application supports custom reporting using controlled datasets.

Users can configure:

- Dataset
- Period
- Filters
- Columns
- Grouping
- Aggregations
- Sorting
- Comparisons
- Charts

Example:

```text
Dataset: Expenses
Period: September 2026
Group By: Category
Measure: Recognized Expenses
Sort: Highest First
Chart: Bar
```

Users cannot submit arbitrary SQL through the report builder.

---

# 📈 Report Reconciliation

For the same reporting scope and accounting basis, authoritative values should reconcile across:

```text
Accounting Engine
      ↓
Dashboard
      ↓
Custom Report
      ↓
Excel
      ↓
PDF
```

Drill-down records should also reconcile with grouped totals.

---

# 📁 Secure Document Management

The application includes a private business document vault.

Documents can be linked to:

- Customers
- Suppliers
- Transactions
- Payments
- Receivables
- Payables
- Follow-Ups
- Notes
- Imports
- Reports

Supported file types can include:

- PDF
- XLSX
- XLS
- CSV
- PNG
- JPG/JPEG
- WEBP
- TXT
- DOCX

depending on deployment configuration.

---

## Document Security

The document architecture supports:

- Private object storage
- Server-authorized access
- Signed temporary URLs
- MIME validation
- File-signature validation
- File-size limits
- Duplicate detection
- SHA-256 checksums
- Version history
- Sensitive-document permissions
- Audit history
- Quarantine architecture

Uploaded document content is treated as untrusted data.

---

# 🔐 Authentication & Authorization

The application supports role-based access control.

Example roles:

| Role | Purpose |
|---|---|
| Owner | Full business administration |
| Admin | Administrative operations |
| Accountant | Accounting and financial workflows |
| Staff | Day-to-day authorized operations |
| Viewer | Read-only access |

Actual capabilities are controlled through permissions rather than role names alone.

---

# 🏢 Multi-Tenant Architecture

The application is designed to support multiple businesses while maintaining strict data isolation.

A user from:

```text
Business A
```

must never be able to access:

```text
Business B
```

data without explicit authorization.

Tenant isolation applies to:

- Customers
- Suppliers
- Transactions
- Payments
- Receivables
- Payables
- Documents
- Reports
- Imports
- Audit
- AI queries

and other business-scoped resources.

---

# 🛡️ Security

The application architecture includes protections for:

- Authentication
- Authorization
- Tenant isolation
- SQL injection
- XSS
- CSRF where applicable
- IDOR/BOLA
- File upload abuse
- Path traversal
- Rate limiting
- Secret leakage
- Error leakage
- AI prompt injection
- Spreadsheet formula injection

Security must be enforced on the server, not only through hidden UI controls.

---

# 📜 Audit Logs

Important actions can be recorded in an append-oriented audit history.

Examples:

- Transaction creation
- Transaction changes
- Payments
- Allocations
- Voids
- Imports
- Exports
- Month-End close
- Month-End reopen
- User/permission changes
- AI queries
- Document activity
- Report generation
- Backup/restore operations

Sensitive secrets must never be stored in audit records.

---

# 💾 Backup & Disaster Recovery

The production architecture includes support for backup and recovery planning covering:

- PostgreSQL database
- Object storage
- Critical configuration
- Migration history
- Important metadata

A backup should not be considered verified merely because creation succeeded.

A reliable process includes:

```text
Backup
 ↓
Integrity Verification
 ↓
Isolated Restore
 ↓
Database Verification
 ↓
Accounting Reconciliation
 ↓
Month-End Verification
 ↓
Document Verification
 ↓
Audit Verification
```

---

# 🧪 Automated Testing

The project is designed for layered automated testing.

Recommended stack for the current Next.js/TypeScript architecture:

- Vitest or the project's existing unit/integration framework
- Playwright for browser/E2E automation

Testing areas include:

- Unit tests
- Accounting tests
- Database integration
- API tests
- Authentication
- Authorization
- Tenant isolation
- Payments
- Receivables/payables
- Month-End
- Excel import/export
- PDF
- Documents
- AI security
- Reports
- Audit
- E2E
- Mobile/browser workflows

---

## Critical Accounting Regression

A mandatory regression scenario is:

```text
Receivable: ₹50,000
Payment:    ₹20,000
Outstanding: ₹30,000
Status: PARTIALLY_PAID
```

The automated suite should fail if the application returns a different result.

---

# 🚦 Deployment Quality Gate

Production deployment should stop when critical automated tests fail.

Critical blockers include:

- Incorrect financial calculations
- Cross-tenant access
- Authentication bypass
- Major permission bypass
- Double payment posting
- Closed-period modification
- Month-End snapshot corruption
- Private document exposure
- Production build failure

---

# 🛠️ Technology Stack

The exact versions should be checked in the repository.

The project architecture is designed around technologies such as:

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Accessible UI components

### Backend

- Next.js server-side architecture
- Server Actions / API services
- TypeScript

### Database

- PostgreSQL

### Authentication

- Secure provider-backed authentication
- RBAC / permission-based authorization

### Storage

- Private object storage

### AI

- Provider-independent AI service layer

### Reporting

- Excel / CSV
- Server-side PDF generation

### Testing

- Unit / Integration testing
- Playwright-style E2E testing

### Deployment

- Vercel-compatible web deployment
- PostgreSQL database
- Private storage
- Optional background workers where required

---

# 🗂️ Main Application Modules

Typical navigation includes:

```text
Dashboard
Quick Entry
Records
Income
Expenses
Receivables
Payables
Customers
Suppliers
Notes
Import Excel
Reports
Month-End
AI Assistant
Documents
Audit Log
Settings
```

---

# 🚀 Getting Started

## 1. Clone Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd <PROJECT_FOLDER>
```

---

## 2. Install Dependencies

Use the package manager represented by the repository lockfile.

For npm projects:

```bash
npm ci
```

For development where appropriate:

```bash
npm install
```

Do not switch package managers unnecessarily.

---

## 3. Environment Configuration

Copy the safe environment template:

```bash
cp .env.example .env.local
```

Configure the environment variables required by the actual project.

Typical categories include:

```text
Application URL
Database
Authentication
Object Storage
AI Provider
Email
Monitoring
Background Jobs
```

### ⚠️ Never commit secrets

Never commit:

```text
.env
.env.local
Database passwords
API keys
Authentication secrets
Storage credentials
Service-role keys
AI API keys
Access tokens
```

---

# 🗄️ Database Setup

Use the project's migration system.

Typical workflow:

```text
Configure PostgreSQL
        ↓
Verify Connection
        ↓
Run Migrations
        ↓
Verify Constraints / RLS
        ↓
Create Authorized Owner
```

Never use destructive database reset commands against production.

---

# ▶️ Development

Run the repository's development command.

For a typical npm/Next.js setup:

```bash
npm run dev
```

Then open the local application URL shown by the development server.

---

# 🧪 Testing

Use the scripts defined in `package.json`.

Recommended project commands include:

```bash
npm run test
npm run test:unit
npm run test:accounting
npm run test:integration
npm run test:security
npm run test:ai
npm run test:e2e
npm run test:critical
npm run test:all
```

Only commands that actually exist in the repository should be documented as active.

---

# 🏗️ Production Build

Before deployment:

```bash
npm run build
```

A successful build alone does **not** prove production readiness.

Critical accounting, security, tenant-isolation and E2E tests should also pass.

---

# 🌐 Production Deployment

The web application is designed to support deployment to a modern Next.js-compatible platform such as Vercel.

Recommended release flow:

```text
Code
 ↓
Type Check
 ↓
Lint
 ↓
Automated Tests
 ↓
Accounting Regression
 ↓
Security Tests
 ↓
Production Build
 ↓
Preview Deployment
 ↓
Preview E2E
 ↓
Production Deployment
 ↓
Live Verification
```

Production deployment should not contain demo financial records.

---

# 🔒 Production Checklist

Before production use verify:

- [ ] Production build passes
- [ ] Database migrations pass
- [ ] Authentication works
- [ ] Authorization works server-side
- [ ] Tenant isolation passes
- [ ] Accounting regression passes
- [ ] Payment allocation passes
- [ ] Month-End regression passes
- [ ] Excel import/export works
- [ ] PDF works
- [ ] Private document storage works
- [ ] AI permissions work
- [ ] Audit works
- [ ] Backup strategy is active
- [ ] Restore procedure is documented/tested
- [ ] HTTPS is enabled
- [ ] Production secrets are server-side
- [ ] No fake production financial data exists

---

# 🌏 Localization

Default business configuration can support:

```text
Currency: INR (₹)
Date Format: DD-MM-YYYY
Timezone: Asia/Kolkata
```

The application also supports Unicode data and can be used with Tamil business information where configured.

---

# 📖 Documentation

Operational documentation may be maintained under:

```text
docs/
```

Recommended documentation includes:

```text
admin-guide.md
accounting-operations.md
automated-testing.md
security-review.md
security-operations.md
threat-model.md
production-readiness.md
production-runbook.md
production-rollback.md
disaster-recovery.md
reporting-guide.md
ai-assistant-guide.md
document-management-guide.md
excel-import-guide.md
month-end-guide.md
roles-permissions-guide.md
support-maintenance.md
known-limitations.md
v1.0-signoff.md
v1.1-roadmap.md
```

---

# 🗺️ Development Roadmap

The V1.0 project was structured through the following phases:

| Phase | Module |
|---|---|
| 0 | Requirements & Architecture |
| 1 | Project Foundation |
| 2 | Database & Security Architecture |
| 3 | Authentication & User Roles |
| 4 | Smart Notes & Records |
| 5 | Accounting Engine |
| 6 | Dashboard & Analytics |
| 7 | Excel / CSV Import |
| 8 | Excel / CSV Export |
| 9 | PDF Reporting |
| 10 | Month-End Closing |
| 11 | AI Assistant |
| 12 | Customer / Supplier CRM |
| 13 | Document Management |
| 14 | Advanced Reports |
| 15 | Audit / Backup / Recovery |
| 16 | Testing & Security Hardening |
| 17 | Production Deployment |
| 18 | Final QA & V1.0 Handover |

---

# 🔮 Possible V1.1 Roadmap

Potential future enhancements may include:

- OCR for invoices and receipts
- AI document extraction
- Automated accounting draft suggestions
- Bank statement import
- Bank reconciliation
- Invoice generation
- GST-oriented enhancements
- Scheduled reports
- Notification center
- Email integrations
- WhatsApp integrations
- Advanced mobile/PWA functionality
- Additional analytics

These features should not be considered implemented unless they exist in the current repository.

---

# ⚠️ Important Financial Disclaimer

This software is intended to assist with internal business data and accounting workflows.

Financial calculations should be verified according to the organization's accounting practices.

The existence of tax-related fields or reports does not by itself establish compliance with GST, income-tax, statutory accounting, or other legal/regulatory requirements.

Consult an appropriate accountant, tax professional, or legal professional where required.

---

# 🔐 Security Disclosure

If you discover a security vulnerability, do not publish sensitive exploit details in a public GitHub issue.

Use the project's private security-reporting process where configured.

Never include:

- Credentials
- Customer data
- Database dumps
- API keys
- Private documents
- Access tokens

in public bug reports.

---

# 🤝 Contributing

Before submitting changes:

1. Create a dedicated branch.
2. Make the required changes.
3. Run type checking.
4. Run linting.
5. Run relevant automated tests.
6. Run critical accounting regression tests.
7. Verify tenant isolation for security-sensitive changes.
8. Run the production build.
9. Submit the change for review.

Financial or authorization logic should not be merged when critical regression tests fail.

---

# 📜 License

Add the project's actual license before public distribution.

For example, if the project is private/proprietary, do not automatically add an open-source license.

If an open-source license is intended, add the appropriate `LICENSE` file after confirming the licensing decision.

---

# 🏷️ Project Status

**Version:** V1.0  
**Status:** Production-oriented / deployment-ready subject to environment-specific verification  
**Primary Currency:** INR (₹)  
**Default Timezone:** Asia/Kolkata

---

# ⭐ Project Principle

> **AI helps understand the data. The accounting engine calculates the money.**

Financial integrity, security, auditability, tenant isolation, and recoverability are treated as core application requirements—not optional features.
