"use server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import {
  PdfReportService,
  type PdfReportType,
} from "@/server/services/pdf-report.service";
import {
  ReportDataService,
  type TransactionFilterParams,
} from "@/server/services/report-data.service";
import { AnalyticsService, type PeriodType } from "@/server/services/analytics.service";
import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { TransactionType, PaymentDirection } from "@prisma/client";

export interface GeneratePdfInput {
  reportType: PdfReportType;
  period?: PeriodType;
  startDate?: string;
  endDate?: string;
  filters?: Partial<TransactionFilterParams>;
  customerId?: string;
  supplierId?: string;
  isConfidential?: boolean;
  isDraft?: boolean;
  includeCharts?: boolean;
  includeNotes?: boolean;
}

export interface PdfPreviewSummaryCard {
  label: string;
  value: string;
  color?: string;
}

export interface PdfReportPreviewDTO {
  reportType: PdfReportType;
  reportTitle: string;
  businessName: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  estimatedRows: number;
  estimatedPages: number;
  summaryCards: PdfPreviewSummaryCard[];
  filtersSummary: Record<string, string>;
  warning?: string;
}

export async function generatePdfReportAction(input: GeneratePdfInput) {
  try {
    const user = await requireCurrentUser();

    // Permissions check
    try {
      PdfReportService.validatePermissions(
        input.reportType,
        user.permissions,
        user.roles
      );
    } catch (permError) {
      return {
        success: false,
        error: permError instanceof Error ? permError.message : "Permission denied.",
      };
    }

    const startDate = input.startDate ? new Date(input.startDate) : undefined;
    const endDate = input.endDate ? new Date(input.endDate) : undefined;

    const dateRange = AnalyticsService.resolveDateRange({
      period: input.period || "this-month",
      startDate,
      endDate,
    });

    const fullFilters: TransactionFilterParams = {
      businessId: user.businessId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...input.filters,
    };

    const result = await PdfReportService.generateReport({
      businessId: user.businessId,
      userId: user.id,
      userRoles: user.roles,
      userPermissions: user.permissions,
      reportType: input.reportType,
      filters: fullFilters,
      customerId: input.customerId,
      supplierId: input.supplierId,
      isConfidential: input.isConfidential,
      isDraft: input.isDraft,
      includeCharts: input.includeCharts !== false,
      includeNotes: input.includeNotes !== false,
    });

    revalidatePath("/reports");
    revalidatePath("/reports/history");

    return {
      success: true,
      data: {
        historyId: result.historyId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        reportReference: result.reportReference,
        downloadUrl: `/api/exports/${result.historyId}/download`,
      },
    };
  } catch (error) {
    console.error("generatePdfReportAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate PDF report.",
    };
  }
}

