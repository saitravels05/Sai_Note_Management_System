# Database Schema & Accounting Data Model Specification
## System: AI-Powered Notes, Data & Month-End Accounting Management System
**Engine**: PostgreSQL 15+ | **ORM**: Prisma 5.22.0 | **Financial Precision**: `DECIMAL(19, 4)`

---

## 1. Architectural Principles

1. **PostgreSQL as Single Source of Truth**: All financial balances, ledger totals, receivables, and payables are derived from transactional entries and payment allocations.
2. **Decimal Precision**:
   - Stored in database as `DECIMAL(19, 4)`.
   - Processed in application memory via `Money` (`Decimal.js`).
   - Standard rounding: `ROUND_HALF_UP`.
   - Formatted in UI: Indian Rupee `₹` with 2 decimal places and Indian grouping (`₹1,25,000.00`).
3. **No Hard Deletion of Financial History**:
   - Posted financial records are never hard-deleted with `DELETE`.
   - Records are soft-voided: `status = 'VOID'`, `voided_at`, `voided_by`, `void_reason`.
   - Voided transactions remain in the historical audit trail but contribute zero to ledger totals.
4. **Tenant Isolation**:
   - Every business-owned entity contains `business_id`.
   - Cross-tenant data leaks are blocked by the service and authorization layer (`AuthorizationService.requireBusinessAccess`).

---

## 2. Core Entities Directory

| Table Name | Entity | Purpose | Delete Rule |
| :--- | :--- | :--- | :--- |
| `businesses` | Business | Multi-tenant organization root | `RESTRICT` |
| `user_profiles` | UserProfile | User identity and profile attributes | `RESTRICT` |
| `roles` | Role | RBAC role definitions (OWNER, ADMIN, etc.) | `CASCADE` |
| `permissions` | Permission | System capability tokens | `CASCADE` |
| `customers` | Customer | Client directory & credit terms | `RESTRICT` |
| `suppliers` | Supplier | Vendor/partner directory & terms | `RESTRICT` |
| `categories` | Category | Hierarchical income/expense categories | `RESTRICT` |
| `tags` | Tag | Categorization tags for search & AI | `RESTRICT` |
| `transactions` | Transaction | Core financial ledger records | `RESTRICT` |
| `transaction_items` | TransactionItem | Multi-line item details | `CASCADE` on Transaction |
| `payments` | Payment | Inflow and outflow payments | `RESTRICT` |
| `payment_allocations` | PaymentAllocation | Bridges payments to invoices/bills | `RESTRICT` |
| `payment_methods` | PaymentMethod | Configurable payment modes | `RESTRICT` |
| `notes` | Note | Non-financial business memos & itineraries | `RESTRICT` |
| `attachments` | Attachment | Metadata-first file storage records | `RESTRICT` |
| `import_batches` | ImportBatch | Staged spreadsheet upload batches | `RESTRICT` |
| `import_rows` | ImportRow | Sandbox rows for validation | `CASCADE` on Batch |
| `financial_periods` | FinancialPeriod | Monthly accounting periods & lock status | `RESTRICT` |
| `monthly_closings` | MonthlyClosing | Immutable snapshot of audited period | `RESTRICT` |
| `audit_logs` | AuditLog | Append-only financial mutation trace | `RESTRICT` |
| `saved_filters` | SavedFilter | User-defined query presets | `CASCADE` on User |
| `ai_queries` | AIQuery | Query logs for AI assistant | `RESTRICT` |
| `report_histories` | ReportHistory | History of generated PDFs/Excels | `RESTRICT` |
| `business_settings` | BusinessSetting | Key-value business preferences | `CASCADE` on Business |
| `custom_field_definitions` | CustomFieldDefinition | Custom dynamic schema extensions | `RESTRICT` |
| `custom_field_values` | CustomFieldValue | Values for custom fields | `CASCADE` on Definition |
| `business_sequences` | BusinessSequence | Concurrency-safe atomic number counters | `RESTRICT` |

---

## 3. Financial Calculation & Payment Settlement Model

### 3.1 Outstanding Balance Derivation
Rather than storing a fragile `balance_due` column that risks desynchronization:
$$\text{Paid Amount} = \sum_{\text{allocations}} \text{allocation.amount}$$
$$\text{Outstanding Amount} = \text{transaction.totalAmount} - \text{Paid Amount}$$

### 3.2 Payment Status Evaluation
- **UNPAID**: $\text{Paid Amount} = 0$
- **PARTIALLY_PAID**: $0 < \text{Paid Amount} < \text{transaction.totalAmount}$
- **PAID**: $\text{Paid Amount} = \text{transaction.totalAmount}$
- **OVERPAID**: $\text{Paid Amount} > \text{transaction.totalAmount}$

### 3.3 Month-End Closing Formula
$$\text{Net Result} = \sum \text{Income (POSTED)} - \sum \text{Expenses (POSTED)}$$
$$\text{Closing Balance} = \text{Opening Balance} + \text{Net Result}$$

---

## 4. Safe Sequence Generation
To prevent concurrent race conditions (such as two desk operators booking tickets simultaneously getting duplicate PNRs or invoice numbers):
- We strictly **avoid** `COUNT(*) + 1`.
- We use atomic increment against `business_sequences` via PostgreSQL transaction upsert:
  ```typescript
  const seq = await prisma.businessSequence.upsert({ ... update: { currentValue: { increment: 1 } } });
  ```
- Formatted output: `TXN-2026-000001`, `PAY-2026-000001`, `CUS-000001`, `SUP-000001`.
