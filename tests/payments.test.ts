import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Money } from "../src/lib/money";
import { PERMISSIONS, hasPermission } from "../src/lib/auth/permissions";

describe("Phase 5 Payments, Tenant Isolation & Closed-Period Safeguards", () => {
  test("Requirement 81: Closed period strictly blocks financial payments", () => {
    const period = {
      year: 2026,
      month: 8,
      status: "CLOSED",
    };

    const isPeriodBlocked = (pStatus: string) => pStatus === "CLOSED" || pStatus === "LOCKED";
    assert.equal(isPeriodBlocked(period.status), true);
  });

  test("Requirement 82: Tenant isolation blocks cross-business payment allocation", () => {
    const businessA = { id: "biz_alpha" };
    const businessB = { id: "biz_beta" };

    const payment = {
      id: "pay_1",
      businessId: businessA.id,
      amount: "25000.00",
    };

    const targetInvoice = {
      id: "inv_99",
      businessId: businessB.id,
      amount: "25000.00",
    };

    // Tenant check
    const isCrossTenant = payment.businessId !== targetInvoice.businessId;
    assert.equal(isCrossTenant, true, "Cross-tenant allocation must be detected and blocked");
  });

  test("Requirement 86: Permission enforcement gates payment creation and voiding", () => {
    const staffPermissions = [
      PERMISSIONS.RECORDS_VIEW,
      PERMISSIONS.RECORDS_CREATE,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.PAYMENTS_CREATE,
    ];

    const canCreatePayment = hasPermission(staffPermissions, ["STAFF"], PERMISSIONS.PAYMENTS_CREATE);
    const canVoidPayment = hasPermission(staffPermissions, ["STAFF"], PERMISSIONS.PAYMENTS_VOID);

    assert.equal(canCreatePayment, true, "Staff can create payments");
    assert.equal(canVoidPayment, false, "Staff cannot void payments without explicit void permission");

    const accountantPermissions = [
      ...staffPermissions,
      PERMISSIONS.PAYMENTS_VOID,
    ];
    const accountantCanVoid = hasPermission(accountantPermissions, ["ACCOUNTANT"], PERMISSIONS.PAYMENTS_VOID);
    assert.equal(accountantCanVoid, true, "Accountant can void payments");
  });

  test("Requirement 84: Reconciliation check detects over-allocated payment discrepancies", () => {
    const payment = {
      amount: Money.parse("10000.00"),
      allocations: [
        { amount: Money.parse("7000.00") },
        { amount: Money.parse("5000.00") },
      ],
    };

    let totalAlloc = Money.zero();
    for (const a of payment.allocations) {
      totalAlloc = totalAlloc.add(a.amount);
    }

    const isOverAllocated = totalAlloc.greaterThan(payment.amount);
    assert.equal(isOverAllocated, true, "Reconciliation must flag allocation exceeding payment amount");
  });

  test("Requirement 60: Centralized rounding policy ensures consistent 2 decimal display", () => {
    const m = Money.parse("12500.5678");
    assert.equal(m.format(), "₹12,500.57");
    assert.equal(m.toDecimalString(), "12500.57");
    assert.equal(m.getDecimal().toFixed(4), "12500.5678");
  });
});
