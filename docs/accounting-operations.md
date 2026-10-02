# Sai Tours & Travels — Standard Accounting Operations Guide

**Document Reference:** `docs/accounting-operations.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 17 Production Deployment, Domain, SSL, Database Migration & Go-Live  
**Target Audience:** Lead Accountants, Financial Controllers, and Bookkeepers  

---

## 1. Accounting Philosophy & Principles

The system implements double-entry principles adapted for a high-velocity tour and travel agency:
1. **Accrual vs. Cash Distinction:**
   - **Accrual Basis (Profit & Loss):** Income is recognized when travel services are booked and confirmed; expenses are recognized when incurred.
   - **Cash Basis (Liquidity):** Money received increases cash; money paid decreases cash. Profit ($\text{Income} - \text{Expenses}$) is strictly separated from Cash Position.
2. **Immutable Audit Trail:**
   - Financial entries are append-only.
   - Posted transactions are never deleted from the database. Corrections are made via structured **Voids** or compensating adjustments with mandatory audit justifications.
3. **High-Precision Decimal Arithmetic:**
   - All monetary calculations execute using Decimal.js with 20 digits of precision and half-up rounding. Floating-point arithmetic (`0.1 + 0.2`) is strictly forbidden.

---

## 2. Core Financial Workflows

### A. Income & Receivables
- When a customer books a tour (e.g. Madurai-Rameswaram 3-day package for ₹50,000.00):
  - If paid immediately: Create `TransactionType.INCOME` with `status: POSTED`, `paymentStatus: PAID`.
  - If advance received: Create `TransactionType.RECEIVABLE` with `totalAmount: ₹50,000.00`, attach partial payment of `₹20,000.00`. Status becomes `PARTIALLY_PAID` with `outstandingAmount: ₹30,000.00`.
  - If credit booking: Create `TransactionType.RECEIVABLE` with `paymentStatus: UNPAID`. Outstanding equals full invoice amount.

### B. Expenses & Payables
- When a bill is received from a coach operator or fuel pump (e.g. ₹40,000.00 diesel bill):
  - If paid immediately from Bank or Cash: Create `TransactionType.EXPENSE` with `status: POSTED`.
  - If vendor credit: Create `TransactionType.PAYABLE` with `paymentStatus: UNPAID`. Tracks aging schedule until payment is disbursed.

### C. Payment Allocations & Multi-Invoice Handling
- When a customer makes a lump-sum payment (e.g. ₹50,000.00 via UPI) covering multiple past trips:
  - System allows allocating portions to Invoice #1 (₹30,000.00) and Invoice #2 (₹20,000.00).
  - Both invoices update to `PAID` with `outstandingAmount: ₹0.00`.
  - Overpayment rule: If payment exceeds total outstanding, the remaining balance is flagged as `unappliedCredit` and displayed on the customer's ledger. It is never silently lost.

### D. Transaction Voids
- If an erroneous transaction was posted (e.g. duplicate booking):
  1. Navigate to transaction details on `/records/[id]`.
  2. Click **Void Transaction**.
  3. Enter a mandatory, meaningful reason (e.g. `"Customer cancelled trip prior to departure; refund issued"`).
  4. The record status updates to `VOID`.
  5. The accounting engine automatically reverses its contribution to Income/Expense/Receivables.
  6. The complete original record, timestamp, user snapshot, and reason remain permanently visible in the Audit Log.

---

## 3. Month-End Closing & Snapshot System

### A. Clean Closing Procedure
1. Navigate to `/month-end`.
2. Select the period to close (e.g. `2026-09`).
3. System automatically runs pre-close integrity validations:
   - Verifies no unposted `DRAFT` transactions exist for the period.
   - Confirms debits and credits balance.
   - Reconciles payment allocations.
4. Click **Close Financial Period**.
5. The system computes the authoritative trial balance, locks the period (`status: CLOSED`), generates a cryptographic SHA-256 snapshot hash, and builds the immutable closing pack (PDF dossier and Excel workbook).

### B. Closed & Locked Period Protection
- Once a period is `CLOSED` or `LOCKED`:
  - `POST`, `EDIT`, `VOID`, `PAYMENT`, and `IMPORT` operations targeting dates inside that period are strictly rejected by the server engine.
  - Backdating transactions into closed periods is impossible without reopening.

### C. Reopen & Reclose Lifecycle
- If an audit adjustment is genuinely required for a closed month:
  1. An authorized user with `month_end.reopen` permission clicks **Reopen Period**.
  2. A mandatory business reason must be entered.
  3. The system transitions status to `REOPENED` and logs an audit event.
  4. The previous snapshot (`Version 1`) is preserved intact.
  5. The authorized accountant enters the adjustment.
  6. The accountant clicks **Reclose Period**.
  7. A new snapshot (`Version 2`) is generated with updated hashes. Both versions remain permanently accessible in the historical archive.

---

## 4. "As-Closed" vs. "Current" Reporting Semantics

Understanding this distinction is critical for clean audit compliance:

| Concept | Definition | Example |
|---|---|---|
| **As-Closed Mode** | Displays the financial state exactly as it existed on the day the period was closed. Subsequent payments made in future months do NOT alter this view. | A ₹30,000 receivable was unpaid on Sept 30. September *As-Closed* report will always show ₹30,000 outstanding, even years later. |
| **Current Mode** | Displays the live, real-time status of all transactions, incorporating payments received to date. | If that ₹30,000 receivable was paid on Oct 10, the *Current* view of that invoice shows ₹0.00 outstanding. |

Both modes are mathematically valid in their respective context: *As-Closed* provides statutory audit immutability, while *Current* provides real-time debt recovery management.
