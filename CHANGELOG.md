# Changelog

All notable changes to the **AI-Powered Notes, Data & Month-End Accounting Management System** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-02

### Added
- **Core Production Foundation (Phase 0–1):** Next.js 16 App Router architecture, TypeScript strict mode, responsive Tailwind CSS styling, error boundaries, and environment validation.
- **Accounting Data Model & Engine (Phase 2, 5):** Double-entry journal engine, multi-currency support (INR ₹), real-time ledger balancing, dual-basis (Cash & Accrual) calculation, customer receivables, and supplier payables.
- **Authentication & RBAC (Phase 3):** Stateless JWT session tokens in secure HTTP-only cookies, Bcrypt password hashing, and server-side RBAC across 5 roles (`OWNER`, `ADMIN`, `ACCOUNTANT`, `STAFF`, `VIEWER`).
- **Smart Notes & Records (Phase 4):** Tagged operational notes, quick financial entry, entity linking, and full-text search.
- **Analytics Dashboard (Phase 6):** Real-time KPI summary widgets (Total Income, Total Expenses, Net Profit, Receivables, Payables, Cash Position) with period filters.
- **Bi-directional Excel & CSV Interchange (Phase 7–8):** High-performance streaming XLSX exports and a two-phase transactional bulk import engine with duplicate warning detection.
- **Professional PDF Reporting (Phase 9):** Vector PDFKit report generation featuring corporate branding for Sai Tours & Travels, currency formatting, and Tamil Unicode typography support.
- **Month-End Closing & Snapshot Engine (Phase 10):** Pre-close validation checks, immutable period locking, frozen balance snapshots, and audited reopening workflows.
- **Secure AI Accounting Assistant (Phase 11):** Natural language query translation layer grounded strictly in deterministic database outputs with zero ledger mutation permissions.
- **Customer & Supplier CRM (Phase 12):** Unified counterparty profiles, invoice histories, collection follow-up task schedules, and promise-to-pay commitment logging.
- **Secure Document Management (Phase 13):** Isolated private cloud object storage, category permissions, version tracking, and cryptographically signed ephemeral URLs.
- **Advanced Report Builder (Phase 14):** AST-based custom query builder supporting ad-hoc grouping, custom filters, aggregate functions, and live vs. as-closed comparisons.
- **Audit, Backup & Disaster Recovery (Phase 15):** Tamper-evident mutation audit logging, automated backup generation with SHA-256 checksums, and cold restore verification runbooks.
- **Full-System Testing & Hardening (Phase 16):** 41 comprehensive test suites (245 unit and integration tests), security penetration test validations, and defense-in-depth security headers.
- **Production Deployment & Go-Live (Phase 17):** Production environment configuration, database migration verification, health checks, domain/SSL validation, and zero demo data enforcement.
- **Final QA & Business Acceptance (Phase 18):** 18 end-to-end business acceptance test scenarios, role-based verifications, comprehensive operational guides in `docs/`, and formal handover specifications.

### Security
- Defense-in-depth HTTP security headers (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- In-memory rate limiting across authentication and API endpoints.
- Strict Zod schema validation across all API boundaries.
- Cross-tenant denial verification ensuring zero data leakage between business entities.
