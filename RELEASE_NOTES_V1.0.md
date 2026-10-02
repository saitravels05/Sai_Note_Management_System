# Sai Tours & Travels — V1.0 Release Notes

**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**Release Tag / Identifier:** `v1.0.0-prod`  
**Semantic Version:** `1.0.0`  
**Target Environment:** Live Production  
**Primary Tenant:** Sai Tours & Travels (`sai-tours-travels`)  
**Release Date:** October 2026  

---

## 1. Executive Overview

Version 1.0 represents the first official enterprise production release of the **AI-Powered Notes, Data & Month-End Accounting Management System** built specifically for **Sai Tours & Travels**. 

This release delivers an auditable, multi-tenant financial accounting platform adhering to strict Indian Accounting Standards (Ind AS / Cash & Accrual dual reporting with Indian Rupee `INR / ₹` currency conventions). It replaces fragmented spreadsheets, manual registers, and ad-hoc physical ledgers with a unified, high-integrity cloud application featuring:
- A deterministic double-entry accounting engine with tamper-evident audit logging.
- Customer and supplier relationship management with structured collection follow-ups.
- Private document management with tenant-isolated cloud storage and time-limited signed URLs.
- Comprehensive financial reporting including standard balance sheets, P&L statements, customer/supplier aging ledgers, and an AST-based custom report builder.
- Deterministic PDF rendering and Excel export/import engines supporting Tamil Unicode typography (`Latha`, `Vijaya`, `Noto Sans Tamil`).
- An AI accounting assistant acting strictly as an explanation and query translation layer, with zero authority to alter financial ledgers.
- Rigorous month-end closing procedures with period locking and immutable snapshot versioning.
- Automated backup verification, disaster recovery runbooks, and defense-in-depth security hardening.

---

## 2. Core Implemented Features Summary

| Functional Area | Implemented Capabilities | Authoritative Service / Engine |
| :--- | :--- | :--- |
| **Authentication & RBAC** | Stateless JWT tokens in `HttpOnly; Secure; SameSite=Strict` cookies, Bcrypt password hashing (cost 12), server-side role validation. | `src/lib/auth.ts`, `src/lib/rbac.ts` |
| **Accounting Engine** | Double-entry journal entries, real-time balance calculations, cash/bank accounts, customer receivables, supplier payables, strict zero-sum balancing. | `src/services/accounting.service.ts` |
| **Smart Notes & Records** | Rich categorized operational notes, multi-currency display, entity linking, full-text search, and inline audit tagging. | `src/services/notes.service.ts` |
| **CRM & Collections** | Comprehensive directory of customers and suppliers, invoice tracking, promise-to-pay logging, call notes, and follow-up schedules. | `src/services/crm.service.ts` |
| **Document Vault** | Private encrypted storage, unguessable storage keys, ephemeral pre-signed access URLs, category-based permissions, document version history. | `src/services/document.service.ts` |
| **Month-End Closing** | Pre-close reconciliation validations, draft checks, immutable frozen snapshots, carry-forward balances, and audited reopening workflows. | `src/services/month-end.service.ts` |
| **Reporting Engine** | Standard Financial Statements (P&L, Balance Sheet, Trial Balance, Cash Flow), AST-based Custom Report Builder, drill-down transaction ledgers. | `src/services/report.service.ts` |
| **Export / Import** | High-performance streaming Excel (XLSX) and CSV exports, two-phase bulk import engine with staging preview, duplicate detection, and validation. | `src/services/excel-export.service.ts`, `src/services/excel-import.service.ts` |
| **PDF Generation** | Server-side PDFKit vector document generator, official corporate branding, INR (`₹`) formatting, Tamil Unicode glyph handling, clean pagination. | `src/services/pdf-report.service.ts` |
| **AI Assistant** | Natural language conversational interface grounded strictly in deterministic database query results; operates under read-only boundaries. | `src/services/ai-assistant.service.ts` |
| **Audit & Resilience** | Tamper-evident mutation logging, SHA-256 backup verification, automated point-in-time recovery runbooks, and live health probes. | `src/services/audit.service.ts`, `src/services/backup.service.ts` |

---

## 3. Detailed Accounting Engine

