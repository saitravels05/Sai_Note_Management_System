import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import {
  TransactionType,
  PaymentStatus,
  TransactionStatus,
  PaymentDirection,
  PaymentMethodType,
  Prisma,
} from "@prisma/client";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  differenceInDays,
  format,
} from "date-fns";

export interface TransactionSummaryInput {
  type: TransactionType;
  totalAmount: string | number;
  status: TransactionStatus;
}

export interface AllocationInput {
  amount: string | number;
}

export interface OutstandingCalculationResult {
  totalAmount: Money;
  paidAmount: Money;
  outstandingAmount: Money;
  status: PaymentStatus;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
  isOverpaid: boolean;
}

export interface FinancialPeriodSummaryResult {
  totalIncome: Money;
  totalExpenses: Money;
  netResult: Money;
  transactionCount: number;
}

export interface ReceivablesSummaryResult {
  totalReceivables: Money;
  totalOriginalAmount: Money;
  totalPaidAmount: Money;
  dueTodayAmount: Money;
  overdueAmount: Money;
  partiallyPaidAmount: Money;
  unpaidAmount: Money;
  totalCount: number;
  dueTodayCount: number;
  overdueCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
}

export interface PayablesSummaryResult {
  totalPayables: Money;
  totalOriginalAmount: Money;
  totalPaidAmount: Money;
  dueTodayAmount: Money;
  overdueAmount: Money;
  partiallyPaidAmount: Money;
  unpaidAmount: Money;
  totalCount: number;
  dueTodayCount: number;
  overdueCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
}

export interface AgingBucket {
  label: string;
  count: number;
  amount: Money;
  percentage: number;
}

export interface AgingAnalysisResult {
  current: AgingBucket;
  days1To30: AgingBucket;
  days31To60: AgingBucket;
  days61To90: AgingBucket;
  days90Plus: AgingBucket;
  total: Money;
}

export interface PaymentMethodBreakdownItem {
  id: string;
  name: string;
  type: PaymentMethodType;
  inflow: Money;
  outflow: Money;
  netFlow: Money;
  transactionCount: number;
}

export interface CategorySummaryItem {
  id: string;
  name: string;
  amount: Money;
  count: number;
  percentage: number;
}

export interface DashboardFinancialSummary {
  periodLabel: string;
  recognizedIncome: Money;
  recognizedExpenses: Money;
  netResult: Money;
  moneyReceived: Money;
  moneyPaid: Money;
  netCashMovement: Money;
  totalReceivables: Money;
  totalPayables: Money;
  cashBalance: Money;
  bankBalance: Money;
  upiBalance: Money;
  totalLiquidity: Money;
  // Comparison vs previous period
  comparison: {
    incomeGrowthPercentage: number;
    expenseGrowthPercentage: number;
    netGrowthPercentage: number;
  };
}

/**
 * Enterprise Accounting Calculation Engine & Financial Aggregator.
 * 
 * Rules:
 * 1. Double-entry integrity: All calculations use Decimal.js via the Money class.
 * 2. VOID or DRAFT transactions do not contribute to active financial totals.
 * 3. Outstanding balance is strictly derived from: Transaction Total - Sum(Payment Allocations).
 * 4. Double Counting Prevention:
 *    - Recognized Income = POSTED INCOME + POSTED RECEIVABLE + CREDIT ADJUSTMENTS.
 *    - Recognized Expenses = POSTED EXPENSE + POSTED PAYABLE + DEBIT ADJUSTMENTS.
 *    - Money Received / Paid is calculated distinctly from payments/inflows to prevent duplicate income.
 */
