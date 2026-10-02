# Sai Tours & Travels — Security Operations Guide (SecOps)

**Document Reference:** `docs/security-operations.md`  
**Application:** AI-Powered Notes, Data & Month-End Accounting Management System  
**System Profile:** Sai Tours & Travels (`sai-tours-travels`)  
**Phase:** Phase 17 Production Deployment, Domain, SSL, Database Migration & Go-Live  
**Target Audience:** Security Officers, System Administrators, and IT Support  

---

## 1. User & Identity Lifecycle Operations

### A. Immediate User Deactivation (Offboarding / Compromised Account)
When an employee departs or an account is suspected of compromise:
1. Log in as `ADMIN` or `OWNER`.
2. Navigate to `/users`.
3. Locate the user and click **Deactivate User**.
4. Status changes to `INACTIVE`.
5. **Security Enforcement:** All active JWT sessions for that user are immediately invalidated upon next request. The user cannot access any API, dashboard, or report.

### B. Password Reset Procedure
- **Self-Service:**
  1. User clicks **Forgot Password** on `/login`.
  2. Enters registered email address.
  3. System sends secure, single-use, time-limited reset link.
- **Admin-Assisted:**
  1. An Administrator can trigger a password reset from `/users/[id]`.
  2. Temporary passwords must satisfy complexity rules: Minimum 8 characters, uppercase, lowercase, number, and special character.

### C. Periodic Role Review (Every 90 Days)
1. Review all users on `/users`.
2. Verify that `OWNER` role is assigned only to actual business proprietors.
3. Verify that `ACCOUNTANT` role is assigned only to finance staff.
4. Ensure no inactive or departed personnel retain active roles.
5. The system strictly prevents removing the **last active Owner** to avoid accidental administrative lockout.

---

## 2. Investigating Suspicious Activity in Audit Control Center

Navigate to `/audit`:
- **Filtering by Severity:** Click the **Security** tab to filter for `SECURITY` or `CRITICAL` severity events.
- **Key Security Events Monitored:**
  - `SECURITY_RATE_LIMIT_TRIGGERED`: Rapid failed login attempts from a single IP or account.
  - `SECURITY_PERMISSION_DENIED`: Unauthorized attempt to execute a restricted action.
  - `MAINTENANCE_MODE_ENABLED`: Emergency mode triggered.
  - `PRODUCTION_RESTORE_REQUESTED`: Attempt to trigger production database restore.
- **Verifying SHA-256 Hash Chaining:**
  - Click **Verify SHA-256 Hash Chain**.
  - System iterates over chronological events, recomputing cryptographic link hashes.
  - If a database row was maliciously modified or deleted out-of-band via raw SQL, the check flags `BROKEN` with the exact ID of the corrupted record.

---

## 3. Secret Rotation Standard Operating Procedure (SOP)

If an environment secret, database password, or API key is compromised:

### A. Rotating Database Credentials (`DATABASE_URL`)
1. Create a new password in your PostgreSQL/Supabase dashboard.
2. Update `DATABASE_URL` and `DIRECT_DATABASE_URL` in your hosting platform environment configuration.
3. Trigger a zero-downtime rolling deployment of the application.
4. Verify `/api/health` returns `status: "ok"`.

### B. Rotating Session Token Signing Key (`AUTH_SECRET`)
1. Generate a fresh, cryptographically random 64-character secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Update `AUTH_SECRET` in hosting provider environment settings.
3. Deploy/restart application.
4. *Effect:* All existing active user sessions will be invalidated. Users must re-authenticate with their password.

### C. Rotating AI Provider Key (`GEMINI_API_KEY`)
1. Generate a new API key in Google AI Studio.
2. Update `GEMINI_API_KEY` in hosting environment settings.
3. Delete the old key from Google AI Studio.

---

## 4. Emergency AI Kill-Switch

If the AI assistant produces unexpected outputs, high token consumption, or external service latency:
1. Log in as an administrator.
2. Update environment variable `AI_ENABLED="false"`.
3. Restart application service.
4. The AI interface safely deactivates. Core accounting, bookings, reports, and payments remain 100% operational.
