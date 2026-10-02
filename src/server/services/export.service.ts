import { prisma } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { AuditService } from "./audit.service";
import { AuditAction, TransactionType, TransactionStatus, PaymentStatus } from "@prisma/client";
import { ReportDataService, type TransactionFilterParams } from "./report-data.service";
import { type PeriodType } from "./analytics.service";
import { ExcelExportService } from "./excel-export.service";
import { CsvExportService } from "./csv-export.service";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const STORAGE_ROOT = process.env.STORAGE_PATH
  ? path.join(process.env.STORAGE_PATH, "exports")
  : process.env.VERCEL
  ? path.join("/tmp", "storage", "exports")
  : path.join(process.cwd(), "storage", "exports");

export type ExportFormat = "EXCEL" | "CSV";

export type ExportType =
  | "MONTHLY_WORKBOOK"
  | "FINANCIAL_SUMMARY"
  | "TRANSACTIONS"
  | "INCOME"
  | "EXPENSES"
  | "PAYMENTS"
  | "RECEIVABLES"
  | "PAYABLES"
  | "CUSTOMER_SUMMARY"
  | "SUPPLIER_SUMMARY"
  | "CUSTOMER_LEDGER"
  | "SUPPLIER_LEDGER"
  | "RECEIVABLE_AGING"
  | "PAYABLE_AGING"
  | "CATEGORY_SUMMARY"
  | "PAYMENT_METHOD_SUMMARY"
  | "DAILY_SUMMARY"
  | "MONTHLY_ANALYSIS";

export interface GenerateExportOptions {
  businessId: string;
  userId: string;
  userPermissions: string[];
  userRoles: string[];
  exportType: ExportType;
  format: ExportFormat;
  period?: string;
  startDate?: Date;
  endDate?: Date;
  filters?: Partial<TransactionFilterParams>;
  partyId?: string; // for customer/supplier ledger
  financialPeriodYear?: number;
}

export interface ExportGenerationResult {
  id: string;
  fileName: string;
  fileSize: number;
  format: ExportFormat;
  exportType: ExportType;
  downloadUrl: string;
  generatedAt: Date;
}

