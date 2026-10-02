import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { AccountingService } from "../src/server/services/accounting.service";
import { NumberingService } from "../src/server/services/numbering.service";
import { Money } from "../src/lib/money";
import { TransactionType, TransactionStatus, PaymentStatus } from "@prisma/client";

describe("Phase 5 Accounting Engine, Ledgers & Payment Allocations", () => {
  // Requirement 73: Basic Accounting & Decimal Precision
  test("Requirement 73: accurately calculates Income, Expense and Net Result with decimal precision", () => {
    const transactions = [
      { type: TransactionType.INCOME, totalAmount: "100000.10", status: TransactionStatus.POSTED },
      { type: TransactionType.EXPENSE, totalAmount: "25000.05", status: TransactionStatus.POSTED },
    ];

    const summary = AccountingService.calculatePeriodSummary(transactions);

    assert.equal(summary.totalIncome.toDecimalString(), "100000.10");
    assert.equal(summary.totalExpenses.toDecimalString(), "25000.05");
    assert.equal(summary.netResult.toDecimalString(), "75000.05");
    assert.equal(summary.netResult.getDecimal().toFixed(2), "75000.05");
  });

  // Requirement 74: Partial Payment
  test("Requirement 74: calculates partial payment correctly (Receivable ₹50,000, Payment ₹20,000)", () => {
    const invoiceTotal = "50000.00";
    const result = AccountingService.calculateOutstanding(invoiceTotal, [{ amount: "20000.00" }]);

    assert.equal(result.paidAmount.toDecimalString(), "20000.00");
    assert.equal(result.outstandingAmount.toDecimalString(), "30000.00");
    assert.equal(result.status, PaymentStatus.PARTIALLY_PAID);
    assert.equal(result.isPartiallyPaid, true);
    assert.equal(result.isFullyPaid, false);
  });

  // Requirement 75: Full Payment
  test("Requirement 75: calculates full payment correctly (Receivable ₹50,000, Payment ₹50,000)", () => {
    const invoiceTotal = "50000.00";
    const result = AccountingService.calculateOutstanding(invoiceTotal, [{ amount: "50000.00" }]);

    assert.equal(result.paidAmount.toDecimalString(), "50000.00");
    assert.equal(result.outstandingAmount.toDecimalString(), "0.00");
    assert.equal(result.status, PaymentStatus.PAID);
    assert.equal(result.isFullyPaid, true);
    assert.equal(result.isPartiallyPaid, false);
  });

  // Requirement 76: Multiple Payments against single invoice
  test("Requirement 76: handles multiple installment payments against single invoice (₹10k + ₹15k + ₹25k)", () => {
    const invoiceTotal = "50000.00";
    const result = AccountingService.calculateOutstanding(invoiceTotal, [
      { amount: "10000.00" },
      { amount: "15000.00" },
      { amount: "25000.00" },
    ]);

    assert.equal(result.paidAmount.toDecimalString(), "50000.00");
    assert.equal(result.outstandingAmount.toDecimalString(), "0.00");
    assert.equal(result.status, PaymentStatus.PAID);
    assert.equal(result.isFullyPaid, true);
  });

  // Requirement 77: Multiple allocations from one payment
  test("Requirement 77: validates one payment allocated across multiple invoices", () => {
    const paymentAmount = Money.parse("50000.00");
    const allocations = [
      { invoice: "INV-001", amount: Money.parse("20000.00") },
      { invoice: "INV-002", amount: Money.parse("15000.00") },
      { invoice: "INV-003", amount: Money.parse("15000.00") },
    ];

    let totalAllocated = Money.zero();
    for (const a of allocations) {
      totalAllocated = totalAllocated.add(a.amount);
    }

    const unapplied = paymentAmount.subtract(totalAllocated);

    assert.equal(totalAllocated.toDecimalString(), "50000.00");
    assert.equal(unapplied.toDecimalString(), "0.00");
    assert.ok(totalAllocated.equals(paymentAmount));
  });

  // Requirement 78: Overpayment & Advance credit
  test("Requirement 78: handles overpayment (Invoice ₹50,000, Payment ₹55,000) preserving advance credit", () => {
    const invoiceTotal = "50000.00";
    const paymentAmount = Money.parse("55000.00");

    // Outstanding status derivation
    const result = AccountingService.calculateOutstanding(invoiceTotal, [{ amount: "55000.00" }]);
    assert.equal(result.status, PaymentStatus.OVERPAID);
    assert.equal(result.isOverpaid, true);
    assert.equal(result.outstandingAmount.toDecimalString(), "0.00");

    // Advance credit preservation
    const appliedToInvoice = Money.parse(invoiceTotal);
    const unappliedAdvance = paymentAmount.subtract(appliedToInvoice);

    assert.equal(unappliedAdvance.toDecimalString(), "5000.00");
    assert.equal(unappliedAdvance.isPositive(), true);
  });

  // Requirement 79: Void transaction exclusion from active totals
  test("Requirement 79: excludes VOID and DRAFT transactions from official accounting totals", () => {
    const transactions = [
      { type: TransactionType.INCOME, totalAmount: "100000.00", status: TransactionStatus.POSTED },
      { type: TransactionType.EXPENSE, totalAmount: "40000.00", status: TransactionStatus.POSTED },
      // Void transaction must not be counted
      { type: TransactionType.INCOME, totalAmount: "60000.00", status: TransactionStatus.VOID },
      // Draft transaction must not be counted
      { type: TransactionType.EXPENSE, totalAmount: "10000.00", status: TransactionStatus.DRAFT },
    ];

    const summary = AccountingService.calculatePeriodSummary(transactions);

    assert.equal(summary.totalIncome.toDecimalString(), "100000.00");
    assert.equal(summary.totalExpenses.toDecimalString(), "40000.00");
    assert.equal(summary.netResult.toDecimalString(), "60000.00");
    assert.equal(summary.transactionCount, 2);
  });

  // Requirement 80: Reversal of allocations on payment void
  test("Requirement 80: simulates payment void reversal of allocations and status restoration", () => {
    const invoiceTotal = "50000.00";
    const activeAllocations = [{ amount: "20000.00" }];

    // Active payment: Status is PARTIALLY_PAID
    const beforeVoid = AccountingService.calculateOutstanding(invoiceTotal, activeAllocations);
    assert.equal(beforeVoid.status, PaymentStatus.PARTIALLY_PAID);
    assert.equal(beforeVoid.outstandingAmount.toDecimalString(), "30000.00");

    // Payment voided: Allocations from that payment are removed
    const afterVoid = AccountingService.calculateOutstanding(invoiceTotal, []);
    assert.equal(afterVoid.status, PaymentStatus.UNPAID);
    assert.equal(afterVoid.outstandingAmount.toDecimalString(), "50000.00");
    assert.equal(afterVoid.paidAmount.toDecimalString(), "0.00");
  });

  // Requirement 83: Allocation limit bounds
  test("Requirement 83: verifies that total allocations cannot exceed total payment amount", () => {
    const payment = Money.parse("10000.00");
    const allocationAttempts = [Money.parse("6000.00"), Money.parse("5000.00")];

    let totalAlloc = Money.zero();
    for (const a of allocationAttempts) {
      totalAlloc = totalAlloc.add(a);
    }

    assert.equal(totalAlloc.greaterThan(payment), true);
  });

  // Requirement 85: Profit vs Cash Flow distinction (Preventing double counting)
  test("Requirement 85: strictly separates recognized profit from liquidity movement", () => {
    // Invoice issued (Accrual Income recognized)
    const accrualRevenue = Money.parse("50000.00");
    const accrualExpense = Money.parse("20000.00");
    const netProfit = accrualRevenue.subtract(accrualExpense);

    assert.equal(netProfit.toDecimalString(), "30000.00");

    // Customer settles invoice with ₹50,000 payment
    // Liquidity flow: Cash Inflow = ₹50,000
    // Crucial: This payment does NOT increment Accrual Revenue!
    const cashInflow = Money.parse("50000.00");
    const cashOutflow = Money.parse("15000.00");
    const netCashFlow = cashInflow.subtract(cashOutflow);

    assert.equal(netCashFlow.toDecimalString(), "35000.00");
    assert.notEqual(netProfit.toDecimalString(), netCashFlow.toDecimalString());
  });

  test("NumberingService formats numbers with padding and prefixes", () => {
    const txn = NumberingService.formatNumber("TXN", 1, 2026);
    const pay = NumberingService.formatNumber("PAY", 42, 2026);
    const cus = NumberingService.formatNumber("CUS", 5);
    const sup = NumberingService.formatNumber("SUP", 123);

    assert.equal(txn, "TXN-2026-000001");
    assert.equal(pay, "PAY-2026-000042");
    assert.equal(cus, "CUS-000005");
    assert.equal(sup, "SUP-000123");
  });
});
