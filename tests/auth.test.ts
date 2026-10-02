import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../src/lib/auth/password";
import { signSessionToken, verifySessionToken, type SessionPayload } from "../src/lib/auth/session";
import { sanitizeRedirectUrl } from "../src/lib/auth/open-redirect";
import { RateLimiter } from "../src/lib/auth/rate-limiter";
import { PERMISSIONS, ROLE_PERMISSION_TEMPLATES, hasPermission } from "../src/lib/auth/permissions";
import { AuthorizationService } from "../src/server/services/authorization.service";
import { RoleType } from "@prisma/client";

describe("Phase 3 Authentication — Password Security & Hashing", () => {
  test("hashes plaintext password and verifies securely", async () => {
    const password = "SaiSecurePassword#2026";
    const hash = await hashPassword(password);

    assert.notEqual(hash, password, "Hash must never equal plaintext");
    assert.match(hash, /^\$2[aby]\$\d{2}\$/, "Must be a valid bcrypt hash with high workfactor");

    const isValid = await verifyPassword(password, hash);
    assert.equal(isValid, true, "Valid password must verify successfully");

    const isWrong = await verifyPassword("WrongPassword123!", hash);
    assert.equal(isWrong, false, "Invalid password must be rejected");
  });

  test("validates password strength according to production standards", () => {
    // Under 8 characters
    const short = validatePasswordStrength("Sai1!");
    assert.equal(short.isValid, false);
    assert.match(short.message || "", /at least 8 characters/);

    // Missing uppercase
    const noUpper = validatePasswordStrength("saitours123#");
    assert.equal(noUpper.isValid, false);

    // Missing numbers/special chars
    const noSpecial = validatePasswordStrength("SaiToursLongPassword");
    assert.equal(noSpecial.isValid, false);

    // Strong password
    const strong = validatePasswordStrength("SaiTours@2026");
    assert.equal(strong.isValid, true);
  });
});

describe("Phase 3 Session Security — JWT & Expiration", () => {
  const samplePayload: SessionPayload = {
    userId: "usr_12345",
    authUserId: "auth_12345",
    businessId: "biz_sai_tours",
    email: "owner@saitours.com",
    displayName: "Sai Proprietor",
    roles: ["OWNER"],
    roleTypes: [RoleType.OWNER],
    permissions: Object.values(PERMISSIONS),
  };

  test("signs and verifies stateless JWT session token", async () => {
    const token = await signSessionToken(samplePayload, false);
    assert.ok(typeof token === "string" && token.length > 50, "JWT token must be a non-empty string");

    const verified = await verifySessionToken(token);
    assert.ok(verified, "Session token must verify");
    assert.equal(verified?.userId, samplePayload.userId);
    assert.equal(verified?.businessId, samplePayload.businessId);
    assert.equal(verified?.email, samplePayload.email);
    assert.equal(verified?.displayName, samplePayload.displayName);
    assert.deepEqual(verified?.roles, ["OWNER"]);
    assert.deepEqual(verified?.roleTypes, [RoleType.OWNER]);
  });

  test("rejects malformed or tampered JWT session tokens", async () => {
    const verifiedMalformed = await verifySessionToken("malformed.jwt.token");
    assert.equal(verifiedMalformed, null, "Malformed token must return null");

    const validToken = await signSessionToken(samplePayload, false);
    const tampered = validToken.slice(0, -6) + "xxxxxx";
    const verifiedTampered = await verifySessionToken(tampered);
    assert.equal(verifiedTampered, null, "Tampered signature must be rejected");
  });
});

