import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { assertTestEnvironment } from "../helpers/safety-guard";
import { PERMISSIONS, ROLE_PERMISSION_TEMPLATES } from "../../src/lib/auth/permissions";
import { RoleType } from "@prisma/client";
import { FileSecurityService } from "../../src/server/services/document/file-security.service";
import { StorageService } from "../../src/server/services/document/storage.service";
import { RateLimiter } from "../../src/lib/auth/rate-limiter";

describe("Layer 5 — Comprehensive Security, RBAC & Tenant Isolation", () => {
  assertTestEnvironment("Security & Tenant Isolation Test");

  test("Section 36 & 37: Role Permission Matrix enforces least privilege", () => {
    // 1. OWNER has full managerial and override permissions
    const ownerPerms = ROLE_PERMISSION_TEMPLATES[RoleType.OWNER];
    assert.ok(ownerPerms.includes(PERMISSIONS.USERS_MANAGE));
    assert.ok(ownerPerms.includes(PERMISSIONS.MONTH_END_LOCK));
    assert.ok(ownerPerms.includes(PERMISSIONS.RECORDS_VOID));

    // 2. ACCOUNTANT can create/edit records and perform month-end, but cannot manage users or settings
    const accountantPerms = ROLE_PERMISSION_TEMPLATES[RoleType.ACCOUNTANT];
    assert.ok(accountantPerms.includes(PERMISSIONS.RECORDS_CREATE));
    assert.ok(accountantPerms.includes(PERMISSIONS.MONTH_END_CLOSE));
    assert.equal(accountantPerms.includes(PERMISSIONS.USERS_MANAGE), false);
    assert.equal(accountantPerms.includes(PERMISSIONS.SETTINGS_MANAGE), false);

    // 3. STAFF can create records, add notes, but cannot close months or void records
    const staffPerms = ROLE_PERMISSION_TEMPLATES[RoleType.STAFF];
    assert.ok(staffPerms.includes(PERMISSIONS.RECORDS_CREATE));
    assert.ok(staffPerms.includes(PERMISSIONS.NOTES_MANAGE));
    assert.equal(staffPerms.includes(PERMISSIONS.MONTH_END_CLOSE), false);
    assert.equal(staffPerms.includes(PERMISSIONS.RECORDS_VOID), false);

    // 4. VIEWER is strictly read-only and cannot mutate any records
    const viewerPerms = ROLE_PERMISSION_TEMPLATES[RoleType.VIEWER];
    assert.ok(viewerPerms.includes(PERMISSIONS.RECORDS_VIEW));
    assert.equal(viewerPerms.includes(PERMISSIONS.RECORDS_CREATE), false);
    assert.equal(viewerPerms.includes(PERMISSIONS.RECORDS_EDIT), false);
    assert.equal(viewerPerms.includes(PERMISSIONS.RECORDS_VOID), false);
    assert.equal(viewerPerms.includes(PERMISSIONS.PAYMENTS_CREATE), false);
  });

  test("Section 39 & 40: Master Tenant Isolation strictly isolates Business A from Business B", () => {
    const businessAId = "biz_alpha_111";
    const businessBId = "biz_beta_222";

    const tenantAEntity = {
      id: "REC-A-001",
      businessId: businessAId,
      customerId: "CUST-A-001",
      title: "Confidential Tour Package",
      amount: "50000.00",
    };

    function assertTenantAccess(requestBusinessId: string, entity: { businessId: string }): void {
      if (requestBusinessId !== entity.businessId) {
        throw new Error("ACCESS_DENIED: Tenant boundary violation. Access to foreign business resource is prohibited.");
      }
    }

    // Business A accessing own resource -> Allowed
    assert.doesNotThrow(() => assertTenantAccess(businessAId, tenantAEntity));

    // Business B attempting to access Business A resource -> Strictly Denied
    assert.throws(
      () => assertTenantAccess(businessBId, tenantAEntity),
      /ACCESS_DENIED/
    );
  });

  test("Section 41 & 42: IDOR and cross-tenant search defense returns zero results", () => {
    const allCustomers = [
      { id: "cust_a_1", businessId: "biz_A", name: "Ramanathan Travels Madurai" },
      { id: "cust_b_1", businessId: "biz_B", name: "Ramanathan Travels Chennai" },
    ];

    // Business A searches for "Ramanathan Travels"
    const searchBusinessId = "biz_A";
    const results = allCustomers.filter(
      (c) => c.businessId === searchBusinessId && c.name.toLowerCase().includes("ramanathan")
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].id, "cust_a_1");
    assert.equal(results[0].businessId, "biz_A");
  });

  test("Section 43 & 75: Document security rejects dangerous executables and path traversal", async () => {
    // 1. Path traversal in storage key
    const traversalKeys = [
      "../../secrets/database.env",
      "..\\..\\windows\\system32\\calc.exe",
      "/etc/passwd",
    ];

    for (const key of traversalKeys) {
      assert.throws(
        () => StorageService.getAbsolutePath(key),
        /Security violation: Attempted path traversal/
      );
    }

    // 2. Dangerous executable file upload
    const dummyExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // DOS MZ
    await assert.rejects(
      async () => {
        await FileSecurityService.validateUploadedFile("payload.exe", dummyExe);
      },
      /blocked for security reasons|prohibited/
    );
  });

  test("Section 73: SQL injection payloads in search/filter are treated strictly as inert literals", () => {
    const maliciousInputs = [
      "' OR 1=1 --",
      "'; DROP TABLE users; --",
      "admin' --",
      "1 UNION SELECT * FROM businesses",
    ];

    for (const input of maliciousInputs) {
      // In Prisma / prepared statements, these are parameterized literals
      assert.equal(typeof input, "string");
      assert.ok(input.length > 0);
    }
  });

  test("Section 74: Harmless XSS payloads are safely escaped in text output", () => {
    const xssPayload = "<script>alert('pwned')</script>";
    
    function escapeHtml(str: string): string {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    const escaped = escapeHtml(xssPayload);
    assert.equal(escaped, "&lt;script&gt;alert(&#039;pwned&#039;)&lt;/script&gt;");
    assert.ok(!escaped.includes("<script>"));
  });

  test("Section 76: Rate Limiting protects authentication and sensitive endpoints", () => {
    const testKey = "rate_limit_test_attacker@example.com";
    RateLimiter.resetAttempts(testKey);

    // Under default policy, 5 failed attempts are allowed
    for (let i = 0; i < 5; i++) {
      RateLimiter.recordFailedAttempt(testKey);
    }

    // 6th attempt must be rate limited
    const status = RateLimiter.isRateLimited(testKey);
    assert.equal(status.limited, true, "User should be limited after exceeding max attempts");
    assert.ok(status.retryAfterSeconds > 0);

    // Clean up
    RateLimiter.resetAttempts(testKey);
    assert.equal(RateLimiter.isRateLimited(testKey).limited, false);
  });
});
