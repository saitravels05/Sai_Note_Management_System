# Sai Tours & Travels — Excel & CSV Data Import Guide

**Document Reference:** `docs/excel-import-guide.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 18 Final QA, Business Acceptance, Launch Sign-Off & V1.0 Handover  
**Target Audience:** Accountants and Data Entry Operators  

---

## 1. Overview & Golden Rule of Imports

The platform includes an enterprise **Two-Phase Excel/CSV Import Engine** built during Phase 7:

> [!IMPORTANT]
> **The Golden Rule of Imports:**  
> **Uploading and previewing a spreadsheet NEVER writes or commits rows directly to your financial database.**  
> Financial records are posted ONLY after you review the validation preview, inspect duplicate warnings, and click the explicit **Commit Import** button.

---

## 2. Preparing Your Spreadsheet

You can import transactions, expenses, customers, or suppliers from `.xlsx` or `.csv` files.

### Recommended Column Structure for Transactions & Bookings:
| Date | Type | Category | Customer / Supplier | Reference No | Description | Total Amount | Payment Method | Payment Status |
|---|---|---|---|---|---|---|---|---|
| `2026-10-01` | `INCOME` | `Tour Package` | `Chennai Pilgrim Tour` | `BK-101` | `Madurai Package` | `45000.00` | `BANK_TRANSFER` | `PAID` |
| `2026-10-02` | `EXPENSE` | `Fuel / Diesel` | `HP Petrol Bunk Madurai` | `DSL-88` | `Diesel Bus KA-01` | `12500.00` | `CASH` | `PAID` |
| `2026-10-03` | `RECEIVABLE` | `Vehicle Hire` | `Meenakshi Travels` | `INV-204` | `Tempo Traveller Hire`| `30000.00` | `UPI` | `UNPAID` |

### Rules for Clean Imports:
- **Date Format:** Use standard `YYYY-MM-DD` or `DD-MM-YYYY`.
- **Amounts:** Numbers with optional decimals (e.g. `45000.00`). Do not include currency symbols (`₹`, `$`) inside the amount column.
- **Tamil Unicode:** Customer names in Tamil (`சாய் டூர்ஸ்`) are fully supported.
- **Formula Safety:** Avoid starting descriptions with `=`, `+`, `-`, or `@`.

---

## 3. Step-by-Step Import Workflow

### Step 1: Upload File
1. Navigate to **Import Data** in the sidebar (`/imports/new`).
2. Download the pre-formatted Excel template if needed.
3. Drag and drop your completed `.xlsx` or `.csv` file into the upload zone.

### Step 2: Column Mapping
The system automatically maps known column names. If your columns differ, match them using the dropdown selectors:
- Map your date column to **Transaction Date**.
- Map your amount column to **Total Amount**.
- Map your party name to **Customer / Supplier Name**.

### Step 3: Automated Validation & Preview
Click **Validate & Preview**:
- The system parses every row without touching the database.
- It validates positive amounts, valid dates, and required fields.
- **Pre-Flight Duplicate Detection:** If a row matches an existing transaction (same date, amount, and reference), it flags it with a yellow `DUPLICATE` warning.
- **Closed Period Guard:** If any row falls inside an already closed month (e.g. `September 2026`), that row is flagged as blocked.

### Step 4: Review Validation Summary
Inspect the preview summary card:
- Total Rows: `50`
- Valid Rows: `48`
- Warnings / Duplicates: `2`
- Invalid Rows: `0`

### Step 5: Commit to Financial Books
1. Choose how to handle duplicates: *Skip duplicate rows* or *Import anyway*.
2. Click **Confirm & Commit Import**.
3. Transactions are posted atomically into the ledger.
4. An audit event is created, and your Dashboard updates immediately.

---

## 4. Post-Import Financial Reconciliation

After committing an import, always perform a quick sanity check:
1. Note the total amount shown on the import confirmation screen (e.g. `₹4,25,000.00`).
2. Go to **Dashboard** and confirm that your Revenue/Expense totals increased by that exact sum.
3. If importing for a prior period, check the **Monthly P&L Report** for that period.
