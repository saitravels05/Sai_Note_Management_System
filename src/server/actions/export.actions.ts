"use server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { ExportService, type ExportFormat, type ExportType } from "@/server/services/export.service";
import { ReportDataService, type TransactionFilterParams } from "@/server/services/report-data.service";
import { AnalyticsService, type PeriodType } from "@/server/services/analytics.service";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { TransactionType } from "@prisma/client";

export interface GenerateExportInput {
  exportType: ExportType;
  format: ExportFormat;
  period?: string;
  startDate?: string;
  endDate?: string;
  filters?: Partial<TransactionFilterParams>;
  partyId?: string;
  financialPeriodYear?: number;
}

export async function generateExportAction(input: GenerateExportInput) {
  try {
    const user = await requireCurrentUser();

    const canExport =
      hasPermission(user.permissions, user.roles, PERMISSIONS.EXPORTS_EXECUTE) ||
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_VIEW);

    if (!canExport) {
      return { success: false, error: "Permission denied: exports.execute required." };
    }

    const startDate = input.startDate ? new Date(input.startDate) : undefined;
    const endDate = input.endDate ? new Date(input.endDate) : undefined;

    const result = await ExportService.generateExport({
      businessId: user.businessId,
      userId: user.id,
      userPermissions: user.permissions,
      userRoles: user.roles,
      exportType: input.exportType,
      format: input.format,
      period: input.period,
      startDate,
      endDate,
      filters: input.filters,
      partyId: input.partyId,
      financialPeriodYear: input.financialPeriodYear,
    });

    revalidatePath("/reports");
    revalidatePath("/reports/exports");

    return {
      success: true,
      data: {
        id: result.id,
        fileName: result.fileName,
        fileSize: result.fileSize,
        format: result.format,
        exportType: result.exportType,
        downloadUrl: result.downloadUrl,
        generatedAt: result.generatedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("generateExportAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate export file.",
    };
  }
}

export async function getExportHistoryAction() {
  try {
    const user = await requireCurrentUser();

    const history = await ExportService.listExportHistory(user.businessId);

    return {
      success: true,
      data: history.map((h) => ({
        id: h.id,
        reportType: h.reportType,
        format: h.format,
        periodStart: h.periodStart.toISOString(),
        periodEnd: h.periodEnd.toISOString(),
        fileName: h.fileName,
        fileSize: h.fileSize,
        generatedAt: h.generatedAt.toISOString(),
        downloadUrl: h.downloadUrl,
      })),
    };
  } catch (error) {
    console.error("getExportHistoryAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load export history.",
    };
  }
}

export async function deleteExportAction(reportId: string) {
  try {
    const user = await requireCurrentUser();

    const canDelete =
      hasPermission(user.permissions, user.roles, PERMISSIONS.EXPORTS_EXECUTE) ||
      user.roles.includes("OWNER") ||
      user.roles.includes("ADMIN");

    if (!canDelete) {
      return { success: false, error: "Permission denied." };
    }

    await ExportService.deleteExport(reportId, user.businessId, user.id);

    revalidatePath("/reports");
    revalidatePath("/reports/exports");

    return { success: true };
  } catch (error) {
    console.error("deleteExportAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete export file.",
    };
  }
}

export async function getExportPreviewAction(input: {
  exportType: ExportType;
  period?: PeriodType;
  startDate?: string;
  endDate?: string;
  partyId?: string;
}) {
  try {
    const user = await requireCurrentUser();

    const startDate = input.startDate ? new Date(input.startDate) : undefined;
    const endDate = input.endDate ? new Date(input.endDate) : undefined;

    const dateRange = AnalyticsService.resolveDateRange({
      period: input.period || "this-month",
      startDate,
      endDate,
    });

    let estimatedRows = 0;
    let estimatedSheets = 1;

    switch (input.exportType) {
      case "MONTHLY_WORKBOOK": {
        estimatedSheets = 13;
        const txns = await ReportDataService.getTransactionReport({
          businessId: user.businessId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });
        estimatedRows = txns.length;
        break;
      }
      case "FINANCIAL_SUMMARY": {
        estimatedSheets = 13;
        estimatedRows = 25;
        break;
      }
      case "TRANSACTIONS":
      case "INCOME":
      case "EXPENSES":
      case "RECEIVABLES":
      case "PAYABLES": {
        const txns = await ReportDataService.getTransactionReport({
          businessId: user.businessId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          transactionType:
            input.exportType === "INCOME"
              ? TransactionType.INCOME
              : input.exportType === "EXPENSES"
              ? TransactionType.EXPENSE
              : input.exportType === "RECEIVABLES"
              ? TransactionType.RECEIVABLE
              : input.exportType === "PAYABLES"
              ? TransactionType.PAYABLE
              : undefined,
        });
        estimatedRows = txns.length;
        break;
      }
      case "PAYMENTS": {
        const pms = await ReportDataService.getPaymentReport({
          businessId: user.businessId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });
        estimatedRows = pms.length;
        break;
      }
      case "CUSTOMER_SUMMARY":
      case "SUPPLIER_SUMMARY":
      case "RECEIVABLE_AGING":
      case "PAYABLE_AGING": {
        estimatedRows = 20;
        break;
      }
      case "CUSTOMER_LEDGER":
      case "SUPPLIER_LEDGER": {
        if (input.partyId) {
          if (input.exportType === "CUSTOMER_LEDGER") {
            const led = await ReportDataService.getCustomerLedgerReport(
              user.businessId,
              input.partyId,
              dateRange.startDate,
              dateRange.endDate
            );
            estimatedRows = led.entries.length;
          } else {
            const led = await ReportDataService.getSupplierLedgerReport(
              user.businessId,
              input.partyId,
              dateRange.startDate,
              dateRange.endDate
            );
            estimatedRows = led.entries.length;
          }
        }
        break;
      }
      default:
        estimatedRows = 10;
    }

    return {
      success: true,
      data: {
        exportType: input.exportType,
        periodLabel: dateRange.label,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        estimatedRows,
        estimatedSheets,
      },
    };
  } catch (error) {
    console.error("getExportPreviewAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to calculate export preview.",
    };
  }
}