describe("Phase 3 Security — Open Redirect & Rate Limiting", () => {
  test("sanitizes returnTo parameter to prevent open redirect attacks", () => {
    // Valid relative internal paths
    assert.equal(sanitizeRedirectUrl("/dashboard"), "/dashboard");
    assert.equal(sanitizeRedirectUrl("/records?filter=all"), "/records?filter=all");
    assert.equal(sanitizeRedirectUrl("/month-end"), "/month-end");

    // Malicious external URLs
    assert.equal(sanitizeRedirectUrl("https://malicious-site.com"), "/dashboard");
    assert.equal(sanitizeRedirectUrl("http://phishing.com/login"), "/dashboard");
    assert.equal(sanitizeRedirectUrl("//attacker.com"), "/dashboard");
    assert.equal(sanitizeRedirectUrl("/\\attacker.com"), "/dashboard");
    assert.equal(sanitizeRedirectUrl("javascript:alert(1)"), "/dashboard");
    assert.equal(sanitizeRedirectUrl(null), "/dashboard");
    assert.equal(sanitizeRedirectUrl(""), "/dashboard");
  });

  test("rate limiter throttles excessive failed authentication attempts", () => {
    const testId = "attacker@example.com";
    RateLimiter.resetAttempts(testId);

    for (let i = 0; i < 4; i++) {
      RateLimiter.recordFailedAttempt(testId);
      const status = RateLimiter.isRateLimited(testId);
      assert.equal(status.limited, false, `Attempt ${i + 1} should not be rate-limited`);
    }

    // 5th attempt hits limit
    RateLimiter.recordFailedAttempt(testId);
    const finalStatus = RateLimiter.isRateLimited(testId);
    assert.equal(finalStatus.limited, true, "5th attempt must trigger rate limit");
    assert.ok(finalStatus.retryAfterSeconds > 0, "Must provide retry-after duration");

    // Success clears rate limit
    RateLimiter.resetAttempts(testId);
    assert.equal(RateLimiter.isRateLimited(testId).limited, false, "Reset clears rate limit");
  });
});

describe("Phase 3 Authorization — Role Templates & Permission Matrix", () => {
  test("OWNER role template possesses full administrative and ledger permissions", () => {
    const ownerPerms = ROLE_PERMISSION_TEMPLATES.OWNER;
    assert.ok(ownerPerms.includes(PERMISSIONS.RECORDS_CREATE));
    assert.ok(ownerPerms.includes(PERMISSIONS.MONTH_END_CLOSE));
    assert.ok(ownerPerms.includes(PERMISSIONS.USERS_MANAGE));
    assert.ok(ownerPerms.includes(PERMISSIONS.AUDIT_VIEW));
    assert.ok(ownerPerms.includes(PERMISSIONS.SETTINGS_MANAGE));

    // hasPermission for OWNER evaluates to true for anything
    assert.equal(hasPermission(ownerPerms, [RoleType.OWNER], "any.unlisted.permission"), true);
  });

  test("ACCOUNTANT role possesses financial operations but lacks user management", () => {
    const accountantPerms = ROLE_PERMISSION_TEMPLATES.ACCOUNTANT;
    assert.ok(accountantPerms.includes(PERMISSIONS.RECORDS_CREATE));
    assert.ok(accountantPerms.includes(PERMISSIONS.MONTH_END_CLOSE));
    assert.ok(accountantPerms.includes(PERMISSIONS.REPORTS_VIEW));
    assert.equal(accountantPerms.includes(PERMISSIONS.USERS_MANAGE), false, "Accountant must not manage users");
    assert.equal(accountantPerms.includes(PERMISSIONS.AUDIT_VIEW), false, "Accountant must not manage audit logs");

    assert.equal(hasPermission(accountantPerms, [RoleType.ACCOUNTANT], PERMISSIONS.MONTH_END_CLOSE), true);
    assert.equal(hasPermission(accountantPerms, [RoleType.ACCOUNTANT], PERMISSIONS.USERS_MANAGE), false);
  });

  test("STAFF role is limited to operational entry and notes without month-end locking", () => {
    const staffPerms = ROLE_PERMISSION_TEMPLATES.STAFF;
    assert.ok(staffPerms.includes(PERMISSIONS.RECORDS_CREATE));
    assert.ok(staffPerms.includes(PERMISSIONS.CUSTOMERS_MANAGE));
    assert.ok(staffPerms.includes(PERMISSIONS.NOTES_MANAGE));

    assert.equal(staffPerms.includes(PERMISSIONS.MONTH_END_CLOSE), false, "Staff cannot close accounting periods");
    assert.equal(staffPerms.includes(PERMISSIONS.MONTH_END_REOPEN), false, "Staff cannot reopen accounting periods");
    assert.equal(staffPerms.includes(PERMISSIONS.USERS_MANAGE), false, "Staff cannot manage users");
    assert.equal(staffPerms.includes(PERMISSIONS.AUDIT_VIEW), false, "Staff cannot view audit logs");
  });

  test("VIEWER role is strictly read-only", () => {
    const viewerPerms = ROLE_PERMISSION_TEMPLATES.VIEWER;
    assert.ok(viewerPerms.includes(PERMISSIONS.RECORDS_VIEW));
    assert.ok(viewerPerms.includes(PERMISSIONS.REPORTS_VIEW));

    assert.equal(viewerPerms.includes(PERMISSIONS.RECORDS_CREATE), false);
    assert.equal(viewerPerms.includes(PERMISSIONS.RECORDS_EDIT), false);
    assert.equal(viewerPerms.includes(PERMISSIONS.RECORDS_VOID), false);
    assert.equal(viewerPerms.includes(PERMISSIONS.USERS_MANAGE), false);
  });
});

