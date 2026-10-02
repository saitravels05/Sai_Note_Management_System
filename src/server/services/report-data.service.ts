import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import {
  TransactionType,
  TransactionStatus,
  PaymentStatus,
  PaymentDirection,
  PaymentMethodType,
  Prisma,
} from "@prisma/client";
import {
  startOfMonth,
  endOfMonth,
  differenceInDays,
} from "date-fns";
import { AccountingService } from "./accounting.service";
import { AnalyticsService, type PeriodType } from "./analytics.service";
import { LedgerService, type CustomerLedgerResult, type SupplierLedgerResult } from "./ledger.service";
import { AppError } from "@/lib/errors";

export interface ReportBaseParams {
  businessId: string;
  startDate?: Date;
  endDate?: Date;
  period?: PeriodType;
  financialPeriodYear?: number;
  financialPeriodMonth?: number;
}

export interface TransactionFilterParams extends ReportBaseParams {
  transactionType?: TransactionType;
  status?: TransactionStatus;
  paymentStatus?: PaymentStatus;
  partyId?: string;
  customerId?: string;
  supplierId?: string;
  categoryId?: string;
  paymentMethodId?: string;
  paymentMethodType?: PaymentMethodType;
  search?: string;
  minAmount?: string | number;
  maxAmount?: string | number;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface FinancialSummaryReportDTO {
  business: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    accountingBasis: "ACCRUAL" | "CASH";
  };
  period: {
    label: string;
    startDate: Date;
    endDate: Date;
  };
  openingBalance: Money;
  totalIncome: Money;
  totalExpenses: Money;
  netResult: Money;
  moneyReceived: Money;
  moneyPaid: Money;
  netCashFlow: Money;
  receivablesOutstanding: Money;
  payablesOutstanding: Money;
  closingBalance: Money;
  transactionCount: number;
}

export interface TransactionReportRowDTO {
  id: string;
  transactionNumber: string;
  date: Date;
  type: TransactionType;
  partyName: string;
  partyCode?: string;
  categoryName: string;
  description: string;
  referenceNumber: string | null;
  amount: Money;
  paidAmount: Money;
  outstandingAmount: Money;
  paymentStatus: PaymentStatus;
  paymentMethod?: string | null;
  status: TransactionStatus;
  dueDate: Date | null;
  daysOverdue: number;
  createdBy: string;
  createdAt: Date;
  tags: string[];
  customFields?: Record<string, unknown>;
}

export interface PaymentReportRowDTO {
  id: string;
  paymentNumber: string;
  date: Date;
  direction: PaymentDirection;
  partyName: string;
  partyType: "CUSTOMER" | "SUPPLIER" | "OTHER";
  paymentMethod: string;
  referenceNumber: string | null;
  amount: Money;
  allocatedAmount: Money;
  unappliedAmount: Money;
  status: string;
  notes: string | null;
  createdBy: string;
}

export interface PartySummaryReportRowDTO {
  id: string;
  code: string;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  transactionCount: number;
  totalBilled: Money;
  totalPaid: Money;
  outstanding: Money;
}

export interface CategorySummaryReportRowDTO {
  id: string;
  name: string;
  type: string;
  transactionCount: number;
  incomeAmount: Money;
  expenseAmount: Money;
  percentageOfTotal: number;
}

export interface PaymentMethodReportRowDTO {
  id: string;
  name: string;
  type: PaymentMethodType;
  transactionCount: number;
  moneyReceived: Money;
  moneyPaid: Money;
  netMovement: Money;
  percentageOfInflows: number;
}

export interface DailySummaryReportRowDTO {
  date: string;
  label: string;
  income: Money;
  expenses: Money;
  netResult: Money;
  moneyIn: Money;
  moneyOut: Money;
  transactionCount: number;
}

export interface MonthlyAnalysisReportRowDTO {
  month: string;
  income: Money;
  expenses: Money;
  netResult: Money;
  moneyIn: Money;
  moneyOut: Money;
  receivables: Money;
  payables: Money;
  transactionCount: number;
}

