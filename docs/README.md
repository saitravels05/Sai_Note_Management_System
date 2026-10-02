# Sai Tours & Travels — Master Operational Documentation Index

**System:** AI-Powered Notes, Data & Month-End Accounting Management System  
**Business Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Production Release Version:** **V1.0 (`v1.0.0`)**  
**Last Updated:** October 2, 2026  

Welcome to the central documentation repository for the **Sai Tours & Travels** production accounting platform. This index organizes all technical blueprints, operational runbooks, user manuals, and security frameworks created across Phases 0 through 18.

---

## 1. Operational & User Manuals (Beginner-Friendly)

- **[admin-guide.md](file:///e:/Softwares/Sai%20Notes%20App/docs/admin-guide.md)**  
  *Administrator & User Guide* — Daily instructions on how to log in, create bookings, record expenses, manage users, and navigate the platform.
- **[accounting-operations.md](file:///e:/Softwares/Sai%20Notes%20App/docs/accounting-operations.md)**  
  *Accounting Operations Guide* — Rules for accrual revenue recognition, payment allocations, voids, receivables, payables, and As-Closed vs. Current reporting.
- **[reporting-guide.md](file:///e:/Softwares/Sai%20Notes%20App/docs/reporting-guide.md)**  
  *Reporting & Analytics Guide* — Catalog of standard reports, custom report builder, multi-page PDF generation, and Excel exports.
- **[month-end-guide.md](file:///e:/Softwares/Sai%20Notes%20App/docs/month-end-guide.md)**  
  *Month-End Closing & Snapshot Guide* — Step-by-step checklist for monthly closes, period locking, reopening with audit reasons, and immutable snapshot versions.
- **[excel-import-guide.md](file:///e:/Softwares/Sai%20Notes%20App/docs/excel-import-guide.md)**  
  *Excel & CSV Import Guide* — Instructions on preparing spreadsheets, column mapping, pre-flight duplicate review, and atomic database commits.
- **[document-management-guide.md](file:///e:/Softwares/Sai%20Notes%20App/docs/document-management-guide.md)**  
  *Document Management Guide* — Storing, categorizing, versioning, and previewing vehicle permits, tour agreements, and passenger identity files.
- **[ai-assistant-guide.md](file:///e:/Softwares/Sai%20Notes%20App/docs/ai-assistant-guide.md)**  
  *AI Accounting Assistant Guide* — How to query the AI assistant in English and Tamil, understanding the Golden Trust Rule, and verifying responses.

---

## 2. Technical, Security & Infrastructure Runbooks

- **[production-runbook.md](file:///e:/Softwares/Sai%20Notes%20App/docs/production-runbook.md)**  
  *Production Operations Runbook* — Daily operator tasks, health checks, on-demand backups, test restore verification, and incident handling playbooks.
- **[security-operations.md](file:///e:/Softwares/Sai%20Notes%20App/docs/security-operations.md)**  
  *Security Operations (SecOps) Guide* — User deactivations, password resets, 90-day role reviews, audit hash chain verification, secret rotation SOPs, and AI kill-switch.
- **[roles-permissions-guide.md](file:///e:/Softwares/Sai%20Notes%20App/docs/roles-permissions-guide.md)**  
  *Roles & Permissions Matrix* — Detailed breakdown of permissions across OWNER, ADMIN, ACCOUNTANT, STAFF, and VIEWER roles.
- **[disaster-recovery.md](file:///e:/Softwares/Sai%20Notes%20App/docs/disaster-recovery.md)**  
  *Disaster Recovery & Business Continuity Framework* — RPO/RTO SLAs, 10-step recovery order, 7 incident playbooks, and isolated sandbox restore rules.
- **[production-rollback.md](file:///e:/Softwares/Sai%20Notes%20App/docs/production-rollback.md)**  
  *Production Rollback Plan* — Immediate response procedures for failed deployments or critical regressions without corrupting financial records.
- **[support-maintenance.md](file:///e:/Softwares/Sai%20Notes%20App/docs/support-maintenance.md)**  
  *Support & Maintenance Plan* — Issue severity definitions (P0–P3), response SLAs, recurring maintenance schedules, and safe update workflows.

---

## 3. Architecture, Threat Modeling & Quality Assurance

- **[DATABASE_SCHEMA.md](file:///e:/Softwares/Sai%20Notes%20App/docs/DATABASE_SCHEMA.md)** & **[DATABASE_ERD.md](file:///e:/Softwares/Sai%20Notes%20App/docs/DATABASE_ERD.md)**  
  *Database Schema & Entity Relationship Diagrams* — Complete relational schema, indexes, enums, and foreign keys.
- **[phase_5_accounting_architecture.md](file:///e:/Softwares/Sai%20Notes%20App/docs/phase_5_accounting_architecture.md)**  
  *Accounting Engine Architecture* — Double-entry principles, Decimal.js precision policies, and running balance rules.
- **[threat-model.md](file:///e:/Softwares/Sai%20Notes%20App/docs/threat-model.md)**  
  *System Threat Model* — Asset classification, STRIDE analysis, attack vectors, and multi-layered defenses.
- **[security-review.md](file:///e:/Softwares/Sai%20Notes%20App/docs/security-review.md)**  
  *Comprehensive Security Review* — Technical audit of authentication, tenant isolation, injection defenses, and CSP headers.
- **[production-readiness-test-plan.md](file:///e:/Softwares/Sai%20Notes%20App/docs/production-readiness-test-plan.md)**  
  *Test Plan & Execution Matrix* — Detailed evidence for all 32 core test cases across accounting, security, and concurrency.
- **[production-readiness.md](file:///e:/Softwares/Sai%20Notes%20App/docs/production-readiness.md)**  
  *Production Readiness Certification* — Quality gate scorecard certifying zero P0/P1 defects and full production readiness.

---

## 4. Release, Handover & Governance

- **[go-live-record.md](file:///e:/Softwares/Sai%20Notes%20App/docs/go-live-record.md)**  
  *Official Go-Live Record* — Deployment metadata, infrastructure statuses, and initial smoke test results.
- **[business-acceptance-test.md](file:///e:/Softwares/Sai%20Notes%20App/docs/business-acceptance-test.md)**  
  *Business Acceptance Test (BAT) Matrix* — Operational verification results across all 5 user roles.
- **[known-limitations.md](file:///e:/Softwares/Sai%20Notes%20App/docs/known-limitations.md)**  
  *Known Limitations Register* — Transparent register of features intentionally excluded from V1.0 (e.g. OCR, WhatsApp bots).
- **[v1.1-roadmap.md](file:///e:/Softwares/Sai%20Notes%20App/docs/v1.1-roadmap.md)**  
  *V1.1 Future Enhancement Roadmap* — Prioritized post-V1.0 candidates (OCR, automated WhatsApp, bank statement feeds).
- **[v1.0-signoff.md](file:///e:/Softwares/Sai%20Notes%20App/docs/v1.0-signoff.md)**  
  *Formal Business Acceptance Sign-Off* — Official executive sign-off document for business handover.
- **[RELEASE_NOTES_V1.0.md](file:///e:/Softwares/Sai%20Notes%20App/RELEASE_NOTES_V1.0.md)**  
  *Official V1.0 Release Notes* — Complete feature summary and upgrade notes.