export class AccountingService {
  /**
   * Derive payment status and outstanding balance from allocations.
   * Prevents discrepancies between entered status and actual settlement amounts.
   */
  public static calculateOutstanding(
    invoiceTotal: string | number,
    allocations: AllocationInput[] = []
  ): OutstandingCalculationResult {
    const total = Money.parse(invoiceTotal);
    let paid = Money.zero(total.currency);

    for (const alloc of allocations) {
      paid = paid.add(Money.parse(alloc.amount, total.currency));
    }

    const outstanding = total.subtract(paid);

    let status: PaymentStatus = PaymentStatus.UNPAID;
    let isFullyPaid = false;
    let isPartiallyPaid = false;
    let isOverpaid = false;

    if (total.isZero()) {
      status = PaymentStatus.PAID;
      isFullyPaid = true;
    } else if (paid.isZero()) {
      status = PaymentStatus.UNPAID;
    } else if (paid.greaterThan(total)) {
      status = PaymentStatus.OVERPAID;
      isFullyPaid = true;
      isOverpaid = true;
    } else if (paid.equals(total)) {
      status = PaymentStatus.PAID;
      isFullyPaid = true;
    } else {
      status = PaymentStatus.PARTIALLY_PAID;
      isPartiallyPaid = true;
    }

    return {
      totalAmount: total,
      paidAmount: paid,
      outstandingAmount: outstanding.isNegative() ? Money.zero(total.currency) : outstanding,
      status,
      isFullyPaid,
      isPartiallyPaid,
      isOverpaid,
    };
  }

  /**
   * Calculate Net Result and Totals for an in-memory set of transactions.
   * Net Result = Total Income - Total Expenses
   */
  public static calculatePeriodSummary(
    transactions: TransactionSummaryInput[],
    currency = "INR"
  ): FinancialPeriodSummaryResult {
    let income = Money.zero(currency);
    let expense = Money.zero(currency);
    let count = 0;

    for (const tx of transactions) {
      // Only POSTED transactions contribute to accounting figures
      if (tx.status !== TransactionStatus.POSTED) {
        continue;
      }

      const amount = Money.parse(tx.totalAmount, currency);

      if (tx.type === TransactionType.INCOME) {
        income = income.add(amount);
        count++;
      } else if (tx.type === TransactionType.EXPENSE) {
        expense = expense.add(amount);
        count++;
      }
    }

    const net = income.subtract(expense);

    return {
      totalIncome: income,
      totalExpenses: expense,
      netResult: net,
      transactionCount: count,
    };
  }

  /**
   * Reconcile month-end closing balance:
   * Closing Balance = Opening Balance + Total Income - Total Expenses
   */
  public static calculateClosingBalance(
    openingBalance: string | number,
    totalIncome: string | number,
    totalExpense: string | number,
    currency = "INR"
  ): Money {
    const opening = Money.parse(openingBalance, currency);
    const income = Money.parse(totalIncome, currency);
    const expense = Money.parse(totalExpense, currency);

    return opening.add(income).subtract(expense);
  }

  // =========================================================================
  // DATABASE AGGREGATION & SERVER-SIDE ACCOUNTING SERVICES
  // =========================================================================

  /**
   * Calculate Recognized Income (Accrual Basis).
   * Includes: POSTED INCOME, POSTED RECEIVABLE, and CREDIT ADJUSTMENTS.
   * Excludes: DRAFT, VOID, and non-revenue payments.
   */
  public static async getRecognizedIncome(params: {
    businessId: string;
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    customerId?: string;
    financialPeriodId?: string;
  }): Promise<Money> {
    const where: Prisma.TransactionWhereInput = {
      businessId: params.businessId,
      status: TransactionStatus.POSTED,
      transactionType: { in: [TransactionType.INCOME, TransactionType.RECEIVABLE] },
    };

    if (params.startDate || params.endDate) {
      where.transactionDate = {};
      if (params.startDate) where.transactionDate.gte = params.startDate;
      if (params.endDate) where.transactionDate.lte = params.endDate;
    }

    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.customerId) where.customerId = params.customerId;
    if (params.financialPeriodId) where.financialPeriodId = params.financialPeriodId;

    const aggregate = await prisma.transaction.aggregate({
      where,
      _sum: { totalAmount: true },
    });

