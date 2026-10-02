import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import { TransactionStatus, PaymentStatus } from "@prisma/client";

export interface ReconciliationDiscrepancy {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  entityType: "TRANSACTION" | "PAYMENT" | "ALLOCATION" | "PERIOD";
  entityId: string;
  reference: string;
  message: string;
}

export interface ReconciliationReport {
  timestamp: Date;
  businessId: string;
  isHealthy: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  summary: {
    totalTransactionsChecked: number;
    totalPaymentsChecked: number;
    totalAllocationsChecked: number;
  };
  discrepancies: ReconciliationDiscrepancy[];
}

export class ReconciliationService {
  /**
   * Run comprehensive accounting integrity and reconciliation checks for a business.
   */
  public static async runReconciliation(businessId: string): Promise<ReconciliationReport> {
    const discrepancies: ReconciliationDiscrepancy[] = [];
    let checksRun = 0;
    let checksFailed = 0;

    // Fetch transactions, payments, allocations
    const [transactions, payments, allocations] = await Promise.all([
      prisma.transaction.findMany({
        where: { businessId },
        select: {
          id: true,
          transactionNumber: true,
          totalAmount: true,
          paymentStatus: true,
          status: true,
          allocations: {
            select: {
              id: true,
              amount: true,
              payment: { select: { id: true, status: true, businessId: true } },
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: { businessId },
        select: {
          id: true,
          paymentNumber: true,
          amount: true,
          status: true,
          allocations: {
            select: {
              id: true,
              amount: true,
              transaction: { select: { id: true, status: true, businessId: true } },
            },
          },
        },
      }),
      prisma.paymentAllocation.findMany({
        where: { businessId },
        select: {
          id: true,
          businessId: true,
          amount: true,
          paymentId: true,
          transactionId: true,
          payment: { select: { id: true, businessId: true, status: true } },
          transaction: { select: { id: true, businessId: true, status: true } },
        },
      }),
    ]);

    // CHECK 1: Over-allocated payments
    checksRun++;
    let check1Failed = false;
    for (const p of payments) {
      if (p.status !== TransactionStatus.POSTED) continue;
      const paymentAmount = Money.fromDecimal(p.amount);
      let allocated = Money.zero(paymentAmount.currency);

      for (const a of p.allocations) {
        allocated = allocated.add(Money.fromDecimal(a.amount));
      }

      if (allocated.greaterThan(paymentAmount)) {
        check1Failed = true;
        discrepancies.push({
          severity: "ERROR",
          code: "PAYMENT_OVER_ALLOCATED",
          entityType: "PAYMENT",
          entityId: p.id,
          reference: p.paymentNumber,
          message: `Payment ${p.paymentNumber} has allocations (₹${allocated.format()}) exceeding payment amount (₹${paymentAmount.format()}).`,
        });
      }
    }
    if (check1Failed) checksFailed++;

    // CHECK 2: Allocations against VOID or DRAFT transactions
    checksRun++;
    let check2Failed = false;
    for (const a of allocations) {
      if (!a.transaction) {
        check2Failed = true;
        discrepancies.push({
          severity: "ERROR",
          code: "ORPHANED_ALLOCATION",
          entityType: "ALLOCATION",
          entityId: a.id,
          reference: `Allocation ${a.id}`,
          message: `Allocation references non-existent transaction ${a.transactionId}.`,
        });
      } else if (a.transaction.status !== TransactionStatus.POSTED && a.payment?.status === TransactionStatus.POSTED) {
        check2Failed = true;
        discrepancies.push({
          severity: "ERROR",
          code: "ALLOCATION_TO_NON_POSTED_TX",
          entityType: "ALLOCATION",
          entityId: a.id,
          reference: `Allocation ${a.id}`,
          message: `Active allocation of ₹${Money.fromDecimal(a.amount).format()} is attached to a ${a.transaction.status} transaction.`,
        });
      }
    }
    if (check2Failed) checksFailed++;

    // CHECK 3: Active allocations from VOID payments
    checksRun++;
    let check3Failed = false;
    for (const p of payments) {
      if (p.status === TransactionStatus.VOID && p.allocations.length > 0) {
        check3Failed = true;
        discrepancies.push({
          severity: "WARNING",
          code: "VOID_PAYMENT_HAS_ALLOCATIONS",
          entityType: "PAYMENT",
          entityId: p.id,
          reference: p.paymentNumber,
          message: `Voided payment ${p.paymentNumber} still has ${p.allocations.length} allocation records attached.`,
        });
      }
    }
    if (check3Failed) checksFailed++;

    // CHECK 4: Tenant isolation consistency
    checksRun++;
    let check4Failed = false;
    for (const a of allocations) {
      if (
        a.businessId !== businessId ||
        a.payment?.businessId !== businessId ||
        a.transaction?.businessId !== businessId
      ) {
        check4Failed = true;
        discrepancies.push({
          severity: "ERROR",
          code: "CROSS_TENANT_ALLOCATION",
          entityType: "ALLOCATION",
          entityId: a.id,
          reference: `Allocation ${a.id}`,
          message: `Cross-tenant allocation detected on allocation ${a.id}.`,
        });
      }
    }
    if (check4Failed) checksFailed++;

    // CHECK 5: Derived Transaction PaymentStatus Consistency
    checksRun++;
    let check5Failed = false;
    for (const t of transactions) {
      if (t.status !== TransactionStatus.POSTED) continue;
      const totalAmount = Money.fromDecimal(t.totalAmount);

      let paid = Money.zero(totalAmount.currency);
      for (const a of t.allocations) {
        if (a.payment.status === TransactionStatus.POSTED) {
          paid = paid.add(Money.fromDecimal(a.amount));
        }
      }

      let expectedStatus: PaymentStatus = PaymentStatus.UNPAID;
      if (paid.isZero()) {
        expectedStatus = PaymentStatus.UNPAID;
      } else if (paid.greaterThan(totalAmount)) {
        expectedStatus = PaymentStatus.OVERPAID;
      } else if (paid.equals(totalAmount)) {
        expectedStatus = PaymentStatus.PAID;
      } else {
        expectedStatus = PaymentStatus.PARTIALLY_PAID;
      }

      // Check for mismatch (only for receivable/payable)
      if (t.paymentStatus !== expectedStatus && t.paymentStatus !== PaymentStatus.NOT_APPLICABLE) {
        check5Failed = true;
        discrepancies.push({
          severity: "WARNING",
          code: "PAYMENT_STATUS_MISMATCH",
          entityType: "TRANSACTION",
          entityId: t.id,
          reference: t.transactionNumber,
          message: `Transaction ${t.transactionNumber} has status '${t.paymentStatus}' but mathematically expected '${expectedStatus}' (Total: ₹${totalAmount.format()}, Paid: ₹${paid.format()}).`,
        });
      }
    }
    if (check5Failed) checksFailed++;

    return {
      timestamp: new Date(),
      businessId,
      isHealthy: discrepancies.filter((d) => d.severity === "ERROR").length === 0,
      totalChecks: checksRun,
      passedChecks: checksRun - checksFailed,
      failedChecks: checksFailed,
      summary: {
        totalTransactionsChecked: transactions.length,
        totalPaymentsChecked: payments.length,
        totalAllocationsChecked: allocations.length,
      },
      discrepancies,
    };
  }
}
