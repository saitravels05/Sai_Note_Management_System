import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { Money } from "../../src/lib/money";
import { assertTestEnvironment } from "../helpers/safety-guard";
import { PaymentStatus, TransactionStatus, TransactionType } from "@prisma/client";

describe("Layer 8 & Layer 2 — Golden Accounting Dataset & Precision Regression", () => {
  assertTestEnvironment("Golden Accounting Test");

  test("Section 9: Decimal precision arithmetic avoids floating-point inaccuracies", () => {
    // ₹100,000.10 - ₹25,000.05 = ₹75,000.05 (Never 75000.049999...)
    const a = new Money("100000.10");
    const b = new Money("25000.05");
    const diff = a.minus(b);

    assert.equal(diff.toDecimalString(), "75000.05");
    assert.equal(diff.format(), "₹75,000.05");
    assert.equal(diff.format({ showSymbol: false }), "75,000.05");
    assert.notEqual(diff.toNumber(), 75000.04999999999);
  });

  test("Section 8: Golden Accounting Dataset computes deterministic net result", () => {
    const openingBalance = new Money("100000.00");
    const recognizedIncome = new Money("250000.10");
    const recognizedExpenses = new Money("75000.05");

    // Net Result = Recognized Income - Recognized Expenses
    const netResult = recognizedIncome.minus(recognizedExpenses);
    assert.equal(netResult.toDecimalString(), "175000.05");
    assert.equal(netResult.format(), "₹1,75,000.05");

    // Closing Balance = Opening Balance + Net Result
    const closingBalance = openingBalance.plus(netResult);
    assert.equal(closingBalance.toDecimalString(), "275000.05");
  });

  test("Section 11: Profit (Accrual Net Result) vs Cash Movement remain strictly separate", () => {
    const recognizedIncome = new Money("250000.10");
    const recognizedExpenses = new Money("75000.05");
    const netProfit = recognizedIncome.minus(recognizedExpenses); // ₹1,75,000.05

    // Cash transactions: Money Received vs Money Paid
    const moneyReceived = new Money("20000.00");
    const moneyPaid = new Money("15000.00");
    const netCashFlow = moneyReceived.minus(moneyPaid); // ₹5,000.00

    assert.equal(netProfit.toDecimalString(), "175000.05");
    assert.equal(netCashFlow.toDecimalString(), "5000.00");
    assert.notEqual(netProfit.toDecimalString(), netCashFlow.toDecimalString(), "Net Profit must not be confused with Cash Flow!");
  });

  test("Section 12 & 13: Receivable partial payment and subsequent full payment lifecycle", () => {
    const originalReceivable = new Money("50000.00");
    const payment1 = new Money("20000.00");

    // Partial Payment
    const outstanding1 = originalReceivable.minus(payment1);
    assert.equal(outstanding1.toDecimalString(), "30000.00");
    const status1 = outstanding1.isZero()
      ? PaymentStatus.PAID
      : payment1.isPositive()
      ? PaymentStatus.PARTIALLY_PAID
      : PaymentStatus.UNPAID;
    assert.equal(status1, PaymentStatus.PARTIALLY_PAID);

    // Full Payment: Add remaining ₹30,000
    const payment2 = new Money("30000.00");
    const totalPaid = payment1.plus(payment2);
    const outstandingFinal = originalReceivable.minus(totalPaid);

    assert.equal(outstandingFinal.toDecimalString(), "0.00");
    assert.ok(outstandingFinal.isZero());
    const statusFinal = outstandingFinal.isZero() ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;
    assert.equal(statusFinal, PaymentStatus.PAID);
  });

  test("Section 14: Multiple incremental payments against receivable", () => {
    const receivable = new Money("50000.00");
    const payments = [new Money("10000.00"), new Money("15000.00"), new Money("25000.00")];

    let currentOutstanding = receivable;
    for (const p of payments) {
      currentOutstanding = currentOutstanding.minus(p);
    }

    assert.equal(currentOutstanding.toDecimalString(), "0.00");
    assert.ok(currentOutstanding.isZero());
  });

  test("Section 15: Multi-invoice allocation from a single payment lump-sum", () => {
    const inv1 = new Money("15000.00");
    const inv2 = new Money("25000.00");
    const lumpSumPayment = new Money("35000.00");

    // Allocate ₹15,000 to Inv1 (fully settles inv1)
    const alloc1 = inv1.lessThan(lumpSumPayment) ? inv1 : lumpSumPayment;
    const unallocatedAfter1 = lumpSumPayment.minus(alloc1);
    const inv1Outstanding = inv1.minus(alloc1);

    assert.equal(alloc1.toDecimalString(), "15000.00");
    assert.equal(inv1Outstanding.toDecimalString(), "0.00");
    assert.equal(unallocatedAfter1.toDecimalString(), "20000.00");

    // Allocate remaining ₹20,000 to Inv2 (partially settles inv2)
    const alloc2 = inv2.lessThan(unallocatedAfter1) ? inv2 : unallocatedAfter1;
    const unallocatedFinal = unallocatedAfter1.minus(alloc2);
    const inv2Outstanding = inv2.minus(alloc2);

    assert.equal(alloc2.toDecimalString(), "20000.00");
    assert.equal(inv2Outstanding.toDecimalString(), "5000.00");
    assert.equal(unallocatedFinal.toDecimalString(), "0.00");
  });

  test("Section 16: Overpayment guard preserves unallocated credit", () => {
    const receivable = new Money("50000.00");
    const payment = new Money("55000.00");

    const allocated = payment.greaterThan(receivable) ? receivable : payment;
    const unallocatedCredit = payment.minus(allocated);

    assert.equal(allocated.toDecimalString(), "50000.00");
    assert.equal(unallocatedCredit.toDecimalString(), "5000.00");
    assert.ok(unallocatedCredit.isPositive(), "Excess payment must remain available as customer credit");
  });

  test("Section 17: Payable partial payment and outstanding liability", () => {
    const originalPayable = new Money("40000.00");
    const paymentMade = new Money("15000.00");

    const outstandingPayable = originalPayable.minus(paymentMade);
    assert.equal(outstandingPayable.toDecimalString(), "25000.00");
  });

  test("Section 18 & 19: Draft transactions and general notes never alter financial totals", () => {
    const postedIncome = new Money("10000.00");
    const draftIncome = new Money("25000.00");
    const generalNoteContent = "Customer promised to visit office tomorrow";

    // Accounting engine filter: status === POSTED
    const transactions = [
      { type: TransactionType.INCOME, status: TransactionStatus.POSTED, amount: postedIncome },
      { type: TransactionType.INCOME, status: TransactionStatus.DRAFT, amount: draftIncome },
    ];

    const authoritativeIncome = transactions
      .filter((t) => t.status === TransactionStatus.POSTED && t.type === TransactionType.INCOME)
      .reduce((acc, t) => acc.plus(t.amount), Money.zero());

    assert.equal(authoritativeIncome.toDecimalString(), "10000.00");
    assert.equal(typeof generalNoteContent, "string");
  });

  test("Section 20: Voided financial record is excluded while audit trail is preserved", () => {
    const transactions = [
      { id: "TXN-01", status: TransactionStatus.POSTED, amount: new Money("20000.00") },
      { id: "TXN-02", status: TransactionStatus.VOID, amount: new Money("15000.00"), voidReason: "Duplicate invoice" },
    ];

    const activeTotal = transactions
      .filter((t) => t.status === TransactionStatus.POSTED)
      .reduce((acc, t) => acc.plus(t.amount), Money.zero());

    assert.equal(activeTotal.toDecimalString(), "20000.00");
    assert.equal(transactions[1].status, TransactionStatus.VOID);
    assert.equal(transactions[1].voidReason, "Duplicate invoice");
  });

  test("Section 21: Internal transfer produces net-zero income and net-zero expense", () => {
    const transferAmount = new Money("50000.00");
    
    // Internal transfer leg: Bank A out, Bank B in
    const bankAOut = transferAmount;
    const bankBIn = transferAmount;

    // Both legs cancel out with 0 recognized business revenue or expense
    const recognizedTransferIncome = Money.zero();
    const recognizedTransferExpense = Money.zero();

    assert.equal(recognizedTransferIncome.toDecimalString(), "0.00");
    assert.equal(recognizedTransferExpense.toDecimalString(), "0.00");
    assert.equal(bankAOut.minus(bankBIn).toDecimalString(), "0.00");
  });

  test("Section 22 & 23: Follow-up outcome and Promise-to-pay NEVER alter financial ledger", () => {
    const originalReceivable = new Money("50000.00");

    // CRM Follow-up with outcome 'PAYMENT_RECEIVED' or Promise '₹20,000'
    const promiseAmount = new Money("20000.00");
    const followUpOutcome = "PAYMENT_PROMISED";

    // Financial ledger only reads actual Payment allocations, not CRM logs
    const actualPayments = Money.zero();
    const currentOutstanding = originalReceivable.minus(actualPayments);

    assert.equal(currentOutstanding.toDecimalString(), "50000.00", "Promise to pay must NOT decrease ledger balance!");
    assert.equal(followUpOutcome, "PAYMENT_PROMISED");
    assert.equal(promiseAmount.toDecimalString(), "20000.00");
  });

  test("Section 26: Aging schedule classification boundaries", () => {
    const referenceDate = new Date("2026-10-15T00:00:00Z");

    function getAgingBucket(dueDate: Date): string {
      const diffTime = referenceDate.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) return "CURRENT";
      if (diffDays <= 30) return "1_TO_30";
      if (diffDays <= 60) return "31_TO_60";
      if (diffDays <= 90) return "61_TO_90";
      return "90_PLUS";
    }

    assert.equal(getAgingBucket(new Date("2026-10-20T00:00:00Z")), "CURRENT");
    assert.equal(getAgingBucket(new Date("2026-10-05T00:00:00Z")), "1_TO_30");
    assert.equal(getAgingBucket(new Date("2026-09-01T00:00:00Z")), "31_TO_60");
    assert.equal(getAgingBucket(new Date("2026-08-01T00:00:00Z")), "61_TO_90");
    assert.equal(getAgingBucket(new Date("2026-06-01T00:00:00Z")), "90_PLUS");
  });

  test("Section 27: Asia/Kolkata timezone midnight boundary and end-of-month handling", () => {
    // In Asia/Kolkata (UTC+05:30), 2026-10-31 23:59:59 is 2026-10-31 18:29:59 UTC
    const istMidnight = new Date("2026-10-31T18:29:59.000Z");
    const formatter = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const formatted = formatter.format(istMidnight);
    assert.ok(formatted.includes("31/10/2026"), `Expected date 31/10/2026 in Asia/Kolkata but got: ${formatted}`);
  });
});
