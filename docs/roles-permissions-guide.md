# Sai Tours & Travels — Roles & Permissions Matrix Guide

**Document Reference:** `docs/roles-permissions-guide.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 18 Final QA, Business Acceptance, Launch Sign-Off & V1.0 Handover  
**Target Audience:** Administrators, Security Officers, and Department Managers  

---

## 1. Role-Based Access Control (RBAC) Architecture

The platform implements a server-enforced **Role-Based Access Control** architecture defined in `src/lib/auth/permissions.ts`.

- **5 System Roles:** `OWNER`, `ADMIN`, `ACCOUNTANT`, `STAFF`, `VIEWER`.
- **Server-Side Enforcement:** Every restricted server action executes `requirePermission(PERMISSIONS.XYZ)` at the function entry point. Client-side button hiding is purely ergonomic.
- **Last Owner Protection:** The system strictly blocks removing or deactivating the last active Owner account.

---

## 2. Master Permission Matrix

| Permission Code | Module & Description | OWNER | ADMIN | ACCOUNTANT | STAFF | VIEWER |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `records.view` | View general transactions & notes | ✅ | ✅ | ✅ | ✅ | ✅ |
| `records.create` | Create new transactions & notes | ✅ | ✅ | ✅ | ✅ | ❌ |
| `records.edit` | Edit unposted/draft records | ✅ | ✅ | ✅ | ✅ | ❌ |
| `records.void` | Void posted financial records | ✅ | ✅ | ✅ | ❌ | ❌ |
| `records.delete` | Delete unposted draft notes | ✅ | ✅ | ✅ | ✅ | ❌ |
| `receivables.view` | View customer invoices & aging | ✅ | ✅ | ✅ | ✅ | ✅ |
| `payables.view` | View vendor bills & payables aging | ✅ | ✅ | ✅ | ❌ | ❌ |
| `payments.record` | Record incoming/outgoing payments | ✅ | ✅ | ✅ | ❌ | ❌ |
| `payments.void` | Void recorded payment allocations | ✅ | ✅ | ✅ | ❌ | ❌ |
| `customers.view` | View customer CRM & profiles | ✅ | ✅ | ✅ | ✅ | ✅ |
| `customers.edit` | Create & update customer profiles | ✅ | ✅ | ✅ | ✅ | ❌ |
| `suppliers.view` | View supplier/vendor CRM list | ✅ | ✅ | ✅ | ❌ | ❌ |
| `suppliers.edit` | Create & update supplier contacts | ✅ | ✅ | ✅ | ❌ | ❌ |
| `documents.view` | View standard attached documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| `documents.upload` | Upload new business documents | ✅ | ✅ | ✅ | ✅ | ❌ |
| `documents.view_sensitive` | Access sensitive/identity documents | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports.view` | View standard financial reports | ✅ | ✅ | ✅ | ❌ | ✅ |
| `reports.generate` | Generate custom reports & dossiers | ✅ | ✅ | ✅ | ❌ | ❌ |
| `reports.export` | Export reports to Excel & PDF | ✅ | ✅ | ✅ | ❌ | ❌ |
| `month_end.view` | View closed month-end dossiers | ✅ | ✅ | ✅ | ❌ | ✅ |
| `month_end.close` | Execute month-end period closing | ✅ | ❌ | ✅ | ❌ | ❌ |
| `month_end.reopen` | Reopen closed financial periods | ✅ | ❌ | ✅ | ❌ | ❌ |
| `month_end.lock` | Permanently lock multi-month archive | ✅ | ❌ | ❌ | ❌ | ❌ |
| `audit.view` | View Audit Control Center events | ✅ | ✅ | ✅ | ❌ | ❌ |
| `audit.view_sensitive` | View unredacted audit details | ✅ | ❌ | ❌ | ❌ | ❌ |
| `audit.export` | Export audit trail to CSV/Excel | ✅ | ✅ | ❌ | ❌ | ❌ |
| `audit.verify_integrity` | Execute SHA-256 hash chain verify | ✅ | ✅ | ❌ | ❌ | ❌ |
| `backups.view` | View backup list & health status | ✅ | ✅ | ❌ | ❌ | ❌ |
| `backups.create` | Trigger on-demand system backup | ✅ | ✅ | ❌ | ❌ | ❌ |
| `backups.restore_test` | Run isolated sandbox test restore | ✅ | ✅ | ❌ | ❌ | ❌ |
| `backups.restore_production` | Execute production restore | ✅ | ❌ | ❌ | ❌ | ❌ |
| `system.maintenance_mode` | Switch Normal/Read-Only/Lock | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users.view` | View staff accounts & roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users.invite` | Invite new staff members | ✅ | ✅ | ❌ | ❌ | ❌ |
| `users.manage_roles` | Assign and modify user roles | ✅ | ✅ | ❌ | ❌ | ❌ |
| `ai.use` | Access AI Accounting Assistant | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 3. Recommended Role Assignment Policy

- **OWNER (1–2 users):** Business Proprietor / Managing Director. Has exclusive access to production restore, period locking, and sensitive audits.
- **ADMIN (1–2 users):** General Manager / Office Admin. Manages user invitations, company settings, and on-demand backups.
- **ACCOUNTANT (1–3 users):** Chief Accountant / Financial Controller. Manages day-to-day books, supplier payments, and month-end closings.
- **STAFF (3–10 users):** Front-Desk Clerks, Booking Agents, and Trip Coordinators. Enters daily passenger bookings, notes, and vehicle permits.
- **VIEWER (Auditors):** External Chartered Accountant (CA) or silent partners who need read-only access for compliance review.
