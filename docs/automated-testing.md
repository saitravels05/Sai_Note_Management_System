# Automated Testing System — Architecture & Developer Guide

## AI-Powered Notes, Data & Month-End Accounting Management System
**Enterprise Multi-Tenant Accounting Architecture**

---

## 1. Overview & Testing Philosophy

This testing system implements a comprehensive 8-layer verification architecture. It enforces strict financial correctness, ledger integrity, multi-tenant isolation, role-based authorization, and regression prevention.

### Core Testing Directives
1. **Zero Fake Passes**: Tests never execute trivial assertions (`expect(true).toBe(true)`). Every assertion checks mathematical invariants, state transitions, or authoritative database rows.
2. **Accrual Net Result vs Cash Flow Separation**: Recognized income and expenses define profitability (`Net Result = Income - Expenses`); liquidity movements define cash flow (`Cash Movement = Inflow - Outflow`). They are never conflated.
3. **Decimal Arithmetic Precision**: All monetary calculations utilize `Money` (`Decimal.js`), preventing IEEE 754 floating-point errors (e.g., `₹100,000.10 - ₹25,000.05 = ₹75,000.05`, never `₹75,000.049999999`).
4. **Strict Production Safety Guard**: Destructive tests verify `process.env.NODE_ENV !== "production"` before executing, ensuring zero accidental mutation of production datasets.
5. **Deterministic Golden Accounting Dataset**: Centralized financial test fixtures verify end-to-end ledger balance, aging buckets, and month-end snapshots across all testing layers.

---

## 2. Layered Testing Architecture

The test suite is structured across 8 distinct layers:

| Layer | Focus Area | Technology | Primary Files |
| :--- | :--- | :--- | :--- |
| **Layer 1** | Unit & Decimal Precision | Node Test Runner / TSX | `tests/money.test.ts`, `tests/date.test.ts` |
| **Layer 2** | Service & Financial Math | Node Test Runner / TSX | `tests/accounting.test.ts`, `tests/payments.test.ts`, `tests/accounting/golden-accounting.test.ts` |
| **Layer 3** | Database Integration | PostgreSQL & Prisma ORM | `tests/integration/database-accounting.test.ts` |
| **Layer 4** | API & Server Actions | Node Test Runner / TSX | `tests/production-readiness.test.ts`, `tests/records.test.ts` |
| **Layer 5** | Security & Tenant Isolation | Node Test Runner / TSX | `tests/security/tenant-security.test.ts`, `tests/auth.test.ts` |
| **Layer 6** | End-to-End User Journeys | Playwright (Chromium) | `tests/e2e/owner-flow.spec.ts`, `tests/e2e/role-matrix.spec.ts` |
| **Layer 7** | Browser, Responsive & A11y | Playwright (Desktop & Mobile) | `tests/e2e/mobile-responsive.spec.ts`, `tests/e2e/accessibility.spec.ts`, `tests/e2e/performance-smoke.spec.ts` |
| **Layer 8** | Regressions & Month-End | Node Test Runner & Playwright | `tests/month-end.test.ts`, `tests/integration/database-accounting.test.ts` |

---

## 3. Test Suites & File Structure

```text
sai-notes-accounting-app/
├── tests/
│   ├── accounting/
│   │   └── golden-accounting.test.ts   # Section 8 Golden Dataset & Math Invariants
│   ├── integration/
│   │   └── database-accounting.test.ts # PostgreSQL As-Closed vs Current & DB Concurrency
│   ├── security/
│   │   └── tenant-security.test.ts     # Master RBAC, IDOR, XSS, SQLi, File Security
│   ├── e2e/
│   │   ├── owner-flow.spec.ts          # Playwright Full Journey (Login -> Report -> Audit)
│   │   ├── role-matrix.spec.ts         # Playwright RBAC Matrix (Accountant, Staff, Viewer)
│   │   ├── mobile-responsive.spec.ts   # Mobile Viewport Navigation & Touch UI
│   │   ├── accessibility.spec.ts       # A11y Landmark, Labels & ARIA Verification
│   │   └── performance-smoke.spec.ts   # Page Latency & Performance Smoke Benchmarks
│   ├── helpers/
│   │   └── safety-guard.ts             # Production Safety Guard Verification
│   ├── accounting.test.ts              # Core Accounting Engine
│   ├── ai-assistant.test.ts            # AI Guardrails & Tamil NLP Parsing
│   ├── analytics.test.ts               # Analytics Engine
│   ├── audit-backup-recovery.test.ts   # Audit Redaction & Backup Verification
│   ├── auth.test.ts                    # Password Hashing, Session JWT, Rate Limiting
│   ├── crm-followups.test.ts           # CRM Follow-ups & Promise-to-Pay Ledger Safety
│   ├── date.test.ts                    # Asia/Kolkata Boundaries
│   ├── documents.test.ts               # Document Vault & Multi-Version Storage
│   ├── exports.test.ts                 # Excel & CSV Export with Formula Injection Guard
│   ├── imports.test.ts                 # Excel & CSV Import Validation & Rollback
│   ├── money.test.ts                   # Decimal Arithmetic Precision
│   ├── month-end.test.ts               # Month-End Closing Engine & Locking
│   ├── payments.test.ts                # Payment Allocation & Overpayment Credit
│   ├── pdf-reports.test.ts             # PDF Generation & Ledger Reconciliation
│   ├── pipeline-integrity.test.ts      # Pipeline Integrity Failure Proof
│   ├── production-readiness.test.ts    # System Audit & Readiness Verification
│   ├── records.test.ts                 # Financial Transaction Validation & Numbering
│   └── report-builder.test.ts          # Custom Report Builder & Drill-Down
├── playwright.config.ts                # Playwright Config (Chromium Desktop & Mobile Pixel 5)
└── .github/workflows/ci.yml            # GitHub Actions CI Automation Pipeline
```

