import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import {
  TransactionStatus,
  TransactionType,
  PaymentDirection,
  PaymentMethodType,
} from "@prisma/client";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  startOfYear,
  endOfYear,
  subYears,
  format,
  differenceInDays,
  eachDayOfInterval,
  eachMonthOfInterval,
} from "date-fns";
import { AccountingService } from "./accounting.service";
import { ReconciliationService, type ReconciliationReport } from "./reconciliation.service";

export type PeriodType =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "last-quarter"
  | "this-year"
  | "last-year"
  | "custom"
  | "financial-period";

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
  prevStartDate: Date;
  prevEndDate: Date;
  prevLabel: string;
}

export interface MetricComparison {
  current: string;
  previous: string;
  diff: string;
  percentageChange: number | null;
  trend: "UP" | "DOWN" | "FLAT";
  isPositiveForBusiness: boolean;
}

export interface TrendDataPoint {
  date: string;
  label: string;
  income: number;
  expenses: number;
  netResult: number;
  moneyIn: number;
  moneyOut: number;
}

export interface PaymentMethodAnalysisItem {
  id: string;
  name: string;
  type: PaymentMethodType;
  inflow: string;
  outflow: string;
  netFlow: string;
  percentageOfInflows: number;
  count: number;
}

export interface CategoryAnalysisItem {
  id: string;
  name: string;
  amount: string;
  percentage: number;
  count: number;
}

export interface AgingBucketItem {
  bucket: string;
  label: string;
  amount: string;
  count: number;
  percentage: number;
}

export interface PartySummaryItem {
  id: string;
  name: string;
  code: string;
  totalBilled: string;
  totalPaid: string;
  outstanding: string;
  count: number;
}

export interface DueItem {
  id: string;
  transactionNumber: string;
  referenceNumber: string | null;
  partyName: string;
  partyType: "CUSTOMER" | "SUPPLIER";
  totalAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  dueDate: string;
  daysRemainingOrOverdue: number;
  isOverdue: boolean;
  status: string;
}

export interface CalculatedInsight {
  id: string;
  type: "POSITIVE" | "WARNING" | "INFO";
  title: string;
  description: string;
  metric?: string;
}

export interface AnalyticsFilterParams {
  businessId: string;
  period?: PeriodType;
  startDate?: Date;
  endDate?: Date;
  financialPeriodYear?: number;
  financialPeriodMonth?: number;
  customerId?: string;
  supplierId?: string;
  categoryId?: string;
  paymentMethodId?: string;
}

/**
 * Enterprise Analytics & Financial Insights Service.
 * Built on top of the verified Phase 5 Accounting Engine.
 * 
 * Rules:
 * 1. Single financial source of truth: PostgreSQL aggregations via AccountingService.
 * 2. Deterministic calculations: No floating point drift, no AI-generated numbers.
 * 3. Zero-safe percentage math: Never produces NaN% or Infinity%.
 * 4. Multi-tenant scoping: Strictly enforces businessId isolation.
 */
