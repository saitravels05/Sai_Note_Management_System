import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import {
  AnalyticsService,
  type PeriodType,
} from "@/server/services/analytics.service";
import { AccountingService } from "@/server/services/accounting.service";
import { DashboardHeader } from "@/components/analytics/DashboardHeader";
import { PrimaryKpiGrid } from "@/components/analytics/PrimaryKpiGrid";
import { IncomeExpenseTrendChart } from "@/components/analytics/IncomeExpenseTrendChart";
import { CashFlowTrendChart } from "@/components/analytics/CashFlowTrendChart";
import { PaymentMethodDonutChart } from "@/components/analytics/PaymentMethodDonutChart";
import { AgingScheduleCard } from "@/components/analytics/AgingScheduleCard";
import { CategoryAnalysisWidget } from "@/components/analytics/CategoryAnalysisWidget";
import { TopPartiesWidget } from "@/components/analytics/TopPartiesWidget";
import { UpcomingAndOverdueWidget } from "@/components/analytics/UpcomingAndOverdueWidget";
import { CalculatedInsightsCard } from "@/components/analytics/CalculatedInsightsCard";
import { AccountingHealthWidget } from "@/components/analytics/AccountingHealthWidget";
import {
  RecentFinancialActivityWidget,
  type SerializedActivityItem,
} from "@/components/analytics/RecentFinancialActivityWidget";
import {
  RecentNotesWidget,
  type SerializedNoteItem,
} from "@/components/analytics/RecentNotesWidget";
import { BackupAuditHealthAdminWidget } from "@/components/analytics/BackupAuditHealthAdminWidget";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { type DashboardViewType } from "@/components/analytics/SavedViewsSelector";
import { TransactionStatus, TransactionType, Prisma } from "@prisma/client";
import { ArrowRight, LogIn } from "lucide-react";