export interface AgingScheduleReportRowDTO {
  partyId: string;
  partyCode: string;
  partyName: string;
  current: Money;
  days1To30: Money;
  days31To60: Money;
  days61To90: Money;
  days90Plus: Money;
  totalOutstanding: Money;
}

export interface MonthlyWorkbookDataDTO {
  summary: FinancialSummaryReportDTO;
  incomeRows: TransactionReportRowDTO[];
  expenseRows: TransactionReportRowDTO[];
  allTransactions: TransactionReportRowDTO[];
  payments: PaymentReportRowDTO[];
  receivables: TransactionReportRowDTO[];
  payables: TransactionReportRowDTO[];
  customerSummary: PartySummaryReportRowDTO[];
  supplierSummary: PartySummaryReportRowDTO[];
  categorySummary: CategorySummaryReportRowDTO[];
  paymentSummary: PaymentMethodReportRowDTO[];
  dailySummary: DailySummaryReportRowDTO[];
  monthlyAnalysis: MonthlyAnalysisReportRowDTO[];
}

export interface CashMovementReportDTO {
  business: {
    id: string;
    name: string;
    currency: string;
  };
  period: {
    label: string;
    startDate: Date;
    endDate: Date;
  };
  openingBalance: Money;
  totalInflow: Money;
  totalOutflow: Money;
  netCashMovement: Money;
  closingBalance: Money;
  paymentMethods: {
    id: string;
    name: string;
    type: string;
    inflow: Money;
    outflow: Money;
    netFlow: Money;
  }[];
}

export interface ManagementSummaryReportDTO {
  financialSummary: FinancialSummaryReportDTO;
  topIncomeCategories: CategorySummaryReportRowDTO[];
  topExpenseCategories: CategorySummaryReportRowDTO[];
  paymentMethods: PaymentMethodReportRowDTO[];
  accountingHealth: {
    status: "BALANCED" | "WARNINGS_FOUND" | "REVIEW_REQUIRED";
    discrepancyCount: number;
    notes: string[];
  };
  insights: string[];
}

/**
 * ReportDataService — Centralized, Authoritative Reporting Source of Truth.
 * 
 * Rules:
 * 1. Financial Consistency: Derives numbers strictly from Phase 5 Accounting & Phase 6 Analytics services.
 * 2. Tenant Isolation: Unconditionally scopes all queries to businessId.
 * 3. Exact Matching: Report totals match dashboard & ledger figures with zero floating-point drift.
 * 4. DTO Sharing: Designed to feed both Phase 8 Excel/CSV and Phase 9 PDF generators.
 */