export class AnalyticsService {
  /**
   * Resolve reporting date range and comparable previous period.
   */
  public static resolveDateRange(params: {
    period?: PeriodType;
    startDate?: Date;
    endDate?: Date;
    now?: Date;
  }): DateRange {
    const now = params.now || new Date();
    const period = params.period || "this-month";

    let startDate: Date;
    let endDate: Date;
    let label: string;
    let prevStartDate: Date;
    let prevEndDate: Date;
    let prevLabel: string;

    switch (period) {
      case "today": {
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        label = `Today (${format(now, "dd MMM yyyy")})`;
        prevStartDate = startOfDay(subDays(now, 1));
        prevEndDate = endOfDay(subDays(now, 1));
        prevLabel = "Yesterday";
        break;
      }
      case "yesterday": {
        const yest = subDays(now, 1);
        startDate = startOfDay(yest);
        endDate = endOfDay(yest);
        label = `Yesterday (${format(yest, "dd MMM")})`;
        prevStartDate = startOfDay(subDays(yest, 1));
        prevEndDate = endOfDay(subDays(yest, 1));
        prevLabel = "Day Before Yesterday";
        break;
      }
      case "this-week": {
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        label = `This Week (${format(startDate, "dd MMM")} - ${format(endDate, "dd MMM")})`;
        const prevWeek = subWeeks(now, 1);
        prevStartDate = startOfWeek(prevWeek, { weekStartsOn: 1 });
        prevEndDate = endOfWeek(prevWeek, { weekStartsOn: 1 });
        prevLabel = "Previous Week";
        break;
      }
      case "last-week": {
        const prevWeek = subWeeks(now, 1);
        startDate = startOfWeek(prevWeek, { weekStartsOn: 1 });
        endDate = endOfWeek(prevWeek, { weekStartsOn: 1 });
        label = `Last Week (${format(startDate, "dd MMM")} - ${format(endDate, "dd MMM")})`;
        const twoWeeksAgo = subWeeks(now, 2);
        prevStartDate = startOfWeek(twoWeeksAgo, { weekStartsOn: 1 });
        prevEndDate = endOfWeek(twoWeeksAgo, { weekStartsOn: 1 });
        prevLabel = "2 Weeks Ago";
        break;
      }
      case "this-month": {
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        label = format(now, "MMMM yyyy");
        const prevMonth = subMonths(now, 1);
        prevStartDate = startOfMonth(prevMonth);
        prevEndDate = endOfMonth(prevMonth);
        prevLabel = format(prevMonth, "MMMM yyyy");
        break;
      }
      case "last-month": {
        const prevMonth = subMonths(now, 1);
        startDate = startOfMonth(prevMonth);
        endDate = endOfMonth(prevMonth);
        label = format(prevMonth, "MMMM yyyy");
        const twoMonthsAgo = subMonths(now, 2);
        prevStartDate = startOfMonth(twoMonthsAgo);
        prevEndDate = endOfMonth(twoMonthsAgo);
        prevLabel = format(twoMonthsAgo, "MMMM yyyy");
        break;
      }
      case "this-quarter": {
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        label = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
        const prevQ = subQuarters(now, 1);
        prevStartDate = startOfQuarter(prevQ);
        prevEndDate = endOfQuarter(prevQ);
        prevLabel = `Q${Math.floor(prevQ.getMonth() / 3) + 1} ${prevQ.getFullYear()}`;
        break;
      }
      case "last-quarter": {
        const prevQ = subQuarters(now, 1);
        startDate = startOfQuarter(prevQ);
        endDate = endOfQuarter(prevQ);
        label = `Q${Math.floor(prevQ.getMonth() / 3) + 1} ${prevQ.getFullYear()}`;
        const twoQAgo = subQuarters(now, 2);
        prevStartDate = startOfQuarter(twoQAgo);
        prevEndDate = endOfQuarter(twoQAgo);
        prevLabel = `Q${Math.floor(twoQAgo.getMonth() / 3) + 1} ${twoQAgo.getFullYear()}`;
        break;
      }
      case "this-year": {
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        label = `Year ${now.getFullYear()}`;
        const prevYear = subYears(now, 1);
        prevStartDate = startOfYear(prevYear);
        prevEndDate = endOfYear(prevYear);
        prevLabel = `Year ${prevYear.getFullYear()}`;
        break;
      }
      case "last-year": {
        const prevYear = subYears(now, 1);
        startDate = startOfYear(prevYear);
        endDate = endOfYear(prevYear);
        label = `Year ${prevYear.getFullYear()}`;
        const twoYearsAgo = subYears(now, 2);
        prevStartDate = startOfYear(twoYearsAgo);
        prevEndDate = endOfYear(twoYearsAgo);
        prevLabel = `Year ${twoYearsAgo.getFullYear()}`;
        break;
      }
      case "custom": {
        startDate = params.startDate ? startOfDay(params.startDate) : startOfMonth(now);
        endDate = params.endDate ? endOfDay(params.endDate) : endOfMonth(now);
        if (startDate > endDate) {
          // Guard against reversed dates
          const temp = startDate;
          startDate = endDate;
          endDate = temp;
        }
        label = `${format(startDate, "dd MMM yyyy")} - ${format(endDate, "dd MMM yyyy")}`;
        const daysSpan = differenceInDays(endDate, startDate) + 1;
        prevEndDate = subDays(startDate, 1);
        prevStartDate = subDays(prevEndDate, daysSpan - 1);
        prevLabel = "Prior Period";
        break;
      }
      default: {
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        label = format(now, "MMMM yyyy");
        const prevMonth = subMonths(now, 1);
        prevStartDate = startOfMonth(prevMonth);
        prevEndDate = endOfMonth(prevMonth);
        prevLabel = format(prevMonth, "MMMM yyyy");
        break;
      }
    }

    return { startDate, endDate, label, prevStartDate, prevEndDate, prevLabel };
  }