export async function getPdfReportPreviewAction(input: {
  reportType: PdfReportType;
  period?: PeriodType;
  startDate?: string;
  endDate?: string;
  filters?: Partial<TransactionFilterParams>;
  customerId?: string;
  supplierId?: string;
}): Promise<{ success: boolean; data?: PdfReportPreviewDTO; error?: string }> {
  try {
    const user = await requireCurrentUser();

    // Check permissions
    try {
      PdfReportService.validatePermissions(
        input.reportType,
        user.permissions,
        user.roles
      );
    } catch (permError) {
      return {
        success: false,
        error: permError instanceof Error ? permError.message : "Permission denied.",
      };
    }

    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
      select: { name: true, currency: true },
    });

    const startDate = input.startDate ? new Date(input.startDate) : undefined;
    const endDate = input.endDate ? new Date(input.endDate) : undefined;

    const dateRange = AnalyticsService.resolveDateRange({
      period: input.period || "this-month",
      startDate,
      endDate,
    });

    let estimatedRows = 0;
    let estimatedPages = 1;
    const summaryCards: PdfPreviewSummaryCard[] = [];
    const filtersSummary: Record<string, string> = {
      Period: dateRange.label,
    };

    const commonParams = {
      businessId: user.businessId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    };

    // Calculate preview data using the exact same server-side reportDataService
    switch (input.reportType) {
      case "MONTHLY_ACCOUNTING": {
        const data = await ReportDataService.getMonthlyWorkbookData(commonParams);
        estimatedRows = data.allTransactions.length + data.payments.length;
        estimatedPages = Math.max(3, Math.ceil(estimatedRows / 25) + 2);
        summaryCards.push(
          { label: "Total Revenue", value: data.summary.totalIncome.format(), color: "#059669" },
          { label: "Total Expenses", value: data.summary.totalExpenses.format(), color: "#DC2626" },
          { label: "Net Result", value: data.summary.netResult.format(), color: "#2563EB" },
          { label: "Receivables", value: data.summary.receivablesOutstanding.format(), color: "#D97706" }
        );
        break;
      }
      case "FINANCIAL_SUMMARY": {
        const sum = await ReportDataService.getFinancialSummaryReport(commonParams);
        estimatedRows = 25;
        estimatedPages = 1;
        summaryCards.push(
          { label: "Opening Liquidity", value: sum.openingBalance.format() },
          { label: "Total Income", value: sum.totalIncome.format(), color: "#059669" },
          { label: "Total Expenses", value: sum.totalExpenses.format(), color: "#DC2626" },
          { label: "Net Profit/Loss", value: sum.netResult.format(), color: "#2563EB" },
          { label: "Closing Liquidity", value: sum.closingBalance.format(), color: "#0284C7" }
        );
        break;
      }
      case "INCOME": {
        const txns = await ReportDataService.getTransactionReport({
          ...commonParams,
          transactionType: TransactionType.INCOME,
          ...input.filters,
        });
        estimatedRows = txns.length;
        estimatedPages = Math.max(1, Math.ceil(estimatedRows / 25));
        const total = txns.reduce((acc, t) => acc.add(t.amount), Money.zero());
        summaryCards.push(
          { label: "Income Transactions", value: `${txns.length}` },
          { label: "Total Income", value: total.format(), color: "#059669" }
        );
        break;
      }
      case "EXPENSES": {
        const txns = await ReportDataService.getTransactionReport({
          ...commonParams,
          transactionType: TransactionType.EXPENSE,
          ...input.filters,
        });
        estimatedRows = txns.length;
        estimatedPages = Math.max(1, Math.ceil(estimatedRows / 25));
        const total = txns.reduce((acc, t) => acc.add(t.amount), Money.zero());
        summaryCards.push(
          { label: "Expense Transactions", value: `${txns.length}` },
          { label: "Total Expenses", value: total.format(), color: "#DC2626" }
        );
        break;
      }
      case "TRANSACTIONS": {
        const txns = await ReportDataService.getTransactionReport({
          ...commonParams,
          ...input.filters,
        });
        estimatedRows = txns.length;
        estimatedPages = Math.max(1, Math.ceil(estimatedRows / 22));
        summaryCards.push({ label: "Total Transactions", value: `${txns.length}` });
        break;
      }
      case "PAYMENTS": {
        const pms = await ReportDataService.getPaymentReport(commonParams);
        estimatedRows = pms.length;
        estimatedPages = Math.max(1, Math.ceil(estimatedRows / 25));
        const totalIn = pms
          .filter((p) => p.direction === PaymentDirection.IN)
          .reduce((acc, p) => acc.add(p.amount), Money.zero());
        const totalOut = pms
          .filter((p) => p.direction === PaymentDirection.OUT)
          .reduce((acc, p) => acc.add(p.amount), Money.zero());
        summaryCards.push(
          { label: "Payments Count", value: `${pms.length}` },
          { label: "Cash In", value: totalIn.format(), color: "#059669" },
          { label: "Cash Out", value: totalOut.format(), color: "#DC2626" }
        );
        break;
      }
      case "CASH_MOVEMENT": {
        const cash = await ReportDataService.getCashMovementReport(commonParams);
        estimatedRows = 20;
        estimatedPages = 1;
        summaryCards.push(
          { label: "Opening Cash", value: cash.openingBalance.format() },
          { label: "Total Inflow", value: cash.totalInflow.format(), color: "#059669" },
          { label: "Total Outflow", value: cash.totalOutflow.format(), color: "#DC2626" },
          { label: "Closing Cash", value: cash.closingBalance.format(), color: "#0284C7" }
        );
        break;
      }
      case "RECEIVABLES":
      case "RECEIVABLE_AGING": {
        const aging = await ReportDataService.getReceivableAgingReport({ businessId: user.businessId });
        estimatedRows = aging.length;
        estimatedPages = Math.max(1, Math.ceil(estimatedRows / 25));
        const total = aging.reduce((acc, r) => acc.add(r.totalOutstanding), Money.zero());
        summaryCards.push(
          { label: "Customer Accounts", value: `${aging.length}` },
          { label: "Total Receivables", value: total.format(), color: "#D97706" }
        );
        break;
      }
      case "PAYABLES":
      case "PAYABLE_AGING": {
        const aging = await ReportDataService.getPayableAgingReport({ businessId: user.businessId });
        estimatedRows = aging.length;
        estimatedPages = Math.max(1, Math.ceil(estimatedRows / 25));
        const total = aging.reduce((acc, r) => acc.add(r.totalOutstanding), Money.zero());
        summaryCards.push(
          { label: "Supplier Accounts", value: `${aging.length}` },
          { label: "Total Payables", value: total.format(), color: "#DC2626" }
        );
        break;
      }
      case "CUSTOMER_STATEMENT":
      case "CUSTOMER_LEDGER": {
        if (!input.customerId) {
          return { success: false, error: "Please select a customer for this statement." };
        }
        const led = await ReportDataService.getCustomerLedgerReport(
          user.businessId,
          input.customerId,
          dateRange.startDate,
          dateRange.endDate
        );
        estimatedRows = led.entries.length;
        estimatedPages = Math.max(1, Math.ceil(estimatedRows / 25));
        filtersSummary["Customer"] = led.customer.name;
        summaryCards.push(
          { label: "Opening Balance", value: led.openingBalance.format() },
          { label: "Total Debits (Billed)", value: led.totalDebits.format() },
          { label: "Total Credits (Paid)", value: led.totalCredits.format() },
          { label: "Closing Balance", value: led.closingBalance.format(), color: "#2563EB" }
        );
        break;
      }
      case "SUPPLIER_STATEMENT":
      case "SUPPLIER_LEDGER": {
        if (!input.supplierId) {
          return { success: false, error: "Please select a supplier for this statement." };
        }
        const led = await ReportDataService.getSupplierLedgerReport(
          user.businessId,
          input.supplierId,
          dateRange.startDate,
          dateRange.endDate
        );
        estimatedRows = led.entries.length;
        estimatedPages = Math.max(1, Math.ceil(estimatedRows / 25));
        filtersSummary["Supplier"] = led.supplier.name;
        summaryCards.push(
          { label: "Opening Balance", value: led.openingBalance.format() },
          { label: "Total Debits (Paid)", value: led.totalDebits.format() },
          { label: "Total Credits (Bills)", value: led.totalCredits.format() },
          { label: "Closing Balance", value: led.closingBalance.format(), color: "#2563EB" }
        );
        break;
      }
      case "MANAGEMENT_SUMMARY": {
        const mgmt = await ReportDataService.getManagementSummaryReport(commonParams);
        estimatedRows = 30;
        estimatedPages = 2;
        summaryCards.push(
          { label: "Operating Revenue", value: mgmt.financialSummary.totalIncome.format(), color: "#059669" },
          { label: "Operating Expenses", value: mgmt.financialSummary.totalExpenses.format(), color: "#DC2626" },
          { label: "Net Operating Margin", value: mgmt.financialSummary.netResult.format(), color: "#2563EB" },
          { label: "Accounting Health", value: mgmt.accountingHealth.status, color: "#0284C7" }
        );
        break;
      }
      default: {
        estimatedRows = 15;
        estimatedPages = 1;
        summaryCards.push({ label: "Report Status", value: "Ready" });
      }
    }

    let warning: string | undefined;
    if (estimatedRows > 500) {
      warning = `This report contains approximately ${estimatedRows} records and may take longer to generate.`;
    }

    const reportTitles: Record<PdfReportType, string> = {
      MONTHLY_ACCOUNTING: "Monthly Accounting Report",
      FINANCIAL_SUMMARY: "Executive Financial Summary",
      INCOME: "Income & Revenue Report",
      EXPENSES: "Operational Expense Report",
      TRANSACTIONS: "Financial Transactions Journal",
      PAYMENTS: "Payment Inflow & Outflow Report",
      CASH_MOVEMENT: "Cash Movement & Liquidity Report",
      RECEIVABLES: "Accounts Receivable Ledger",
      PAYABLES: "Accounts Payable Ledger",
      RECEIVABLE_AGING: "Receivable Aging Schedule",
      PAYABLE_AGING: "Payable Aging Schedule",
      CUSTOMER_STATEMENT: "Customer Statement of Account",
      CUSTOMER_LEDGER: "Customer Ledger Account",
      SUPPLIER_STATEMENT: "Supplier Statement of Account",
      SUPPLIER_LEDGER: "Supplier Ledger Account",
      CATEGORY_SUMMARY: "Category Breakdown Analysis",
      PAYMENT_METHOD_SUMMARY: "Payment Methods Analysis",
      DAILY_SUMMARY: "Daily Financial Movement",
      MONTHLY_SUMMARY: "Monthly Multi-Period Trends",
      MANAGEMENT_SUMMARY: "Executive Management Briefing",
    };

    return {
      success: true,
      data: {
        reportType: input.reportType,
        reportTitle: reportTitles[input.reportType] || input.reportType,
        businessName: business?.name || "Sai Tours & Travels",
        periodLabel: dateRange.label,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        estimatedRows,
        estimatedPages,
        summaryCards,
        filtersSummary,
        warning,
      },
    };
  } catch (error) {
    console.error("getPdfReportPreviewAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to calculate report preview.",
    };
  }
}

