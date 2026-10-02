# Sai Tours & Travels — Reporting & Analytics Guide

**Document Reference:** `docs/reporting-guide.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 18 Final QA, Business Acceptance, Launch Sign-Off & V1.0 Handover  
**Target Audience:** Owners, Accountants, Auditors, and Business Analysts  

---

## 1. Overview of Reporting Capabilities

The platform provides a dual-layer reporting architecture:
1. **Pre-Built Standard Accounting Reports (12 Standard Packs):** High-precision statutory reports covering monthly P&L, customer ledgers, supplier bills, aging schedules, and cash movements.
2. **Advanced Custom Report Builder:** Flexible multi-dimensional query builder allowing users to group, filter, aggregate, and drill down into bookings and expenses.

Both layers support **Multi-Page PDF Dossiers** and **Multi-Sheet Excel Workbooks** with Tamil Unicode (`சாய் டிராவல்ஸ்`) and Indian Rupee (`₹`) formatting.

---

## 2. Standard Financial Report Catalog

| Report Name | Frequency | Target Audience | Primary Metric & Content |
|---|---|---|---|
| **Monthly Accounting Dossier** | Monthly | Owner, Auditor | Comprehensive financial pack: P&L, Receivables, Payables, and Cash Flow reconciliation. |
| **Financial Summary (Compact)** | Daily / Weekly | Owner | One-page executive brief: Gross Revenue, Operating Expenses, Net Result, and Cash Position. |
| **Income by Category** | Monthly | Management | Revenue breakdown by service: Tour Packages, Vehicle Rentals, Commission, and Custom Trips. |
| **Expenses by Category** | Monthly | Accountant | Cost analysis: Diesel/Fuel, Tolls, Driver Allowance, Vehicle Maintenance, Taxes, and Office Rent. |
| **Receivables & Aging Schedule** | Weekly | Accountant, Staff | Outstanding customer balances partitioned into `Current`, `1–30`, `31–60`, `61–90`, and `90+` days overdue. |
| **Payables & Vendor Aging** | Weekly | Accountant | Outstanding vendor obligations to bus owners, mechanics, spare-part dealers, and hotels. |
| **Cash Movement & Liquidity** | Daily / Monthly | Owner, Cashier | Physical cash vs bank vs UPI inflows and outflows; reconciles opening balance to closing balance. |
| **Customer Statement** | On-Demand | Customers | Formal itemized statement of trips, invoices, payments received, and remaining balance. |
| **Supplier Ledger Statement** | On-Demand | Vendors | Verified statement of bills received and payments disbursed with running balances. |

---

## 3. "As-Closed" vs. "Current" Reporting Modes

A critical accounting feature implemented in Phase 10 & 14:

```
                            ┌──────────────────────────────────────────┐
                            │           REPORTING DATA MODE            │
                            └────────────────────┬─────────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   ▼                                                           ▼
    ┌───────────────────────────────┐                           ┌───────────────────────────────┐
    │        AS-CLOSED MODE         │                           │         CURRENT MODE          │
    ├───────────────────────────────┤                           ├───────────────────────────────┤
    │ • Statutory & tax audit       │                           │ • Operational debt recovery   │
    │ • Historical snapshot hash    │                           │ • Live outstanding balances   │
    │ • Subsequent payments ignored │                           │ • Reflects payments to-date   │
    └───────────────────────────────┘                           └───────────────────────────────┘
```

- **When to use As-Closed:** Use when filing monthly GST returns, conducting financial audits, or reviewing past performance. This view guarantees that historical numbers never shift.
- **When to use Current:** Use when following up with customers for pending payments or reconciling today's bank accounts.

---

## 4. Custom Report Builder & Drill-Down

Located at `/reports/builder`:
1. **Dimensions:** Group data by `Category`, `Customer`, `Supplier`, `Payment Method`, `Status`, or `Month`.
2. **Metrics:** Calculate `Sum of Total Amount`, `Sum of Paid Amount`, `Sum of Outstanding`, or `Transaction Count`.
3. **Filtering:** Filter by Date Range, Payment Status (`UNPAID`, `PARTIALLY_PAID`, `PAID`), or Amount thresholds.
4. **Drill-Down Reconciliation:** Clicking on any aggregate category row (e.g. `Fuel Expenses: ₹75,000.00`) expands the underlying authorized line-item transactions. The sum of the line items is mathematically guaranteed to equal the category header.

---

## 5. Exporting Reports Safely

### A. PDF Generation
- Rendered using PDFKit with the embedded **Nirmala UI** font family.
- Table headers repeat automatically across page boundaries.
- Page numbering buffer dynamically computes `"Page X of Y"`.
- Long descriptions wrap cleanly without clipping numbers.

### B. Excel & CSV Exports
- Generated using `xlsx` with UTF-8 BOM encoding for complete Tamil character fidelity.
- **Formula Injection Defense:** Any text field starting with `=`, `+`, `-`, `@`, `\t`, `\r` is escaped with a single quote (`'`), protecting your desktop spreadsheet from malicious macro execution while preserving valid negative currency values.