The V1.0 accounting subsystem is engineered for zero-discrepancy financial compliance:
- **Income & Revenue Recording:** Direct sales and recurring revenue capture linked to customer accounts with explicit cash/bank account attribution.
- **Expense Management:** Operational expenditure categorization (Fuel, Vehicle Maintenance, Tolls, Driver Wages, Office Utilities) with invoice attachments and tax tracking.
- **Receivables & Debt Aging:** Automated outstanding balance tracking across 0–30, 31–60, 61–90, and 90+ day aging buckets.
- **Payables & Supplier Settlements:** Structured supplier invoices and payment disbursement tracking with partial payment allocation support.
- **Payments & Allocation:** Two-way settlement matching where cash or bank transfers immediately reduce outstanding ledger balances without creating orphan credits.
- **Customer & Supplier Ledgers:** Complete chronological ledger generation displaying debit, credit, running balance, transaction reference, and settlement history.
- **Accounting Basis Support:** Dual-view reporting supporting Accrual Basis (recognized upon invoicing/billing) and Cash Basis (recognized upon actual settlement).
- **Month-End Financial Snapshots:** Formal closing locks the accounting period against edits, freezes opening and closing balances, and creates an immutable snapshot record. Reopening requires Owner authorization with mandatory audit rationale logging.

---

## 4. CRM & Follow-Up System

Designed to streamline operations for Sai Tours & Travels:
- **Unified Counterparty Registry:** Distinct profiles for corporate clients, retail travelers, vehicle operators, fuel vendors, and external service providers.
- **Payment Follow-Ups:** Dedicated collection workflow with priority levels (Low, Medium, High, Urgent), assigned staff owners, and scheduled callback dates.
- **Promise-to-Pay (PTP) Logging:** Records agreed payment commitments without altering accounting ledgers until actual funds are received and reconciled.
- **Follow-Up State Safety:** Recording a follow-up interaction or changing a task status to "Completed" does NOT post ledger entries. Real financial transactions require an authorized payment entry.

---

## 5. Document Management System

- **Storage Isolation:** All physical files are persisted with random UUID keys in private, non-public cloud object storage buckets.
- **Ephemeral Access:** Direct public URLs are never stored or exposed. Authorized users access files through cryptographically signed URLs with a strict 15-minute expiration window.
- **Classification & Access Control:** Mandatory document categorization (Invoices, Receipts, RC Books, Insurance Policies, Tax Forms, General Contracts) with RBAC restricting sensitive document visibility.
- **Document Versioning:** Complete version tree tracking superseding documents without deleting prior historic attachments required for audit compliance.

---

## 6. Advanced Reporting & Data Interchange

- **Standard Financial Packs:**
  - Balance Sheet (Assets, Liabilities, Equity)
  - Profit & Loss Statement (Operating Revenue, Cost of Operations, Gross Margin, Net Profit)
  - Trial Balance (Debit/Credit balance parity check)
  - Customer Aging Summary & Supplier Aging Summary
  - Cash & Bank Movement Ledger
- **AST Custom Report Builder:** Visual report constructor allowing custom filtering by date range, counterparty, payment mode, expense category, or tag with dynamic grouping and aggregate functions.
- **Current vs. As-Closed Reporting:** Explicit UI toggle enabling operators to view live real-time figures or frozen historical figures captured during past month-end closings.
- **Bi-Directional Excel Interchange:**
  - Multi-sheet styled Excel exports with auto-calculated formula rows and frozen header panes.
  - Two-phase import workflow featuring client-side file inspection, database staging, column mapping, duplicate warning detection, and transactional commit.
- **Executive PDF Generation:** Pixel-perfect vector PDFs rendered server-side with Sai Tours & Travels header branding, formatted currency, and Tamil script support.

---

## 7. AI Accounting Assistant (Golden Trust Rule)

The AI Assistant is an interactive decision-support interface:
- **Strict Read-Only Boundary:** The AI subsystem possesses zero mutation permissions. It cannot create, edit, delete, or settle any financial record, note, or user.
- **Deterministic Grounding:** All quantitative answers (totals, outstanding balances, profit margins) are computed by deterministic backend services before being summarized by the LLM.
- **Natural Language Query Interpretation:** Converts conversational questions (e.g., *"How much fuel expense was incurred last month?"* or *"எந்த வாடிக்கையாளர் அதிக பாக்கி வைத்துள்ளார்?"*) into structured database queries.
- **Zero-Impact Resilience:** If the external AI API is unreachable, times out, or fails authentication, the entire accounting application, reporting engine, and CRM continue operating without degradation.