export async function getPdfReportHistoryAction(options?: {
  reportType?: string;
  limit?: number;
}) {
  try {
    const user = await requireCurrentUser();

    const history = await prisma.reportHistory.findMany({
      where: {
        businessId: user.businessId,
        format: "PDF",
        ...(options?.reportType ? { reportType: options.reportType } : {}),
      },
      orderBy: { generatedAt: "desc" },
      take: options?.limit || 50,
    });

    return {
      success: true,
      data: history.map((h) => {
        const p = (h.parameters as Record<string, unknown>) || {};
        const fileName =
          typeof p.fileName === "string"
            ? p.fileName
            : `Report_${h.reportType}_${h.id.slice(0, 8)}.pdf`;
        const fileSize = typeof p.fileSize === "number" ? p.fileSize : 0;
        const status = typeof p.status === "string" ? p.status : "COMPLETED";

        return {
          id: h.id,
          reportType: h.reportType,
          format: h.format,
          periodStart: h.periodStart.toISOString(),
          periodEnd: h.periodEnd.toISOString(),
          fileName,
          fileSize,
          status,
          generatedAt: h.generatedAt.toISOString(),
          generatedBy: h.generatedBy || "System",
          downloadUrl: `/api/exports/${h.id}/download`,
          parameters: p,
        };
      }),
    };
  } catch (error) {
    console.error("getPdfReportHistoryAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to retrieve report history.",
    };
  }
}