/**
 * Sanitize filename to prevent directory traversal or malformed HTTP headers.
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
}

export class ExportService {
  /**
   * Ensure private business export storage directory exists.
   */
  private static async ensureStorageDir(businessId: string): Promise<string> {
    const dir = path.join(STORAGE_ROOT, businessId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  /**
   * Check permissions based on requested export entity.
   */
  public static validateExportPermissions(
    exportType: ExportType,
    userPermissions: string[],
    userRoles: string[]
  ): void {
    const isOwner = userRoles.includes("OWNER");
    if (isOwner || userPermissions.includes("*")) {
      return;
    }

    if (!userPermissions.includes("exports.execute") && !userPermissions.includes("reports.view")) {
      throw new ForbiddenError("You do not have permission to generate exports (exports.execute required).");
    }

    // Specific entity checks
    if (exportType === "PAYABLES" || exportType === "PAYABLE_AGING" || exportType === "SUPPLIER_LEDGER") {
      if (!userPermissions.includes("payables.view") && !userPermissions.includes("suppliers.view")) {
        throw new ForbiddenError("You do not have permission to view or export payables / supplier records.");
      }
    }

    if (exportType === "RECEIVABLES" || exportType === "RECEIVABLE_AGING" || exportType === "CUSTOMER_LEDGER") {
      if (!userPermissions.includes("receivables.view") && !userPermissions.includes("customers.view")) {
        throw new ForbiddenError("You do not have permission to view or export receivables / customer records.");
      }
    }

    if (exportType === "EXPENSES" && !userPermissions.includes("expenses.view")) {
      throw new ForbiddenError("You do not have permission to view or export expense records.");
    }

    if (exportType === "INCOME" && !userPermissions.includes("income.view")) {
      throw new ForbiddenError("You do not have permission to view or export income records.");
    }
  }

  /**
   * Generate an Export file, persist securely, log audit, and track in ReportHistory.
   */
  public static async generateExport(options: GenerateExportOptions): Promise<ExportGenerationResult> {
    const {
      businessId,
      userId,
      userPermissions,
      userRoles,
      exportType,
      format,
      period,
      startDate,
      endDate,
      filters = {},
      partyId,
      financialPeriodYear,
    } = options;

    // 1. Authorization check
    this.validateExportPermissions(exportType, userPermissions, userRoles);

    // 2. Fetch business context
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, currency: true },
    });

    if (!business) {
      throw new NotFoundError("Business context not found.");
    }

    // 3. Generate file content buffer based on export type and format
    let fileBuffer: Buffer;
    let baseFileName: string;
    const dateStr = new Date().toISOString().slice(0, 10);
    const ext = format === "EXCEL" ? "xlsx" : "csv";

    const commonParams = {
      businessId,
      startDate,
      endDate,
      period: (period as PeriodType) || "this-month",
      financialPeriodYear,
      ...filters,
    };

    switch (exportType) {
      case "MONTHLY_WORKBOOK": {
        if (format === "CSV") {
          // For CSV with monthly workbook, export all transactions
          const txns = await ReportDataService.getTransactionReport(commonParams);
          fileBuffer = CsvExportService.exportTransactionsCsv(txns, "Monthly Workbook Transactions");
        } else {
          const workbookData = await ReportDataService.getMonthlyWorkbookData(commonParams);
          fileBuffer = ExcelExportService.generateMonthlyAccountingWorkbook(workbookData);
        }
        baseFileName = `Monthly_Accounts_${period || dateStr}`;
        break;
      }

      case "FINANCIAL_SUMMARY": {
        const summary = await ReportDataService.getFinancialSummaryReport(commonParams);
        const workbookData = await ReportDataService.getMonthlyWorkbookData(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateMonthlyAccountingWorkbook({ ...workbookData, summary })
            : CsvExportService.exportTransactionsCsv(workbookData.allTransactions, "Financial Summary Data");
        baseFileName = `Financial_Summary_${period || dateStr}`;
        break;
      }

      case "TRANSACTIONS": {
        const txns = await ReportDataService.getTransactionReport(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateTransactionsWorkbook(txns, "Transaction Records", business.name)
            : CsvExportService.exportTransactionsCsv(txns, "Transaction Records");
        baseFileName = `Transactions_${period || dateStr}`;
        break;
      }

      case "INCOME": {
        const incomeRows = await ReportDataService.getIncomeReport(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateTransactionsWorkbook(incomeRows, "Income Transactions", business.name)
            : CsvExportService.exportTransactionsCsv(incomeRows, "Income Transactions");
        baseFileName = `Income_Statement_${period || dateStr}`;
        break;
      }

      case "EXPENSES": {
        const expenseRows = await ReportDataService.getExpenseReport(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateTransactionsWorkbook(expenseRows, "Expense Transactions", business.name)
            : CsvExportService.exportTransactionsCsv(expenseRows, "Expense Transactions");
        baseFileName = `Expense_Statement_${period || dateStr}`;
        break;
      }

      case "PAYMENTS": {
        const payments = await ReportDataService.getPaymentReport(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateTransactionsWorkbook(
                payments.map((p) => ({
                  id: p.id,
                  transactionNumber: p.paymentNumber,
                  date: p.date,
                  type: TransactionType.PAYMENT_IN,
                  partyName: p.partyName,
                  categoryName: p.paymentMethod,
                  description: p.notes || "Payment Settlement",
                  referenceNumber: p.referenceNumber,
                  amount: p.amount,
                  paidAmount: p.allocatedAmount,
                  outstandingAmount: p.unappliedAmount,
                  paymentStatus: PaymentStatus.PAID,
                  paymentMethod: p.paymentMethod,
                  status: TransactionStatus.POSTED,
                  dueDate: null,
                  daysOverdue: 0,
                  createdBy: p.createdBy,
                  createdAt: p.date,
                  tags: [],
                })),
                "Payments Record",
                business.name
              )
            : CsvExportService.exportPaymentsCsv(payments);
        baseFileName = `Payments_Ledger_${period || dateStr}`;
        break;
      }

      case "RECEIVABLES": {
        const receivables = await ReportDataService.getReceivableReport(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateTransactionsWorkbook(receivables, "Accounts Receivable", business.name)
            : CsvExportService.exportTransactionsCsv(receivables, "Accounts Receivable");
        baseFileName = `Receivables_${period || dateStr}`;
        break;
      }

      case "PAYABLES": {
        const payables = await ReportDataService.getPayableReport(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateTransactionsWorkbook(payables, "Accounts Payable", business.name)
            : CsvExportService.exportTransactionsCsv(payables, "Accounts Payable");
        baseFileName = `Payables_${period || dateStr}`;
        break;
      }

      case "CUSTOMER_SUMMARY": {
        const customerRows = await ReportDataService.getCustomerSummaryReport(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateTransactionsWorkbook(
                customerRows.map((c) => ({
                  id: c.id,
                  transactionNumber: c.code,
                  date: new Date(),
                  type: TransactionType.RECEIVABLE,
                  partyName: c.name,
                  categoryName: c.companyName || "Customer",
                  description: `Total Billed: ${c.totalBilled.format()}, Settled: ${c.totalPaid.format()}`,
                  referenceNumber: c.phone || "-",
                  amount: c.totalBilled,
                  paidAmount: c.totalPaid,
                  outstandingAmount: c.outstanding,
                  paymentStatus: c.outstanding.isZero() ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID,
                  status: TransactionStatus.POSTED,
                  dueDate: null,
                  daysOverdue: 0,
                  createdBy: "System",
                  createdAt: new Date(),
                  tags: [],
                })),
                "Customer Summary",
                business.name
              )
            : CsvExportService.exportPartySummaryCsv(customerRows, "Customer");
        baseFileName = `Customer_Summary_${dateStr}`;
        break;
      }

      case "SUPPLIER_SUMMARY": {
        const supplierRows = await ReportDataService.getSupplierSummaryReport(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateTransactionsWorkbook(
                supplierRows.map((s) => ({
                  id: s.id,
                  transactionNumber: s.code,
                  date: new Date(),
                  type: TransactionType.PAYABLE,
                  partyName: s.name,
                  categoryName: s.companyName || "Supplier",
                  description: `Total Billed: ${s.totalBilled.format()}, Settled: ${s.totalPaid.format()}`,
                  referenceNumber: s.phone || "-",
                  amount: s.totalBilled,
                  paidAmount: s.totalPaid,
                  outstandingAmount: s.outstanding,
                  paymentStatus: s.outstanding.isZero() ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID,
                  status: TransactionStatus.POSTED,
                  dueDate: null,
                  daysOverdue: 0,
                  createdBy: "System",
                  createdAt: new Date(),
                  tags: [],
                })),
                "Supplier Summary",
                business.name
              )
            : CsvExportService.exportPartySummaryCsv(supplierRows, "Supplier");
        baseFileName = `Supplier_Summary_${dateStr}`;
        break;
      }

      case "CUSTOMER_LEDGER": {
        if (!partyId) {
          throw new AppError("Customer ID is required for customer ledger export.", 400);
        }
        const ledger = await ReportDataService.getCustomerLedgerReport(
          businessId,
          partyId,
          startDate,
          endDate
        );
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateCustomerLedgerWorkbook(ledger, business.name)
            : CsvExportService.exportCustomerLedgerCsv(ledger);
        baseFileName = `Customer_Ledger_${ledger.customer.customerCode || ledger.customer.name}_${dateStr}`;
        break;
      }

      case "SUPPLIER_LEDGER": {
        if (!partyId) {
          throw new AppError("Supplier ID is required for supplier ledger export.", 400);
        }
        const ledger = await ReportDataService.getSupplierLedgerReport(
          businessId,
          partyId,
          startDate,
          endDate
        );
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateSupplierLedgerWorkbook(ledger, business.name)
            : CsvExportService.exportSupplierLedgerCsv(ledger);
        baseFileName = `Supplier_Ledger_${ledger.supplier.supplierCode || ledger.supplier.name}_${dateStr}`;
        break;
      }

      case "RECEIVABLE_AGING": {
        const aging = await ReportDataService.getReceivableAgingReport(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateAgingScheduleWorkbook(aging, "RECEIVABLES")
            : CsvExportService.exportAgingScheduleCsv(aging, "RECEIVABLES");
        baseFileName = `Receivable_Aging_${dateStr}`;
        break;
      }

      case "PAYABLE_AGING": {
        const aging = await ReportDataService.getPayableAgingReport(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateAgingScheduleWorkbook(aging, "PAYABLES")
            : CsvExportService.exportAgingScheduleCsv(aging, "PAYABLES");
        baseFileName = `Payable_Aging_${dateStr}`;
        break;
      }

      default: {
        const txns = await ReportDataService.getTransactionReport(commonParams);
        fileBuffer =
          format === "EXCEL"
            ? ExcelExportService.generateTransactionsWorkbook(txns, "Report", business.name)
            : CsvExportService.exportTransactionsCsv(txns, "Report");
        baseFileName = `Export_${exportType}_${dateStr}`;
      }
    }

    // 4. Save to private storage
    await this.ensureStorageDir(businessId);
    const fileId = crypto.randomUUID();
    const finalFileName = `${sanitizeFileName(baseFileName)}.${ext}`;
    const storageKey = `${businessId}/${Date.now()}_${fileId}.${ext}`;
    const absoluteFilePath = path.join(STORAGE_ROOT, storageKey);

    // Ensure subdirectories for storageKey exist
    await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });
    await fs.writeFile(absoluteFilePath, fileBuffer);

    // 5. Create ReportHistory record
    const reportHistory = await prisma.reportHistory.create({
      data: {
        businessId,
        reportType: exportType,
        periodStart: startDate || new Date(),
        periodEnd: endDate || new Date(),
        parameters: {
          period,
          filters,
          partyId,
          fileName: finalFileName,
          fileSize: fileBuffer.length,
        },
        format,
        storageKey,
        generatedBy: userId,
      },
    });

    // 6. Audit Logging
    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.EXPORT,
      entityType: "REPORT",
      entityId: reportHistory.id,
      newValues: {
        reportType: exportType,
        format,
        fileName: finalFileName,
        fileSize: fileBuffer.length,
      },
      reason: `Generated ${exportType} export (${format})`,
    });

    return {
      id: reportHistory.id,
      fileName: finalFileName,
      fileSize: fileBuffer.length,
      format,
      exportType,
      downloadUrl: `/api/exports/${reportHistory.id}/download`,
      generatedAt: reportHistory.generatedAt,
    };
  }

  /**
   * Retrieve stored export file for authenticated download.
   */
  public static async getExportFileForDownload(
    reportId: string,
    businessId: string
  ): Promise<{
    fileName: string;
    fileBuffer: Buffer;
    mimeType: string;
    fileSize: number;
  }> {
    const report = await prisma.reportHistory.findFirst({
      where: { id: reportId, businessId },
    });

    if (!report || !report.storageKey) {
      throw new NotFoundError("Export report file not found or unauthorized.");
    }

    const filePath = path.isAbsolute(report.storageKey)
      ? report.storageKey
      : path.join(/*turbopackIgnore: true*/ process.cwd(), report.storageKey);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch {
      throw new NotFoundError("Export physical file has expired or was removed from server storage.");
    }

    const params = (report.parameters as Record<string, unknown>) || {};
    const ext = report.format === "PDF" ? "pdf" : report.format === "EXCEL" ? "xlsx" : "csv";
    const fileName =
      typeof params.fileName === "string"
        ? params.fileName
        : `Export_${report.reportType}_${report.id.slice(0, 8)}.${ext}`;

    const mimeType =
      report.format === "PDF"
        ? "application/pdf"
        : report.format === "EXCEL"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv; charset=utf-8";

    return {
      fileName,
      fileBuffer,
      mimeType,
      fileSize: fileBuffer.length,
    };
  }

  /**
   * List export history for the business.
   */
  public static async listExportHistory(businessId: string, limit = 50) {
    const list = await prisma.reportHistory.findMany({
      where: { businessId },
      orderBy: { generatedAt: "desc" },
      take: limit,
    });

    return list.map((r) => {
      const p = (r.parameters as Record<string, unknown>) || {};
      return {
        id: r.id,
        reportType: r.reportType,
        format: r.format,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        fileName: typeof p.fileName === "string" ? p.fileName : `${r.reportType}.${r.format === "EXCEL" ? "xlsx" : "csv"}`,
        fileSize: typeof p.fileSize === "number" ? p.fileSize : 0,
        generatedAt: r.generatedAt,
        downloadUrl: `/api/exports/${r.id}/download`,
      };
    });
  }

  /**
   * Delete an export file from storage and report history.
   * Does NOT touch financial transaction records.
   */
  public static async deleteExport(
    reportId: string,
    businessId: string,
    userId: string
  ): Promise<void> {
    const report = await prisma.reportHistory.findFirst({
      where: { id: reportId, businessId },
    });

    if (!report) {
      throw new NotFoundError("Report not found.");
    }

    if (report.storageKey) {
      const filePath = path.join(STORAGE_ROOT, report.storageKey);
      try {
        await fs.unlink(filePath);
      } catch {
        // file may already be removed
      }
    }

    await prisma.reportHistory.delete({
      where: { id: report.id },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.VOID,
      entityType: "REPORT",
      entityId: report.id,
      reason: `Deleted export file ${report.reportType} (${report.id})`,
    });
  }
}