interface DashboardPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await getCurrentUser();
  const sp = searchParams ? await searchParams : {};

  // If user is not authenticated, render welcoming public portal
  if (!user) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center p-6 space-y-6 max-w-2xl mx-auto animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-orange-600/10 border border-orange-500/20 flex items-center justify-center text-orange-500 font-black text-2xl shadow-xl shadow-orange-600/10">
          ST
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Sai Tours & Travels
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Enterprise Financial Command Center, Smart Notes & Month-End Accounting Management
          </p>
        </div>

        <div className="p-4 rounded-2xl glass-card border border-slate-800 text-xs text-slate-400 space-y-2">
          <p>Deterministic calculations powered by PostgreSQL & multi-tenant security architecture.</p>
          <p className="text-orange-400 font-semibold">Please sign in to access your business financial workspace.</p>
        </div>

        <Link
          href="/login"
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white bg-orange-600 hover:bg-orange-500 shadow-xl shadow-orange-600/25 transition-all text-sm"
        >
          <span>Sign In to Dashboard</span>
          <LogIn className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const periodParam = (typeof sp.period === "string" ? sp.period : "this-month") as PeriodType;
  const viewParam = (typeof sp.view === "string" ? sp.view : "OVERVIEW") as DashboardViewType;
  const startDateParam = typeof sp.startDate === "string" ? sp.startDate : undefined;
  const endDateParam = typeof sp.endDate === "string" ? sp.endDate : undefined;

  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  const endDate = endDateParam ? new Date(endDateParam) : undefined;

  const businessId = user.businessId;

  type CommandCenterData = Awaited<ReturnType<typeof AnalyticsService.getFinancialCommandCenter>>;
  type TrendData = Awaited<ReturnType<typeof AnalyticsService.getTrendData>>;
  type PaymentMethodData = Awaited<ReturnType<typeof AnalyticsService.getPaymentMethodAnalysis>>;
  type CategoryData = Awaited<ReturnType<typeof AnalyticsService.getCategoryAnalysis>>;
  type CustomerData = Awaited<ReturnType<typeof AnalyticsService.getCustomerAnalysis>>;
  type SupplierData = Awaited<ReturnType<typeof AnalyticsService.getSupplierAnalysis>>;
  type DuesData = Awaited<ReturnType<typeof AnalyticsService.getDuesAndOverdueItems>>;
  type HealthData = Awaited<ReturnType<typeof AnalyticsService.getAccountingHealth>>;
  type AgingData = Awaited<ReturnType<typeof AccountingService.getAgingAnalysis>>;
  type TransactionItem = Prisma.TransactionGetPayload<{
    include: {
      category: true;
      customer: true;
      supplier: true;
    };
  }>;
  type NoteItem = Prisma.NoteGetPayload<Record<string, never>>;

  let isDatabaseOffline = false;
  let commandCenter: CommandCenterData;
  let trendData: TrendData;
  let paymentMethodAnalysis: PaymentMethodData;
  let categoryAnalysis: CategoryData;
  let customerAnalysis: CustomerData;
  let supplierAnalysis: SupplierData;
  let duesData: DuesData;
  let accountingHealth: HealthData;
  let receivablesAging: AgingData;
  let payablesAging: AgingData;
  let recentTransactions: TransactionItem[] = [];
  let recentNotes: NoteItem[] = [];

  try {
    // Execute parallel database aggregations
    [
      commandCenter,
      trendData,
      paymentMethodAnalysis,
      categoryAnalysis,
      customerAnalysis,
      supplierAnalysis,
      duesData,
      accountingHealth,
      receivablesAging,
      payablesAging,
      recentTransactions,
      recentNotes,
    ] = await Promise.all([
      AnalyticsService.getFinancialCommandCenter({
        businessId,
        period: periodParam,
        startDate,
        endDate,
      }),
      AnalyticsService.getTrendData({
        businessId,
        period: periodParam,
        startDate,
        endDate,
      }),
      AnalyticsService.getPaymentMethodAnalysis({
        businessId,
        period: periodParam,
        startDate,
        endDate,
      }),
      AnalyticsService.getCategoryAnalysis({
        businessId,
        period: periodParam,
        startDate,
        endDate,
      }),
      AnalyticsService.getCustomerAnalysis({
        businessId,
        limit: 5,
      }),
      AnalyticsService.getSupplierAnalysis({
        businessId,
        limit: 5,
      }),
      AnalyticsService.getDuesAndOverdueItems({
        businessId,
        limit: 5,
      }),
      AnalyticsService.getAccountingHealth(businessId),
      AccountingService.getAgingAnalysis({ businessId, type: "RECEIVABLE" }),
      AccountingService.getAgingAnalysis({ businessId, type: "PAYABLE" }),
      prisma.transaction.findMany({
        where: { businessId, status: TransactionStatus.POSTED },
        include: {
          category: true,
          customer: true,
          supplier: true,
        },
        orderBy: { transactionDate: "desc" },
        take: 5,
      }),
      prisma.note.findMany({
        where: { businessId, archivedAt: null },
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
        take: 4,
      }),
    ]);
  } catch (error) {
    console.warn("Database offline on dashboard, serving zero-balance clean state:", error);
    isDatabaseOffline = true;
    const dateRange = AnalyticsService.resolveDateRange({
      period: periodParam,
      startDate,
      endDate,
    });
    const zeroComparison = {
      current: "0.00",
      previous: "0.00",
      diff: "0.00",
      percentageChange: 0,
      trend: "FLAT" as const,
      isPositiveForBusiness: true,
    };
    commandCenter = {
      dateRange,
      kpi: {
        income: zeroComparison,
        expenses: zeroComparison,
        netResult: zeroComparison,
        moneyReceived: zeroComparison,
        moneyPaid: zeroComparison,
        netCashFlow: zeroComparison,
        totalReceivables: "0.00",
        totalPayables: "0.00",
        cashBalance: "0.00",
        bankBalance: "0.00",
        upiBalance: "0.00",
        totalLiquidity: "0.00",
      },
      receivablesSummary: {
        totalReceivables: Money.zero(),
        totalOriginalAmount: Money.zero(),
        totalPaidAmount: Money.zero(),
        dueTodayAmount: Money.zero(),
        overdueAmount: Money.zero(),
        partiallyPaidAmount: Money.zero(),
        unpaidAmount: Money.zero(),
        totalCount: 0,
        dueTodayCount: 0,
        overdueCount: 0,
        partiallyPaidCount: 0,
        unpaidCount: 0,
      },
      payablesSummary: {
        totalPayables: Money.zero(),
        totalOriginalAmount: Money.zero(),
        totalPaidAmount: Money.zero(),
        dueTodayAmount: Money.zero(),
        overdueAmount: Money.zero(),
        partiallyPaidAmount: Money.zero(),
        unpaidAmount: Money.zero(),
        totalCount: 0,
        dueTodayCount: 0,
        overdueCount: 0,
        partiallyPaidCount: 0,
        unpaidCount: 0,
      },
      paymentMethods: [],
    };
    trendData = [];
    paymentMethodAnalysis = [];
    categoryAnalysis = { incomeCategories: [], expenseCategories: [] };
    customerAnalysis = [];
    supplierAnalysis = [];
    duesData = { overdueItems: [], upcomingItems: [] };
    accountingHealth = {
      status: "BALANCED" as const,
      report: {
        timestamp: new Date(),
        businessId,
        isHealthy: true,
        totalChecks: 1,
        passedChecks: 1,
        failedChecks: 0,
        summary: {
          totalTransactionsChecked: 0,
          totalPaymentsChecked: 0,
          totalAllocationsChecked: 0,
        },
        discrepancies: [],
      },
    };
    const emptyAging = {
      current: { label: "Current", count: 0, amount: Money.zero(), percentage: 0 },
      days1To30: { label: "1–30 Days", count: 0, amount: Money.zero(), percentage: 0 },
      days31To60: { label: "31–60 Days", count: 0, amount: Money.zero(), percentage: 0 },
      days61To90: { label: "61–90 Days", count: 0, amount: Money.zero(), percentage: 0 },
      days90Plus: { label: "90+ Days", count: 0, amount: Money.zero(), percentage: 0 },
      total: Money.zero(),
    };
    receivablesAging = emptyAging;
    payablesAging = emptyAging;
    recentTransactions = [];
    recentNotes = [];
  }

  // Generate deterministic calculated insights
  const calculatedInsights = AnalyticsService.generateCalculatedInsights({
    incomeComparison: commandCenter.kpi.income,
    expenseComparison: commandCenter.kpi.expenses,
    netComparison: commandCenter.kpi.netResult,
    overdueAmount: commandCenter.receivablesSummary.overdueAmount,
    overdueCount: commandCenter.receivablesSummary.overdueCount,
    topExpenseCategory: categoryAnalysis.expenseCategories[0],
    paymentMethods: paymentMethodAnalysis,
  });

  const serializedRecentActivity: SerializedActivityItem[] = recentTransactions.map(
    (t: {
      id: string;
      transactionNumber: string;
      transactionType: TransactionType;
      transactionDate: Date;
      totalAmount: Prisma.Decimal;
      customer: { name: string } | null;
      supplier: { name: string } | null;
      category: { name: string } | null;
      status: string;
      paymentStatus: string;
    }) => ({
      id: t.id,
      number: t.transactionNumber,
      type: t.transactionType,
      date: t.transactionDate.toISOString(),
      amount: t.totalAmount.toString(),
      partyName: t.customer?.name || t.supplier?.name || null,
      categoryName: t.category?.name || null,
      status: t.status,
      paymentStatus: t.paymentStatus,
    })
  );

  const serializedRecentNotes: SerializedNoteItem[] = recentNotes.map(
    (n: {
      id: string;
      title: string;
      content: string;
      isPinned: boolean;
      noteType: string;
      updatedAt: Date;
    }) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      isPinned: n.isPinned,
      noteType: n.noteType,
      updatedAt: n.updatedAt.toISOString(),
    })
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* 1. Header with Controls */}
      <DashboardHeader
        businessName={user.businessName}
        currentPeriod={periodParam}
        periodLabel={commandCenter.dateRange.label}
        startDate={startDateParam}
        endDate={endDateParam}
        currentView={viewParam}
        userPermissions={user.permissions}
        userRoles={user.roles}
      />

      {isDatabaseOffline && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span>
              <strong>Local Database Standby:</strong> PostgreSQL server at <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-300">localhost:5432</code> is in standby or offline. Displaying initial zero-balance starting state.
            </span>
          </div>
        </div>
      )}

      {/* 2. System Reconciliation & Accounting Health */}
      <AccountingHealthWidget
        status={accountingHealth.status}
        report={accountingHealth.report}
      />

      {/* 2b. Phase 15 Disaster Recovery & Backup Health Admin Widget */}
      {(user.permissions.includes(PERMISSIONS.BACKUPS_VIEW) ||
        user.permissions.includes(PERMISSIONS.AUDIT_VIEW)) && (
        <BackupAuditHealthAdminWidget businessId={user.businessId} />
      )}

      {/* 3. Primary KPI Cards Grid (8 Cards) */}
      <PrimaryKpiGrid
        kpi={commandCenter.kpi}
        prevPeriodLabel={commandCenter.dateRange.prevLabel}
      />

      {/* 4. Conditional View Content */}
      {viewParam === "OVERVIEW" && (
        <div className="space-y-8">
          {/* Calculated Insights Banner */}
          <CalculatedInsightsCard insights={calculatedInsights} />

          {/* Income vs Expenses Trend Chart */}
          <IncomeExpenseTrendChart
            data={trendData}
            periodLabel={commandCenter.dateRange.label}
          />

          {/* Aging Schedule Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgingScheduleCard
              title="Receivables Aging Schedule"
              type="RECEIVABLE"
              aging={receivablesAging}
            />
            <AgingScheduleCard
              title="Payables Aging Schedule"
              type="PAYABLE"
              aging={payablesAging}
            />
          </div>

          {/* Categories & Top Counterparties */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryAnalysisWidget
              incomeCategories={categoryAnalysis.incomeCategories}
              expenseCategories={categoryAnalysis.expenseCategories}
            />
            <TopPartiesWidget
              customers={customerAnalysis}
              suppliers={supplierAnalysis}
            />
          </div>

          {/* Overdue Items & Upcoming Dues */}
          <UpcomingAndOverdueWidget
            overdueItems={duesData.overdueItems}
            upcomingItems={duesData.upcomingItems}
          />

          {/* Recent Activity & Notes (Strictly Separated) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentFinancialActivityWidget records={serializedRecentActivity} />
            <RecentNotesWidget notes={serializedRecentNotes} />
          </div>
        </div>
      )}

      {viewParam === "CASH_FLOW" && (
        <div className="space-y-8 animate-fade-in">
          {/* Cash Flow Movements */}
          <CashFlowTrendChart
            data={trendData}
            periodLabel={commandCenter.dateRange.label}
          />

          {/* Payment Methods & Channels */}
          <PaymentMethodDonutChart methods={paymentMethodAnalysis} />

          {/* Recent Posted Cash Activity */}
          <RecentFinancialActivityWidget records={serializedRecentActivity} />
        </div>
      )}

      {viewParam === "DUES_RECEIVABLES" && (
        <div className="space-y-8 animate-fade-in">
          {/* Aging Schedule Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgingScheduleCard
              title="Customer Receivables Aging"
              type="RECEIVABLE"
              aging={receivablesAging}
            />
            <AgingScheduleCard
              title="Supplier Payables Aging"
              type="PAYABLE"
              aging={payablesAging}
            />
          </div>

          {/* Overdue and Upcoming Settlement Schedule */}
          <UpcomingAndOverdueWidget
            overdueItems={duesData.overdueItems}
            upcomingItems={duesData.upcomingItems}
          />

          {/* Top Counterparties with Direct Ledger Links */}
          <TopPartiesWidget
            customers={customerAnalysis}
            suppliers={supplierAnalysis}
          />
        </div>
      )}

      {viewParam === "EXPENSE_AUDIT" && (
        <div className="space-y-8 animate-fade-in">
          {/* Category Distribution */}
          <CategoryAnalysisWidget
            incomeCategories={categoryAnalysis.incomeCategories}
            expenseCategories={categoryAnalysis.expenseCategories}
          />

          {/* Supplier Payables Volume */}
          <TopPartiesWidget
            customers={customerAnalysis}
            suppliers={supplierAnalysis}
          />

          {/* Recent Expense Transactions */}
          <RecentFinancialActivityWidget records={serializedRecentActivity} />
        </div>
      )}

      {/* Global Drill-Down Footer Banner */}
      <div className="p-4 rounded-2xl glass-card border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time deterministic aggregations from PostgreSQL. No client-side guessing.</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/records" className="hover:text-white transition-colors flex items-center gap-1">
            <span>Ledger Records</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
          <Link href="/receivables" className="hover:text-white transition-colors flex items-center gap-1">
            <span>Receivables</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
          <Link href="/payables" className="hover:text-white transition-colors flex items-center gap-1">
            <span>Payables</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