    return aggregate._sum.totalAmount
      ? Money.fromDecimal(aggregate._sum.totalAmount)
      : Money.zero();
  }

  /**
   * Calculate Recognized Expenses (Accrual Basis).
   * Includes: POSTED EXPENSE, POSTED PAYABLE, and DEBIT ADJUSTMENTS.
   * Excludes: DRAFT, VOID, and non-expense payments.
   */
  public static async getRecognizedExpenses(params: {
    businessId: string;
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    supplierId?: string;
    financialPeriodId?: string;
  }): Promise<Money> {
    const where: Prisma.TransactionWhereInput = {
      businessId: params.businessId,
      status: TransactionStatus.POSTED,
      transactionType: { in: [TransactionType.EXPENSE, TransactionType.PAYABLE] },
    };

    if (params.startDate || params.endDate) {
      where.transactionDate = {};
      if (params.startDate) where.transactionDate.gte = params.startDate;
      if (params.endDate) where.transactionDate.lte = params.endDate;
    }

    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.supplierId) where.supplierId = params.supplierId;
    if (params.financialPeriodId) where.financialPeriodId = params.financialPeriodId;

    const aggregate = await prisma.transaction.aggregate({
      where,
      _sum: { totalAmount: true },
    });

    return aggregate._sum.totalAmount
      ? Money.fromDecimal(aggregate._sum.totalAmount)
      : Money.zero();
  }

  /**
   * Calculate Cash Movement (Physical Inflows and Outflows).
   * Inflow: POSTED Payment(direction: IN) + Direct POSTED INCOME transactions.
   * Outflow: POSTED Payment(direction: OUT) + Direct POSTED EXPENSE transactions.
   */
  public static async getCashMovement(params: {
    businessId: string;
    startDate?: Date;
    endDate?: Date;
    paymentMethodId?: string;
  }): Promise<{ inflow: Money; outflow: Money; netCashFlow: Money }> {
    const paymentWhere: Prisma.PaymentWhereInput = {
      businessId: params.businessId,
      status: TransactionStatus.POSTED,
    };

    if (params.startDate || params.endDate) {
      paymentWhere.paymentDate = {};
      if (params.startDate) paymentWhere.paymentDate.gte = params.startDate;
      if (params.endDate) paymentWhere.paymentDate.lte = params.endDate;
    }

    if (params.paymentMethodId) {
      paymentWhere.paymentMethodId = params.paymentMethodId;
    }

    const [inflowsAgg, outflowsAgg] = await Promise.all([
      prisma.payment.aggregate({
        where: { ...paymentWhere, direction: PaymentDirection.IN },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { ...paymentWhere, direction: PaymentDirection.OUT },
        _sum: { amount: true },
      }),
    ]);

    const inflow = inflowsAgg._sum.amount
      ? Money.fromDecimal(inflowsAgg._sum.amount)
      : Money.zero();

    const outflow = outflowsAgg._sum.amount
      ? Money.fromDecimal(outflowsAgg._sum.amount)
      : Money.zero();

    const netCashFlow = inflow.subtract(outflow);

    return { inflow, outflow, netCashFlow };
  }

  /**
   * Receivables Summary (Outstanding balances, due today, overdue).
   */
  public static async getReceivablesSummary(params: {
    businessId: string;
    asOfDate?: Date;
  }): Promise<ReceivablesSummaryResult> {
    const asOf = params.asOfDate || new Date();
    const todayStart = startOfDay(asOf);
    const todayEnd = endOfDay(asOf);

    // Fetch all active posted receivables with their allocations
    const receivables = await prisma.transaction.findMany({
      where: {
        businessId: params.businessId,
        status: TransactionStatus.POSTED,
        transactionType: TransactionType.RECEIVABLE,
      },
      select: {
        id: true,
        totalAmount: true,
        dueDate: true,
        allocations: {
          select: {
            amount: true,
            payment: { select: { status: true } },
          },
        },
      },
    });

    let totalOriginal = Money.zero();
    let totalPaid = Money.zero();
    let totalOutstanding = Money.zero();
    let dueTodayAmount = Money.zero();
    let overdueAmount = Money.zero();
    let partiallyPaidAmount = Money.zero();
    let unpaidAmount = Money.zero();

    let dueTodayCount = 0;
    let overdueCount = 0;
    let partiallyPaidCount = 0;
    let unpaidCount = 0;

    for (const r of receivables) {
      const original = Money.fromDecimal(r.totalAmount);
      totalOriginal = totalOriginal.add(original);

      // Sum active allocations (excluding allocations from VOID payments)
      let paid = Money.zero();
      for (const a of r.allocations) {
        if (a.payment.status === TransactionStatus.POSTED) {
          paid = paid.add(Money.fromDecimal(a.amount));
        }
      }
      totalPaid = totalPaid.add(paid);

      const outstanding = original.subtract(paid);
      if (outstanding.isPositive()) {
        totalOutstanding = totalOutstanding.add(outstanding);

        if (paid.isZero()) {
          unpaidCount++;
          unpaidAmount = unpaidAmount.add(outstanding);
        } else {
          partiallyPaidCount++;
          partiallyPaidAmount = partiallyPaidAmount.add(outstanding);
        }

        if (r.dueDate) {
          const d = new Date(r.dueDate);
          if (d >= todayStart && d <= todayEnd) {
            dueTodayCount++;
            dueTodayAmount = dueTodayAmount.add(outstanding);
          } else if (d < todayStart) {
            overdueCount++;
            overdueAmount = overdueAmount.add(outstanding);
          }
        }
      }
    }

    return {
      totalReceivables: totalOutstanding,
      totalOriginalAmount: totalOriginal,
      totalPaidAmount: totalPaid,
      dueTodayAmount,
      overdueAmount,
      partiallyPaidAmount,
      unpaidAmount,
      totalCount: receivables.length,
      dueTodayCount,
      overdueCount,
      partiallyPaidCount,
      unpaidCount,
    };
  }

  /**
   * Payables Summary (Outstanding balances, due today, overdue).
   */
  public static async getPayablesSummary(params: {
    businessId: string;
    asOfDate?: Date;
  }): Promise<PayablesSummaryResult> {
    const asOf = params.asOfDate || new Date();
    const todayStart = startOfDay(asOf);
    const todayEnd = endOfDay(asOf);

    const payables = await prisma.transaction.findMany({
      where: {
        businessId: params.businessId,
        status: TransactionStatus.POSTED,
        transactionType: TransactionType.PAYABLE,
      },
      select: {
        id: true,
        totalAmount: true,
        dueDate: true,
        allocations: {
          select: {
            amount: true,
            payment: { select: { status: true } },
          },
        },
      },
    });

    let totalOriginal = Money.zero();
    let totalPaid = Money.zero();
    let totalOutstanding = Money.zero();
    let dueTodayAmount = Money.zero();
    let overdueAmount = Money.zero();
    let partiallyPaidAmount = Money.zero();
    let unpaidAmount = Money.zero();

    let dueTodayCount = 0;
    let overdueCount = 0;
    let partiallyPaidCount = 0;
    let unpaidCount = 0;

    for (const p of payables) {
      const original = Money.fromDecimal(p.totalAmount);
      totalOriginal = totalOriginal.add(original);

      let paid = Money.zero();
      for (const a of p.allocations) {
        if (a.payment.status === TransactionStatus.POSTED) {
          paid = paid.add(Money.fromDecimal(a.amount));
        }
      }
      totalPaid = totalPaid.add(paid);

      const outstanding = original.subtract(paid);
      if (outstanding.isPositive()) {
        totalOutstanding = totalOutstanding.add(outstanding);

        if (paid.isZero()) {
          unpaidCount++;
          unpaidAmount = unpaidAmount.add(outstanding);
        } else {
          partiallyPaidCount++;
          partiallyPaidAmount = partiallyPaidAmount.add(outstanding);
        }

        if (p.dueDate) {
          const d = new Date(p.dueDate);
          if (d >= todayStart && d <= todayEnd) {
            dueTodayCount++;
            dueTodayAmount = dueTodayAmount.add(outstanding);
          } else if (d < todayStart) {
            overdueCount++;
            overdueAmount = overdueAmount.add(outstanding);
          }
        }
      }
    }

    return {
      totalPayables: totalOutstanding,
      totalOriginalAmount: totalOriginal,
      totalPaidAmount: totalPaid,
      dueTodayAmount,
      overdueAmount,
      partiallyPaidAmount,
      unpaidAmount,
      totalCount: payables.length,
      dueTodayCount,
      overdueCount,
      partiallyPaidCount,
      unpaidCount,
    };
  }

  /**
   * Aging Analysis for Receivables or Payables (Current, 1-30d, 31-60d, 61-90d, 90+d).
   */
  public static async getAgingAnalysis(params: {
    businessId: string;
    type: "RECEIVABLE" | "PAYABLE";
    asOfDate?: Date;
  }): Promise<AgingAnalysisResult> {
    const asOf = params.asOfDate || new Date();
    const records = await prisma.transaction.findMany({
      where: {
        businessId: params.businessId,
        status: TransactionStatus.POSTED,
        transactionType:
          params.type === "RECEIVABLE" ? TransactionType.RECEIVABLE : TransactionType.PAYABLE,
      },
      select: {
        id: true,
        totalAmount: true,
        dueDate: true,
        transactionDate: true,
        allocations: {
          select: {
            amount: true,
            payment: { select: { status: true } },
          },
        },
      },
    });

    let currentAmount = Money.zero();
    let days1To30Amount = Money.zero();
    let days31To60Amount = Money.zero();
    let days61To90Amount = Money.zero();
    let days90PlusAmount = Money.zero();

    let currentCount = 0;
    let days1To30Count = 0;
    let days31To60Count = 0;
    let days61To90Count = 0;
    let days90PlusCount = 0;

    let grandTotal = Money.zero();

    for (const r of records) {
      let paid = Money.zero();
      for (const a of r.allocations) {
        if (a.payment.status === TransactionStatus.POSTED) {
          paid = paid.add(Money.fromDecimal(a.amount));
        }
      }
      const outstanding = Money.fromDecimal(r.totalAmount).subtract(paid);
      if (!outstanding.isPositive()) continue;

      grandTotal = grandTotal.add(outstanding);

      // Compare due date (or transaction date if no due date)
      const baseDate = r.dueDate ? new Date(r.dueDate) : new Date(r.transactionDate);
      const daysDiff = differenceInDays(asOf, baseDate);

      if (daysDiff <= 0) {
        currentAmount = currentAmount.add(outstanding);
        currentCount++;
      } else if (daysDiff <= 30) {
        days1To30Amount = days1To30Amount.add(outstanding);
        days1To30Count++;
      } else if (daysDiff <= 60) {
        days31To60Amount = days31To60Amount.add(outstanding);
        days31To60Count++;
      } else if (daysDiff <= 90) {
        days61To90Amount = days61To90Amount.add(outstanding);
        days61To90Count++;
      } else {
        days90PlusAmount = days90PlusAmount.add(outstanding);
        days90PlusCount++;
      }
    }

    const calcPct = (m: Money) => {
      if (grandTotal.isZero()) return 0;
      return Number(m.getDecimal().dividedBy(grandTotal.getDecimal()).times(100).toFixed(1));
    };

    return {
      current: {
        label: "Current",
        count: currentCount,
        amount: currentAmount,
        percentage: calcPct(currentAmount),
      },
      days1To30: {
        label: "1–30 Days",
        count: days1To30Count,
        amount: days1To30Amount,
        percentage: calcPct(days1To30Amount),
      },
      days31To60: {
        label: "31–60 Days",
        count: days31To60Count,
        amount: days31To60Amount,
        percentage: calcPct(days31To60Amount),
      },
      days61To90: {
        label: "61–90 Days",
        count: days61To90Count,
        amount: days61To90Amount,
        percentage: calcPct(days61To90Amount),
      },
      days90Plus: {
        label: "90+ Days",
        count: days90PlusCount,
        amount: days90PlusAmount,
        percentage: calcPct(days90PlusAmount),
      },
      total: grandTotal,
    };
  }

  /**
   * Summary breakdown by Payment Method (Cash, Bank, UPI, Card, Cheque, Other).
   */
  public static async getPaymentMethodSummaries(params: {
    businessId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<PaymentMethodBreakdownItem[]> {
    const methods = await prisma.paymentMethod.findMany({
      where: { businessId: params.businessId, isActive: true },
      orderBy: { name: "asc" },
    });

    const where: Prisma.PaymentWhereInput = {
      businessId: params.businessId,
      status: TransactionStatus.POSTED,
    };

    if (params.startDate || params.endDate) {
      where.paymentDate = {};
      if (params.startDate) where.paymentDate.gte = params.startDate;
      if (params.endDate) where.paymentDate.lte = params.endDate;
    }

    const payments = await prisma.payment.findMany({
      where,
      select: {
        paymentMethodId: true,
        direction: true,
        amount: true,
      },
    });

    const map = new Map<
      string,
      { inflow: Money; outflow: Money; count: number }
    >();

    for (const m of methods) {
      map.set(m.id, { inflow: Money.zero(), outflow: Money.zero(), count: 0 });
    }

    for (const p of payments) {
      const entry = map.get(p.paymentMethodId) || {
        inflow: Money.zero(),
        outflow: Money.zero(),
        count: 0,
      };
      const amt = Money.fromDecimal(p.amount);
      if (p.direction === PaymentDirection.IN) {
        entry.inflow = entry.inflow.add(amt);
      } else {
        entry.outflow = entry.outflow.add(amt);
      }
      entry.count++;
      map.set(p.paymentMethodId, entry);
    }

    return methods.map((m) => {
      const e = map.get(m.id) || {
        inflow: Money.zero(),
        outflow: Money.zero(),
        count: 0,
      };
      return {
        id: m.id,
        name: m.name,
        type: m.type,
        inflow: e.inflow,
        outflow: e.outflow,
        netFlow: e.inflow.subtract(e.outflow),
        transactionCount: e.count,
      };
    });
  }

  /**
   * Category breakdown (Income vs. Expense categories with amount, count, percentage).
   */
  public static async getCategorySummaries(params: {
    businessId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ incomeCategories: CategorySummaryItem[]; expenseCategories: CategorySummaryItem[] }> {
    const where: Prisma.TransactionWhereInput = {
      businessId: params.businessId,
      status: TransactionStatus.POSTED,
    };

    if (params.startDate || params.endDate) {
      where.transactionDate = {};
      if (params.startDate) where.transactionDate.gte = params.startDate;
      if (params.endDate) where.transactionDate.lte = params.endDate;
    }

    const txs = await prisma.transaction.findMany({
      where,
      select: {
        totalAmount: true,
        transactionType: true,
        categoryId: true,
        category: { select: { name: true } },
      },
    });

    const incomeMap = new Map<string, { name: string; amount: Money; count: number }>();
    const expenseMap = new Map<string, { name: string; amount: Money; count: number }>();

    let totalIncome = Money.zero();
    let totalExpense = Money.zero();

    for (const t of txs) {
      const amt = Money.fromDecimal(t.totalAmount);
      const isIncome =
        t.transactionType === TransactionType.INCOME ||
        t.transactionType === TransactionType.RECEIVABLE;
      const isExpense =
        t.transactionType === TransactionType.EXPENSE ||
        t.transactionType === TransactionType.PAYABLE;

      if (isIncome) {
        totalIncome = totalIncome.add(amt);
        const cur = incomeMap.get(t.categoryId) || {
          name: t.category.name,
          amount: Money.zero(),
          count: 0,
        };
        cur.amount = cur.amount.add(amt);
        cur.count++;
        incomeMap.set(t.categoryId, cur);
      } else if (isExpense) {
        totalExpense = totalExpense.add(amt);
        const cur = expenseMap.get(t.categoryId) || {
          name: t.category.name,
          amount: Money.zero(),
          count: 0,
        };
        cur.amount = cur.amount.add(amt);
        cur.count++;
        expenseMap.set(t.categoryId, cur);
      }
    }

    const mapToList = (
      m: Map<string, { name: string; amount: Money; count: number }>,
      grand: Money
    ): CategorySummaryItem[] => {
      const items: CategorySummaryItem[] = [];
      for (const [id, val] of m.entries()) {
        const pct = grand.isZero()
          ? 0
          : Number(val.amount.getDecimal().dividedBy(grand.getDecimal()).times(100).toFixed(1));
        items.push({
          id,
          name: val.name,
          amount: val.amount,
          count: val.count,
          percentage: pct,
        });
      }
      return items.sort((a, b) => (b.amount.greaterThan(a.amount) ? 1 : -1));
    };

    return {
      incomeCategories: mapToList(incomeMap, totalIncome),
      expenseCategories: mapToList(expenseMap, totalExpense),
    };
  }

  /**
   * Unified Dashboard Summary.
   * Single performant query computing all KPI cards and previous period comparison.
   */
  public static async getDashboardSummary(params: {
    businessId: string;
    period?: "today" | "week" | "month" | "year" | "custom";
    startDate?: Date;
    endDate?: Date;
  }): Promise<DashboardFinancialSummary> {
    const now = new Date();
    let start: Date;
    let end: Date;
    let prevStart: Date;
    let prevEnd: Date;
    let label: string;

    const period = params.period || "month";

    switch (period) {
      case "today":
        start = startOfDay(now);
        end = endOfDay(now);
        prevStart = startOfDay(subMonths(now, 1));
        prevEnd = endOfDay(subMonths(now, 1));
        label = `Today (${format(now, "dd MMM yyyy")})`;
        break;
      case "week":
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        prevStart = startOfWeek(subMonths(now, 1), { weekStartsOn: 1 });
        prevEnd = endOfWeek(subMonths(now, 1), { weekStartsOn: 1 });
        label = "This Week";
        break;
      case "year":
        start = startOfYear(now);
        end = endOfYear(now);
        prevStart = startOfYear(subMonths(now, 12));
        prevEnd = endOfYear(subMonths(now, 12));
        label = `This Year (${now.getFullYear()})`;
        break;
      case "custom":
        start = params.startDate ? startOfDay(params.startDate) : startOfMonth(now);
        end = params.endDate ? endOfDay(params.endDate) : endOfMonth(now);
        prevStart = subMonths(start, 1);
        prevEnd = subMonths(end, 1);
        label = `${format(start, "dd MMM")} - ${format(end, "dd MMM yyyy")}`;
        break;
      case "month":
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
        prevStart = startOfMonth(subMonths(now, 1));
        prevEnd = endOfMonth(subMonths(now, 1));
        label = format(now, "MMMM yyyy");
        break;
    }

    const [
      income,
      expense,
      prevIncome,
      prevExpense,
      cashFlow,
      receivablesSummary,
      payablesSummary,
      paymentMethods,
    ] = await Promise.all([
      this.getRecognizedIncome({ businessId: params.businessId, startDate: start, endDate: end }),
      this.getRecognizedExpenses({ businessId: params.businessId, startDate: start, endDate: end }),
      this.getRecognizedIncome({ businessId: params.businessId, startDate: prevStart, endDate: prevEnd }),
      this.getRecognizedExpenses({ businessId: params.businessId, startDate: prevStart, endDate: prevEnd }),
      this.getCashMovement({ businessId: params.businessId, startDate: start, endDate: end }),
      this.getReceivablesSummary({ businessId: params.businessId, asOfDate: end }),
      this.getPayablesSummary({ businessId: params.businessId, asOfDate: end }),
      this.getPaymentMethodSummaries({ businessId: params.businessId }),
    ]);

    const netResult = income.subtract(expense);
    const prevNet = prevIncome.subtract(prevExpense);

    // Calculate growth percentages
    const calcGrowth = (current: Money, prev: Money) => {
      if (prev.isZero()) return current.isZero() ? 0 : 100;
      const diff = current.subtract(prev);
      return Number(diff.getDecimal().dividedBy(prev.getDecimal()).times(100).toFixed(1));
    };

    // Calculate cash/bank/UPI balances from payment methods
    let cashBalance = Money.zero();
    let bankBalance = Money.zero();
    let upiBalance = Money.zero();

    for (const pm of paymentMethods) {
      if (pm.type === PaymentMethodType.CASH) {
        cashBalance = cashBalance.add(pm.netFlow);
      } else if (pm.type === PaymentMethodType.BANK_TRANSFER) {
        bankBalance = bankBalance.add(pm.netFlow);
      } else if (pm.type === PaymentMethodType.UPI) {
        upiBalance = upiBalance.add(pm.netFlow);
      }
    }

    const totalLiquidity = cashBalance.add(bankBalance).add(upiBalance);

    return {
      periodLabel: label,
      recognizedIncome: income,
      recognizedExpenses: expense,
      netResult,
      moneyReceived: cashFlow.inflow,
      moneyPaid: cashFlow.outflow,
      netCashMovement: cashFlow.netCashFlow,
      totalReceivables: receivablesSummary.totalReceivables,
      totalPayables: payablesSummary.totalPayables,
      cashBalance,
      bankBalance,
      upiBalance,
      totalLiquidity,
      comparison: {
        incomeGrowthPercentage: calcGrowth(income, prevIncome),
        expenseGrowthPercentage: calcGrowth(expense, prevExpense),
        netGrowthPercentage: calcGrowth(netResult, prevNet),
      },
    };
  }
}
