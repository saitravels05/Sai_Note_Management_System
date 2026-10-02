# Sai Tours & Travels — Month-End Closing & Snapshot Guide

**Document Reference:** `docs/month-end-guide.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 18 Final QA, Business Acceptance, Launch Sign-Off & V1.0 Handover  
**Target Audience:** Lead Accountants, Financial Controllers, and Proprietors  

---

## 1. What is Month-End Closing?

In accounting, **Month-End Closing** freezes the financial books for a completed calendar month (e.g. `September 2026`). 

Once a month is closed:
- Total revenue, expenses, and profits are permanently finalized.
- An immutable, cryptographic SHA-256 snapshot is generated.
- Standard tax and audit reports (PDF & Excel) are archived.
- No staff member can backdate, edit, or delete transactions in that month without a formal audited reopening.

---

## 2. Pre-Closing Checklist (Run on the 1st of Each Month)

Before clicking Close, complete these operational checks:

- [ ] **All Trip Bookings Entered:** Verify that all tours concluded during the month have been posted as Income or Receivables.
- [ ] **All Fuel & Driver Bills Recorded:** Confirm all diesel pump vouchers, toll receipts, and driver batta payments are logged under Expenses.
- [ ] **No Draft Records Pending:** Check that there are zero unfinished transactions in `DRAFT` status for the target month.
- [ ] **Bank Reconciliation Completed:** Confirm that cash and bank deposits match your physical bank passbook or statement.
- [ ] **Outstanding Invoices Reviewed:** Ensure uncollected balances are accurately flagged as Receivables.

---

## 3. Step-by-Step Closing Procedure

1. Log in as an **ACCOUNTANT** or **OWNER**.
2. Navigate to **Month-End Closing** (`/month-end`) from the sidebar.
3. Select the period you are closing (e.g. `2026-09`).
4. Click **Run Pre-Close Validation**:
   - The system checks trial balance debit/credit equality.
   - It flags any unposted drafts or unbalanced payments.
5. If validations pass with green checkmarks, click **Close Financial Period**.
6. Enter any closing remarks (e.g. *"September 2026 closed after Dussehra holiday tour reconciliation"*).
7. Click **Confirm Close**:
   - The period transitions to `CLOSED`.
   - The system computes the authoritative financial snapshot and hashes it with SHA-256.
   - The final **Monthly Accounting Dossier (PDF)** and **Closing Excel Pack** are generated and permanently linked to `Snapshot Version 1`.

---

## 4. Understanding Period Statuses

| Status | What It Means | Allowed Actions | Restricted Actions |
|---|---|---|---|
| `OPEN` | Current active operating period | Creates, Edits, Voids, Payments, Imports | None |
| `CLOSED` | Formally closed month-end | Search, Read-Only Reports, PDF/Excel Exports | No new entries, no edits, no voids, no payments |
| `LOCKED` | Multi-month archived period (Strict) | Read-only audit reviews | Blocked from reopening except by Owner |
| `REOPENED` | Temporarily unlocked for audit adjustments | Adjustment entries | Must be re-closed immediately after correction |

---

## 5. How to Reopen a Closed Period (Audit Adjustment)

If an official tax audit or auditor discovers an error in a closed month:
1. Only users with the `month_end.reopen` permission can reopen a period.
2. Click **Reopen Financial Period**.
3. **Mandatory Audit Reason:** Enter a clear explanation (e.g. *"Auditor requested reclassification of fuel invoice #402 from Vehicle Maintenance to Diesel Expenses"*).
4. The system transitions status to `REOPENED` and logs an event in the Audit Control Center.
5. The original `Snapshot Version 1` is **never deleted or overwritten**.
6. The accountant posts the corrective entry.
7. Click **Reclose Financial Period**.
8. The system generates `Snapshot Version 2`. Both Version 1 and Version 2 remain permanently accessible side-by-side in your historical records.
