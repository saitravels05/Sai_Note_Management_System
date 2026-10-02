# Sai Tours & Travels — Support & Maintenance Plan

**Document Reference:** `docs/support-maintenance.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 18 Final QA, Business Acceptance, Launch Sign-Off & V1.0 Handover  
**Target Audience:** Technical Support, System Operators, and Business Management  

---

## 1. Issue Classification & Incident Severities

| Severity | Definition & Examples | Target Response | Target Resolution | Escalation Path |
|---|---|---|---|---|
| **P0 — Critical** | Total system outage, cross-tenant data leak, financial calculation failure, double payment deduction, or active security breach. | **< 15 minutes** | **< 2 hours** | Immediate call to Lead DevOps & Owner |
| **P1 — High** | Major functional failure without workaround (e.g. Month-End closing fails, PDF generation crashes, document upload fails). | **< 1 hour** | **< 8 hours** | Senior Engineer & Lead Accountant |
| **P2 — Medium** | Non-critical bug with operational workaround (e.g. minor UI display glitch, non-blocking export delay, slow search). | **< 4 hours** | **< 48 hours** | Support Team Sprint Backlog |
| **P3 — Low** | Cosmetic adjustment, minor layout wrapping, or minor feature request. | **< 24 hours** | Next Scheduled Release | V1.1 Enhancement Roadmap |

---

## 2. Recurring Maintenance Schedule

### Daily Routine (Automated + 2-Minute Operator Check)
- [ ] **Automated Backup:** Confirm automated database dump completed successfully.
- [ ] **Health Check:** Operator views `/dashboard` backup widget; confirms green `HEALTHY` status.
- [ ] **Error Log Inspection:** Check server logs for any unhandled HTTP 500 exceptions.

### Weekly Routine (15 Minutes)
- [ ] **Automated Sandbox Test-Restore:** Run automated test restore on latest backup via `/settings/backups`. Confirm verification status changes to `VERIFIED`.
- [ ] **Audit Hash Chain Check:** Execute SHA-256 integrity verification in `/audit`.
- [ ] **Failed Uploads Review:** Inspect storage quarantine folder for abandoned file uploads.

### Monthly Routine (During Month-End Close)
- [ ] **Access & Role Review:** Inspect active accounts on `/users`; deactivate departed staff.
- [ ] **Month-End Snapshot Confirmation:** Confirm closed period snapshot generated and archived.
- [ ] **Storage Growth Check:** Monitor disk usage for database and document storage.

### Quarterly Routine (Every 90 Days)
- [ ] **Disaster Recovery Tabletop Drill:** Review `docs/disaster-recovery.md` with operational team.
- [ ] **Dependency Security Audit:** Run `npm audit` in staging; test and apply non-breaking patches.
- [ ] **Secret Rotation Assessment:** Review whether API keys or session secrets require rotation.

---

## 3. Safe Dependency & Security Update Workflow

> [!WARNING]
> **Never blindly run `npm update` on a live production server.**

When applying security patches or dependency updates:
1. **Local Review:** Check release notes of updated packages.
2. **Local Regression Test:** Run full automated test suite (`npm test`).
3. **Staging Dry Run:** Deploy update to staging environment; run business acceptance suite.
4. **Backup Confirmation:** Confirm latest production backup is verified.
5. **Scheduled Deployment:** Deploy to production during low-traffic window (e.g. 11:00 PM – 12:00 AM IST).
6. **Post-Deployment Verification:** Check `/api/health`, log in as Owner, and verify financial summaries.

---

## 4. Support Contacts & Escalation Matrix

- **Primary Technical Support:** Antigravity Engineering Support (`support@saitourstravels.com`)
- **Emergency Incident Hotline:** Designated Technical Lead
- **Business Operations Escalation:** Sai Tours & Travels Management (`saipassportmdu@gmail.com`)
