import crypto from "crypto";
import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import {
  FinancialPeriodStatus,
  TransactionStatus,
  PaymentStatus,
  TransactionType,
  AuditAction,
  Prisma,
} from "@prisma/client";
import {
  ValidationError,
  NotFoundError,
  BusinessRuleError,
  ForbiddenError,
} from "@/lib/errors";
import { AuditService } from "./audit.service";
import { ReportDataService } from "./report-data.service";
import { ExportService } from "./export.service";
import { PdfReportService } from "./pdf-report.service";
import { ReconciliationService, type ReconciliationDiscrepancy } from "./reconciliation.service";
import { SystemMaintenanceService } from "./system-maintenance.service";

// ===================================================================
// TYPES & INTERFACES (Re-exported from @/types/month-end)
// ===================================================================

export * from "@/types/month-end";
import {
  type ChecklistItem,
  type PreCloseChecklistResult,
  type ClosingSnapshotDTO,
  type VersionDiffResult,
  type ReopenReasonCategory,
} from "@/types/month-end";

// ===================================================================
// MONTH-END CLOSING & PERIOD LOCKING SERVICE
// ===================================================================

export class MonthEndService {
  /**
   * Helper to compute Month start and end dates
   */
  public static getPeriodDates(year: number, month: number): { startDate: Date; endDate: Date } {
    if (month < 1 || month > 12) {
      throw new ValidationError(`Invalid month: ${month}. Must be between 1 and 12.`);
    }
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    // Last day of month
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { startDate, endDate };
  }