---

## 8. Security, RBAC & Tenant Isolation

- **Role-Based Access Control (RBAC):** Five distinct operational roles strictly enforced across server-side API routes and client-side page guards:
  - `OWNER`: Full system authority, user management, audit logs, backup tools, month-end reopening.
  - `ADMIN`: Operational oversight, user administration, financial reporting, document management.
  - `ACCOUNTANT`: Complete accounting entry, ledger reconciliation, month-end closing, imports/exports.
  - `STAFF`: Day-to-day data entry (notes, records, customers, follow-ups), restricted from core accounting settings and audit logs.
  - `VIEWER`: Read-only access to authorized records and general reports; cannot create, modify, or export sensitive ledgers.
- **Tenant Isolation:** Every database query filters by `tenantId` (`sai-tours-travels`). Zero cross-tenant data leakage guaranteed by schema constraints and service-layer validation.
- **Defense in Depth:**
  - In-memory rate limiting across authentication endpoints (5 requests / 15 minutes) and API endpoints (100 requests / minute).
  - Secure HTTP headers configured via Next.js: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
  - Input validation using strict Zod schemas preventing SQL injection, mass assignment, and type confusion.

---

## 9. Backup, Disaster Recovery & Infrastructure

- **Automated Backup Strategy:** Daily logical database dumps and file storage sync with SHA-256 cryptographic checksum calculation.
- **Backup Verification:** Standalone verification script validates dump integrity, file size thresholds, and checksum matches before marking backups as verified.
- **Disaster Recovery Targets:**
  - Recovery Point Objective (RPO): ≤ 24 hours (daily backup) / ≤ 1 hour with database WAL archiving.
  - Recovery Time Objective (RTO): ≤ 4 hours for cold restore to secondary infrastructure.
- **Comprehensive Runbooks:** Detailed step-by-step procedures in `docs/production-runbook.md`, `docs/disaster-recovery.md`, and `docs/production-rollback.md`.

---

## 10. Deployment & Hosting Specifications

- **Application Framework:** Next.js 16 (App Router) running on Node.js 20 LTS.
- **Database Engine:** PostgreSQL 16 with Prisma ORM 5.22.
- **UI Architecture:** React 19, Tailwind CSS v4, Lucide Icons.
- **PDF Engine:** PDFKit 0.20 with custom vector layout and font embedding.
- **Spreadsheet Engine:** SheetJS (xlsx 0.18.5) with streaming worksheet buffers.
- **Process Manager:** Systemd / Docker containerized deployment behind Nginx reverse proxy with TLS 1.3 / Let's Encrypt SSL certificates.

---

## 11. Known Limitations Register

As documented in `docs/known-limitations.md`, the following capabilities are intentionally out of scope for V1.0:
1. **No Automated Invoice OCR:** Scanned PDF or photo receipts cannot be automatically converted into expense drafts; receipts must be entered manually with documents attached.
2. **No Direct Bank Feed Scraping:** Bank and credit card transactions cannot be synced automatically via NetBanking APIs; statements must be imported using the Excel/CSV import tool.
3. **No Direct WhatsApp / SMS Messaging Bot:** Customer follow-up reminders are tracked internally and must be dispatched manually via phone call or messaging apps.
4. **No Direct GST Portal Filing:** GSTR reports must be reviewed and filed manually by the accountant on the government GST portal.
5. **In-Memory Rate Limiting:** In multi-instance clustering mode, rate limits apply per-instance unless upgraded to centralized Redis in V1.1.

---

## 12. Upgrade & Maintenance Notes

- **Initial Setup:** Execute `npm run db:migrate:deploy` to ensure all schema migrations are applied.
- **Bootstrap Owner:** Run `npm run bootstrap:owner` to initialize the primary enterprise owner account.
- **Production Verification:** Verify all health endpoints at `/api/health` return HTTP 200 with database connectivity confirmation.
- **Zero Demo Data:** The live production ledger contains zero dummy or simulated transactions. All operational entries must represent authentic business activities.