export async function regeneratePdfReportAction(reportId: string) {
  try {
    const user = await requireCurrentUser();

    const existing = await prisma.reportHistory.findFirst({
      where: {
        id: reportId,
        businessId: user.businessId,
      },
    });

    if (!existing) {
      return { success: false, error: "Report history entry not found." };
    }

    const params = (existing.parameters as Record<string, unknown>) || {};
    const reportType = (existing.reportType as PdfReportType) || "FINANCIAL_SUMMARY";

    // Requirement 67: Regeneration creates a new report artifact/history entry to preserve auditability
    const result = await PdfReportService.generateReport({
      businessId: user.businessId,
      userId: user.id,
      userRoles: user.roles,
      userPermissions: user.permissions,
      reportType,
      filters: {
        businessId: user.businessId,
        startDate: existing.periodStart,
        endDate: existing.periodEnd,
        ...(typeof params.filters === "object" && params.filters !== null ? params.filters : {}),
      },
      customerId: typeof params.customerId === "string" ? params.customerId : undefined,
      supplierId: typeof params.supplierId === "string" ? params.supplierId : undefined,
      isConfidential: typeof params.isConfidential === "boolean" ? params.isConfidential : undefined,
      isDraft: typeof params.isDraft === "boolean" ? params.isDraft : undefined,
      includeCharts: params.includeCharts !== false,
      includeNotes: params.includeNotes !== false,
    });

    revalidatePath("/reports");
    revalidatePath("/reports/history");

    return {
      success: true,
      data: {
        historyId: result.historyId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        reportReference: result.reportReference,
        downloadUrl: `/api/exports/${result.historyId}/download`,
      },
    };
  } catch (error) {
    console.error("regeneratePdfReportAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to regenerate report.",
    };
  }
}

export async function getReportCustomersAction(): Promise<{
  success: boolean;
  data: { id: string; name: string; customerCode: string; phone: string | null }[];
}> {
  try {
    const user = await requireCurrentUser();
    const customers = await prisma.customer.findMany({
      where: { businessId: user.businessId },
      select: { id: true, name: true, customerCode: true, phone: true },
      orderBy: { name: "asc" },
      take: 100,
    });
    return { success: true, data: customers };
  } catch (error) {
    console.error("getReportCustomersAction error:", error);
    return { success: false, data: [] };
  }
}

export async function getReportSuppliersAction(): Promise<{
  success: boolean;
  data: { id: string; name: string; supplierCode: string; phone: string | null }[];
}> {
  try {
    const user = await requireCurrentUser();
    const suppliers = await prisma.supplier.findMany({
      where: { businessId: user.businessId },
      select: { id: true, name: true, supplierCode: true, phone: true },
      orderBy: { name: "asc" },
      take: 100,
    });
    return { success: true, data: suppliers };
  } catch (error) {
    console.error("getReportSuppliersAction error:", error);
    return { success: false, data: [] };
  }
}