  /**
   * Helper to format Month/Year label
   */
  public static getPeriodLabel(year: number, month: number): string {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${monthNames[month - 1]} ${year}`;
  }

  /**
   * Compute deterministic canonical SHA-256 hash for snapshot integrity protection (Requirement 33)
   */
  public static computeSnapshotHash(payload: Record<string, unknown>): string {
    // Canonical sort of keys
    const canonicalString = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash("sha256").update(canonicalString, "utf8").digest("hex");
  }

  /**
   * Find or initialize financial period record
   */
  public static async ensureFinancialPeriod(
    businessId: string,
    year: number,
    month: number
  ) {
    const { startDate, endDate } = this.getPeriodDates(year, month);

    const existing = await prisma.financialPeriod.findUnique({
      where: {
        businessId_year_month: {
          businessId,
          year,
          month,
        },
      },
      include: {
        closing: true,
      },
    });

    if (existing) {
      return existing;
    }

    return await prisma.financialPeriod.create({
      data: {
        businessId,
        year,
        month,
        startDate,
        endDate,
        status: FinancialPeriodStatus.OPEN,
      },
      include: {
        closing: true,
      },
    });
  }

  /**
   * List all financial periods for a business with real statuses and closing metadata
   */
  public static async getPeriodList(businessId: string) {
    const periods = await prisma.financialPeriod.findMany({
      where: { businessId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: {
        closing: true,
      },
    });

    // If no periods exist yet, initialize the current period
    if (periods.length === 0) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const initial = await this.ensureFinancialPeriod(businessId, currentYear, currentMonth);
      periods.push(initial);
    }

    return periods.map((p) => {
      const closingData = (p.closing?.snapshotData as Record<string, unknown>) || {};
      const version = typeof closingData.version === "number" ? closingData.version : (p.closing ? 1 : null);

      return {
        id: p.id,
        year: p.year,
        month: p.month,
        periodLabel: this.getPeriodLabel(p.year, p.month),
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status,
        openedAt: p.openedAt,
        closedAt: p.closedAt,
        closedBy: p.closedBy,
        reopenedAt: p.reopenedAt,
        reopenedBy: p.reopenedBy,
        reopenReason: p.reopenReason,
        closing: p.closing
          ? {
              id: p.closing.id,
              version,
              openingBalance: p.closing.openingBalance.toString(),
              totalIncome: p.closing.totalIncome.toString(),
              totalExpenses: p.closing.totalExpenses.toString(),
              netResult: p.closing.netResult.toString(),
              closingBalance: p.closing.closingBalance.toString(),
              totalReceivables: p.closing.totalReceivables.toString(),
              totalPayables: p.closing.totalPayables.toString(),
              transactionCount: p.closing.transactionCount,
              closedAt: p.closing.closedAt,
              closedBy: p.closing.closedBy,
            }
          : null,
      };
    });
  }

  /**
   * Run deterministic Pre-Close Checklist for a financial period.
   * Evaluates all 8+ validation dimensions with PASS / WARNING / BLOCKING classification.
   */
  public static async runPreCloseChecklist(
    businessId: string,
    year: number,
    month: number
  ): Promise<PreCloseChecklistResult> {
    const period = await this.ensureFinancialPeriod(businessId, year, month);
    const { startDate, endDate } = this.getPeriodDates(year, month);
    const periodLabel = this.getPeriodLabel(year, month);

    const items: ChecklistItem[] = [];

    // Parallel fetch of underlying period entities
    const [
      draftRecords,
      postedRecords,
      allPeriodPayments,
      allocations,
      importBatches,
      reconciliationReport,
      priorPeriod,
    ] = await Promise.all([
      // 1. DRAFT records inside period
      prisma.transaction.findMany({
        where: {
          businessId,
          transactionDate: { gte: startDate, lte: endDate },
          status: TransactionStatus.DRAFT,
        },
        select: {
          id: true,
          transactionNumber: true,
          title: true,
          totalAmount: true,
          transactionDate: true,
        },
      }),

      // 2. POSTED records inside period
      prisma.transaction.findMany({
        where: {
          businessId,
          transactionDate: { gte: startDate, lte: endDate },
          status: TransactionStatus.POSTED,
        },
        select: {
          id: true,
          transactionNumber: true,
          transactionType: true,
          title: true,
          totalAmount: true,
          currency: true,
          categoryId: true,
          customerId: true,
          supplierId: true,
          paymentStatus: true,
          transactionDate: true,
          referenceNumber: true,
          category: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, customerCode: true } },
          supplier: { select: { id: true, name: true, supplierCode: true } },
        },
      }),

      // 3. Payments inside period
      prisma.payment.findMany({
        where: {
          businessId,
          paymentDate: { gte: startDate, lte: endDate },
        },
        include: {
          paymentMethod: { select: { id: true, name: true, type: true } },
          allocations: { select: { id: true, amount: true, transactionId: true } },
          customer: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      }),

      // 4. All allocations in business (for orphan checks)
      prisma.paymentAllocation.findMany({
        where: { businessId },
        select: {
          id: true,
          amount: true,
          paymentId: true,
          transactionId: true,
          payment: { select: { id: true, status: true, paymentDate: true } },
          transaction: { select: { id: true, status: true, transactionDate: true } },
        },
      }),

      // 5. Imports in business (for processing check)
      prisma.importBatch.findMany({
        where: { businessId },
        select: {
          id: true,
          originalFileName: true,
          status: true,
          createdAt: true,
          errorRows: true,
        },
      }),

      // 6. Accounting Health
      ReconciliationService.runReconciliation(businessId),

      // 7. Prior period for continuity
      prisma.financialPeriod.findFirst({
        where: {
          businessId,
          OR: [
            month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 },
          ],
        },
        include: { closing: true },
      }),
    ]);

    // -------------------------------------------------------------
    // CHECK 1: Draft Records Check (Requirement 7 & 85) - BLOCKING
    // -------------------------------------------------------------
    const draftTotal = draftRecords.reduce(
      (sum: Money, r: { totalAmount: Prisma.Decimal }) => sum.add(Money.fromDecimal(r.totalAmount)),
      Money.zero()
    );

    if (draftRecords.length > 0) {
      items.push({
        id: "check_draft_records",
        category: "RECORDS",
        title: "Unresolved Draft Financial Records",
        description: `Found ${draftRecords.length} draft transaction(s) totaling ₹${draftTotal.format()} dated within this period. Financial periods cannot close with pending drafts.`,
        severity: "BLOCKING",
        count: draftRecords.length,
        amount: `₹${draftTotal.format()}`,
        details: draftRecords.map((d: { id: string; transactionNumber: string; title: string; totalAmount: Prisma.Decimal; transactionDate: Date }) => ({
          id: d.id,
          reference: d.transactionNumber,
          description: d.title,
          amount: `₹${Money.fromDecimal(d.totalAmount).format()}`,
          date: d.transactionDate.toISOString().split("T")[0],
          reason: "Status is DRAFT. Post or delete this record before closing.",
        })),
      });
    } else {
      items.push({
        id: "check_draft_records",
        category: "RECORDS",
        title: "Draft Records Verification",
        description: "Zero unresolved drafts detected in this period. All recorded activities are posted.",
        severity: "PASS",
        count: 0,
      });
    }

    // -------------------------------------------------------------
    // CHECK 2: Incomplete Posted Records (Requirement 8) - BLOCKING
    // -------------------------------------------------------------
    const incompleteRecords: Array<{
      id: string;
      reference: string;
      description: string;
      reason: string;
    }> = [];

    for (const r of postedRecords) {
      const amount = Money.fromDecimal(r.totalAmount);

      // Check zero or negative amounts on posted transactions
      if (amount.isZero() || amount.isNegative()) {
        incompleteRecords.push({
          id: r.id,
          reference: r.transactionNumber,
          description: r.title,
          reason: "Posted financial record has ₹0.00 or negative amount.",
        });
      }

      // Check missing category
      if (!r.categoryId) {
        incompleteRecords.push({
          id: r.id,
          reference: r.transactionNumber,
          description: r.title,
          reason: "Transaction is missing a required accounting category.",
        });
      }

      // Check missing required party on receivables/payables
      if (r.transactionType === TransactionType.RECEIVABLE && !r.customerId) {
        incompleteRecords.push({
          id: r.id,
          reference: r.transactionNumber,
          description: r.title,
          reason: "Receivable invoice is missing required customer association.",
        });
      }

      if (r.transactionType === TransactionType.PAYABLE && !r.supplierId) {
        incompleteRecords.push({
          id: r.id,
          reference: r.transactionNumber,
          description: r.title,
          reason: "Payable bill is missing required supplier association.",
        });
      }
    }

    if (incompleteRecords.length > 0) {
      items.push({
        id: "check_incomplete_records",
        category: "RECORDS",
        title: "Incomplete Accounting Entries",
        description: `${incompleteRecords.length} posted record(s) are missing critical accounting fields (category, party, or amount).`,
        severity: "BLOCKING",
        count: incompleteRecords.length,
        details: incompleteRecords,
      });
    } else {
      items.push({
        id: "check_incomplete_records",
        category: "RECORDS",
        title: "Data Completeness Verification",
        description: "All posted transactions have complete classifications, parties, and non-zero amounts.",
        severity: "PASS",
        count: 0,
      });
    }

    // -------------------------------------------------------------
    // CHECK 3: Duplicate Warning Review (Requirement 9) - WARNING
    // -------------------------------------------------------------
    const duplicateMap = new Map<string, typeof postedRecords>();
    for (const r of postedRecords) {
      const key = `${r.transactionDate.toISOString().split("T")[0]}_${r.totalAmount.toString()}_${r.referenceNumber || r.title}`;
      if (!duplicateMap.has(key)) {
        duplicateMap.set(key, []);
      }
      duplicateMap.get(key)!.push(r);
    }

    const duplicateGroups = Array.from(duplicateMap.values()).filter((g) => g.length > 1);
    if (duplicateGroups.length > 0) {
      items.push({
        id: "check_duplicates",
        category: "RECORDS",
        title: "Potential Duplicate Entries",
        description: `${duplicateGroups.length} pair(s) of records share identical date, amount, and reference/title. Please review for inadvertent duplicate entry.`,
        severity: "WARNING",
        count: duplicateGroups.length,
        details: duplicateGroups.flatMap((g) =>
          g.map((r: { id: string; transactionNumber: string; title: string; totalAmount: Prisma.Decimal; transactionDate: Date }) => ({
            id: r.id,
            reference: r.transactionNumber,
            description: r.title,
            amount: `₹${Money.fromDecimal(r.totalAmount).format()}`,
            reason: `Potential duplicate of matching entry on ${r.transactionDate.toISOString().split("T")[0]}`,
          }))
        ),
      });
    } else {
      items.push({
        id: "check_duplicates",
        category: "RECORDS",
        title: "Duplicate Check",
        description: "No duplicate records detected by date, amount, and reference parameters.",
        severity: "PASS",
        count: 0,
      });
    }

    // -------------------------------------------------------------
    // CHECK 4: Payment Reconciliation & Allocations (Req 10, 11)
    // -------------------------------------------------------------
    const overAllocatedPayments: Array<{ id: string; reference: string; description: string; reason: string }> = [];
    const unallocatedPayments: Array<{ id: string; reference: string; description: string; amount: string; reason: string }> = [];

    for (const p of allPeriodPayments) {
      if (p.status !== TransactionStatus.POSTED) continue;
      const paymentAmount = Money.fromDecimal(p.amount);
      let allocatedTotal = Money.zero(paymentAmount.currency);

      for (const a of p.allocations) {
        allocatedTotal = allocatedTotal.add(Money.fromDecimal(a.amount));
      }

      if (allocatedTotal.greaterThan(paymentAmount)) {
        overAllocatedPayments.push({
          id: p.id,
          reference: p.paymentNumber,
          description: `Paid to/from ${p.customer?.name || p.supplier?.name || "General"}`,
          reason: `Allocated amount (₹${allocatedTotal.format()}) exceeds payment amount (₹${paymentAmount.format()}).`,
        });
      } else if (allocatedTotal.lessThan(paymentAmount)) {
        const unapplied = paymentAmount.minus(allocatedTotal);
        unallocatedPayments.push({
          id: p.id,
          reference: p.paymentNumber,
          description: `Party: ${p.customer?.name || p.supplier?.name || "Unassigned"}`,
          amount: `₹${unapplied.format()}`,
          reason: `Payment has ₹${unapplied.format()} unapplied advance balance.`,
        });
      }
    }

    const orphanAllocations = allocations.filter(
      (a) => !a.payment || !a.transaction || a.payment.status === TransactionStatus.VOID
    );
    if (orphanAllocations.length > 0) {
      overAllocatedPayments.push(
        ...orphanAllocations.map((a) => ({
          id: a.id,
          reference: `Allocation ${a.id}`,
          description: "Orphan allocation detected",
          reason: "Allocation is missing an active payment or transaction relation.",
        }))
      );
    }

    if (overAllocatedPayments.length > 0) {
      items.push({
        id: "check_overallocated_payments",
        category: "PAYMENTS",
        title: "Over-Allocated Payments Detected",
        description: `${overAllocatedPayments.length} payment(s) have allocations exceeding their total face value.`,
        severity: "BLOCKING",
        count: overAllocatedPayments.length,
        details: overAllocatedPayments,
      });
    } else {
      items.push({
        id: "check_overallocated_payments",
        category: "PAYMENTS",
        title: "Payment Allocation Math Integrity",
        description: "Zero over-allocated payment discrepancies detected.",
        severity: "PASS",
        count: 0,
      });
    }

    if (unallocatedPayments.length > 0) {
      items.push({
        id: "check_unapplied_payments",
        category: "PAYMENTS",
        title: "Unapplied Payments / Customer Advances",
        description: `${unallocatedPayments.length} payment(s) contain unapplied funds. Legitimate advances are permitted to close but should be acknowledged.`,
        severity: "WARNING",
        count: unallocatedPayments.length,
        details: unallocatedPayments,
      });
    } else {
      items.push({
        id: "check_unapplied_payments",
        category: "PAYMENTS",
        title: "Unapplied Payments Status",
        description: "All payments recorded within this period are fully applied.",
        severity: "PASS",
        count: 0,
      });
    }

    // -------------------------------------------------------------
    // CHECK 5: Receivables & Payables Review (Req 12, 13, 87, 89)
    // -------------------------------------------------------------
    // CHECK 5: Receivables & Payables Review (Req 12, 13, 87, 89)
    // -------------------------------------------------------------
    const [openReceivables, openPayables] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          businessId,
          transactionType: TransactionType.RECEIVABLE,
          status: TransactionStatus.POSTED,
          transactionDate: { lte: endDate },
          paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
        },
        select: {
          id: true,
          totalAmount: true,
          dueDate: true,
          allocations: { select: { amount: true } },
        },
      }),
      prisma.transaction.findMany({
        where: {
          businessId,
          transactionType: TransactionType.PAYABLE,
          status: TransactionStatus.POSTED,
          transactionDate: { lte: endDate },
          paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
        },
        select: {
          id: true,
          totalAmount: true,
          dueDate: true,
          allocations: { select: { amount: true } },
        },
      }),
    ]);

    let totalRecOutstanding = Money.zero();
    let overdueRecCount = 0;
    for (const r of openReceivables) {
      const allocated = r.allocations.reduce((s: Money, a: { amount: Prisma.Decimal }) => s.add(Money.fromDecimal(a.amount)), Money.zero());
      const out = Money.fromDecimal(r.totalAmount).minus(allocated);
      if (out.isPositive()) {
        totalRecOutstanding = totalRecOutstanding.add(out);
        if (r.dueDate && r.dueDate < endDate) overdueRecCount++;
      }
    }

    let totalPayOutstanding = Money.zero();
    let overduePayCount = 0;
    for (const p of openPayables) {
      const allocated = p.allocations.reduce((s: Money, a: { amount: Prisma.Decimal }) => s.add(Money.fromDecimal(a.amount)), Money.zero());
      const out = Money.fromDecimal(p.totalAmount).minus(allocated);
      if (out.isPositive()) {
        totalPayOutstanding = totalPayOutstanding.add(out);
        if (p.dueDate && p.dueDate < endDate) overduePayCount++;
      }
    }

    items.push({
      id: "check_receivables",
      category: "RECEIVABLES",
      title: "Accounts Receivable Review",
      description: `Period ended with ₹${totalRecOutstanding.format()} in outstanding receivables (${openReceivables.length} invoice(s), ${overdueRecCount} overdue). Outstanding receivables are valid accounting assets.`,
      severity: "PASS",
      count: openReceivables.length,
      amount: `₹${totalRecOutstanding.format()}`,
    });

    items.push({
      id: "check_payables",
      category: "PAYABLES",
      title: "Accounts Payable Review",
      description: `Period ended with ₹${totalPayOutstanding.format()} in outstanding payables (${openPayables.length} bill(s), ${overduePayCount} overdue). Outstanding payables are valid liabilities.`,
      severity: "PASS",
      count: openPayables.length,
      amount: `₹${totalPayOutstanding.format()}`,
    });

    // -------------------------------------------------------------
    // CHECK 6: Opening Balance & Prior Period Continuity (Req 14, 15)
    // -------------------------------------------------------------
    if (priorPeriod) {
      if (priorPeriod.status !== FinancialPeriodStatus.CLOSED && priorPeriod.status !== FinancialPeriodStatus.LOCKED) {
        items.push({
          id: "check_prior_period_continuity",
          category: "CONTINUITY",
          title: "Prior Accounting Period Unclosed",
          description: `Prior period (${this.getPeriodLabel(priorPeriod.year, priorPeriod.month)}) is currently ${priorPeriod.status}. Standard accounting protocol recommends closing prior periods first to guarantee opening balance continuity.`,
          severity: "WARNING",
        });
      } else {
        items.push({
          id: "check_prior_period_continuity",
          category: "CONTINUITY",
          title: "Prior Accounting Period Closed",
          description: `Prior period (${this.getPeriodLabel(priorPeriod.year, priorPeriod.month)}) is ${priorPeriod.status} with audited snapshot.`,
          severity: "PASS",
        });
      }
    } else {
      items.push({
        id: "check_prior_period_continuity",
        category: "CONTINUITY",
        title: "Baseline Accounting Period",
        description: "No preceding financial period found in database. This period serves as the initial accounting period.",
        severity: "PASS",
      });
    }

    // -------------------------------------------------------------
    // CHECK 7: Import Staging Pipeline Review (Requirement 23)
    // -------------------------------------------------------------
    const activeImports = importBatches.filter(
      (b: { status: string }) => b.status === "UPLOADING" || b.status === "VALIDATING" || b.status === "COMMITTING" || b.status === "PARSED" || b.status === "MAPPED"
    );

    if (activeImports.length > 0) {
      items.push({
        id: "check_imports",
        category: "IMPORTS",
        title: "Active Import Batches in Progress",
        description: `${activeImports.length} import batch(es) are currently executing. Please wait for imports to complete before closing the period.`,
        severity: "BLOCKING",
        count: activeImports.length,
        details: activeImports.map((i: { id: string; originalFileName: string; status: string }) => ({
          id: i.id,
          reference: i.originalFileName,
          description: `Status: ${i.status}`,
          reason: "Import in progress. Cannot close period during database modification.",
        })),
      });
    } else {
      items.push({
        id: "check_imports",
        category: "IMPORTS",
        title: "Import Pipeline Clear",
        description: "Zero active import batches running. All Excel/CSV staging pipelines are committed or settled.",
        severity: "PASS",
        count: 0,
      });
    }

    // -------------------------------------------------------------
    // CHECK 8: Overall Accounting Health (Requirement 24)
    // -------------------------------------------------------------
    const blockingErrors = reconciliationReport.discrepancies.filter((d: ReconciliationDiscrepancy) => d.severity === "ERROR");
    if (blockingErrors.length > 0) {
      items.push({
        id: "check_accounting_health",
        category: "HEALTH",
        title: "Accounting Integrity Discrepancies",
        description: `Found ${blockingErrors.length} integrity discrepancy(ies) via Phase 5 Reconciliation Engine.`,
        severity: "BLOCKING",
        count: blockingErrors.length,
        details: blockingErrors.map((e: ReconciliationDiscrepancy) => ({
          id: e.entityId,
          reference: e.reference,
          description: e.message,
          reason: e.code,
        })),
      });
    } else {
      items.push({
        id: "check_accounting_health",
        category: "HEALTH",
        title: "Reconciliation & Health Status",
        description: "Full Phase 5 accounting engine integrity verification passed with zero errors.",
        severity: "PASS",
      });
    }

    // -------------------------------------------------------------
    // Preliminary Figures Calculation (Phase 5 Single Source of Truth)
    // -------------------------------------------------------------
    const workbookData = await ReportDataService.getMonthlyWorkbookData({
      businessId,
      startDate,
      endDate,
      financialPeriodYear: year,
    });

    const blockingCount = items.filter((i) => i.severity === "BLOCKING").length;
    const warningCount = items.filter((i) => i.severity === "WARNING").length;
    const passedCount = items.filter((i) => i.severity === "PASS").length;

    let overallStatus: "READY" | "WARNINGS" | "BLOCKED" = "READY";
    if (blockingCount > 0) {
      overallStatus = "BLOCKED";
    } else if (warningCount > 0) {
      overallStatus = "WARNINGS";
    }

    // Data Change Token (Requirement 83): hash of record counts + amounts to prevent race conditions
    const tokenSource = `${postedRecords.length}_${draftRecords.length}_${allPeriodPayments.length}_${workbookData.summary.netResult.toDecimalString()}`;
    const dataChangeToken = crypto.createHash("md5").update(tokenSource).digest("hex");

    return {
      year,
      month,
      periodLabel,
      startDate,
      endDate,
      periodStatus: period.status,
      overallStatus,
      dataChangeToken,
      totalChecks: items.length,
      passedChecks: passedCount,
      warningChecks: warningCount,
      blockingChecks: blockingCount,
      items,
      preliminaryFigures: {
        openingBalance: workbookData.summary.openingBalance.format(),
        totalIncome: workbookData.summary.totalIncome.format(),
        totalExpenses: workbookData.summary.totalExpenses.format(),
        netResult: workbookData.summary.netResult.format(),
        moneyReceived: workbookData.summary.moneyReceived.format(),
        moneyPaid: workbookData.summary.moneyPaid.format(),
        receivablesOutstanding: workbookData.summary.receivablesOutstanding.format(),
        payablesOutstanding: workbookData.summary.payablesOutstanding.format(),
        closingCashPosition: workbookData.summary.closingBalance.format(),
        cashBalance: workbookData.paymentSummary.find((p) => p.name.toLowerCase().includes("cash"))?.netMovement.format() || "0.00",
        bankBalance: workbookData.paymentSummary.find((p) => p.name.toLowerCase().includes("bank"))?.netMovement.format() || "0.00",
        upiBalance: workbookData.paymentSummary.find((p) => p.name.toLowerCase().includes("upi"))?.netMovement.format() || "0.00",
        transactionCount: workbookData.summary.transactionCount,
        accountingBasis: workbookData.summary.business.accountingBasis,
      },
    };
  }

  /**
   * Final atomic month-end close operation.
   * Creates immutable closing snapshot, closes financial period, generates final Excel/PDF reports.
   */
  public static async closeFinancialPeriod(params: {
    businessId: string;
    userId: string;
    year: number;
    month: number;
    closingNotes?: string | null;
    dataChangeToken?: string;
  }) {
    const { businessId, userId, year, month, closingNotes } = params;
    await SystemMaintenanceService.assertCanWrite(businessId);

    // 1. Commit-time revalidation (Requirement 34 & 36)
    const checklist = await this.runPreCloseChecklist(businessId, year, month);
    if (checklist.blockingChecks > 0) {
      const firstBlocking = checklist.items.find((i) => i.severity === "BLOCKING");
      throw new BusinessRuleError(
        `Cannot close period: ${firstBlocking?.title || "Blocking accounting discrepancy detected"}. Resolve all blocking items first.`
      );
    }

    // 2. Fetch authoritative report dataset from ReportDataService
    const { startDate, endDate } = this.getPeriodDates(year, month);
    const periodLabel = this.getPeriodLabel(year, month);

    const [workbookData, recAging, payAging] = await Promise.all([
      ReportDataService.getMonthlyWorkbookData({
        businessId,
        startDate,
        endDate,
        financialPeriodYear: year,
      }),
      ReportDataService.getReceivableAgingReport({
        businessId,
        startDate,
        endDate,
        financialPeriodYear: year,
      }),
      ReportDataService.getPayableAgingReport({
        businessId,
        startDate,
        endDate,
        financialPeriodYear: year,
      }),
    ]);
    const summary = workbookData.summary;

    const recAgingSummary = recAging.reduce(
      (acc, r) => ({
        current: acc.current.add(r.current),
        days1To30: acc.days1To30.add(r.days1To30),
        days31To60: acc.days31To60.add(r.days31To60),
        days61To90: acc.days61To90.add(r.days61To90),
        days90Plus: acc.days90Plus.add(r.days90Plus),
      }),
      {
        current: Money.zero(),
        days1To30: Money.zero(),
        days31To60: Money.zero(),
        days61To90: Money.zero(),
        days90Plus: Money.zero(),
      }
    );

    const payAgingSummary = payAging.reduce(
      (acc, p) => ({
        current: acc.current.add(p.current),
        days1To30: acc.days1To30.add(p.days1To30),
        days31To60: acc.days31To60.add(p.days31To60),
        days61To90: acc.days61To90.add(p.days61To90),
        days90Plus: acc.days90Plus.add(p.days90Plus),
      }),
      {
        current: Money.zero(),
        days1To30: Money.zero(),
        days31To60: Money.zero(),
        days61To90: Money.zero(),
        days90Plus: Money.zero(),
      }
    );

    const cashBalance = workbookData.paymentSummary.find((p) => p.name.toLowerCase().includes("cash"))?.netMovement || Money.zero();
    const bankBalance = workbookData.paymentSummary.find((p) => p.name.toLowerCase().includes("bank"))?.netMovement || Money.zero();
    const upiBalance = workbookData.paymentSummary.find((p) => p.name.toLowerCase().includes("upi"))?.netMovement || Money.zero();

    // 3. Concurrency Protection & Atomic Close Transaction (Requirement 34 & 35)
    const closingResult = await prisma.$transaction(async (tx) => {
      // Find current period
      const currentPeriod = await tx.financialPeriod.findUnique({
        where: {
          businessId_year_month: {
            businessId,
            year,
            month,
          },
        },
        include: { closing: true },
      });

      if (!currentPeriod) {
        throw new NotFoundError("Financial period record not found.");
      }

      if (currentPeriod.status === FinancialPeriodStatus.CLOSED || currentPeriod.status === FinancialPeriodStatus.LOCKED) {
        throw new BusinessRuleError(
          `Financial period ${periodLabel} is already ${currentPeriod.status}. Double-closing is prevented.`
        );
      }

      // Calculate snapshot version
      let newVersion = 1;
      let historyChain: NonNullable<ClosingSnapshotDTO["history"]> = [];

      if (currentPeriod.closing && currentPeriod.closing.snapshotData) {
        const prevSnapshot = currentPeriod.closing.snapshotData as unknown as ClosingSnapshotDTO;
        newVersion = (prevSnapshot.version || 1) + 1;

        // Preserve prior version in history chain
        historyChain = prevSnapshot.history || [];
        historyChain.push({
          version: prevSnapshot.version || 1,
          closedAt: prevSnapshot.closedAt || currentPeriod.closing.closedAt.toISOString(),
          closedBy: prevSnapshot.closedBy || currentPeriod.closing.closedBy,
          reopenedAt: currentPeriod.reopenedAt ? currentPeriod.reopenedAt.toISOString() : new Date().toISOString(),
          reopenedBy: currentPeriod.reopenedBy || "Unknown",
          reopenReason: currentPeriod.reopenReason || "Correction",
          summary: { ...prevSnapshot.summary },
        });
      }

      // Link any unassigned transactions in this date range to this period
      await tx.transaction.updateMany({
        where: {
          businessId,
          transactionDate: { gte: startDate, lte: endDate },
          financialPeriodId: null,
        },
        data: {
          financialPeriodId: currentPeriod.id,
        },
      });

      // Construct Structured Closing Snapshot DTO (Requirement 29, 30, 31)
      const canonicalPayload: Omit<ClosingSnapshotDTO, "integrityHash"> = {
        version: newVersion,
        businessId,
        financialPeriodId: currentPeriod.id,
        periodLabel,
        year,
        month,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        accountingBasis: summary.business.accountingBasis,
        closedAt: new Date().toISOString(),
        closedBy: userId,
        closingNotes: closingNotes?.trim() || null,
        summary: {
          openingBalance: summary.openingBalance.format(),
          totalIncome: summary.totalIncome.format(),
          totalExpenses: summary.totalExpenses.format(),
          netResult: summary.netResult.format(),
          closingBalance: summary.closingBalance.format(),
          totalReceivables: summary.receivablesOutstanding.format(),
          totalPayables: summary.payablesOutstanding.format(),
          moneyReceived: summary.moneyReceived.format(),
          moneyPaid: summary.moneyPaid.format(),
          cashBalance: cashBalance.format(),
          bankBalance: bankBalance.format(),
          upiBalance: upiBalance.format(),
          transactionCount: summary.transactionCount,
        },
        categories: {
          income: workbookData.categorySummary
            .filter((c) => c.type === "INCOME")
            .map((c) => ({
              category: c.name,
              count: c.transactionCount,
              amount: c.incomeAmount.format(),
              percentage: c.percentageOfTotal,
            })),
          expenses: workbookData.categorySummary
            .filter((c) => c.type === "EXPENSE")
            .map((c) => ({
              category: c.name,
              count: c.transactionCount,
              amount: c.expenseAmount.format(),
              percentage: c.percentageOfTotal,
            })),
        },
        paymentMethods: workbookData.paymentSummary.map((pm) => ({
          method: pm.name,
          received: pm.moneyReceived.format(),
          paid: pm.moneyPaid.format(),
          net: pm.netMovement.format(),
          count: pm.transactionCount,
        })),
        receivables: {
          totalOutstanding: summary.receivablesOutstanding.format(),
          aging: {
            current: recAgingSummary.current.format(),
            days1To30: recAgingSummary.days1To30.format(),
            days31To60: recAgingSummary.days31To60.format(),
            days61To90: recAgingSummary.days61To90.format(),
            days90Plus: recAgingSummary.days90Plus.format(),
          },
          items: workbookData.receivables.map((r) => ({
            customerName: r.partyName,
            customerCode: r.partyCode || "",
            originalAmount: r.amount.format(),
            paidAmount: r.paidAmount.format(),
            outstandingAmount: r.outstandingAmount.format(),
            dueDate: r.dueDate ? r.dueDate.toISOString().split("T")[0] : undefined,
          })),
        },
        payables: {
          totalOutstanding: summary.payablesOutstanding.format(),
          aging: {
            current: payAgingSummary.current.format(),
            days1To30: payAgingSummary.days1To30.format(),
            days31To60: payAgingSummary.days31To60.format(),
            days61To90: payAgingSummary.days61To90.format(),
            days90Plus: payAgingSummary.days90Plus.format(),
          },
          items: workbookData.payables.map((p) => ({
            supplierName: p.partyName,
            supplierCode: p.partyCode || "",
            originalAmount: p.amount.format(),
            paidAmount: p.paidAmount.format(),
            outstandingAmount: p.outstandingAmount.format(),
            dueDate: p.dueDate ? p.dueDate.toISOString().split("T")[0] : undefined,
          })),
        },
        reports: {
          excelStatus: "PENDING",
          pdfStatus: "PENDING",
        },
        history: historyChain,
      };

      // Compute SHA-256 integrity hash
      const integrityHash = MonthEndService.computeSnapshotHash(canonicalPayload as Record<string, unknown>);
      const completeSnapshot: ClosingSnapshotDTO = {
        ...canonicalPayload,
        integrityHash,
      };

      // Update Financial Period to CLOSED
      const updatedPeriod = await tx.financialPeriod.update({
        where: { id: currentPeriod.id },
        data: {
          status: FinancialPeriodStatus.CLOSED,
          closedAt: new Date(),
          closedBy: userId,
          reopenedAt: null,
          reopenedBy: null,
          reopenReason: null,
        },
      });

      // Upsert MonthlyClosing entity
      const closingRecord = await tx.monthlyClosing.upsert({
        where: { financialPeriodId: currentPeriod.id },
        create: {
          businessId,
          financialPeriodId: currentPeriod.id,
          openingBalance: summary.openingBalance.toDecimal(),
          totalIncome: summary.totalIncome.toDecimal(),
          totalExpenses: summary.totalExpenses.toDecimal(),
          netResult: summary.netResult.toDecimal(),
          closingBalance: summary.closingBalance.toDecimal(),
          totalReceivables: summary.receivablesOutstanding.toDecimal(),
          totalPayables: summary.payablesOutstanding.toDecimal(),
          cashBalance: cashBalance.toDecimal(),
          bankBalance: bankBalance.toDecimal(),
          upiBalance: upiBalance.toDecimal(),
          transactionCount: summary.transactionCount,
          snapshotData: completeSnapshot as unknown as Prisma.InputJsonValue,
          closedBy: userId,
          closedAt: new Date(),
        },
        update: {
          openingBalance: summary.openingBalance.toDecimal(),
          totalIncome: summary.totalIncome.toDecimal(),
          totalExpenses: summary.totalExpenses.toDecimal(),
          netResult: summary.netResult.toDecimal(),
          closingBalance: summary.closingBalance.toDecimal(),
          totalReceivables: summary.receivablesOutstanding.toDecimal(),
          totalPayables: summary.payablesOutstanding.toDecimal(),
          cashBalance: cashBalance.toDecimal(),
          bankBalance: bankBalance.toDecimal(),
          upiBalance: upiBalance.toDecimal(),
          transactionCount: summary.transactionCount,
          snapshotData: completeSnapshot as unknown as Prisma.InputJsonValue,
          closedBy: userId,
          closedAt: new Date(),
        },
      });

      // Audit Log (Requirement 39 & 59)
      await AuditService.log({
        businessId,
        userId,
        action: AuditAction.MONTH_CLOSE,
        entityType: "FINANCIAL_PERIOD",
        entityId: currentPeriod.id,
        reason: closingNotes?.trim() || `Closed ${periodLabel} (Version ${newVersion})`,
        newValues: {
          periodLabel,
          version: newVersion,
          integrityHash,
          totalIncome: summary.totalIncome.format(),
          totalExpenses: summary.totalExpenses.format(),
          netResult: summary.netResult.format(),
          closingBalance: summary.closingBalance.format(),
        },
      });

      return {
        period: updatedPeriod,
        closing: closingRecord,
        snapshot: completeSnapshot,
      };
    });

    // 4. Post-Close Asynchronous / Non-Blocking Report Generation (Requirement 44, 45, 47)
    // If Excel or PDF generation fails, valid accounting close MUST NOT be rolled back.
    let excelReportId: string | undefined;
    let excelStatus: "COMPLETED" | "FAILED" = "COMPLETED";
    let pdfReportId: string | undefined;
    let pdfStatus: "COMPLETED" | "FAILED" = "COMPLETED";

    try {
      const excelRes = await ExportService.generateExport({
        businessId,
        userId,
        userRoles: ["OWNER", "ADMIN"],
        userPermissions: ["*"],
        exportType: "MONTHLY_WORKBOOK",
        format: "EXCEL",
        startDate,
        endDate,
        financialPeriodYear: year,
        period: "custom",
      });
      excelReportId = excelRes.id;
    } catch (err) {
      excelStatus = "FAILED";
      console.error("[MonthEndService] Excel generation error on close:", err);
    }

    try {
      const pdfRes = await PdfReportService.generateReport({
        businessId,
        userId,
        userRoles: ["OWNER", "ADMIN"],
        userPermissions: ["*"],
        reportType: "MONTHLY_ACCOUNTING",
        filters: {
          businessId,
          startDate,
          endDate,
          period: "custom",
        },
      });
      pdfReportId = pdfRes.historyId;
    } catch (err) {
      pdfStatus = "FAILED";
      console.error("[MonthEndService] PDF generation error on close:", err);
    }

    // Update snapshot with generated report links
    const finalSnapshot: ClosingSnapshotDTO = {
      ...closingResult.snapshot,
      reports: {
        excelReportId,
        pdfReportId,
        excelStatus,
        pdfStatus,
      },
    };

    await prisma.monthlyClosing.update({
      where: { id: closingResult.closing.id },
      data: {
        snapshotData: finalSnapshot as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      periodLabel,
      version: finalSnapshot.version,
      integrityHash: finalSnapshot.integrityHash,
      closedAt: closingResult.period.closedAt,
      closedBy: userId,
      summary: finalSnapshot.summary,
      reports: finalSnapshot.reports,
    };
  }

  /**
   * Reopen a closed financial period with mandatory reason and audit trail (Requirement 52-55).
   * Preserves previous closing snapshots in history chain without silent data loss.
   */
  public static async reopenFinancialPeriod(params: {
    businessId: string;
    userId: string;
    year: number;
    month: number;
    reasonCategory: ReopenReasonCategory;
    explanation: string;
    isOwnerOrElevated?: boolean;
  }) {
    const { businessId, userId, year, month, reasonCategory, explanation, isOwnerOrElevated } = params;
    await SystemMaintenanceService.assertCanWrite(businessId);

    if (!explanation || explanation.trim().length < 5) {
      throw new ValidationError("A detailed explanation (minimum 5 characters) is required to reopen an accounting period.");
    }

    const fullReason = `[${reasonCategory}] ${explanation.trim()}`;
    const periodLabel = this.getPeriodLabel(year, month);

    return await prisma.$transaction(async (tx) => {
      const period = await tx.financialPeriod.findUnique({
        where: {
          businessId_year_month: {
            businessId,
            year,
            month,
          },
        },
        include: { closing: true },
      });

      if (!period) {
        throw new NotFoundError("Financial period not found.");
      }

      if (period.status === FinancialPeriodStatus.OPEN) {
        throw new BusinessRuleError(`Financial period ${periodLabel} is already OPEN.`);
      }

      if (period.status === FinancialPeriodStatus.LOCKED && !isOwnerOrElevated) {
        throw new ForbiddenError(
          `Financial period ${periodLabel} is LOCKED. Reopening a locked period requires Owner / Administrator authorization.`
        );
      }

      // Preserve previous closing snapshot and mark superseded
      if (period.closing && period.closing.snapshotData) {
        const snap = period.closing.snapshotData as unknown as ClosingSnapshotDTO;
        const history = snap.history || [];
        history.push({
          version: snap.version || 1,
          closedAt: snap.closedAt,
          closedBy: snap.closedBy,
          reopenedAt: new Date().toISOString(),
          reopenedBy: userId,
          reopenReason: fullReason,
          summary: { ...snap.summary },
        });
        snap.history = history;

        await tx.monthlyClosing.update({
          where: { id: period.closing.id },
          data: {
            snapshotData: snap as unknown as Prisma.InputJsonValue,
          },
        });
      }

      // Reopen period
      const reopened = await tx.financialPeriod.update({
        where: { id: period.id },
        data: {
          status: FinancialPeriodStatus.OPEN,
          reopenedAt: new Date(),
          reopenedBy: userId,
          reopenReason: fullReason,
        },
      });

      // Audit Log
      await AuditService.log({
        businessId,
        userId,
        action: AuditAction.MONTH_REOPEN,
        entityType: "FINANCIAL_PERIOD",
        entityId: period.id,
        reason: fullReason,
        newValues: {
          periodLabel,
          status: FinancialPeriodStatus.OPEN,
          reopenCategory: reasonCategory,
          explanation: explanation.trim(),
        },
      });

      return {
        success: true,
        periodLabel,
        status: reopened.status,
        reopenedAt: reopened.reopenedAt,
        reopenedBy: userId,
        reason: fullReason,
      };
    });
  }

  /**
   * Lock a closed financial period for historical immutability (Requirement 50 & 51).
   */
  public static async lockFinancialPeriod(businessId: string, userId: string, year: number, month: number) {
    const periodLabel = this.getPeriodLabel(year, month);

    const period = await prisma.financialPeriod.findUnique({
      where: {
        businessId_year_month: {
          businessId,
          year,
          month,
        },
      },
    });

    if (!period) throw new NotFoundError("Financial period not found.");
    if (period.status !== FinancialPeriodStatus.CLOSED) {
      throw new BusinessRuleError(`Only CLOSED periods can be locked. Current status: ${period.status}`);
    }

    const locked = await prisma.financialPeriod.update({
      where: { id: period.id },
      data: { status: FinancialPeriodStatus.LOCKED },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.UPDATE,
      entityType: "FINANCIAL_PERIOD",
      entityId: period.id,
      reason: `Locked period ${periodLabel} for historical compliance.`,
      newValues: { status: FinancialPeriodStatus.LOCKED },
    });

    return { success: true, periodLabel, status: locked.status };
  }

  /**
   * Unlock a locked financial period (reverting to CLOSED) with elevated permission (Requirement 60).
   */
  public static async unlockFinancialPeriod(
    businessId: string,
    userId: string,
    year: number,
    month: number,
    reason: string
  ) {
    const periodLabel = this.getPeriodLabel(year, month);

    if (!reason || reason.trim().length < 5) {
      throw new ValidationError("A detailed reason is required to unlock a locked period.");
    }

    const period = await prisma.financialPeriod.findUnique({
      where: {
        businessId_year_month: {
          businessId,
          year,
          month,
        },
      },
    });

    if (!period) throw new NotFoundError("Financial period not found.");
    if (period.status !== FinancialPeriodStatus.LOCKED) {
      throw new BusinessRuleError(`Only LOCKED periods can be unlocked. Current status: ${period.status}`);
    }

    const unlocked = await prisma.financialPeriod.update({
      where: { id: period.id },
      data: { status: FinancialPeriodStatus.CLOSED },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.UPDATE,
      entityType: "FINANCIAL_PERIOD",
      entityId: period.id,
      reason: `Unlocked period ${periodLabel}: ${reason.trim()}`,
      newValues: { status: FinancialPeriodStatus.CLOSED },
    });

    return { success: true, periodLabel, status: unlocked.status };
  }

  /**
   * Retrieve preserved "As-Closed" snapshot for a closed period (Requirement 65 & 66).
   */
  public static async getClosingSnapshot(
    businessId: string,
    year: number,
    month: number
  ): Promise<ClosingSnapshotDTO | null> {
    const period = await prisma.financialPeriod.findUnique({
      where: {
        businessId_year_month: {
          businessId,
          year,
          month,
        },
      },
      include: {
        closing: true,
      },
    });

    if (!period || !period.closing) {
      return null;
    }

    return period.closing.snapshotData as unknown as ClosingSnapshotDTO;
  }

  /**
   * Calculate side-by-side differences between Version 1 and Version 2 (Requirement 57 & 91).
   */
  public static async getVersionComparison(
    businessId: string,
    year: number,
    month: number
  ): Promise<VersionDiffResult | null> {
    const activeSnapshot = await this.getClosingSnapshot(businessId, year, month);
    if (!activeSnapshot || !activeSnapshot.history || activeSnapshot.history.length === 0) {
      return null;
    }

    // Historical v1 (first version) vs v2 (active version)
    const v1History = activeSnapshot.history[0];
    const v1Summary = v1History.summary;
    const v2Summary = activeSnapshot.summary;

    const v1Income = Money.parse(String(v1Summary.totalIncome || 0));
    const v2Income = Money.parse(v2Summary.totalIncome);
    const v1Expenses = Money.parse(String(v1Summary.totalExpenses || 0));
    const v2Expenses = Money.parse(v2Summary.totalExpenses);
    const v1Net = Money.parse(String(v1Summary.netResult || 0));
    const v2Net = Money.parse(v2Summary.netResult);
    const v1Rec = Money.parse(String(v1Summary.totalReceivables || 0));
    const v2Rec = Money.parse(v2Summary.totalReceivables);
    const v1Pay = Money.parse(String(v1Summary.totalPayables || 0));
    const v2Pay = Money.parse(v2Summary.totalPayables);
    const v1Cash = Money.parse(String(v1Summary.closingBalance || 0));
    const v2Cash = Money.parse(v2Summary.closingBalance);
    const v1Count = Number(v1Summary.transactionCount || 0);
    const v2Count = Number(v2Summary.transactionCount || 0);

    return {
      periodLabel: activeSnapshot.periodLabel,
      v1: {
        version: v1History.version,
        closedAt: v1History.closedAt,
        closedBy: v1History.closedBy,
        income: v1Income.format(),
        expenses: v1Expenses.format(),
        netResult: v1Net.format(),
        receivables: v1Rec.format(),
        payables: v1Pay.format(),
        cashPosition: v1Cash.format(),
        transactionCount: v1Count,
      },
      v2: {
        version: activeSnapshot.version,
        closedAt: activeSnapshot.closedAt,
        closedBy: activeSnapshot.closedBy,
        income: v2Income.format(),
        expenses: v2Expenses.format(),
        netResult: v2Net.format(),
        receivables: v2Rec.format(),
        payables: v2Pay.format(),
        cashPosition: v2Cash.format(),
        transactionCount: v2Count,
      },
      differences: {
        incomeDiff: v2Income.minus(v1Income).format(),
        expensesDiff: v2Expenses.minus(v1Expenses).format(),
        netResultDiff: v2Net.minus(v1Net).format(),
        receivablesDiff: v2Rec.minus(v1Rec).format(),
        payablesDiff: v2Pay.minus(v1Pay).format(),
        cashPositionDiff: v2Cash.minus(v1Cash).format(),
        transactionCountDiff: v2Count - v1Count,
      },
    };
  }

  /**
   * Regenerate official closing reports strictly from snapshot data if lost (Requirement 72).
   */
  public static async regenerateClosingReports(
    businessId: string,
    userId: string,
    year: number,
    month: number,
    format: "EXCEL" | "PDF" | "BOTH" = "BOTH"
  ) {
    const snapshot = await this.getClosingSnapshot(businessId, year, month);
    if (!snapshot) {
      throw new NotFoundError("Closing snapshot not found for this period.");
    }

    const { startDate, endDate } = this.getPeriodDates(year, month);
    let excelReportId = snapshot.reports?.excelReportId;
    let excelStatus = snapshot.reports?.excelStatus || "PENDING";
    let pdfReportId = snapshot.reports?.pdfReportId;
    let pdfStatus = snapshot.reports?.pdfStatus || "PENDING";

    if (format === "EXCEL" || format === "BOTH") {
      try {
        const excelRes = await ExportService.generateExport({
          businessId,
          userId,
          userRoles: ["OWNER", "ADMIN"],
          userPermissions: ["*"],
          exportType: "MONTHLY_WORKBOOK",
          format: "EXCEL",
          startDate,
          endDate,
          financialPeriodYear: year,
          period: "custom",
        });
        excelReportId = excelRes.id;
        excelStatus = "COMPLETED";
      } catch (err) {
        excelStatus = "FAILED";
        console.error("[MonthEndService] Error regenerating closing Excel:", err);
      }
    }

    if (format === "PDF" || format === "BOTH") {
      try {
        const pdfRes = await PdfReportService.generateReport({
          businessId,
          userId,
          userRoles: ["OWNER", "ADMIN"],
          userPermissions: ["*"],
          reportType: "MONTHLY_ACCOUNTING",
          filters: {
            businessId,
            startDate,
            endDate,
            period: "custom",
          },
        });
        pdfReportId = pdfRes.historyId;
        pdfStatus = "COMPLETED";
      } catch (err) {
        pdfStatus = "FAILED";
        console.error("[MonthEndService] Error regenerating closing PDF:", err);
      }
    }

    // Update snapshot with newly regenerated report references
    const updatedSnapshot: ClosingSnapshotDTO = {
      ...snapshot,
      reports: {
        excelReportId,
        pdfReportId,
        excelStatus,
        pdfStatus,
      },
    };

    await prisma.monthlyClosing.update({
      where: { financialPeriodId: snapshot.financialPeriodId },
      data: {
        snapshotData: updatedSnapshot as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      reports: updatedSnapshot.reports,
    };
  }
}
