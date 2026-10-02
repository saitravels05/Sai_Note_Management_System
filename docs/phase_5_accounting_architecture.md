# Phase 5: Accounting Engine, Double-Counting Prevention & Ledger Architecture

## 1. Executive Accounting Principles

The **Sai Tours & Travels** system implements an enterprise accounting architecture that guarantees deterministic accuracy without reliance on client-side approximations or AI hallucinations.

### Core Principles:
1. **Mathematical Determinism**: All arithmetic is executed using decimal-safe types via the `Money` utility and `Decimal.js` with 4 decimal places internally and 2 decimal places formatted in INR (`₹`).
2. **Recognition vs. Cash Movement**: Recognized revenue/expenses are strictly segregated from liquidity movements (inflows and outflows).
3. **No Double Counting**: Credit invoices (`RECEIVABLE`) and their subsequent payment allocations (`PAYMENT_IN` / `PaymentAllocation`) never result in duplicated income calculations.
4. **Server-Side Aggregations**: Financial summaries are computed on PostgreSQL using indexed queries, `SUM()`, `GROUP BY`, and atomic transactions (`prisma.$transaction`).
5. **Immutable Auditability**: Posted financial records and payments cannot be deleted casually. Voiding requires a mandatory audit reason and reverses balances safely.

---

## 2. Preventing Double Counting

A common fatal bug in naive accounting software is double-counting when an invoice is issued and later settled.

### The Scenario:
- On 15th October, customer pays for an international tour package billed at **₹50,000**.
- An invoice/receivable is created: `RECEIVABLE`, ₹50,000.
- On 20th October, the customer makes a bank transfer of **₹50,000** (`PAYMENT_IN`).

### How Our Engine Prevents Double Counting:
1. **Accrual Basis (Profit & Loss / Net Result)**:
   - **Recognized Income** = `SUM(POSTED INCOME)` + `SUM(POSTED RECEIVABLE)` + `SUM(CREDIT ADJUSTMENTS)`.
   - The payment of ₹50,000 is an asset conversion (Accounts Receivable $\to$ Cash/Bank). It does **NOT** increment recognized revenue.
   - Therefore, Recognized Income = **₹50,000**, NOT ₹100,000.
2. **Cash Movement (Cash Flow)**:
   - **Money Received** = `SUM(POSTED PAYMENT_IN)` + `SUM(POSTED direct cash INCOME)`.
   - Money Received = **₹50,000**.
   - Cash Flow reflects the physical movement of money into bank/cash accounts on 20th October.

### Mathematical Definition of Reports:
| Report Dimension | Formula | Includes | Excludes |
| :--- | :--- | :--- | :--- |
| **Recognized Income** | `INCOME` + `RECEIVABLE` + `ADJUSTMENT(CREDIT)` | Invoices & cash sales | Payments received for invoices |
| **Recognized Expenses**| `EXPENSE` + `PAYABLE` + `ADJUSTMENT(DEBIT)` | Vendor bills & cash costs | Payments made for bills |
| **Net Result (Profit)**| `Recognized Income` - `Recognized Expenses` | Earned revenue - incurred costs | Balance sheet asset conversions |
| **Cash Inflow** | `Payments Received` + `Direct Cash Sales` | Actual liquidity received | Unpaid invoices |
| **Cash Outflow** | `Payments Made` + `Direct Cash Expenses` | Actual liquidity disbursed | Unpaid bills |
| **Net Cash Flow** | `Cash Inflow` - `Cash Outflow` | Net bank/cash account delta | Non-cash accounting accruals |

---

## 3. Payment Allocation Engine

### Models:
1. `Payment`: Represents the physical exchange of money (`direction: IN | OUT`, `amount`, `paymentMethodId`, `customerId`, `supplierId`, `paymentDate`, `status: POSTED | VOID`).
2. `PaymentAllocation`: Links a `Payment` to a `Transaction` (`transactionId`, `amount`).

### Allocation Scenarios:
1. **Partial Payment**:
   - Receivable Total: ₹50,000
   - Payment Received: ₹20,000
   - Allocated: ₹20,000
   - Outstanding: ₹30,000
   - Derived Status: `PARTIALLY_PAID`
2. **Multiple Payments Against One Invoice**:
   - Payment 1: ₹10,000 $\to$ Outstanding: ₹40,000 (`PARTIALLY_PAID`)
   - Payment 2: ₹15,000 $\to$ Outstanding: ₹25,000 (`PARTIALLY_PAID`)
   - Payment 3: ₹25,000 $\to$ Outstanding: ₹0 (`PAID`)
3. **One Payment Across Multiple Invoices**:
   - Single payment of ₹50,000 from customer:
     - Allocation to Invoice A (₹20,000) $\to$ Invoice A status `PAID`
     - Allocation to Invoice B (₹15,000) $\to$ Invoice B status `PAID`
     - Allocation to Invoice C (₹15,000) $\to$ Invoice C status `PAID`
4. **Overpayment & Advance Credit**:
   - Invoice Total: ₹50,000
   - Customer pays: ₹55,000
   - Allocated to Invoice: ₹50,000 (Invoice marked `PAID`)
   - **Unapplied Balance**: ₹5,000 retained on `Payment` as an advance/credit balance. No money disappears.

---

## 4. Derived Payment Status Matrix

The payment status of any transaction is **strictly derived on the server** from:
$$\text{PaidAmount} = \sum_{\text{active allocations}} \text{Allocation.amount}$$

$$\text{OutstandingAmount} = \max(0, \text{TotalAmount} - \text{PaidAmount})$$

- $\text{PaidAmount} = 0 \implies \mathbf{UNPAID}$
- $0 < \text{PaidAmount} < \text{TotalAmount} \implies \mathbf{PARTIALLY\_PAID}$
- $\text{PaidAmount} = \text{TotalAmount} \implies \mathbf{PAID}$
- $\text{PaidAmount} > \text{TotalAmount} \implies \mathbf{OVERPAID}$

---

## 5. Party Ledger Sign Conventions

### Customer Ledger:
- **Debit (+)**: Invoices / Receivables / Debit Adjustments (increases what the customer owes).
- **Credit (-)**: Payments Received / Credit Notes (reduces what the customer owes).
- **Running Balance**:
  $$\text{Balance}_n = \text{Balance}_{n-1} + \text{Debit}_n - \text{Credit}_n$$
- Positive balance indicates Customer owes money to business (Receivable).

### Supplier Ledger:
- **Credit (+)**: Bills / Payables / Supplier charges (increases what the business owes the supplier).
- **Debit (-)**: Payments Made / Debit Notes (reduces what the business owes the supplier).
- **Running Balance**:
  $$\text{Balance}_n = \text{Balance}_{n-1} + \text{Credit}_n - \text{Debit}_n$$
- Positive balance indicates Business owes money to supplier (Payable).

---

## 6. Financial Health & Reconciliation Engine

The system runs 8 automated integrity checks:
1. **Allocation Bounds**: No payment's allocations exceed the payment amount.
2. **Transaction Validity**: No allocation exists against a VOID or DRAFT transaction.
3. **Payment Validity**: No active allocation exists from a VOID payment.
4. **Tenant Isolation**: Cross-business allocations are strictly impossible and flagged as security violations.
5. **Derived Status Consistency**: Every transaction's `paymentStatus` matches its mathematical allocation sum.
6. **No Negative Outstanding**: Outstanding balance must never be negative.
7. **No Orphaned Records**: Every allocation must have an active parent payment and transaction.
8. **Closed Period Bounds**: Closed accounting periods reject retroactive modifications.
