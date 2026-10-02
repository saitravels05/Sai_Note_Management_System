# Sai Tours & Travels — Production Rollback Plan

**Document Reference:** `docs/production-rollback.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 17 Production Deployment, Domain, SSL, Database Migration & Go-Live  
**Classification:** Critical Operational Procedure  

---

## 1. When to Initiate Rollback

A production rollback is a high-severity emergency intervention. Trigger rollback ONLY under the following documented criteria:

| Severity | Trigger Condition | Decision Authority | Action |
|---|---|---|---|
| **P0** | **Total Outage / Unhandled Crash:** Application fails to start, core routing crashes, or HTTP 500 error rate exceeds 5% during initial post-deployment window. | Release Owner / Lead Engineer | Immediate code rollback |
| **P0** | **Financial Integrity Breakdown:** Core calculations (Income, Expenses, Net Result, Receivables, Payables) produce discrepancies or corrupt accounting state. | Lead Accountant & Owner | Immediate maintenance lockdown + rollback |
| **P0** | **Cross-Tenant Security Breach:** Tenant isolation failure detected (e.g. Business A can view or search Business B records). | Security Officer / Owner | Immediate maintenance lockdown + rollback |
| **P1** | **Database Migration Failure:** Schema migration fails mid-execution or produces broken constraints that cannot be hotfixed forward within 15 minutes. | Database Administrator | Database recovery / forward patch |
| **P1** | **Authentication Lockout:** Valid users cannot log in due to JWT secret mismatch or session cookie failure. | Release Owner | Rollback auth config / deployment |

---

## 2. Rollback Strategies: Application vs. Database

```
                           ┌────────────────────────────────────────────────────────┐
                           │                  INCIDENT DISCOVERY                    │
                           └───────────────────────────┬────────────────────────────┘
                                                       │
                           ┌───────────────────────────┴────────────────────────────┐
                           ▼                                                        ▼
         ┌───────────────────────────────────┐                    ┌───────────────────────────────────┐
         │     CODE / APPLICATION ONLY       │                    │    SCHEMA / DATA CORRUPTION       │
         ├───────────────────────────────────┤                    ├───────────────────────────────────┤
         │ • Fast rollback to previous build │                    │ • Never rollback DB if users have │
         │ • Zero database restoration       │                    │   created real new transactions   │
         │ • Immediate recovery (< 5 mins)   │                    │ • Use forward fix or Point-In-Time│
         └───────────────────────────────────┘                    └───────────────────────────────────┘
```

### Strategy A: Application-Only Code Rollback (Preferred & Safest)
*Use when database schema is backward-compatible and only UI/application logic is defective.*
1. Re-deploy the previously verified stable container/commit image (e.g. `v0.9.9` or previous git SHA).
2. Hosting platform (Vercel, AWS, Render, Docker) instantly points traffic to the previous deployment.
3. Database remains untouched. No transaction loss.
4. Total execution time: **< 3 minutes**.

### Strategy B: Database Forward Fix vs. Rollback (Critical Financial Rule)
*Mandatory Rule: Never blindly execute a destructive SQL `DROP TABLE` or restore an old database snapshot if users have already entered valid production accounting transactions.*
- **Scenario 1 (Pre-Traffic / Zero Real Transactions):**
  If migration fails before real business operations begin, restore the verified pre-migration snapshot created prior to deployment.
- **Scenario 2 (Post-Traffic / Real Transactions Exist):**
  Do NOT restore an old database snapshot, as doing so destroys legitimate customer bookings and payments. Instead, apply a forward non-destructive migration script that resolves the defect while preserving newly created rows.

---

## 3. Step-by-Step Production Rollback Execution Procedure

### Step 1: Emergency Lockdown (Phase 15 Maintenance Mode)
Immediately transition the application to `MAINTENANCE` mode using server action `setMaintenanceModeAction("MAINTENANCE", "Emergency rollback in progress")`. Non-administrative users receive a friendly maintenance splash screen; financial mutations are strictly blocked.

### Step 2: Identify Incident Scope
Inspect structured logs (`LOG_LEVEL=INFO` or `ERROR`) to determine:
- Was it caused by a code regression?
- Was it caused by a database migration failure?
- Was it caused by environment variable misconfiguration (e.g. missing `AUTH_SECRET`, incorrect `DATABASE_URL`)?

### Step 3: Execute Target Rollback Action
- **If Application Code:** Revert deployment target in hosting provider console to previous release version.
- **If Environment Variables:** Correct the missing or invalid variable in hosting secrets manager and trigger zero-downtime rolling restart.
- **If Critical Database Migration:** Execute pre-tested migration down script or forward corrective migration.

### Step 4: Storage & Object Synchronization
Verify that any uploaded document artifacts created during the failed release remain intact in private object storage (`s3://sai-accounting-vault` or `./uploads`). Ensure no dangling pointers or orphaned file references exist.

### Step 5: Post-Rollback Smoke Verification
Execute the following verification checklist before reopening traffic:
1. Verify `GET /api/health` returns HTTP 200 `status: "ok"`.
2. Authenticate as Owner and navigate to `/dashboard`.
3. Check `/records`, `/receivables`, and `/payables` to confirm balances match pre-incident numbers.
4. Run `AuditService.verifyIntegrity(businessId)` to confirm SHA-256 hash chaining remains intact.

### Step 6: Reopen Production Access
Transition system maintenance mode back to `NORMAL`:
`setMaintenanceModeAction("NORMAL", "Rollback completed and system verified")`.

### Step 7: Stakeholder Communication & Incident Post-Mortem
1. Notify Owner and primary operators that the platform is operational on the stable release.
2. Draft an Incident Post-Mortem documenting: Root Cause, Timeline, Resolution, Preventative Measures.