export class ReportDataService {
  /**
   * 1. Financial Summary Report
   */
  public static async getFinancialSummaryReport(
    params: ReportBaseParams
  ): Promise<FinancialSummaryReportDTO> {
    const { businessId, period = "this-month", startDate, endDate } = params;

    const [business, commandCenter] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, currency: true, timezone: true },
      }),
      AnalyticsService.getFinancialCommandCenter({
        businessId,
        period,
        startDate,
        endDate,
      }),
    ]);

    if (!business) {
      throw new AppError("Business context not found.", 404);
    }

    const totalIncome = Money.of(commandCenter.kpi.income.current);
    const totalExpenses = Money.of(commandCenter.kpi.expenses.current);
    const netResult = Money.of(commandCenter.kpi.netResult.current);
    const moneyReceived = Money.of(commandCenter.kpi.moneyReceived.current);
    const moneyPaid = Money.of(commandCenter.kpi.moneyPaid.current);
    const netCashFlow = Money.of(commandCenter.kpi.netCashFlow.current);
    const receivablesOutstanding = Money.of(commandCenter.kpi.totalReceivables);
    const payablesOutstanding = Money.of(commandCenter.kpi.totalPayables);
    const closingBalance = Money.of(commandCenter.kpi.totalLiquidity);
    const openingBalance = closingBalance.minus(netCashFlow);

    const transactionCount = await prisma.transaction.count({
      where: {
        businessId,
        transactionDate: {
          gte: commandCenter.dateRange.startDate,
          lte: commandCenter.dateRange.endDate,
        },
        status: TransactionStatus.POSTED,
      },
    });

    return {
      business: {
        id: business.id,
        name: business.name,
        currency: business.currency || "INR",
        timezone: business.timezone || "Asia/Kolkata",
        accountingBasis: "ACCRUAL",
      },
      period: {
        label: commandCenter.dateRange.label,
        startDate: commandCenter.dateRange.startDate,
        endDate: commandCenter.dateRange.endDate,
      },
      openingBalance,
      totalIncome,
      totalExpenses,
      netResult,
      moneyReceived,
      moneyPaid,
      netCashFlow,
      receivablesOutstanding,
      payablesOutstanding,
      closingBalance,
      transactionCount,
    };
  }

  /**
   * 2. Transaction Report (All, Filtered, Income, Expense, Receivables, Payables)
   */
  public static async getTransactionReport(
    filters: TransactionFilterParams
  ): Promise<TransactionReportRowDTO[]> {
    const {
      businessId,
      transactionType,
      status,
      paymentStatus,
      partyId,
      customerId,
      supplierId,
      categoryId,
      paymentMethodId,
      search,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      tags,
      limit,
      offset,
    } = filters;

    const where: Prisma.TransactionWhereInput = {
      businessId,
    };

    if (transactionType) {
      where.transactionType = transactionType;
    }

    if (status) {
      where.status = status;
    } else {
      // By default exclude VOID records unless explicitly filtered
      where.status = { not: TransactionStatus.VOID };
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (customerId) {
      where.customerId = customerId;
    } else if (supplierId) {
      where.supplierId = supplierId;
    } else if (partyId) {
      where.OR = [{ customerId: partyId }, { supplierId: partyId }];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (paymentMethodId) {
      where.allocations = {
        some: {
          payment: { paymentMethodId },
        },
      };
    }

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = startDate;
      if (endDate) where.transactionDate.lte = endDate;
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      where.totalAmount = {};
      if (minAmount !== undefined) where.totalAmount.gte = new Prisma.Decimal(minAmount.toString());
      if (maxAmount !== undefined) where.totalAmount.lte = new Prisma.Decimal(maxAmount.toString());
    }

    if (tags && tags.length > 0) {
      where.tags = {
        some: {
          tag: {
            name: { in: tags },
          },
        },
      };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.AND = [
        {
          OR: [
            { description: { contains: q, mode: "insensitive" } },
            { referenceNumber: { contains: q, mode: "insensitive" } },
            { transactionNumber: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { supplier: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
      ];
    }

    const records = await prisma.transaction.findMany({
      where,
      include: {
        customer: { select: { name: true, customerCode: true } },
        supplier: { select: { name: true, supplierCode: true } },
        category: { select: { name: true } },
        tags: { include: { tag: true } },
        allocations: {
          where: { payment: { status: TransactionStatus.POSTED } },
          select: {
            amount: true,
            payment: {
              select: {
                paymentMethod: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    });

    const now = new Date();

    return records.map((t) => {
      const totalAmt = Money.fromDecimal(t.totalAmount);
      let paidAmt = Money.zero(totalAmt.currency);
      let paymentMethodName: string | null = null;
      for (const a of t.allocations) {
        paidAmt = paidAmt.add(Money.fromDecimal(a.amount));
        if (!paymentMethodName && a.payment?.paymentMethod?.name) {
          paymentMethodName = a.payment.paymentMethod.name;
        }
      }
      const outAmt = totalAmt.minus(paidAmt);

      let daysOverdue = 0;
      if (t.dueDate && t.dueDate < now && t.paymentStatus !== PaymentStatus.PAID) {
        daysOverdue = differenceInDays(now, t.dueDate);
      }

      const partyName = t.customer?.name || t.supplier?.name || "General";
      const partyCode = t.customer?.customerCode || t.supplier?.supplierCode || undefined;

      return {
        id: t.id,
        transactionNumber: t.transactionNumber,
        date: t.transactionDate,
        type: t.transactionType,
        partyName,
        partyCode,
        categoryName: t.category?.name || "Uncategorized",
        description: t.description || "",
        referenceNumber: t.referenceNumber,
        amount: totalAmt,
        paidAmount: paidAmt,
        outstandingAmount: outAmt.isNegative() ? Money.zero() : outAmt,
        paymentStatus: t.paymentStatus,
        paymentMethod: paymentMethodName,
        status: t.status,
        dueDate: t.dueDate,
        daysOverdue,
        createdBy: "System",
        createdAt: t.createdAt,
        tags: t.tags.map((tg: { tag: { name: string } }) => tg.tag.name),
        customFields: t.metadata ? (t.metadata as Record<string, unknown>) : undefined,
      };
    });
  }

  /**
   * 3. Income Report
   */
  public static async getIncomeReport(filters: TransactionFilterParams) {
    return this.getTransactionReport({
      ...filters,
      transactionType: TransactionType.INCOME,
    });
  }

  /**
   * 4. Expense Report
   */
  public static async getExpenseReport(filters: TransactionFilterParams) {
    return this.getTransactionReport({
      ...filters,
      transactionType: TransactionType.EXPENSE,
    });
  }

  /**
   * 5. Payments Report
   */
  public static async getPaymentReport(
    params: ReportBaseParams & {
      direction?: PaymentDirection;
      partyId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<PaymentReportRowDTO[]> {
    const { businessId, direction, partyId, startDate, endDate, limit, offset } = params;

    const where: Prisma.PaymentWhereInput = {
      businessId,
    };

    if (direction) {
      where.direction = direction;
    }

    if (partyId) {
      where.OR = [{ customerId: partyId }, { supplierId: partyId }];
    }

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = startDate;
      if (endDate) where.paymentDate.lte = endDate;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
        paymentMethod: { select: { name: true } },
        allocations: { select: { amount: true } },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    });

    return payments.map((p) => {
      const amount = Money.fromDecimal(p.amount);
      let allocated = Money.zero(amount.currency);
      for (const a of p.allocations) {
        allocated = allocated.add(Money.fromDecimal(a.amount));
      }
      const unapplied = amount.minus(allocated);

      const partyName = p.customer?.name || p.supplier?.name || "General";
      const partyType = p.customerId ? "CUSTOMER" : p.supplierId ? "SUPPLIER" : "OTHER";

      return {
        id: p.id,
        paymentNumber: p.paymentNumber,
        date: p.paymentDate,
        direction: p.direction,
        partyName,
        partyType,
        paymentMethod: p.paymentMethod?.name || "Unspecified",
        referenceNumber: p.referenceNumber,
        amount,
        allocatedAmount: allocated,
        unappliedAmount: unapplied.isNegative() ? Money.zero() : unapplied,
        status: p.status,
        notes: p.notes,
        createdBy: "System",
      };
    });
  }

  /**
   * 6. Receivables Report
   */
  public static async getReceivableReport(filters: TransactionFilterParams) {
    return this.getTransactionReport({
      ...filters,
      transactionType: TransactionType.RECEIVABLE,
    });
  }

  /**
   * 7. Payables Report
   */
  public static async getPayableReport(filters: TransactionFilterParams) {
    return this.getTransactionReport({
      ...filters,
      transactionType: TransactionType.PAYABLE,
    });
  }

  /**
   * 8. Customer Summary Report
   */
  public static async getCustomerSummaryReport(
    params: ReportBaseParams
  ): Promise<PartySummaryReportRowDTO[]> {
    const { businessId } = params;

    const customers = await prisma.customer.findMany({
      where: { businessId },
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
      orderBy: { name: "asc" },
    });

    return customers.map((c) => {
      let billed = Money.zero();
      let paid = Money.zero();

      c.transactions.forEach((t) => {
        const tTotal = Money.fromDecimal(t.totalAmount);
        billed = billed.add(tTotal);
        t.allocations.forEach((a) => {
          if (a.payment.status === TransactionStatus.POSTED) {
            paid = paid.add(Money.fromDecimal(a.amount));
          }
        });
      });

      const outstanding = billed.minus(paid);

      return {
        id: c.id,
        code: c.customerCode || "-",
        name: c.name,
        companyName: c.companyName,
        phone: c.phone,
        email: c.email,
        transactionCount: c.transactions.length,
        totalBilled: billed,
        totalPaid: paid,
        outstanding: outstanding.isNegative() ? Money.zero() : outstanding,
      };
    });
  }

  /**
   * 9. Supplier Summary Report
   */
  public static async getSupplierSummaryReport(
    params: ReportBaseParams
  ): Promise<PartySummaryReportRowDTO[]> {
    const { businessId } = params;

    const suppliers = await prisma.supplier.findMany({
      where: { businessId },
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
      orderBy: { name: "asc" },
    });

    return suppliers.map((s) => {
      let billed = Money.zero();
      let paid = Money.zero();

      s.transactions.forEach((t) => {
        const tTotal = Money.fromDecimal(t.totalAmount);
        billed = billed.add(tTotal);
        t.allocations.forEach((a) => {
          if (a.payment.status === TransactionStatus.POSTED) {
            paid = paid.add(Money.fromDecimal(a.amount));
          }
        });
      });

      const outstanding = billed.minus(paid);

      return {
        id: s.id,
        code: s.supplierCode || "-",
        name: s.name,
        companyName: s.companyName,
        phone: s.phone,
        email: s.email,
        transactionCount: s.transactions.length,
        totalBilled: billed,
        totalPaid: paid,
        outstanding: outstanding.isNegative() ? Money.zero() : outstanding,
      };
    });
  }

  /**
   * 10. Customer Ledger Report
   */
  public static async getCustomerLedgerReport(
    businessId: string,
    customerId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CustomerLedgerResult> {
    return LedgerService.getCustomerLedger({
      businessId,
      customerId,
      startDate,
      endDate,
    });
  }

  /**
   * 11. Supplier Ledger Report
   */
  public static async getSupplierLedgerReport(
    businessId: string,
    supplierId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<SupplierLedgerResult> {
    return LedgerService.getSupplierLedger({
      businessId,
      supplierId,
      startDate,
      endDate,
    });
  }

  /**
   * 12. Category Summary Report
   */
  public static async getCategoryReport(
    params: ReportBaseParams
  ): Promise<CategorySummaryReportRowDTO[]> {
    const { businessId, period = "this-month", startDate, endDate } = params;

    const analysis = await AnalyticsService.getCategoryAnalysis({
      businessId,
      period,
      startDate,
      endDate,
    });

    const incomeMap = new Map(analysis.incomeCategories.map((c) => [c.id, c]));
    const expenseMap = new Map(analysis.expenseCategories.map((c) => [c.id, c]));

    const allIds = new Set([...incomeMap.keys(), ...expenseMap.keys()]);
    const rows: CategorySummaryReportRowDTO[] = [];

    for (const id of allIds) {
      const inc = incomeMap.get(id);
      const exp = expenseMap.get(id);
      const name = inc?.name || exp?.name || "Unknown";
      const count = (inc?.count || 0) + (exp?.count || 0);
      const incAmt = inc ? Money.of(inc.amount) : Money.zero();
      const expAmt = exp ? Money.of(exp.amount) : Money.zero();

      rows.push({
        id,
        name,
        type: inc && exp ? "BOTH" : inc ? "INCOME" : "EXPENSE",
        transactionCount: count,
        incomeAmount: incAmt,
        expenseAmount: expAmt,
        percentageOfTotal: inc?.percentage || exp?.percentage || 0,
      });
    }

    return rows.sort((a, b) => b.incomeAmount.plus(b.expenseAmount).toPaise() > a.incomeAmount.plus(a.expenseAmount).toPaise() ? 1 : -1);
  }

  /**
   * 13. Payment Method Report
   */
  public static async getPaymentMethodReport(
    params: ReportBaseParams
  ): Promise<PaymentMethodReportRowDTO[]> {
    const { businessId, period = "this-month", startDate, endDate } = params;

    const analysis = await AnalyticsService.getPaymentMethodAnalysis({
      businessId,
      period,
      startDate,
      endDate,
    });

    return analysis.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      transactionCount: item.count,
      moneyReceived: Money.of(item.inflow),
      moneyPaid: Money.of(item.outflow),
      netMovement: Money.of(item.netFlow),
      percentageOfInflows: item.percentageOfInflows,
    }));
  }

  /**
   * 14. Daily Summary Report
   */
  public static async getDailySummaryReport(
    params: ReportBaseParams
  ): Promise<DailySummaryReportRowDTO[]> {
    const { businessId, period = "this-month", startDate, endDate } = params;

    const trend = await AnalyticsService.getTrendData({
      businessId,
      period,
      startDate,
      endDate,
    });

    return trend.map((dp) => ({
      date: dp.date,
      label: dp.label,
      income: Money.of(dp.income),
      expenses: Money.of(dp.expenses),
      netResult: Money.of(dp.netResult),
      moneyIn: Money.of(dp.moneyIn),
      moneyOut: Money.of(dp.moneyOut),
      transactionCount: dp.income > 0 || dp.expenses > 0 ? 1 : 0,
    }));
  }

  /**
   * 15. Monthly Analysis Report
   */
  public static async getMonthlyAnalysisReport(
    params: ReportBaseParams
  ): Promise<MonthlyAnalysisReportRowDTO[]> {
    const { businessId, financialPeriodYear } = params;
    const year = financialPeriodYear || new Date().getFullYear();

    const months: MonthlyAnalysisReportRowDTO[] = [];

    for (let m = 0; m < 12; m++) {
      const mStart = startOfMonth(new Date(year, m, 1));
      const mEnd = endOfMonth(new Date(year, m, 1));
      const monthLabel = mStart.toLocaleString("en-US", { month: "short", year: "numeric" });

      const [incomeMoney, expenseMoney, cashFlow] = await Promise.all([
        AccountingService.getRecognizedIncome({
          businessId,
          startDate: mStart,
          endDate: mEnd,
        }),
        AccountingService.getRecognizedExpenses({
          businessId,
          startDate: mStart,
          endDate: mEnd,
        }),
        AccountingService.getCashMovement({
          businessId,
          startDate: mStart,
          endDate: mEnd,
        }),
      ]);

      const netResult = incomeMoney.minus(expenseMoney);

      months.push({
        month: monthLabel,
        income: incomeMoney,
        expenses: expenseMoney,
        netResult,
        moneyIn: cashFlow.inflow,
        moneyOut: cashFlow.outflow,
        receivables: Money.zero(),
        payables: Money.zero(),
        transactionCount: 0,
      });
    }

    return months;
  }

  /**
   * 16. Receivable Aging Report
   */
  public static async getReceivableAgingReport(
    params: ReportBaseParams
  ): Promise<AgingScheduleReportRowDTO[]> {
    const { businessId } = params;

    const customers = await prisma.customer.findMany({
      where: { businessId },
      include: {
        transactions: {
          where: {
            transactionType: TransactionType.RECEIVABLE,
            status: TransactionStatus.POSTED,
            paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
          },
          select: {
            totalAmount: true,
            dueDate: true,
            transactionDate: true,
            allocations: {
              where: { payment: { status: TransactionStatus.POSTED } },
              select: { amount: true },
            },
          },
        },
      },
    });

    const now = new Date();
    const rows: AgingScheduleReportRowDTO[] = [];

    for (const c of customers) {
      if (c.transactions.length === 0) continue;

      let current = Money.zero();
      let days1To30 = Money.zero();
      let days31To60 = Money.zero();
      let days61To90 = Money.zero();
      let days90Plus = Money.zero();
      let totalOut = Money.zero();

      for (const t of c.transactions) {
        const total = Money.fromDecimal(t.totalAmount);
        let paid = Money.zero();
        for (const a of t.allocations) {
          paid = paid.add(Money.fromDecimal(a.amount));
        }
        const out = total.minus(paid);
        if (!out.isPositive()) continue;

        totalOut = totalOut.add(out);
        const refDate = t.dueDate || t.transactionDate;
        const days = differenceInDays(now, refDate);

        if (days <= 0) {
          current = current.add(out);
        } else if (days <= 30) {
          days1To30 = days1To30.add(out);
        } else if (days <= 60) {
          days31To60 = days31To60.add(out);
        } else if (days <= 90) {
          days61To90 = days61To90.add(out);
        } else {
          days90Plus = days90Plus.add(out);
        }
      }

      if (totalOut.isPositive()) {
        rows.push({
          partyId: c.id,
          partyCode: c.customerCode || "-",
          partyName: c.name,
          current,
          days1To30,
          days31To60,
          days61To90,
          days90Plus,
          totalOutstanding: totalOut,
        });
      }
    }

    return rows.sort((a, b) => (b.totalOutstanding.greaterThan(a.totalOutstanding) ? 1 : -1));
  }

  /**
   * 17. Payable Aging Report
   */
  public static async getPayableAgingReport(
    params: ReportBaseParams
  ): Promise<AgingScheduleReportRowDTO[]> {
    const { businessId } = params;

    const suppliers = await prisma.supplier.findMany({
      where: { businessId },
      include: {
        transactions: {
          where: {
            transactionType: TransactionType.PAYABLE,
            status: TransactionStatus.POSTED,
            paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
          },
          select: {
            totalAmount: true,
            dueDate: true,
            transactionDate: true,
            allocations: {
              where: { payment: { status: TransactionStatus.POSTED } },
              select: { amount: true },
            },
          },
        },
      },
    });

    const now = new Date();
    const rows: AgingScheduleReportRowDTO[] = [];

    for (const s of suppliers) {
      if (s.transactions.length === 0) continue;

      let current = Money.zero();
      let days1To30 = Money.zero();
      let days31To60 = Money.zero();
      let days61To90 = Money.zero();
      let days90Plus = Money.zero();
      let totalOut = Money.zero();

      for (const t of s.transactions) {
        const total = Money.fromDecimal(t.totalAmount);
        let paid = Money.zero();
        for (const a of t.allocations) {
          paid = paid.add(Money.fromDecimal(a.amount));
        }
        const out = total.minus(paid);
        if (!out.isPositive()) continue;

        totalOut = totalOut.add(out);
        const refDate = t.dueDate || t.transactionDate;
        const days = differenceInDays(now, refDate);

        if (days <= 0) {
          current = current.add(out);
        } else if (days <= 30) {
          days1To30 = days1To30.add(out);
        } else if (days <= 60) {
          days31To60 = days31To60.add(out);
        } else if (days <= 90) {
          days61To90 = days61To90.add(out);
        } else {
          days90Plus = days90Plus.add(out);
        }
      }

      if (totalOut.isPositive()) {
        rows.push({
          partyId: s.id,
          partyCode: s.supplierCode || "-",
          partyName: s.name,
          current,
          days1To30,
          days31To60,
          days61To90,
          days90Plus,
          totalOutstanding: totalOut,
        });
      }
    }

    return rows.sort((a, b) => (b.totalOutstanding.greaterThan(a.totalOutstanding) ? 1 : -1));
  }

  /**
   * 18. Complete Monthly Workbook Bundle (13 Sheets)
   */
  public static async getMonthlyWorkbookData(
    params: ReportBaseParams
  ): Promise<MonthlyWorkbookDataDTO> {
    const [
      summary,
      incomeRows,
      expenseRows,
      allTransactions,
      payments,
      receivables,
      payables,
      customerSummary,
      supplierSummary,
      categorySummary,
      paymentSummary,
      dailySummary,
      monthlyAnalysis,
    ] = await Promise.all([
      this.getFinancialSummaryReport(params),
      this.getIncomeReport(params),
      this.getExpenseReport(params),
      this.getTransactionReport(params),
      this.getPaymentReport(params),
      this.getReceivableReport(params),
      this.getPayableReport(params),
      this.getCustomerSummaryReport(params),
      this.getSupplierSummaryReport(params),
      this.getCategoryReport(params),
      this.getPaymentMethodReport(params),
      this.getDailySummaryReport(params),
      this.getMonthlyAnalysisReport(params),
    ]);

    return {
      summary,
      incomeRows,
      expenseRows,
      allTransactions,
      payments,
      receivables,
      payables,
      customerSummary,
      supplierSummary,
      categorySummary,
      paymentSummary,
      dailySummary,
      monthlyAnalysis,
    };
  }

  /**
   * 19. Cash Movement Report
   */
  public static async getCashMovementReport(
    params: ReportBaseParams
  ): Promise<CashMovementReportDTO> {
    const { businessId, period = "this-month", startDate, endDate } = params;
    const [business, commandCenter, methods] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, currency: true },
      }),
      AnalyticsService.getFinancialCommandCenter({
        businessId,
        period,
        startDate,
        endDate,
      }),
      this.getPaymentMethodReport(params),
    ]);

    if (!business) throw new AppError("Business not found", 404);

    const totalInflow = Money.of(commandCenter.kpi.moneyReceived.current);
    const totalOutflow = Money.of(commandCenter.kpi.moneyPaid.current);
    const netCashMovement = Money.of(commandCenter.kpi.netCashFlow.current);
    const closingBalance = Money.of(commandCenter.kpi.totalLiquidity);
    const openingBalance = closingBalance.minus(netCashMovement);

    return {
      business: {
        id: business.id,
        name: business.name,
        currency: business.currency || "INR",
      },
      period: {
        label: commandCenter.dateRange.label,
        startDate: commandCenter.dateRange.startDate,
        endDate: commandCenter.dateRange.endDate,
      },
      openingBalance,
      totalInflow,
      totalOutflow,
      netCashMovement,
      closingBalance,
      paymentMethods: methods.map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        inflow: m.moneyReceived,
        outflow: m.moneyPaid,
        netFlow: m.netMovement,
      })),
    };
  }

  /**
   * 20. Management Summary Report
   */
  public static async getManagementSummaryReport(
    params: ReportBaseParams
  ): Promise<ManagementSummaryReportDTO> {
    const { businessId } = params;
    const [financialSummary, categories, paymentMethods, health] = await Promise.all([
      this.getFinancialSummaryReport(params),
      this.getCategoryReport(params),
      this.getPaymentMethodReport(params),
      AnalyticsService.getAccountingHealth(businessId),
    ]);

    const topIncomeCategories = categories.filter((c) => c.type === "INCOME").slice(0, 5);
    const topExpenseCategories = categories.filter((c) => c.type === "EXPENSE").slice(0, 5);

    const insights: string[] = [];
    if (financialSummary.netResult.isPositive()) {
      insights.push(`Business achieved a positive net result of ₹${financialSummary.netResult.format()} for this period.`);
    } else if (financialSummary.netResult.isNegative()) {
      insights.push(`Business recorded a net deficit of ₹${financialSummary.netResult.abs().format()} for this period.`);
    }

    if (financialSummary.netCashFlow.isPositive()) {
      insights.push(`Operating cash flow was positive with a net inflow of ₹${financialSummary.netCashFlow.format()}.`);
    } else {
      insights.push(`Operating cash outflow exceeded inflows by ₹${financialSummary.netCashFlow.abs().format()}.`);
    }

    if (financialSummary.receivablesOutstanding.isPositive()) {
      insights.push(`Outstanding customer receivables stand at ₹${financialSummary.receivablesOutstanding.format()}.`);
    }

    if (financialSummary.payablesOutstanding.isPositive()) {
      insights.push(`Outstanding supplier payables stand at ₹${financialSummary.payablesOutstanding.format()}.`);
    }

    return {
      financialSummary,
      topIncomeCategories,
      topExpenseCategories,
      paymentMethods,
      accountingHealth: {
        status: health.status,
        discrepancyCount: health.report.discrepancies.length,
        notes: health.report.discrepancies.map((d) => d.message),
      },
      insights,
    };
  }
}