describe("Phase 3 Mandatory Security Test — Cross-Business Tenant Isolation", () => {
  test("User belonging to Business A is strictly forbidden from accessing Business B data", async () => {
    const userA = {
      id: "usr_A",
      businessId: "biz_sai_tours_A",
      displayName: "Staff User A",
    };

    const userB = {
      id: "usr_B",
      businessId: "biz_competitor_B",
      displayName: "Staff User B",
    };

    // User A accessing Business A -> Allowed
    await assert.doesNotReject(
      async () => {
        await AuthorizationService.requireBusinessAccess(userA, "biz_sai_tours_A");
      },
      "User A should have access to Business A"
    );

    // User A attempting to access Business B -> Strictly Rejected with 403 Forbidden
    await assert.rejects(
      async () => {
        await AuthorizationService.requireBusinessAccess(userA, "biz_competitor_B");
      },
      {
        name: "ForbiddenError",
        message: /Cross-tenant access prohibited/,
      },
      "User A MUST be blocked from accessing Business B"
    );

    // User B attempting to access Business A -> Strictly Rejected with 403 Forbidden
    await assert.rejects(
      async () => {
        await AuthorizationService.requireBusinessAccess(userB, "biz_sai_tours_A");
      },
      {
        name: "ForbiddenError",
        message: /Cross-tenant access prohibited/,
      },
      "User B MUST be blocked from accessing Business A"
    );
  });
});

describe("Phase 3 Mandatory Security Test — Server-Side Permission Enforcement", () => {
  test("Staff user with records.create=YES and audit.view=NO is correctly gated server-side", async () => {
    const staffPermissions = ROLE_PERMISSION_TEMPLATES.STAFF;
    const staffRoles = ["STAFF"];

    // Operation 1: Create record -> Allowed
    assert.equal(hasPermission(staffPermissions, staffRoles, PERMISSIONS.RECORDS_CREATE), true);
    await assert.doesNotReject(async () => {
      await AuthorizationService.requirePermission(staffPermissions, staffRoles, PERMISSIONS.RECORDS_CREATE);
    });

    // Operation 2: Audit log view -> Denied with ForbiddenError
    assert.equal(hasPermission(staffPermissions, staffRoles, PERMISSIONS.AUDIT_VIEW), false);
    await assert.rejects(
      async () => {
        await AuthorizationService.requirePermission(staffPermissions, staffRoles, PERMISSIONS.AUDIT_VIEW);
      },
      {
        name: "ForbiddenError",
        message: /Missing required permission audit\.view/,
      }
    );

    // Operation 3: User management -> Denied with ForbiddenError
    await assert.rejects(
      async () => {
        await AuthorizationService.requirePermission(staffPermissions, staffRoles, PERMISSIONS.USERS_MANAGE);
      },
      {
        name: "ForbiddenError",
        message: /Missing required permission users\.manage/,
      }
    );
  });
});