---

## 4. Golden Accounting Dataset Verification

The golden dataset is executed deterministically across Layer 2 and Layer 8:

| Financial Element | Value | Meaning |
| :--- | :--- | :--- |
| **Opening Balance** | ₹1,00,000.00 | Liquid opening cash |
| **Recognized Income** | ₹2,50,000.10 | Accrual recognized revenue |
| **Recognized Expenses** | ₹75,000.05 | Accrual recognized costs |
| **Receivables Billed** | ₹50,000.00 | Invoiced customer revenue |
| **Receivable Payment** | ₹20,000.00 | Cash received against invoices |
| **Outstanding Receivable** | **₹30,000.00** | Pending customer debt (`PARTIALLY_PAID`) |
| **Payables Incurred** | ₹40,000.00 | Invoiced supplier expenses |
| **Payable Payment Made** | ₹15,000.00 | Cash disbursed to suppliers |
| **Outstanding Payable** | **₹25,000.00** | Pending supplier liability |
| **Accrual Net Result** | **₹1,75,000.05** | `₹2,50,000.10 - ₹75,000.05` |
| **Net Cash Movement** | **₹5,000.00** | `₹20,000.00 - ₹15,000.00` |

---

## 5. Month-End As-Closed vs Current Regression

The application implements immutable financial period snapshots:
- **Scenario**: In September 2026, an invoice of ₹50,000 has ₹20,000 received.
- **Action**: September 2026 is officially validated, closed, and locked.
- **As-Closed View**: September retains an authoritative outstanding balance of **₹30,000.00**.
- **October Activity**: In October 2026, the remaining ₹30,000 is received.
- **Verification**:
  - In **Current Mode**, the customer's outstanding balance drops to **₹0.00**.
  - In **As-Closed Mode (September 2026 Snapshot)**, the report displays exactly **₹30,000.00**.
  - Direct modifications, edits, or voids targeting the closed September period are strictly blocked by server-side guards.

---

## 6. Beginner-Friendly Run Guide

Follow these simple steps to run the complete automated testing suite locally:

### Step 1: Open Terminal
Open PowerShell or your preferred terminal in the repository root directory:
```powershell
cd "e:\Softwares\Sai Notes App"
```

### Step 2: Install Dependencies
Ensure all application and test dependencies are installed:
```powershell
npm install
```

### Step 3: Start the Local PostgreSQL Database
Start the zero-configuration embedded PostgreSQL engine:
```powershell
npx tsx scripts/start-local-db.ts
```
*(Runs on `127.0.0.1:5432` with database `sai_accounting_db`)*

### Step 4: Run the Mandatory Pre-Deployment Gate
Run the critical verification gate (Type check + Accounting + Security + Database Integration):
```powershell
npm run test:critical
```

### Step 5: Run Specialized Test Suites
Execute specific test layers as needed:
```powershell
# Run unit & decimal precision tests
npm run test:unit

# Run full accounting & golden dataset suites
npm run test:accounting

# Run RBAC security & tenant isolation tests
npm run test:security

# Run database integration & month-end regression tests
npm run test:integration

# Run AI structured assistant & guardrail tests
npm run test:ai

# Run all 274+ Node.js test cases
npm test
```

### Step 6: Run Browser & Mobile E2E Tests (Playwright)
```powershell
# Run all E2E tests (Desktop Chromium & Mobile Viewport)
npm run test:e2e

# Run only mobile responsive tests
npm run test:e2e:mobile

# Open interactive Playwright UI
npx playwright test --ui
```

### Step 7: Run Full Production Gate (`test:all`)
```powershell
npm run test:all
```
This runs TypeScript checking, ESLint, all 274 Node.js unit/integration/security suites, and all 14 Playwright E2E suites.

---

## 7. How to Read Test Reports & Debug Failures

### Understanding Test Output
- **Node Test Runner**: Outputs standard TAP/spec format. Each passed test shows `✔ Test Name (latency in ms)`. A summary at the bottom reports `tests X, pass X, fail 0`.
- **Playwright**: Reports test progression per browser worker (`ok 1 [chromium]`, `ok 2 [mobile]`).

### Debugging Failures
1. **Accounting Discrepancy**: If an accounting test fails, inspect `tests/accounting/golden-accounting.test.ts`. Verify if floating-point primitives (`+`, `-`, `*`) were accidentally used instead of `Money.add()` or `Money.sub()`.
2. **Playwright E2E Failure**:
   - Playwright automatically saves failure artifacts to `test-results/`.
   - Inspect `test-results/<test-name>/error-context.md` for the exact DOM snapshot at the time of failure.
   - Inspect `test-results/<test-name>/test-failed-1.png` for a screenshot of the browser UI.
   - Run `npx playwright show-report` to view the interactive HTML report.

### Pipeline Integrity Verification
The test pipeline includes a deliberate integrity test (`tests/pipeline-integrity.test.ts`) verifying that assertions are authoritative and capable of halting deployment when an invalid financial calculation is detected.
