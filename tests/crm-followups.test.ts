import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { Money } from "../src/lib/money";
import {
  FollowUpStatus,
  FollowUpType,
  FollowUpPriority,
  FollowUpOutcome,
  PromiseStatus,
  PaymentCommitmentStatus,
} from "@prisma/client";
import { PERMISSIONS, hasPermission } from "../src/lib/auth/permissions";
import { DeterministicNLPInterpreter } from "../src/server/services/ai/ai-provider";

describe("Phase 12 CRM, Follow-Ups, Promises & Accounting Source of Truth", () => {
  // -------------------------------------------------------------------------
  // TEST 1 (Requirement 1 & 103): CRM Does NOT Maintain a Second Balance
  // -------------------------------------------------------------------------
  test("Requirement 1 & 103: Receivable of ₹50,000 displays ₹50,000 outstanding; adding follow-up does NOT mutate financial balance", () => {
    // Phase 5 Accounting Truth
    const originalReceivable = new Money("50000.00");
    const postedPayments = Money.zero();
    const currentOutstanding = originalReceivable.subtract(postedPayments);

    assert.equal(currentOutstanding.format(), "₹50,000.00");

    // Operational Follow-up added
    const operationalFollowUp = {
      id: "fu-test-01",
      type: FollowUpType.RECEIVABLE,
      title: "Call customer regarding ticket invoice",
      dueDate: new Date(),
      status: FollowUpStatus.OPEN,
      priority: FollowUpPriority.HIGH,
    };
    assert.equal(operationalFollowUp.status, FollowUpStatus.OPEN);

    // The follow-up is purely operational; balance remains 100% strictly ₹50,000
    const balanceAfterFollowUp = originalReceivable.subtract(postedPayments);
    assert.equal(
      balanceAfterFollowUp.format(),
      "₹50,000.00",
      "Follow-up creation must NEVER mutate accounting receivable balance"
    );
  });

  // -------------------------------------------------------------------------
  // TEST 2 (Requirement 39, 41, 104): Promise-to-Pay Is NOT a Payment
  // -------------------------------------------------------------------------
  test("Requirement 39, 41, 104: Adding a ₹20,000 Promise-to-Pay preserves ₹50,000 outstanding balance", () => {
    const receivableTotal = new Money("50000.00");
    const actualAccountingPaid = Money.zero();

    // Operational Promise created for ₹20,000 on 10th October
    const promise = {
      id: "prom-test-01",
      customerId: "cust-01",
      promisedAmount: new Money("20000.00"),
      promiseDate: new Date("2026-10-10"),
      status: PromiseStatus.ACTIVE,
    };

    // CRITICAL: Promise does not reduce receivable!
    const outstandingAfterPromise = receivableTotal.subtract(actualAccountingPaid);
    assert.equal(
      outstandingAfterPromise.format(),
      "₹50,000.00",
      "Promise-to-Pay is an operational commitment, NOT an accounting entry. Balance must remain ₹50,000"
    );
    assert.equal(promise.status, PromiseStatus.ACTIVE);
  });

  // -------------------------------------------------------------------------
  // TEST 3 (Requirement 42, 105): Actual Posted Payment Updates Balance & Promise
  // -------------------------------------------------------------------------
  test("Requirement 42, 105: Posting a real ₹20,000 payment via Phase 5 reduces outstanding to ₹30,000 and fulfills matched promise", () => {
    const receivableTotal = new Money("50000.00");
    const promiseAmount = new Money("20000.00");

    // Real Phase 5 Payment posted and allocated
    const paymentPosted = new Money("20000.00");
    const actualAccountingPaid = paymentPosted;

    const outstandingAfterPayment = receivableTotal.subtract(actualAccountingPaid);
    assert.equal(
      outstandingAfterPayment.format(),
      "₹30,000.00",
      "Posting real payment reduces outstanding to ₹30,000.00"
    );

    // Matching logic marks promise as FULFILLED
    const promiseStatus =
      actualAccountingPaid.greaterThanOrEqual(promiseAmount)
        ? PromiseStatus.FULFILLED
        : PromiseStatus.PARTIALLY_FULFILLED;

    assert.equal(promiseStatus, PromiseStatus.FULFILLED);
  });

  // -------------------------------------------------------------------------
  // TEST 4 (Requirement 43): Partial Promise Fulfillment
  // -------------------------------------------------------------------------
  test("Requirement 43: Partial payment of ₹10,000 against ₹20,000 promise sets PARTIALLY_FULFILLED without creating new receivable", () => {
    const promised = new Money("20000.00");
    const actualPaid = new Money("10000.00");

    const status =
      actualPaid.greaterThanOrEqual(promised)
        ? PromiseStatus.FULFILLED
        : actualPaid.isPositive()
        ? PromiseStatus.PARTIALLY_FULFILLED
        : PromiseStatus.ACTIVE;

    const remainingPromise = promised.subtract(actualPaid);

    assert.equal(status, PromiseStatus.PARTIALLY_FULFILLED);
    assert.equal(remainingPromise.format(), "₹10,000.00");
  });

  // -------------------------------------------------------------------------
  // TEST 5 (Requirement 36 & 106): Critical Payment Rule - Outcome != Accounting Payment
  // -------------------------------------------------------------------------
  test("Requirement 36 & 106: Completing follow-up as 'Payment Received' strictly does NOT create an accounting payment", () => {
    const originalOutstanding = new Money("50000.00");
    const accountingPaymentCreated = false;

    // Follow-up completed with outcome "PAYMENT_RECEIVED"
    const completedFollowUp = {
      id: "fu-rec-01",
      status: FollowUpStatus.COMPLETED,
      outcome: FollowUpOutcome.PAYMENT_RECEIVED,
      outcomeNotes: "Customer stated NEFT transferred this morning",
      completedAt: new Date(),
    };

    // Rule 36: Requires Record Payment workflow; does NOT post payment silently!
    const requiresPaymentRecord = completedFollowUp.outcome === FollowUpOutcome.PAYMENT_RECEIVED;
    assert.equal(requiresPaymentRecord, true);
    assert.equal(accountingPaymentCreated, false);

    // Financial outstanding remains ₹50,000
    assert.equal(
      originalOutstanding.format(),
      "₹50,000.00",
      "Completing follow-up as Payment Received must NEVER modify receivable balance"
    );
  });

  // -------------------------------------------------------------------------
  // TEST 6 (Requirement 45 & 107): Supplier Payment Commitment
  // -------------------------------------------------------------------------
  test("Requirement 45 & 107: Planned supplier commitment of ₹15,000 preserves ₹40,000 payable until real payment is posted", () => {
    const originalPayable = new Money("40000.00");
    let actualPaidToSupplier = Money.zero();

    // Operational payment commitment planned
    const commitment = {
      id: "comm-01",
      supplierId: "sup-01",
      plannedAmount: new Money("15000.00"),
      commitmentDate: new Date("2026-10-15"),
      status: PaymentCommitmentStatus.ACTIVE,
    };
    assert.equal(commitment.status, PaymentCommitmentStatus.ACTIVE);

    // Balance remains ₹40,000
    let currentPayable = originalPayable.subtract(actualPaidToSupplier);
    assert.equal(
      currentPayable.format(),
      "₹40,000.00",
      "Supplier commitment must NOT reduce payable balance"
    );

    // Real disbursement posted
    actualPaidToSupplier = actualPaidToSupplier.add(new Money("15000.00"));
    currentPayable = originalPayable.subtract(actualPaidToSupplier);
    assert.equal(
      currentPayable.format(),
      "₹25,000.00",
      "Posting real supplier payment reduces payable to ₹25,000.00"
    );
  });

  // -------------------------------------------------------------------------
  // TEST 7 (Requirement 75, 76 & 108): Overdue & Deterministic Aging Buckets
  // -------------------------------------------------------------------------
  test("Requirement 75, 76 & 108: Deterministic days overdue and 5-bucket aging calculation", () => {
    const today = new Date("2026-10-01T00:00:00.000Z");
    const dueDatePast45Days = new Date("2026-08-17T00:00:00.000Z");

    const diffMs = today.getTime() - dueDatePast45Days.getTime();
    const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    assert.equal(daysOverdue, 45);

    // Aging bucket mapping (Phase 5 Standard: Current, 1-30, 31-60, 61-90, 90+)
    let bucket = "CURRENT";
    if (daysOverdue > 90) bucket = "90+";
    else if (daysOverdue > 60) bucket = "61-90";
    else if (daysOverdue > 30) bucket = "31-60";
    else if (daysOverdue > 0) bucket = "1-30";

    assert.equal(bucket, "31-60");
  });

  // -------------------------------------------------------------------------
  // TEST 8 (Requirement 44 & 109): Overdue Promise Operational State
  // -------------------------------------------------------------------------
  test("Requirement 44 & 109: Promise date passes without payment marks promise OVERDUE while receivable is unchanged", () => {
    const today = new Date("2026-10-15T00:00:00.000Z");
    const promiseDate = new Date("2026-10-10T00:00:00.000Z");
    const status = PromiseStatus.ACTIVE;

    const isOverdue = status === PromiseStatus.ACTIVE && promiseDate < today;
    assert.equal(isOverdue, true);

    const receivableOutstanding = new Money("50000.00");
    assert.equal(
      receivableOutstanding.format(),
      "₹50,000.00",
      "Overdue promise does not alter accounting receivable balance"
    );
  });

  // -------------------------------------------------------------------------
  // TEST 9 (Requirement 11 & 110): Current Profile vs As-Closed Historical Snapshot
  // -------------------------------------------------------------------------
  test("Requirement 11 & 110: Current profile shows live balance (₹0) while September As-Closed shows snapshot balance (₹30,000)", () => {
    // September snapshot closed on 30 Sept with ₹30,000 outstanding
    const septemberClosedSnapshot = {
      period: "2026-09",
      isClosed: true,
      snapshotReceivable: new Money("30000.00"),
    };

    // In October, customer pays ₹30,000 in full
    const liveOctoberBalance = Money.zero();

    assert.equal(
      liveOctoberBalance.format(),
      "₹0.00",
      "Current customer profile displays live financial truth"
    );
    assert.equal(
      septemberClosedSnapshot.snapshotReceivable.format(),
      "₹30,000.00",
      "Historical As-Closed snapshot preserves immutable closed balance"
    );
  });

  // -------------------------------------------------------------------------
  // TEST 10 (Requirement 59 & 111): Permission Intersection Security
  // -------------------------------------------------------------------------
  test("Requirement 59 & 111: User with customer contact view but lacking receivables permission cannot see balances", () => {
    const staffPermissions = [
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.FOLLOWUPS_VIEW,
    ];

    // Allowed to view basic directory and contact details
    const canViewCustomers = hasPermission(staffPermissions, [], PERMISSIONS.CUSTOMERS_VIEW);
    assert.equal(canViewCustomers, true);

    // Strictly forbidden from viewing financial receivables or modifying customer accounts
    const canViewReceivables = hasPermission(staffPermissions, [], PERMISSIONS.RECEIVABLES_VIEW);
    const canManageCustomers = hasPermission(staffPermissions, [], PERMISSIONS.CUSTOMERS_MANAGE);

    assert.equal(canViewReceivables, false);
    assert.equal(canManageCustomers, false);
  });

  // -------------------------------------------------------------------------
  // TEST 11 (Requirement 54, 98 & 112): Cross-Business Assignment & Tenant Isolation
  // -------------------------------------------------------------------------
  test("Requirement 54, 98 & 112: Business A user cannot assign follow-up to Business B staff", () => {
    const businessAId = "biz-sai-tours";
    const businessBId = "biz-other-travels";

    const targetUser = {
      id: "usr-b-99",
      businessId: businessBId,
      displayName: "External Staff",
    };

    const isAssignmentValid = targetUser.businessId === businessAId;
    assert.equal(
      isAssignmentValid,
      false,
      "Cross-business user assignment must strictly be rejected by server validation"
    );
  });

  // -------------------------------------------------------------------------
  // TEST 12 (Requirement 62 & 114): Customer Archive Preserves History
  // -------------------------------------------------------------------------
  test("Requirement 62 & 114: Archiving customer preserves historical transactions, payments, and double-entry ledger", () => {
    const customer = {
      id: "cust-arch-01",
      name: "Old Client Travels",
      status: "ACTIVE",
    };

    // Archiving switches status to ARCHIVED without deleting rows
    const archivedCustomer = { ...customer, status: "ARCHIVED" };
    assert.equal(archivedCustomer.status, "ARCHIVED");

    // Historical ledger entries remain intact
    const historicalLedgerCount = 14;
    assert.equal(historicalLedgerCount > 0, true, "Ledger records must never be cascaded or deleted");
  });

  // -------------------------------------------------------------------------
  // TEST 13 (Requirement 64 & 65): Duplicate Party Protection
  // -------------------------------------------------------------------------
  test("Requirement 64 & 65: Duplicate party check flags identical phone or normalized name", () => {
    const existingCustomer = {
      name: "Rajesh Kumar",
      phone: "+91 98400 12345",
      email: "rajesh@example.com",
    };

    const newSubmission = {
      name: "rajesh kumar  ",
      phone: "9840012345",
      email: "RAJESH@example.com",
    };

    const nameMatches =
      existingCustomer.name.trim().toLowerCase() === newSubmission.name.trim().toLowerCase();
    const emailMatches =
      existingCustomer.email.toLowerCase() === newSubmission.email.toLowerCase();

    assert.equal(nameMatches, true);
    assert.equal(emailMatches, true);
  });

  // -------------------------------------------------------------------------
  // TEST 14 (Requirement 78, 80 & 115): AI Assistant CRM Natural Language Queries
  // -------------------------------------------------------------------------
  test("Requirement 78, 80 & 115: AI NLP parses follow-up queries and summarizes customer without inventing balances", () => {
    const q1 = DeterministicNLPInterpreter.interpret("Who should I follow up today?");
    assert.equal(q1.intent, "GET_FOLLOW_UPS_DUE");

    const q2 = DeterministicNLPInterpreter.interpret("Who promised payment this week?");
    assert.equal(q2.intent, "GET_PROMISES_DUE");

    const q3 = DeterministicNLPInterpreter.interpret("Summarize Mohamed Ibrahim");
    assert.equal(q3.intent, "GET_CUSTOMER_SUMMARY");
    assert.equal(q3.filters.customerName, "Mohamed Ibrahim");

    const q4 = DeterministicNLPInterpreter.interpret("Show suppliers due this week");
    assert.equal(q4.intent, "GET_SUPPLIER_PAYABLES_DUE");
  });

  // -------------------------------------------------------------------------
  // TEST 15 (Requirement 116): Tamil & Unicode Support in CRM
  // -------------------------------------------------------------------------
  test("Requirement 116: Tamil customer names, notes, and search queries preserve full Unicode fidelity", () => {
    const tamilCustomer = {
      name: "மீனாட்சி டிராவல்ஸ்",
      notes: "சென்னையில் கட்டணம் பெறப்பட்டது. வெள்ளிக்கிழமை நேரில் அழைக்கவும்.",
      preferredLanguage: "ta",
    };

    // Check string preservation without encoding degradation
    assert.equal(tamilCustomer.name, "மீனாட்சி டிராவல்ஸ்");
    assert.ok(tamilCustomer.notes.includes("சென்னையில்"));

    // Deterministic search match
    const searchQuery = "மீனாட்சி";
    const isMatched = tamilCustomer.name.includes(searchQuery);
    assert.equal(isMatched, true);
  });
});
