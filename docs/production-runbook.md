# Sai Tours & Travels — Production Operations Runbook

**Document Reference:** `docs/production-runbook.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 17 Production Deployment, Domain, SSL, Database Migration & Go-Live  
**Audience:** System Administrators, DevOps Engineers, and Platform Operators  

---

## 1. System Overview & Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               CLIENT DEVICES (HTTPS ONLY)              │
                    │         Mobile (375px+) | Tablet | Desktop Web         │
                    └───────────────────────────┬────────────────────────────┘
                                                │ HTTPS / TLS 1.3
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │            NEXT.JS APPLICATION (VERSION 1.0.0)         │
                    │   • Edge Proxy / Auth Middleware                       │
                    │   • Server Actions & API Routes                        │
                    │   • Central Accounting Engine (Decimal.js)             │
                    │   • PDFKit (Tamil / Unicode Font: Nirmala)             │
                    │   • Audit Chaining & Security Redaction                │
                    └───────────────┬────────────────────────┬───────────────┘
                                    │                        │
                   Database Query   │                        │ Object Storage
                   (Prisma / TLS)   │                        │ (Private Bucket)
                                    ▼                        ▼
                    ┌────────────────────────┐      ┌────────────────────────┐
                    │ PRODUCTION POSTGRESQL  │      │  ENCRYPTED VAULT / S3  │
                    │ • Row-Level Tenant ID  │      │ • Private Documents    │
                    │ • Automated Daily Dumps│      │ • SHA-256 Checksums    │
                    │ • Point-In-Time Backup │      │ • Ephemeral Signed URLs│
                    └────────────────────────┘      └────────────────────────┘
```

---

## 2. Daily Administrative & Operator Tasks

### A. System Health Verification
1. **Public Health Check:** Query `GET /api/health`. Expected response:
   ```json
   { "status": "ok", "timestamp": "2026-10-02T12:00:00.000Z" }
   ```
2. **Admin Backup & Audit Health Widget:**
   - Log in as `ADMIN` or `OWNER`.
   - View top right of `/dashboard` or navigate to `/settings/backups`.
   - Verify Backup Status shows `HEALTHY` (Green). If `WARNING` or `CRITICAL`, trigger on-demand backup.
   - Verify Audit Hash Chain shows `VERIFIED` (Green).

### B. On-Demand Backup Creation
1. Navigate to `/settings/backups` or `/backup`.
2. Click **Create Backup**.
3. Select Scope (`FULL_SYSTEM` or `DATABASE`), Environment (`PRODUCTION`), and Type (`MANUAL`).
4. Click **Request Backup**. Status will show `COMPLETED` with initial verification status `NOT_VERIFIED`.

### C. Executing Automated Test-Restore Verification
1. On `/settings/backups`, locate the completed backup record.
2. Click **Run Test Restore**.
3. System runs an automated 5-step verification in an isolated sandbox (`safetyModeActive: true`):
   - Schema & 12 Table Checks
   - Financial Balance Reconciliation
   - Closed Month-End Snapshot Hashes
   - Document Checksum Continuity
   - Audit Log SHA-256 Hash Chain
4. Upon passing, status updates to `VERIFIED` (Green badge).

---

## 3. Incident Management & Disaster Procedures

### Playbook 1: Transitioning System to Maintenance or Read-Only Mode
When investigating suspected anomalies, data imports, or scheduled maintenance:
1. Navigate to `/settings/backups`.
2. In the **Disaster Mode** panel, select:
   - **Read-Only:** Allows reading, reports, and search; rejects creates, edits, voids, and payments.
   - **Lock (Maintenance):** Locks non-administrative users out entirely with a maintenance screen.
3. Enter mandatory reason in prompt (e.g. `"Investigating supplier ledger discrepancy"`).
4. System immediately enforces server-side write blocking.
5. After investigation, click **Normal** to restore operations.

### Playbook 2: AI Provider Outage or Kill-Switch
If external AI service (Google Gemini) experiences downtime, high latency, or billing disruption:
- **Zero Financial Impact:** Core accounting, journal entries, payments, PDF reports, and Excel exports do NOT depend on AI.
- **Admin Kill-Switch:** Set environment variable `AI_ENABLED="false"` or leave `GEMINI_API_KEY=""`.
- The AI Assistant modal displays a graceful notice: *"AI Assistant is temporarily offline for maintenance. Accounting functions remain fully operational."*

### Playbook 3: Document Storage Connectivity Failure
If cloud object storage is temporarily unreachable:
- Document downloads return HTTP 503 with friendly retry message.
- Accounting engine and financial transactions remain 100% operational.
- Once storage recovers, existing files remain intact with matching SHA-256 checksums.

### Playbook 4: Database Connection Errors
If database connection times out or pool is exhausted:
1. Check database server health in hosting/provider dashboard.
2. Verify connection string `DATABASE_URL` and `DIRECT_DATABASE_URL`.
3. Check active connection pool usage. Adjust pooling limits if concurrent traffic has spiked.
4. If database process crashed, hosting platform auto-restarts the PostgreSQL container.

---

## 4. First Owner Account Bootstrap Procedure

If initializing an empty production database without an active Owner:
1. Execute the server-side bootstrap command via terminal:
   ```bash
   npm run bootstrap:owner -- --email="saipassportmdu@gmail.com" --password="Saitours@2026" --name="Sai Tours Proprietor" --business="Sai Tours & Travels" --code="SAI"
   ```
2. The script:
   - Validates password strength (rejects weak/default passwords).
   - Verifies that zero active Owners currently exist.
   - Upserts all system permissions.
   - Creates the business entity (`SAI`).
   - Provisions all role templates (`OWNER`, `ADMIN`, `ACCOUNTANT`, `STAFF`, `VIEWER`).
   - Creates the primary Owner account with status `ACTIVE`.
   - Permanently locks itself against duplicate execution.

---

## 5. Escalation Contacts & Responsibilities

| Role | Name / Contact | Primary Responsibility |
|---|---|---|
| **System Owner** | Sai Tours Management (`saipassportmdu@gmail.com`) | Final launch sign-off, production restore approval |
| **Lead Accountant** | Accounting Lead (`accounts@saitours.com`) | Monthly financial close, reconciliation verification |
| **DevOps / SysAdmin** | Technical Operations (`ops@saitours.com`) | Database migrations, backups, domain/SSL management |