  /**
   * Deterministic zero-safe percentage comparison calculator.
   */
  public static calculateComparison(
    current: Money,
    previous: Money,
    higherIsBetter = true
  ): MetricComparison {
    const diff = current.subtract(previous);
    let pct: number | null = null;
    let trend: "UP" | "DOWN" | "FLAT" = "FLAT";

    if (diff.isPositive()) {
      trend = "UP";
    } else if (diff.isNegative()) {
      trend = "DOWN";
    }

    if (previous.isZero()) {
      if (current.isZero()) {
        pct = 0;
      } else {
        pct = null; // Meaning: no previous baseline
      }
    } else {
      const curVal = current.getDecimal();
      const prevVal = previous.getDecimal().abs();
      const diffVal = curVal.minus(previous.getDecimal());
      pct = Number(diffVal.dividedBy(prevVal).times(100).toFixed(1));
    }

    const isPositiveForBusiness =
      trend === "FLAT"
        ? true
        : higherIsBetter
        ? trend === "UP"
        : trend === "DOWN";

    return {
      current: current.toDecimalString(),
      previous: previous.toDecimalString(),
      diff: diff.toDecimalString(),
      percentageChange: pct,
      trend,
      isPositiveForBusiness,
    };
  }

  /**
   * Get complete financial command center summary with primary KPI cards.
   */
  public static async getFinancialCommandCenter(params: AnalyticsFilterParams) {
    const dateRange = this.resolveDateRange({
      period: params.period,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const [
      curIncome,
      prevIncome,
      curExpense,
      prevExpense,
      curCashFlow,
      prevCashFlow,
      receivablesSummary,
      payablesSummary,
      paymentMethods,
    ] = await Promise.all([
      AccountingService.getRecognizedIncome({
        businessId: params.businessId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        customerId: params.customerId,
        categoryId: params.categoryId,
      }),
      AccountingService.getRecognizedIncome({
        businessId: params.businessId,
        startDate: dateRange.prevStartDate,
        endDate: dateRange.prevEndDate,
        customerId: params.customerId,
        categoryId: params.categoryId,
      }),
      AccountingService.getRecognizedExpenses({
        businessId: params.businessId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        supplierId: params.supplierId,
        categoryId: params.categoryId,
      }),
      AccountingService.getRecognizedExpenses({
        businessId: params.businessId,
        startDate: dateRange.prevStartDate,
        endDate: dateRange.prevEndDate,
        supplierId: params.supplierId,
        categoryId: params.categoryId,
      }),
      AccountingService.getCashMovement({
        businessId: params.businessId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        paymentMethodId: params.paymentMethodId,
      }),
      AccountingService.getCashMovement({
        businessId: params.businessId,
        startDate: dateRange.prevStartDate,
        endDate: dateRange.prevEndDate,
        paymentMethodId: params.paymentMethodId,
      }),
      AccountingService.getReceivablesSummary({
        businessId: params.businessId,
        asOfDate: dateRange.endDate,
      }),
      AccountingService.getPayablesSummary({
        businessId: params.businessId,
        asOfDate: dateRange.endDate,
      }),
      AccountingService.getPaymentMethodSummaries({
        businessId: params.businessId,
      }),
    ]);

    const curNetResult = curIncome.subtract(curExpense);
    const prevNetResult = prevIncome.subtract(prevExpense);

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

    // KPI Cards with deterministic comparison
    const kpi = {
      income: this.calculateComparison(curIncome, prevIncome, true),
      expenses: this.calculateComparison(curExpense, prevExpense, false),
      netResult: this.calculateComparison(curNetResult, prevNetResult, true),
      moneyReceived: this.calculateComparison(curCashFlow.inflow, prevCashFlow.inflow, true),
      moneyPaid: this.calculateComparison(curCashFlow.outflow, prevCashFlow.outflow, false),
      netCashFlow: this.calculateComparison(curCashFlow.netCashFlow, prevCashFlow.netCashFlow, true),
      totalReceivables: receivablesSummary.totalReceivables.toDecimalString(),
      totalPayables: payablesSummary.totalPayables.toDecimalString(),
      cashBalance: cashBalance.toDecimalString(),
      bankBalance: bankBalance.toDecimalString(),
      upiBalance: upiBalance.toDecimalString(),
      totalLiquidity: totalLiquidity.toDecimalString(),
    };

    return {
      dateRange,
      kpi,
      receivablesSummary,
      payablesSummary,
      paymentMethods,
    };
  }

  /**
   * Income vs Expenses & Cash Flow Trend Points for Charts.
   */
  public static async getTrendData(params: AnalyticsFilterParams): Promise<TrendDataPoint[]> {
    const dateRange = this.resolveDateRange({
      period: params.period,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const diffDays = differenceInDays(dateRange.endDate, dateRange.startDate);

    // Fetch posted transactions in range
    const txs = await prisma.transaction.findMany({
      where: {
        businessId: params.businessId,
        status: TransactionStatus.POSTED,
        transactionDate: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      },
      select: {
        transactionDate: true,
        transactionType: true,
        totalAmount: true,
      },
    });

    // Fetch posted payments in range
    const payments = await prisma.payment.findMany({
      where: {
        businessId: params.businessId,
        status: TransactionStatus.POSTED,
        paymentDate: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        paymentDate: true,
        direction: true,
        amount: true,
      },
    });

    // Grouping strategy: If range > 65 days -> Group by Month; Else -> Group by Day
    if (diffDays > 65) {
      const months = eachMonthOfInterval({
        start: dateRange.startDate,
        end: dateRange.endDate,
      });

      return months.map((m) => {
        const mStart = startOfMonth(m);
        const mEnd = endOfMonth(m);
        const key = format(m, "yyyy-MM");
        const label = format(m, "MMM yyyy");

        let inc = Money.zero();
        let exp = Money.zero();

        for (const t of txs) {
          if (t.transactionDate >= mStart && t.transactionDate <= mEnd) {
            const amt = Money.fromDecimal(t.totalAmount);
            if (
              t.transactionType === TransactionType.INCOME ||
              t.transactionType === TransactionType.RECEIVABLE
            ) {
              inc = inc.add(amt);
            } else if (
              t.transactionType === TransactionType.EXPENSE ||
              t.transactionType === TransactionType.PAYABLE
            ) {
              exp = exp.add(amt);
            }
          }
        }

        let mIn = Money.zero();
        let mOut = Money.zero();

        for (const p of payments) {
          if (p.paymentDate >= mStart && p.paymentDate <= mEnd) {
            const amt = Money.fromDecimal(p.amount);
            if (p.direction === PaymentDirection.IN) {
              mIn = mIn.add(amt);
            } else {
              mOut = mOut.add(amt);
            }
          }
        }

        const net = inc.subtract(exp);

        return {
          date: key,
          label,
          income: inc.toNumber(),
          expenses: exp.toNumber(),
          netResult: net.toNumber(),
          moneyIn: mIn.toNumber(),
          moneyOut: mOut.toNumber(),
        };
      });
    }

    // Daily grouping
    const days = eachDayOfInterval({
      start: dateRange.startDate,
      end: dateRange.endDate,
    });

    return days.map((d) => {
      const dStart = startOfDay(d);
      const dEnd = endOfDay(d);
      const key = format(d, "yyyy-MM-dd");
      const label = format(d, "dd MMM");

      let inc = Money.zero();
      let exp = Money.zero();

      for (const t of txs) {
        if (t.transactionDate >= dStart && t.transactionDate <= dEnd) {
          const amt = Money.fromDecimal(t.totalAmount);
          if (
            t.transactionType === TransactionType.INCOME ||
            t.transactionType === TransactionType.RECEIVABLE
          ) {
            inc = inc.add(amt);
          } else if (
            t.transactionType === TransactionType.EXPENSE ||
            t.transactionType === TransactionType.PAYABLE
          ) {
            exp = exp.add(amt);
          }
        }
      }

      let mIn = Money.zero();
      let mOut = Money.zero();

      for (const p of payments) {
        if (p.paymentDate >= dStart && p.paymentDate <= dEnd) {
          const amt = Money.fromDecimal(p.amount);
          if (p.direction === PaymentDirection.IN) {
            mIn = mIn.add(amt);
          } else {
            mOut = mOut.add(amt);
          }
        }
      }

      const net = inc.subtract(exp);

      return {
        date: key,
        label,
        income: inc.toNumber(),
        expenses: exp.toNumber(),
        netResult: net.toNumber(),
        moneyIn: mIn.toNumber(),
        moneyOut: mOut.toNumber(),
      };
    });
  }

  /**
   * Payment Method Breakdown with Inflows, Outflows and percentage share.
   */
  public static async getPaymentMethodAnalysis(params: AnalyticsFilterParams): Promise<PaymentMethodAnalysisItem[]> {
    const dateRange = this.resolveDateRange({
      period: params.period,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const methods = await prisma.paymentMethod.findMany({
      where: { businessId: params.businessId, isActive: true },
      orderBy: { name: "asc" },
    });

    const payments = await prisma.payment.findMany({
      where: {
        businessId: params.businessId,
        status: TransactionStatus.POSTED,
        paymentDate: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        paymentMethodId: true,
        direction: true,
        amount: true,
      },
    });

    let grandInflows = Money.zero();
    const map = new Map<string, { inflow: Money; outflow: Money; count: number }>();

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
        grandInflows = grandInflows.add(amt);
      } else {
        entry.outflow = entry.outflow.add(amt);
      }
      entry.count++;
      map.set(p.paymentMethodId, entry);
    }

    return methods.map((m) => {
      const entry = map.get(m.id) || { inflow: Money.zero(), outflow: Money.zero(), count: 0 };
      const net = entry.inflow.subtract(entry.outflow);
      const pct = grandInflows.isZero()
        ? 0
        : Number(entry.inflow.getDecimal().dividedBy(grandInflows.getDecimal()).times(100).toFixed(1));

      return {
        id: m.id,
        name: m.name,
        type: m.type,
        inflow: entry.inflow.toDecimalString(),
        outflow: entry.outflow.toDecimalString(),
        netFlow: net.toDecimalString(),
        percentageOfInflows: pct,
        count: entry.count,
      };
    });
  }

  /**
   * Category Analysis for Income and Expenses separately.
   */
  public static async getCategoryAnalysis(params: AnalyticsFilterParams) {
    const dateRange = this.resolveDateRange({
      period: params.period,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const summary = await AccountingService.getCategorySummaries({
      businessId: params.businessId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });

    const serialize = (item: { id: string; name: string; amount: Money; percentage: number; count: number }) => ({
      id: item.id,
      name: item.name,
      amount: item.amount.toDecimalString(),
      percentage: item.percentage,
      count: item.count,
    });

    return {
      incomeCategories: summary.incomeCategories.map(serialize),
      expenseCategories: summary.expenseCategories.map(serialize),
    };
  }

  /**
   * Top Customers by total business value or outstanding balance.
   */
  public static async getCustomerAnalysis(params: {
    businessId: string;
    limit?: number;
  }): Promise<PartySummaryItem[]> {
    const customers = await prisma.customer.findMany({
      where: { businessId: params.businessId, status: "ACTIVE" },
      include: {
        transactions: {
          where: { status: TransactionStatus.POSTED },
          select: {
            totalAmount: true,
            allocations: {
              select: {
                amount: true,
                payment: { select: { status: true } },
              },
            },
          },
        },
      },
    });

    const results: PartySummaryItem[] = [];

    for (const c of customers) {
      let billed = Money.zero();
      let paid = Money.zero();

      for (const t of c.transactions) {
        billed = billed.add(Money.fromDecimal(t.totalAmount));
        for (const a of t.allocations) {
          if (a.payment.status === TransactionStatus.POSTED) {
            paid = paid.add(Money.fromDecimal(a.amount));
          }
        }
      }

      const outstanding = billed.subtract(paid);

      results.push({
        id: c.id,
        name: c.name,
        code: c.customerCode,
        totalBilled: billed.toDecimalString(),
        totalPaid: paid.toDecimalString(),
        outstanding: outstanding.isPositive() ? outstanding.toDecimalString() : "0.00",
        count: c.transactions.length,
      });
    }

    return results
      .sort((a, b) => parseFloat(b.totalBilled) - parseFloat(a.totalBilled))
      .slice(0, params.limit || 5);
  }

  /**
   * Top Suppliers by total expenses or outstanding payables.
   */
  public static async getSupplierAnalysis(params: {
    businessId: string;
    limit?: number;
  }): Promise<PartySummaryItem[]> {
    const suppliers = await prisma.supplier.findMany({
      where: { businessId: params.businessId, status: "ACTIVE" },
      include: {
        transactions: {
          where: { status: TransactionStatus.POSTED },
          select: {
            totalAmount: true,
            allocations: {
              select: {
                amount: true,
                payment: { select: { status: true } },
              },
            },
          },
        },
      },
    });

    const results: PartySummaryItem[] = [];

    for (const s of suppliers) {
      let billed = Money.zero();
      let paid = Money.zero();

      for (const t of s.transactions) {
        billed = billed.add(Money.fromDecimal(t.totalAmount));
        for (const a of t.allocations) {
          if (a.payment.status === TransactionStatus.POSTED) {
            paid = paid.add(Money.fromDecimal(a.amount));
          }
        }
      }

      const outstanding = billed.subtract(paid);

      results.push({
        id: s.id,
        name: s.name,
        code: s.supplierCode,
        totalBilled: billed.toDecimalString(),
        totalPaid: paid.toDecimalString(),
        outstanding: outstanding.isPositive() ? outstanding.toDecimalString() : "0.00",
        count: s.transactions.length,
      });
    }

    return results
      .sort((a, b) => parseFloat(b.totalBilled) - parseFloat(a.totalBilled))
      .slice(0, params.limit || 5);
  }

  /**
   * Overdue and Upcoming items (Receivables & Payables).
   */
  public static async getDuesAndOverdueItems(params: {
    businessId: string;
    now?: Date;
    limit?: number;
  }) {
    const now = params.now || new Date();
    const today = startOfDay(now);

    const txs = await prisma.transaction.findMany({
      where: {
        businessId: params.businessId,
        status: TransactionStatus.POSTED,
        transactionType: { in: [TransactionType.RECEIVABLE, TransactionType.PAYABLE] },
        dueDate: { not: null },
      },
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
        allocations: {
          select: {
            amount: true,
            payment: { select: { status: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const overdueList: DueItem[] = [];
    const upcomingList: DueItem[] = [];

    for (const t of txs) {
      const orig = Money.fromDecimal(t.totalAmount);
      let paid = Money.zero();
      for (const a of t.allocations) {
        if (a.payment.status === TransactionStatus.POSTED) {
          paid = paid.add(Money.fromDecimal(a.amount));
        }
      }

      const outstanding = orig.subtract(paid);
      if (outstanding.isZero() || outstanding.isNegative()) continue;

      const dueDate = t.dueDate!;
      const diff = differenceInDays(dueDate, today);
      const isOverdue = diff < 0;

      const item: DueItem = {
        id: t.id,
        transactionNumber: t.transactionNumber,
        referenceNumber: t.referenceNumber,
        partyName: t.customer?.name || t.supplier?.name || "Direct Party",
        partyType: t.transactionType === TransactionType.RECEIVABLE ? "CUSTOMER" : "SUPPLIER",
        totalAmount: orig.toDecimalString(),
        paidAmount: paid.toDecimalString(),
        outstandingAmount: outstanding.toDecimalString(),
        dueDate: format(dueDate, "dd-MM-yyyy"),
        daysRemainingOrOverdue: Math.abs(diff),
        isOverdue,
        status: t.paymentStatus,
      };

      if (isOverdue) {
        overdueList.push(item);
      } else {
        upcomingList.push(item);
      }
    }

    return {
      overdueItems: overdueList.slice(0, params.limit || 5),
      upcomingItems: upcomingList.slice(0, params.limit || 5),
    };
  }

  /**
   * Deterministic Business Insights Rule Engine (Section 55-58).
   * Generates calculated insights grounded strictly in verifiable accounting totals.
   */
  public static generateCalculatedInsights(params: {
    incomeComparison: MetricComparison;
    expenseComparison: MetricComparison;
    netComparison: MetricComparison;
    overdueAmount: Money;
    overdueCount: number;
    topExpenseCategory?: { name: string; percentage: number };
    paymentMethods: PaymentMethodAnalysisItem[];
  }): CalculatedInsight[] {
    const insights: CalculatedInsight[] = [];

    // Rule 1: Expense Growth Threshold (> 15% increase)
    if (
      params.expenseComparison.percentageChange !== null &&
      params.expenseComparison.percentageChange > 15
    ) {
      insights.push({
        id: "EXPENSE_SURGE",
        type: "WARNING",
        title: "Expense Acceleration",
        description: `Operational expenses rose by ${params.expenseComparison.percentageChange}% compared to the prior baseline.`,
        metric: `+${params.expenseComparison.percentageChange}%`,
      });
    }

    // Rule 2: Income Growth (> 10% increase)
    if (
      params.incomeComparison.percentageChange !== null &&
      params.incomeComparison.percentageChange > 10
    ) {
      insights.push({
        id: "INCOME_GROWTH",
        type: "POSITIVE",
        title: "Revenue Expansion",
        description: `Recognized business revenue grew by ${params.incomeComparison.percentageChange}% over the previous comparative period.`,
        metric: `+${params.incomeComparison.percentageChange}%`,
      });
    } else if (
      params.incomeComparison.percentageChange !== null &&
      params.incomeComparison.percentageChange < -10
    ) {
      insights.push({
        id: "INCOME_DIP",
        type: "WARNING",
        title: "Revenue Contraction",
        description: `Recognized business revenue was ${Math.abs(
          params.incomeComparison.percentageChange
        )}% lower than the prior period.`,
        metric: `${params.incomeComparison.percentageChange}%`,
      });
    }

    // Rule 3: Overdue Concentration
    if (params.overdueAmount.isPositive() && params.overdueCount > 0) {
      insights.push({
        id: "OVERDUE_ALERT",
        type: "WARNING",
        title: "Overdue Receivables",
        description: `₹${params.overdueAmount.format()} is currently past due across ${params.overdueCount} invoices requiring customer follow-up.`,
        metric: `₹${params.overdueAmount.format()}`,
      });
    }

    // Rule 4: Top Expense Category Concentration (> 35% of total expenses)
    if (params.topExpenseCategory && params.topExpenseCategory.percentage >= 35) {
      insights.push({
        id: "CATEGORY_CONCENTRATION",
        type: "INFO",
        title: "Expense Concentration",
        description: `"${params.topExpenseCategory.name}" accounts for ${params.topExpenseCategory.percentage}% of all recorded expenses this period.`,
        metric: `${params.topExpenseCategory.percentage}%`,
      });
    }

    // Rule 5: Digital Collection Dominance (UPI > 50% of inflows)
    const upiItem = params.paymentMethods.find((p) => p.type === PaymentMethodType.UPI);
    if (upiItem && upiItem.percentageOfInflows >= 50) {
      insights.push({
        id: "UPI_DOMINANCE",
        type: "POSITIVE",
        title: "High Digital Collections",
        description: `UPI accounts for ${upiItem.percentageOfInflows}% of all incoming cash receipts, indicating efficient real-time settlements.`,
        metric: `${upiItem.percentageOfInflows}%`,
      });
    }

    // Fallback if no specific threshold was breached
    if (insights.length === 0) {
      insights.push({
        id: "STABLE_OPERATIONS",
        type: "INFO",
        title: "Balanced Operations",
        description: "Financial metrics remain consistent with historical patterns with no critical alerts.",
      });
    }

    return insights;
  }

  /**
   * Accounting Health summary combining reconciliation report.
   */
  public static async getAccountingHealth(businessId: string): Promise<{
    status: "BALANCED" | "WARNINGS_FOUND" | "REVIEW_REQUIRED";
    report: ReconciliationReport;
  }> {
    const report = await ReconciliationService.runReconciliation(businessId);
    let status: "BALANCED" | "WARNINGS_FOUND" | "REVIEW_REQUIRED" = "BALANCED";

    const errorCount = report.discrepancies.filter((d) => d.severity === "ERROR").length;
    const warningCount = report.discrepancies.filter((d) => d.severity === "WARNING").length;

    if (!report.isHealthy || errorCount > 0) {
      status = "REVIEW_REQUIRED";
    } else if (warningCount > 0) {
      status = "WARNINGS_FOUND";
    }

    return { status, report };
  }
}
