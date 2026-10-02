import path from "path";
import fs from "fs";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import { AppError, NotFoundError } from "@/lib/errors";
import { NumberingService } from "./numbering.service";
import { AuditService } from "./audit.service";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import {
  ReportDataService,
  type TransactionFilterParams,
  type FinancialSummaryReportDTO,
  type MonthlyWorkbookDataDTO,
  type TransactionReportRowDTO,
  type PaymentReportRowDTO,
  type CategorySummaryReportRowDTO,
  type PaymentMethodReportRowDTO,
  type DailySummaryReportRowDTO,
  type MonthlyAnalysisReportRowDTO,
  type AgingScheduleReportRowDTO,
  type CashMovementReportDTO,
  type ManagementSummaryReportDTO,
} from "./report-data.service";
import { type CustomerLedgerResult, type SupplierLedgerResult } from "./ledger.service";
import {
  setupPdfFonts,
  formatPdfMoney,
  formatPdfDate,
  PDF_COLORS,
} from "./pdf/pdf-theme";
import {
  PdfBuilder,
  type PdfHeaderOptions,
  type PdfKPICard,
  type PdfTableColumn,
} from "./pdf/pdf-builder";

export type PdfReportType =
  | "MONTHLY_ACCOUNTING"
  | "FINANCIAL_SUMMARY"
  | "INCOME"
  | "EXPENSES"
  | "TRANSACTIONS"
  | "PAYMENTS"
  | "CASH_MOVEMENT"
  | "RECEIVABLES"
  | "PAYABLES"
  | "RECEIVABLE_AGING"
  | "PAYABLE_AGING"
  | "CUSTOMER_STATEMENT"
  | "CUSTOMER_LEDGER"
  | "SUPPLIER_STATEMENT"
  | "SUPPLIER_LEDGER"
  | "CATEGORY_SUMMARY"
  | "PAYMENT_METHOD_SUMMARY"
  | "DAILY_SUMMARY"
  | "MONTHLY_SUMMARY"
  | "MANAGEMENT_SUMMARY";

export interface GeneratePdfOptions {
  businessId: string;
  userId: string;
  userRoles: string[];
  userPermissions: string[];
  reportType: PdfReportType;
  filters: TransactionFilterParams;
  customerId?: string;
  supplierId?: string;
  isConfidential?: boolean;
  isDraft?: boolean;
  includeCharts?: boolean;
  includeNotes?: boolean;
}

export interface GeneratedPdfResult {
  historyId: string;
  fileName: string;
  fileBuffer: Buffer;
  fileSize: number;
  mimeType: string;
  reportReference: string;
}

export class PdfReportService {
  /**
   * Validate authorization permissions before generating PDF reports.
   */
  public static validatePermissions(
    reportType: PdfReportType,
    permissions: string[],
    roles: string[]
  ): void {
    const isOwnerOrAdmin = roles.includes("OWNER") || roles.includes("ADMIN");

    const hasReportsView =
      isOwnerOrAdmin ||
      hasPermission(permissions, roles, PERMISSIONS.REPORTS_VIEW) ||
      hasPermission(permissions, roles, PERMISSIONS.EXPORTS_EXECUTE);

    if (!hasReportsView) {
      throw new AppError("Forbidden: Insufficient permissions to generate reports.", 403);
    }

    if (reportType === "MANAGEMENT_SUMMARY") {
      const canManage = isOwnerOrAdmin || permissions.includes("reports.management") || permissions.includes("*");
      if (!canManage) {
        throw new AppError("Forbidden: reports.management required.", 403);
      }
    }

    if (
      reportType === "RECEIVABLES" ||
      reportType === "RECEIVABLE_AGING" ||
      reportType === "CUSTOMER_LEDGER" ||
      reportType === "CUSTOMER_STATEMENT"
    ) {
      const canViewRec =
        isOwnerOrAdmin ||
        permissions.includes("receivables.view") ||
        permissions.includes("customers.view") ||
        permissions.includes("*");
      if (!canViewRec) throw new AppError("Forbidden: receivables.view or customers.view required.", 403);
    }

    if (
      reportType === "PAYABLES" ||
      reportType === "PAYABLE_AGING" ||
      reportType === "SUPPLIER_LEDGER" ||
      reportType === "SUPPLIER_STATEMENT"
    ) {
      const canViewPay =
        isOwnerOrAdmin ||
        permissions.includes("payables.view") ||
        permissions.includes("suppliers.view") ||
        permissions.includes("*");
      if (!canViewPay) throw new AppError("Forbidden: payables.view or suppliers.view required.", 403);
    }
  }

  /**
   * Main entry point: Generates, stores, audits, and returns a verified PDF report.
   */
  public static async generateReport(options: GeneratePdfOptions): Promise<GeneratedPdfResult> {
    const {
      businessId,
      userId,
      userRoles,
      userPermissions,
      reportType,
      filters,
      customerId,
      supplierId,
      isConfidential = false,
      isDraft = false,
    } = options;

    // 1. Validate authorization
    this.validatePermissions(reportType, userPermissions, userRoles);

    // 2. Fetch business context
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        legalName: true,
        currency: true,
        currencySymbol: true,
        timezone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        phone: true,
        email: true,
        gstin: true,
        logoUrl: true,
      },
    });

    if (!business) {
      throw new NotFoundError("Business context not found.");
    }

    // 3. Generate safe sequential report reference
    const year = new Date().getFullYear();
    const reportReference = await NumberingService.getNextSequenceNumber(
      businessId,
      "REPORT",
      "RPT",
      year
    );

    // 4. Determine layout orientation
    const isLandscape = [
      "TRANSACTIONS",
      "RECEIVABLES",
      "PAYABLES",
      "RECEIVABLE_AGING",
      "PAYABLE_AGING",
      "CUSTOMER_LEDGER",
      "SUPPLIER_LEDGER",
      "MONTHLY_ACCOUNTING",
      "MONTHLY_SUMMARY",
    ].includes(reportType);

    // 5. Initialize PDFKit document
    const doc = new PDFDocument({
      size: "A4",
      layout: isLandscape ? "landscape" : "portrait",
      margin: 36,
      bufferPages: true,
    });

    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));

    const fonts = setupPdfFonts(doc);

    // Base header options
    const headerOpts: PdfHeaderOptions = {
      business: {
        name: business.name,
        legalName: business.legalName,
        email: business.email,
        phone: business.phone,
        addressLine1: business.addressLine1,
        addressLine2: business.addressLine2,
        city: business.city,
        state: business.state,
        postalCode: business.postalCode,
        gstin: business.gstin,
        logoUrl: business.logoUrl,
      },
      reportTitle: this.getReportTitle(reportType),
      periodLabel: this.resolvePeriodLabel(filters),
      reportReference,
      accountingBasis: "Accrual",
      isConfidential,
      isDraft,
    };

    // 6. Delegate to specific report builder using ReportDataService
    await this.renderReportContent(doc, fonts, reportType, filters, headerOpts, {
      customerId,
      supplierId,
      businessId,
    });

    // 7. Finalize running headers/footers with accurate "Page X of Y"
    PdfBuilder.finalizeFooters(
      doc,
      fonts,
      business.name,
      reportReference,
      isConfidential,
      business.timezone || "IST"
    );

    // 8. Finalize stream to Buffer
    const fileBuffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.end();
    });

    // 9. Multi-tenant private file storage
    const sanitizedTitle = reportType.toLowerCase().replace(/_/g, "-");
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `${sanitizedTitle}_${dateStamp}_${reportReference}.pdf`;

    const storageBase = process.env.STORAGE_PATH
      ? process.env.STORAGE_PATH
      : process.env.VERCEL
      ? path.join("/tmp", "storage")
      : path.join(process.cwd(), "storage");
    const storageDir = path.join(storageBase, "reports", businessId);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const storageKey = path.join(storageDir, `${Date.now()}_${crypto.randomUUID()}.pdf`);
    fs.writeFileSync(storageKey, fileBuffer);

    // 10. Record ReportHistory
    const history = await prisma.reportHistory.create({
      data: {
        businessId,
        reportType,
        periodStart: filters.startDate || new Date(year, 0, 1),
        periodEnd: filters.endDate || new Date(year, 11, 31),
        parameters: {
          ...filters,
          reportReference,
          customerId,
          supplierId,
          isConfidential,
          isDraft,
        },
        format: "PDF",
        storageKey,
        generatedBy: userId,
      },
    });

    // 11. Record Audit Log
    await AuditService.log({
      businessId,
      userId,
      action: "EXPORT",
      entityType: "REPORT",
      entityId: history.id,
      reason: `Generated PDF report: ${headerOpts.reportTitle} (${reportReference})`,
      newValues: {
        reportType,
        format: "PDF",
        reportReference,
        fileSize: fileBuffer.length,
      },
    });

    return {
      historyId: history.id,
      fileName,
      fileBuffer,
      fileSize: fileBuffer.length,
      mimeType: "application/pdf",
      reportReference,
    };
  }

  /**
   * Route specific report drawing to corresponding renderer.
   */
  private static async renderReportContent(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    reportType: PdfReportType,
    filters: TransactionFilterParams,
    headerOpts: PdfHeaderOptions,
    context: { customerId?: string; supplierId?: string; businessId: string }
  ): Promise<void> {
    switch (reportType) {
      case "MONTHLY_ACCOUNTING": {
        const data = await ReportDataService.getMonthlyWorkbookData(filters);
        this.renderMonthlyAccounting(doc, fonts, data, headerOpts);
        break;
      }
      case "FINANCIAL_SUMMARY": {
        const data = await ReportDataService.getFinancialSummaryReport(filters);
        this.renderFinancialSummary(doc, fonts, data, headerOpts);
        break;
      }
      case "INCOME": {
        const rows = await ReportDataService.getIncomeReport(filters);
        this.renderIncomeReport(doc, fonts, rows, headerOpts);
        break;
      }
      case "EXPENSES": {
        const rows = await ReportDataService.getExpenseReport(filters);
        this.renderExpenseReport(doc, fonts, rows, headerOpts);
        break;
      }
      case "TRANSACTIONS": {
        const rows = await ReportDataService.getTransactionReport(filters);
        this.renderTransactionsReport(doc, fonts, rows, headerOpts);
        break;
      }
      case "PAYMENTS": {
        const rows = await ReportDataService.getPaymentReport(filters);
        this.renderPaymentsReport(doc, fonts, rows, headerOpts);
        break;
      }
      case "CASH_MOVEMENT": {
        const data = await ReportDataService.getCashMovementReport(filters);
        this.renderCashMovementReport(doc, fonts, data, headerOpts);
        break;
      }
      case "RECEIVABLES": {
        const rows = await ReportDataService.getReceivableReport(filters);
        this.renderReceivablesReport(doc, fonts, rows, headerOpts);
        break;
      }
      case "PAYABLES": {
        const rows = await ReportDataService.getPayableReport(filters);
        this.renderPayablesReport(doc, fonts, rows, headerOpts);
        break;
      }
      case "RECEIVABLE_AGING": {
        const rows = await ReportDataService.getReceivableAgingReport(filters);
        this.renderAgingReport(doc, fonts, rows, headerOpts, "Customer");
        break;
      }
      case "PAYABLE_AGING": {
        const rows = await ReportDataService.getPayableAgingReport(filters);
        this.renderAgingReport(doc, fonts, rows, headerOpts, "Supplier");
        break;
      }
      case "CUSTOMER_STATEMENT": {
        if (!context.customerId) throw new AppError("CustomerId required for Customer Statement", 400);
        const data = await ReportDataService.getCustomerLedgerReport(
          context.businessId,
          context.customerId,
          filters.startDate,
          filters.endDate
        );
        this.renderCustomerStatement(doc, fonts, data, headerOpts);
        break;
      }
      case "CUSTOMER_LEDGER": {
        if (!context.customerId) throw new AppError("CustomerId required for Customer Ledger", 400);
        const data = await ReportDataService.getCustomerLedgerReport(
          context.businessId,
          context.customerId,
          filters.startDate,
          filters.endDate
        );
        this.renderCustomerLedger(doc, fonts, data, headerOpts);
        break;
      }
      case "SUPPLIER_STATEMENT": {
        if (!context.supplierId) throw new AppError("SupplierId required for Supplier Statement", 400);
        const data = await ReportDataService.getSupplierLedgerReport(
          context.businessId,
          context.supplierId,
          filters.startDate,
          filters.endDate
        );
        this.renderSupplierStatement(doc, fonts, data, headerOpts);
        break;
      }
      case "SUPPLIER_LEDGER": {
        if (!context.supplierId) throw new AppError("SupplierId required for Supplier Ledger", 400);
        const data = await ReportDataService.getSupplierLedgerReport(
          context.businessId,
          context.supplierId,
          filters.startDate,
          filters.endDate
        );
        this.renderSupplierLedger(doc, fonts, data, headerOpts);
        break;
      }
      case "CATEGORY_SUMMARY": {
        const rows = await ReportDataService.getCategoryReport(filters);
        this.renderCategorySummaryReport(doc, fonts, rows, headerOpts);
        break;
      }
      case "PAYMENT_METHOD_SUMMARY": {
        const rows = await ReportDataService.getPaymentMethodReport(filters);
        this.renderPaymentMethodSummaryReport(doc, fonts, rows, headerOpts);
        break;
      }
      case "DAILY_SUMMARY": {
        const rows = await ReportDataService.getDailySummaryReport(filters);
        this.renderDailySummaryReport(doc, fonts, rows, headerOpts);
        break;
      }
      case "MONTHLY_SUMMARY": {
        const rows = await ReportDataService.getMonthlyAnalysisReport(filters);
        this.renderMonthlySummaryReport(doc, fonts, rows, headerOpts);
        break;
      }
      case "MANAGEMENT_SUMMARY": {
        const data = await ReportDataService.getManagementSummaryReport(filters);
        this.renderManagementSummaryReport(doc, fonts, data, headerOpts);
        break;
      }
    }
  }

  // =========================================================================
  // REPORT RENDERERS
  // =========================================================================

  public static renderMonthlyAccounting(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    data: MonthlyWorkbookDataDTO,
    headerOpts: PdfHeaderOptions
  ): void {
    // 1. Page 1 — Executive Financial Summary
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    const cards: PdfKPICard[] = [
      { label: "Opening Balance", value: formatPdfMoney(data.summary.openingBalance), color: PDF_COLORS.secondaryText },
      { label: "Total Revenue", value: formatPdfMoney(data.summary.totalIncome), color: PDF_COLORS.incomeGreen },
      { label: "Total Expenses", value: formatPdfMoney(data.summary.totalExpenses), color: PDF_COLORS.expenseRed },
      { label: "Net Profit / Deficit", value: formatPdfMoney(data.summary.netResult), color: data.summary.netResult.isPositive() ? PDF_COLORS.incomeGreen : PDF_COLORS.expenseRed },
      { label: "Money Received", value: formatPdfMoney(data.summary.moneyReceived), color: PDF_COLORS.incomeGreen },
      { label: "Money Paid", value: formatPdfMoney(data.summary.moneyPaid), color: PDF_COLORS.expenseRed },
      { label: "Receivables", value: formatPdfMoney(data.summary.receivablesOutstanding), color: PDF_COLORS.amber },
      { label: "Payables", value: formatPdfMoney(data.summary.payablesOutstanding), color: PDF_COLORS.purple },
      { label: "Closing Liquidity", value: formatPdfMoney(data.summary.closingBalance), color: PDF_COLORS.netBlue },
    ];

    PdfBuilder.drawSectionTitle(doc, fonts, "Executive Financial Overview");
    PdfBuilder.drawKPICards(doc, fonts, cards.slice(0, 4));
    PdfBuilder.drawKPICards(doc, fonts, cards.slice(4, 7));
    PdfBuilder.drawKPICards(doc, fonts, cards.slice(7));

    // Category Distribution Bars
    if (data.categorySummary.length > 0) {
      const distItems = data.categorySummary.slice(0, 5).map((c) => {
        const catAmt = c.type === "INCOME" ? c.incomeAmount : c.expenseAmount;
        return {
          label: c.name,
          amountStr: formatPdfMoney(catAmt),
          percentage: c.percentageOfTotal,
          color: c.type === "INCOME" ? PDF_COLORS.incomeGreen : PDF_COLORS.expenseRed,
        };
      });
      PdfBuilder.drawBarDistribution(doc, fonts, "Top Business Categories", distItems);
    }

    // 2. Income Section Table
    doc.addPage();
    PdfBuilder.drawHeader(doc, fonts, { ...headerOpts, reportTitle: "Monthly Accounting — Income Details" });
    const incCols: PdfTableColumn[] = [
      { id: "date", header: "Date", width: 70 },
      { id: "number", header: "Txn #", width: 90 },
      { id: "party", header: "Customer", width: 140 },
      { id: "category", header: "Category", width: 110 },
      { id: "ref", header: "Reference", width: 110 },
      { id: "amount", header: "Amount", width: 90, align: "right" },
      { id: "status", header: "Status", width: 70, align: "center" },
    ];
    PdfBuilder.drawTable(doc, fonts, {
      title: "Recognized Income Records",
      columns: incCols,
      rows: data.incomeRows.slice(0, 30).map((r) => ({
        date: formatPdfDate(r.date),
        number: r.transactionNumber,
        party: r.partyName,
        category: r.categoryName,
        ref: r.referenceNumber || "-",
        amount: formatPdfMoney(r.amount),
        status: r.paymentStatus,
      })),
      summaryRow: {
        party: "TOTAL INCOME",
        amount: formatPdfMoney(data.summary.totalIncome),
      },
    });

    // 3. Expense Section Table
    doc.addPage();
    PdfBuilder.drawHeader(doc, fonts, { ...headerOpts, reportTitle: "Monthly Accounting — Expense Details" });
    const expCols: PdfTableColumn[] = [
      { id: "date", header: "Date", width: 70 },
      { id: "number", header: "Txn #", width: 90 },
      { id: "party", header: "Supplier", width: 140 },
      { id: "category", header: "Category", width: 110 },
      { id: "ref", header: "Reference", width: 110 },
      { id: "amount", header: "Amount", width: 90, align: "right" },
      { id: "status", header: "Status", width: 70, align: "center" },
    ];
    PdfBuilder.drawTable(doc, fonts, {
      title: "Recognized Expense Records",
      columns: expCols,
      rows: data.expenseRows.slice(0, 30).map((r) => ({
        date: formatPdfDate(r.date),
        number: r.transactionNumber,
        party: r.partyName,
        category: r.categoryName,
        ref: r.referenceNumber || "-",
        amount: formatPdfMoney(r.amount),
        status: r.paymentStatus,
      })),
      summaryRow: {
        party: "TOTAL EXPENSES",
        amount: formatPdfMoney(data.summary.totalExpenses),
      },
    });

    // 4. Receivables & Payables Table
    doc.addPage();
    PdfBuilder.drawHeader(doc, fonts, { ...headerOpts, reportTitle: "Monthly Accounting — Outstanding Balances" });
    const recCols: PdfTableColumn[] = [
      { id: "party", header: "Customer / Supplier", width: 160 },
      { id: "code", header: "Code", width: 80 },
      { id: "txnCount", header: "Count", width: 60, align: "center" },
      { id: "billed", header: "Total Billed", width: 100, align: "right" },
      { id: "paid", header: "Total Settled", width: 100, align: "right" },
      { id: "outstanding", header: "Outstanding", width: 100, align: "right" },
    ];
    PdfBuilder.drawTable(doc, fonts, {
      title: "Customer Receivables Summary",
      columns: recCols,
      rows: data.customerSummary.slice(0, 20).map((c) => ({
        party: c.name,
        code: c.code,
        txnCount: c.transactionCount,
        billed: formatPdfMoney(c.totalBilled),
        paid: formatPdfMoney(c.totalPaid),
        outstanding: formatPdfMoney(c.outstanding),
      })),
      summaryRow: {
        party: "TOTAL RECEIVABLES",
        outstanding: formatPdfMoney(data.summary.receivablesOutstanding),
      },
    });
  }

  public static renderFinancialSummary(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    data: FinancialSummaryReportDTO,
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    const cards: PdfKPICard[] = [
      { label: "Opening Liquidity", value: formatPdfMoney(data.openingBalance), color: PDF_COLORS.secondaryText },
      { label: "Total Income", value: formatPdfMoney(data.totalIncome), color: PDF_COLORS.incomeGreen },
      { label: "Total Expenses", value: formatPdfMoney(data.totalExpenses), color: PDF_COLORS.expenseRed },
      { label: "Net Result", value: formatPdfMoney(data.netResult), color: data.netResult.isPositive() ? PDF_COLORS.incomeGreen : PDF_COLORS.expenseRed },
    ];
    PdfBuilder.drawSectionTitle(doc, fonts, "Performance Summary");
    PdfBuilder.drawKPICards(doc, fonts, cards);

    const cards2: PdfKPICard[] = [
      { label: "Cash Inflow", value: formatPdfMoney(data.moneyReceived), color: PDF_COLORS.incomeGreen },
      { label: "Cash Outflow", value: formatPdfMoney(data.moneyPaid), color: PDF_COLORS.expenseRed },
      { label: "Net Cash Flow", value: formatPdfMoney(data.netCashFlow), color: data.netCashFlow.isPositive() ? PDF_COLORS.incomeGreen : PDF_COLORS.expenseRed },
      { label: "Closing Liquidity", value: formatPdfMoney(data.closingBalance), color: PDF_COLORS.netBlue },
    ];
    PdfBuilder.drawSectionTitle(doc, fonts, "Cash Movement Overview");
    PdfBuilder.drawKPICards(doc, fonts, cards2);

    const cards3: PdfKPICard[] = [
      { label: "Customer Receivables", value: formatPdfMoney(data.receivablesOutstanding), color: PDF_COLORS.amber },
      { label: "Supplier Payables", value: formatPdfMoney(data.payablesOutstanding), color: PDF_COLORS.purple },
      { label: "Transaction Count", value: String(data.transactionCount), color: PDF_COLORS.secondaryText },
    ];
    PdfBuilder.drawSectionTitle(doc, fonts, "Outstanding Position");
    PdfBuilder.drawKPICards(doc, fonts, cards3);

    // Summary Table
    const summaryRows = [
      { metric: "Opening Cash & Bank Balance", amount: formatPdfMoney(data.openingBalance), notes: "Start of period liquidity" },
      { metric: "Total Accrued Income", amount: formatPdfMoney(data.totalIncome), notes: "Recognized sales & service revenue" },
      { metric: "Total Accrued Expenses", amount: formatPdfMoney(data.totalExpenses), notes: "Recognized vendor & operational expenses" },
      { metric: "Net Accounting Result", amount: formatPdfMoney(data.netResult), notes: "Revenue minus Expenses" },
      { metric: "Cash & Bank Inflow", amount: formatPdfMoney(data.moneyReceived), notes: "Payments collected in period" },
      { metric: "Cash & Bank Outflow", amount: formatPdfMoney(data.moneyPaid), notes: "Payments disbursed in period" },
      { metric: "Net Cash Flow", amount: formatPdfMoney(data.netCashFlow), notes: "Inflow minus Outflow" },
      { metric: "Customer Receivables", amount: formatPdfMoney(data.receivablesOutstanding), notes: "Uncollected customer balances" },
      { metric: "Supplier Payables", amount: formatPdfMoney(data.payablesOutstanding), notes: "Unpaid vendor bills" },
      { metric: "Closing Cash & Bank Balance", amount: formatPdfMoney(data.closingBalance), notes: "End of period verified liquidity" },
    ];

    PdfBuilder.drawTable(doc, fonts, {
      title: "Authoritative Accounting Reconciliation Table",
      columns: [
        { id: "metric", header: "Financial Indicator", width: 220 },
        { id: "amount", header: "Amount", width: 120, align: "right" },
        { id: "notes", header: "Description / Accounting Basis", width: 180 },
      ],
      rows: summaryRows,
    });
  }

  public static renderIncomeReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    rows: TransactionReportRowDTO[],
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    let total = Money.zero();
    rows.forEach((r) => (total = total.add(r.amount)));

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Total Recognized Income", value: formatPdfMoney(total), color: PDF_COLORS.incomeGreen },
      { label: "Transaction Count", value: String(rows.length), color: PDF_COLORS.secondaryText },
    ]);

    PdfBuilder.drawTable(doc, fonts, {
      columns: [
        { id: "date", header: "Date", width: 65 },
        { id: "number", header: "Txn #", width: 85 },
        { id: "party", header: "Customer", width: 110 },
        { id: "category", header: "Category", width: 85 },
        { id: "desc", header: "Description", width: 120 },
        { id: "ref", header: "Ref", width: 65 },
        { id: "amount", header: "Amount", width: 75, align: "right" },
        { id: "status", header: "Status", width: 65, align: "center" },
      ],
      rows: rows.map((r) => ({
        date: formatPdfDate(r.date),
        number: r.transactionNumber,
        party: r.partyName,
        category: r.categoryName,
        desc: r.description || "-",
        ref: r.referenceNumber || "-",
        amount: formatPdfMoney(r.amount),
        status: r.paymentStatus,
      })),
      summaryRow: {
        desc: "TOTAL INCOME",
        amount: formatPdfMoney(total),
      },
    });
  }

  public static renderExpenseReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    rows: TransactionReportRowDTO[],
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    let total = Money.zero();
    rows.forEach((r) => (total = total.add(r.amount)));

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Total Recognized Expenses", value: formatPdfMoney(total), color: PDF_COLORS.expenseRed },
      { label: "Transaction Count", value: String(rows.length), color: PDF_COLORS.secondaryText },
    ]);

    PdfBuilder.drawTable(doc, fonts, {
      columns: [
        { id: "date", header: "Date", width: 65 },
        { id: "number", header: "Txn #", width: 85 },
        { id: "party", header: "Supplier", width: 110 },
        { id: "category", header: "Category", width: 85 },
        { id: "desc", header: "Description", width: 120 },
        { id: "ref", header: "Ref", width: 65 },
        { id: "amount", header: "Amount", width: 75, align: "right" },
        { id: "status", header: "Status", width: 65, align: "center" },
      ],
      rows: rows.map((r) => ({
        date: formatPdfDate(r.date),
        number: r.transactionNumber,
        party: r.partyName,
        category: r.categoryName,
        desc: r.description || "-",
        ref: r.referenceNumber || "-",
        amount: formatPdfMoney(r.amount),
        status: r.paymentStatus,
      })),
      summaryRow: {
        desc: "TOTAL EXPENSES",
        amount: formatPdfMoney(total),
      },
    });
  }

  public static renderTransactionsReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    rows: TransactionReportRowDTO[],
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    let total = Money.zero();
    rows.forEach((r) => (total = total.add(r.amount)));

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Total Transactions Volume", value: formatPdfMoney(total), color: PDF_COLORS.netBlue },
      { label: "Record Count", value: String(rows.length), color: PDF_COLORS.secondaryText },
    ]);

    PdfBuilder.drawTable(doc, fonts, {
      columns: [
        { id: "date", header: "Date", width: 65 },
        { id: "number", header: "Txn #", width: 85 },
        { id: "type", header: "Type", width: 70 },
        { id: "party", header: "Party", width: 120 },
        { id: "category", header: "Category", width: 90 },
        { id: "desc", header: "Description", width: 140 },
        { id: "ref", header: "Ref #", width: 70 },
        { id: "amount", header: "Amount", width: 80, align: "right" },
        { id: "status", header: "Status", width: 65, align: "center" },
      ],
      rows: rows.map((r) => ({
        date: formatPdfDate(r.date),
        number: r.transactionNumber,
        type: r.type,
        party: r.partyName,
        category: r.categoryName,
        desc: r.description || "-",
        ref: r.referenceNumber || "-",
        amount: formatPdfMoney(r.amount),
        status: r.status,
      })),
      summaryRow: {
        desc: "TOTAL AMOUNT",
        amount: formatPdfMoney(total),
      },
    });
  }

  public static renderPaymentsReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    rows: PaymentReportRowDTO[],
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    let totalIn = Money.zero();
    let totalOut = Money.zero();
    rows.forEach((p) => {
      if (p.direction === "IN") totalIn = totalIn.add(p.amount);
      else totalOut = totalOut.add(p.amount);
    });

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Money Received (IN)", value: formatPdfMoney(totalIn), color: PDF_COLORS.incomeGreen },
      { label: "Money Paid (OUT)", value: formatPdfMoney(totalOut), color: PDF_COLORS.expenseRed },
      { label: "Net Cash Movement", value: formatPdfMoney(totalIn.minus(totalOut)), color: PDF_COLORS.netBlue },
      { label: "Payment Records", value: String(rows.length), color: PDF_COLORS.secondaryText },
    ]);

    PdfBuilder.drawTable(doc, fonts, {
      columns: [
        { id: "date", header: "Date", width: 65 },
        { id: "number", header: "Payment #", width: 85 },
        { id: "direction", header: "Direction", width: 60, align: "center" },
        { id: "party", header: "Party Name", width: 130 },
        { id: "method", header: "Method", width: 85 },
        { id: "ref", header: "Reference", width: 75 },
        { id: "amount", header: "Amount", width: 80, align: "right" },
        { id: "allocated", header: "Allocated", width: 80, align: "right" },
        { id: "unapplied", header: "Unapplied", width: 75, align: "right" },
        { id: "status", header: "Status", width: 60, align: "center" },
      ],
      rows: rows.map((p) => ({
        date: formatPdfDate(p.date),
        number: p.paymentNumber,
        direction: p.direction,
        party: p.partyName,
        method: p.paymentMethod,
        ref: p.referenceNumber || "-",
        amount: formatPdfMoney(p.amount),
        allocated: formatPdfMoney(p.allocatedAmount),
        unapplied: formatPdfMoney(p.unappliedAmount),
        status: p.status,
      })),
      summaryRow: {
        ref: "TOTAL IN / OUT",
        amount: `+${formatPdfMoney(totalIn)} / -${formatPdfMoney(totalOut)}`,
      },
    });
  }

  public static renderCashMovementReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    data: CashMovementReportDTO,
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Opening Cash/Bank", value: formatPdfMoney(data.openingBalance), color: PDF_COLORS.secondaryText },
      { label: "Total Inflow", value: formatPdfMoney(data.totalInflow), color: PDF_COLORS.incomeGreen },
      { label: "Total Outflow", value: formatPdfMoney(data.totalOutflow), color: PDF_COLORS.expenseRed },
      { label: "Net Cash Flow", value: formatPdfMoney(data.netCashMovement), color: data.netCashMovement.isPositive() ? PDF_COLORS.incomeGreen : PDF_COLORS.expenseRed },
      { label: "Closing Liquidity", value: formatPdfMoney(data.closingBalance), color: PDF_COLORS.netBlue },
    ]);

    PdfBuilder.drawTable(doc, fonts, {
      title: "Cash Movement by Payment Method",
      columns: [
        { id: "method", header: "Payment Method / Account", width: 180 },
        { id: "type", header: "Account Type", width: 100 },
        { id: "inflow", header: "Money Received", width: 120, align: "right" },
        { id: "outflow", header: "Money Paid", width: 120, align: "right" },
        { id: "net", header: "Net Flow", width: 120, align: "right" },
      ],
      rows: data.paymentMethods.map((m) => ({
        method: m.name,
        type: m.type,
        inflow: formatPdfMoney(m.inflow),
        outflow: formatPdfMoney(m.outflow),
        net: formatPdfMoney(m.netFlow),
      })),
      summaryRow: {
        method: "TOTAL CASH MOVEMENT",
        inflow: formatPdfMoney(data.totalInflow),
        outflow: formatPdfMoney(data.totalOutflow),
        net: formatPdfMoney(data.netCashMovement),
      },
    });
  }

  public static renderReceivablesReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    rows: TransactionReportRowDTO[],
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    let totalOriginal = Money.zero();
    let totalPaid = Money.zero();
    let totalOut = Money.zero();

    rows.forEach((r) => {
      totalOriginal = totalOriginal.add(r.amount);
      totalPaid = totalPaid.add(r.paidAmount);
      totalOut = totalOut.add(r.outstandingAmount);
    });

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Total Invoiced", value: formatPdfMoney(totalOriginal), color: PDF_COLORS.secondaryText },
      { label: "Total Settled", value: formatPdfMoney(totalPaid), color: PDF_COLORS.incomeGreen },
      { label: "Outstanding Receivables", value: formatPdfMoney(totalOut), color: PDF_COLORS.amber },
      { label: "Unsettled Invoices", value: String(rows.length), color: PDF_COLORS.secondaryText },
    ]);

    PdfBuilder.drawTable(doc, fonts, {
      columns: [
        { id: "date", header: "Invoice Date", width: 65 },
        { id: "number", header: "Invoice #", width: 80 },
        { id: "customer", header: "Customer Name", width: 130 },
        { id: "ref", header: "Ref #", width: 70 },
        { id: "due", header: "Due Date", width: 65 },
        { id: "overdue", header: "Overdue", width: 55, align: "center" },
        { id: "original", header: "Original", width: 75, align: "right" },
        { id: "paid", header: "Paid", width: 70, align: "right" },
        { id: "outstanding", header: "Outstanding", width: 80, align: "right" },
        { id: "status", header: "Status", width: 70, align: "center" },
      ],
      rows: rows.map((r) => ({
        date: formatPdfDate(r.date),
        number: r.transactionNumber,
        customer: r.partyName,
        ref: r.referenceNumber || "-",
        due: formatPdfDate(r.dueDate),
        overdue: r.daysOverdue > 0 ? `${r.daysOverdue}d` : "Current",
        original: formatPdfMoney(r.amount),
        paid: formatPdfMoney(r.paidAmount),
        outstanding: formatPdfMoney(r.outstandingAmount),
        status: r.paymentStatus,
      })),
      summaryRow: {
        ref: "TOTAL",
        original: formatPdfMoney(totalOriginal),
        paid: formatPdfMoney(totalPaid),
        outstanding: formatPdfMoney(totalOut),
      },
    });
  }

  public static renderPayablesReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    rows: TransactionReportRowDTO[],
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    let totalOriginal = Money.zero();
    let totalPaid = Money.zero();
    let totalOut = Money.zero();

    rows.forEach((r) => {
      totalOriginal = totalOriginal.add(r.amount);
      totalPaid = totalPaid.add(r.paidAmount);
      totalOut = totalOut.add(r.outstandingAmount);
    });

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Total Billed", value: formatPdfMoney(totalOriginal), color: PDF_COLORS.secondaryText },
      { label: "Total Disbursed", value: formatPdfMoney(totalPaid), color: PDF_COLORS.expenseRed },
      { label: "Outstanding Payables", value: formatPdfMoney(totalOut), color: PDF_COLORS.purple },
      { label: "Pending Bills", value: String(rows.length), color: PDF_COLORS.secondaryText },
    ]);

    PdfBuilder.drawTable(doc, fonts, {
      columns: [
        { id: "date", header: "Bill Date", width: 65 },
        { id: "number", header: "Bill #", width: 80 },
        { id: "supplier", header: "Supplier Name", width: 130 },
        { id: "ref", header: "Ref #", width: 70 },
        { id: "due", header: "Due Date", width: 65 },
        { id: "overdue", header: "Overdue", width: 55, align: "center" },
        { id: "original", header: "Original", width: 75, align: "right" },
        { id: "paid", header: "Paid", width: 70, align: "right" },
        { id: "outstanding", header: "Outstanding", width: 80, align: "right" },
        { id: "status", header: "Status", width: 70, align: "center" },
      ],
      rows: rows.map((r) => ({
        date: formatPdfDate(r.date),
        number: r.transactionNumber,
        supplier: r.partyName,
        ref: r.referenceNumber || "-",
        due: formatPdfDate(r.dueDate),
        overdue: r.daysOverdue > 0 ? `${r.daysOverdue}d` : "Current",
        original: formatPdfMoney(r.amount),
        paid: formatPdfMoney(r.paidAmount),
        outstanding: formatPdfMoney(r.outstandingAmount),
        status: r.paymentStatus,
      })),
      summaryRow: {
        ref: "TOTAL",
        original: formatPdfMoney(totalOriginal),
        paid: formatPdfMoney(totalPaid),
        outstanding: formatPdfMoney(totalOut),
      },
    });
  }

  public static renderAgingReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    rows: AgingScheduleReportRowDTO[],
    headerOpts: PdfHeaderOptions,
    partyType: "Customer" | "Supplier"
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    let grandTotal = Money.zero();
    let currentTotal = Money.zero();
    let d1Total = Money.zero();
    let d2Total = Money.zero();
    let d3Total = Money.zero();
    let d4Total = Money.zero();

    rows.forEach((r) => {
      grandTotal = grandTotal.add(r.totalOutstanding);
      currentTotal = currentTotal.add(r.current);
      d1Total = d1Total.add(r.days1To30);
      d2Total = d2Total.add(r.days31To60);
      d3Total = d3Total.add(r.days61To90);
      d4Total = d4Total.add(r.days90Plus);
    });

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: `Total ${partyType} Balance`, value: formatPdfMoney(grandTotal), color: PDF_COLORS.amber },
      { label: "Current (Not Due)", value: formatPdfMoney(currentTotal), color: PDF_COLORS.incomeGreen },
      { label: "1 - 30 Days", value: formatPdfMoney(d1Total), color: PDF_COLORS.netBlue },
      { label: "31 - 60 Days", value: formatPdfMoney(d2Total), color: PDF_COLORS.amber },
      { label: "61 - 90 Days", value: formatPdfMoney(d3Total), color: PDF_COLORS.expenseRed },
      { label: "90+ Days Overdue", value: formatPdfMoney(d4Total), color: "#991b1b" },
    ]);

    PdfBuilder.drawTable(doc, fonts, {
      title: `${partyType} Aging Analysis Schedule`,
      columns: [
        { id: "name", header: `${partyType} Name`, width: 170 },
        { id: "code", header: "Code", width: 80 },
        { id: "cur", header: "Current", width: 80, align: "right" },
        { id: "d1", header: "1 - 30 Days", width: 80, align: "right" },
        { id: "d2", header: "31 - 60 Days", width: 80, align: "right" },
        { id: "d3", header: "61 - 90 Days", width: 80, align: "right" },
        { id: "d4", header: "90+ Days", width: 80, align: "right" },
        { id: "total", header: "Total Outstanding", width: 95, align: "right" },
      ],
      rows: rows.map((r) => ({
        name: r.partyName,
        code: r.partyCode,
        cur: formatPdfMoney(r.current),
        d1: formatPdfMoney(r.days1To30),
        d2: formatPdfMoney(r.days31To60),
        d3: formatPdfMoney(r.days61To90),
        d4: formatPdfMoney(r.days90Plus),
        total: formatPdfMoney(r.totalOutstanding),
      })),
      summaryRow: {
        code: "GRAND TOTAL",
        cur: formatPdfMoney(currentTotal),
        d1: formatPdfMoney(d1Total),
        d2: formatPdfMoney(d2Total),
        d3: formatPdfMoney(d3Total),
        d4: formatPdfMoney(d4Total),
        total: formatPdfMoney(grandTotal),
      },
    });
  }

  public static renderCustomerStatement(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    data: CustomerLedgerResult,
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, {
      ...headerOpts,
      reportTitle: "Customer Account Statement",
    });

    const leftX = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Customer Billing Box
    const boxY = doc.y;
    doc.roundedRect(leftX, boxY, usableWidth, 54, 4).fillColor(PDF_COLORS.cardBg).fill();
    doc.roundedRect(leftX, boxY, usableWidth, 54, 4).strokeColor(PDF_COLORS.borderLight).lineWidth(1).stroke();

    doc.font(fonts.bold).fontSize(9).fillColor(PDF_COLORS.mutedText);
    doc.text("STATEMENT RECIPIENT (CUSTOMER)", leftX + 10, boxY + 8);

    doc.font(fonts.bold).fontSize(12).fillColor(PDF_COLORS.primaryText);
    doc.text(data.customer.name, leftX + 10, boxY + 20);

    doc.font(fonts.regular).fontSize(8.5).fillColor(PDF_COLORS.secondaryText);
    const details = [
      `Code: ${data.customer.customerCode}`,
      data.customer.companyName ? `Company: ${data.customer.companyName}` : null,
      data.customer.phone ? `Phone: ${data.customer.phone}` : null,
      data.customer.email ? `Email: ${data.customer.email}` : null,
    ].filter(Boolean).join(" | ");
    doc.text(details, leftX + 10, boxY + 36);

    doc.y = boxY + 64;

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Opening Balance", value: formatPdfMoney(data.openingBalance), color: PDF_COLORS.secondaryText },
      { label: "New Invoices / Debits", value: formatPdfMoney(data.totalDebits), color: PDF_COLORS.primaryText },
      { label: "Payments / Credits", value: formatPdfMoney(data.totalCredits), color: PDF_COLORS.incomeGreen },
      { label: "Total Amount Due", value: formatPdfMoney(data.totalOutstanding), color: PDF_COLORS.amber },
    ]);

    // Entries Table (internal notes stripped for customer privacy - Requirement 56)
    PdfBuilder.drawTable(doc, fonts, {
      title: "Statement Transaction Activity",
      columns: [
        { id: "date", header: "Date", width: 65 },
        { id: "ref", header: "Invoice / Ref #", width: 95 },
        { id: "desc", header: "Description", width: 170 },
        { id: "debit", header: "Amount (Debit)", width: 65, align: "right" },
        { id: "credit", header: "Paid (Credit)", width: 65, align: "right" },
        { id: "bal", header: "Balance", width: 65, align: "right" },
      ],
      rows: data.entries.map((e) => ({
        date: formatPdfDate(e.date),
        ref: e.referenceNumber || e.entityNumber,
        desc: e.description,
        debit: e.debit.isPositive() ? formatPdfMoney(e.debit) : "-",
        credit: e.credit.isPositive() ? formatPdfMoney(e.credit) : "-",
        bal: formatPdfMoney(e.runningBalance),
      })),
      summaryRow: {
        desc: "CLOSING BALANCE DUE",
        debit: formatPdfMoney(data.totalDebits),
        credit: formatPdfMoney(data.totalCredits),
        bal: formatPdfMoney(data.closingBalance),
      },
    });

    // Remittance Notice
    const remY = doc.y + 4;
    doc.roundedRect(leftX, remY, usableWidth, 34, 4).fillColor(PDF_COLORS.incomeLight).fill();
    doc.roundedRect(leftX, remY, usableWidth, 34, 4).strokeColor(PDF_COLORS.incomeGreen).lineWidth(0.5).stroke();

    doc.font(fonts.bold).fontSize(8.5).fillColor(PDF_COLORS.incomeGreen);
    doc.text("PAYMENT NOTICE & REMITTANCE", leftX + 10, remY + 6);
    doc.font(fonts.regular).fontSize(7.5).fillColor(PDF_COLORS.secondaryText);
    doc.text(
      "Please remit outstanding balance via Bank Transfer or UPI. Quote your Customer Code and Invoice Number with all payments.",
      leftX + 10,
      remY + 18
    );
  }

  public static renderCustomerLedger(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    data: CustomerLedgerResult,
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, {
      ...headerOpts,
      reportTitle: `Customer Ledger — ${data.customer.name} (${data.customer.customerCode})`,
    });

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Opening Balance", value: formatPdfMoney(data.openingBalance), color: PDF_COLORS.secondaryText },
      { label: "Total Debits", value: formatPdfMoney(data.totalDebits), color: PDF_COLORS.primaryText },
      { label: "Total Credits", value: formatPdfMoney(data.totalCredits), color: PDF_COLORS.incomeGreen },
      { label: "Closing Balance", value: formatPdfMoney(data.closingBalance), color: PDF_COLORS.netBlue },
    ]);

    PdfBuilder.drawTable(doc, fonts, {
      columns: [
        { id: "date", header: "Date", width: 70 },
        { id: "number", header: "Entity #", width: 100 },
        { id: "ref", header: "Ref #", width: 90 },
        { id: "desc", header: "Description / Memo", width: 220 },
        { id: "debit", header: "Debit (+)", width: 90, align: "right" },
        { id: "credit", header: "Credit (-)", width: 90, align: "right" },
        { id: "balance", header: "Running Balance", width: 105, align: "right" },
      ],
      rows: data.entries.map((e) => ({
        date: formatPdfDate(e.date),
        number: e.entityNumber,
        ref: e.referenceNumber || "-",
        desc: e.description,
        debit: e.debit.isPositive() ? formatPdfMoney(e.debit) : "-",
        credit: e.credit.isPositive() ? formatPdfMoney(e.credit) : "-",
        balance: formatPdfMoney(e.runningBalance),
      })),
      summaryRow: {
        desc: "LEDGER TOTALS",
        debit: formatPdfMoney(data.totalDebits),
        credit: formatPdfMoney(data.totalCredits),
        balance: formatPdfMoney(data.closingBalance),
      },
    });
  }

  public static renderSupplierStatement(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    data: SupplierLedgerResult,
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, {
      ...headerOpts,
      reportTitle: "Supplier Account Statement",
    });

    const leftX = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Supplier Info Box
    const boxY = doc.y;
    doc.roundedRect(leftX, boxY, usableWidth, 54, 4).fillColor(PDF_COLORS.cardBg).fill();
    doc.roundedRect(leftX, boxY, usableWidth, 54, 4).strokeColor(PDF_COLORS.borderLight).lineWidth(1).stroke();

    doc.font(fonts.bold).fontSize(9).fillColor(PDF_COLORS.mutedText);
    doc.text("SUPPLIER / VENDOR DETAILS", leftX + 10, boxY + 8);

    doc.font(fonts.bold).fontSize(12).fillColor(PDF_COLORS.primaryText);
    doc.text(data.supplier.name, leftX + 10, boxY + 20);

    doc.font(fonts.regular).fontSize(8.5).fillColor(PDF_COLORS.secondaryText);
    const details = [
      `Code: ${data.supplier.supplierCode}`,
      data.supplier.companyName ? `Company: ${data.supplier.companyName}` : null,
      data.supplier.phone ? `Phone: ${data.supplier.phone}` : null,
      data.supplier.email ? `Email: ${data.supplier.email}` : null,
    ].filter(Boolean).join(" | ");
    doc.text(details, leftX + 10, boxY + 36);

    doc.y = boxY + 64;

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Opening Balance", value: formatPdfMoney(data.openingBalance), color: PDF_COLORS.secondaryText },
      { label: "Bills (Credits)", value: formatPdfMoney(data.totalCredits), color: PDF_COLORS.expenseRed },
      { label: "Payments (Debits)", value: formatPdfMoney(data.totalDebits), color: PDF_COLORS.incomeGreen },
      { label: "Net Payable Due", value: formatPdfMoney(data.totalOutstanding), color: PDF_COLORS.purple },
    ]);

    PdfBuilder.drawTable(doc, fonts, {
      title: "Vendor Statement Activity",
      columns: [
        { id: "date", header: "Date", width: 65 },
        { id: "ref", header: "Bill / Ref #", width: 95 },
        { id: "desc", header: "Description", width: 170 },
        { id: "credit", header: "Bill (Credit)", width: 65, align: "right" },
        { id: "debit", header: "Paid (Debit)", width: 65, align: "right" },
        { id: "bal", header: "Balance", width: 65, align: "right" },
      ],
      rows: data.entries.map((e) => ({
        date: formatPdfDate(e.date),
        ref: e.referenceNumber || e.entityNumber,
        desc: e.description,
        credit: e.credit.isPositive() ? formatPdfMoney(e.credit) : "-",
        debit: e.debit.isPositive() ? formatPdfMoney(e.debit) : "-",
        bal: formatPdfMoney(e.runningBalance),
      })),
      summaryRow: {
        desc: "CLOSING PAYABLE BALANCE",
        credit: formatPdfMoney(data.totalCredits),
        debit: formatPdfMoney(data.totalDebits),
        bal: formatPdfMoney(data.closingBalance),
      },
    });
  }

  public static renderSupplierLedger(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    data: SupplierLedgerResult,
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, {
      ...headerOpts,
      reportTitle: `Supplier Ledger — ${data.supplier.name} (${data.supplier.supplierCode})`,
    });

    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Opening Balance", value: formatPdfMoney(data.openingBalance), color: PDF_COLORS.secondaryText },
      { label: "Total Bills (Credit)", value: formatPdfMoney(data.totalCredits), color: PDF_COLORS.expenseRed },
      { label: "Total Payments (Debit)", value: formatPdfMoney(data.totalDebits), color: PDF_COLORS.incomeGreen },
      { label: "Closing Balance", value: formatPdfMoney(data.closingBalance), color: PDF_COLORS.purple },
    ]);

    PdfBuilder.drawTable(doc, fonts, {
      columns: [
        { id: "date", header: "Date", width: 70 },
        { id: "number", header: "Entity #", width: 100 },
        { id: "ref", header: "Ref #", width: 90 },
        { id: "desc", header: "Description / Memo", width: 220 },
        { id: "credit", header: "Credit (+)", width: 90, align: "right" },
        { id: "debit", header: "Debit (-)", width: 90, align: "right" },
        { id: "balance", header: "Running Balance", width: 105, align: "right" },
      ],
      rows: data.entries.map((e) => ({
        date: formatPdfDate(e.date),
        number: e.entityNumber,
        ref: e.referenceNumber || "-",
        desc: e.description,
        credit: e.credit.isPositive() ? formatPdfMoney(e.credit) : "-",
        debit: e.debit.isPositive() ? formatPdfMoney(e.debit) : "-",
        balance: formatPdfMoney(e.runningBalance),
      })),
      summaryRow: {
        desc: "LEDGER TOTALS",
        credit: formatPdfMoney(data.totalCredits),
        debit: formatPdfMoney(data.totalDebits),
        balance: formatPdfMoney(data.closingBalance),
      },
    });
  }

  public static renderCategorySummaryReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    rows: CategorySummaryReportRowDTO[],
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    const incomeCats = rows.filter((r) => r.type === "INCOME");
    const expenseCats = rows.filter((r) => r.type === "EXPENSE");

    if (incomeCats.length > 0) {
      PdfBuilder.drawBarDistribution(
        doc,
        fonts,
        "Revenue Distribution by Category",
        incomeCats.map((c) => ({
          label: c.name,
          amountStr: formatPdfMoney(c.incomeAmount),
          percentage: c.percentageOfTotal,
          color: PDF_COLORS.incomeGreen,
        }))
      );
    }

    if (expenseCats.length > 0) {
      PdfBuilder.drawBarDistribution(
        doc,
        fonts,
        "Expense Distribution by Category",
        expenseCats.map((c) => ({
          label: c.name,
          amountStr: formatPdfMoney(c.expenseAmount),
          percentage: c.percentageOfTotal,
          color: PDF_COLORS.expenseRed,
        }))
      );
    }

    PdfBuilder.drawTable(doc, fonts, {
      title: "Detailed Category Breakdown",
      columns: [
        { id: "name", header: "Category Name", width: 200 },
        { id: "type", header: "Category Type", width: 90 },
        { id: "count", header: "Txn Count", width: 70, align: "center" },
        { id: "amount", header: "Total Amount", width: 100, align: "right" },
        { id: "pct", header: "% of Type", width: 65, align: "right" },
      ],
      rows: rows.map((r) => {
        const catAmt = r.type === "INCOME" ? r.incomeAmount : r.expenseAmount;
        return {
          name: r.name,
          type: r.type,
          count: r.transactionCount,
          amount: formatPdfMoney(catAmt),
          pct: `${r.percentageOfTotal.toFixed(1)}%`,
        };
      }),
    });
  }

  public static renderPaymentMethodSummaryReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    rows: PaymentMethodReportRowDTO[],
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    PdfBuilder.drawBarDistribution(
      doc,
      fonts,
      "Payment Method Inflows",
      rows.map((r) => ({
        label: r.name,
        amountStr: formatPdfMoney(r.moneyReceived),
        percentage: r.percentageOfInflows,
        color: PDF_COLORS.netBlue,
      }))
    );

    PdfBuilder.drawTable(doc, fonts, {
      title: "Payment Method Flow Analysis",
      columns: [
        { id: "name", header: "Method Name", width: 150 },
        { id: "type", header: "Type", width: 90 },
        { id: "count", header: "Count", width: 60, align: "center" },
        { id: "in", header: "Money Received", width: 75, align: "right" },
        { id: "out", header: "Money Paid", width: 75, align: "right" },
        { id: "net", header: "Net Flow", width: 75, align: "right" },
      ],
      rows: rows.map((r) => ({
        name: r.name,
        type: r.type,
        count: r.transactionCount,
        in: formatPdfMoney(r.moneyReceived),
        out: formatPdfMoney(r.moneyPaid),
        net: formatPdfMoney(r.netMovement),
      })),
    });
  }

  public static renderDailySummaryReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    rows: DailySummaryReportRowDTO[],
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    let totInc = Money.zero();
    let totExp = Money.zero();
    let totIn = Money.zero();
    let totOut = Money.zero();

    rows.forEach((r) => {
      totInc = totInc.add(r.income);
      totExp = totExp.add(r.expenses);
      totIn = totIn.add(r.moneyIn);
      totOut = totOut.add(r.moneyOut);
    });

    PdfBuilder.drawTable(doc, fonts, {
      title: "Day-by-Day Financial Activity",
      columns: [
        { id: "date", header: "Date", width: 85 },
        { id: "inc", header: "Revenue", width: 75, align: "right" },
        { id: "exp", header: "Expense", width: 75, align: "right" },
        { id: "net", header: "Net Result", width: 75, align: "right" },
        { id: "in", header: "Cash In", width: 70, align: "right" },
        { id: "out", header: "Cash Out", width: 70, align: "right" },
        { id: "count", header: "Txns", width: 50, align: "center" },
      ],
      rows: rows.map((r) => ({
        date: r.date,
        inc: formatPdfMoney(r.income),
        exp: formatPdfMoney(r.expenses),
        net: formatPdfMoney(r.netResult),
        in: formatPdfMoney(r.moneyIn),
        out: formatPdfMoney(r.moneyOut),
        count: r.transactionCount,
      })),
      summaryRow: {
        date: "TOTAL",
        inc: formatPdfMoney(totInc),
        exp: formatPdfMoney(totExp),
        net: formatPdfMoney(totInc.minus(totExp)),
        in: formatPdfMoney(totIn),
        out: formatPdfMoney(totOut),
      },
    });
  }

  public static renderMonthlySummaryReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    rows: MonthlyAnalysisReportRowDTO[],
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    let totInc = Money.zero();
    let totExp = Money.zero();
    let totIn = Money.zero();
    let totOut = Money.zero();

    rows.forEach((r) => {
      totInc = totInc.add(r.income);
      totExp = totExp.add(r.expenses);
      totIn = totIn.add(r.moneyIn);
      totOut = totOut.add(r.moneyOut);
    });

    PdfBuilder.drawTable(doc, fonts, {
      title: "12-Month Fiscal Analysis",
      columns: [
        { id: "month", header: "Month", width: 110 },
        { id: "inc", header: "Income", width: 100, align: "right" },
        { id: "exp", header: "Expenses", width: 100, align: "right" },
        { id: "net", header: "Net Result", width: 100, align: "right" },
        { id: "in", header: "Cash Inflow", width: 100, align: "right" },
        { id: "out", header: "Cash Outflow", width: 100, align: "right" },
        { id: "txns", header: "Txn Count", width: 80, align: "center" },
      ],
      rows: rows.map((r) => ({
        month: r.month,
        inc: formatPdfMoney(r.income),
        exp: formatPdfMoney(r.expenses),
        net: formatPdfMoney(r.netResult),
        in: formatPdfMoney(r.moneyIn),
        out: formatPdfMoney(r.moneyOut),
        txns: r.transactionCount,
      })),
      summaryRow: {
        month: "ANNUAL TOTALS",
        inc: formatPdfMoney(totInc),
        exp: formatPdfMoney(totExp),
        net: formatPdfMoney(totInc.minus(totExp)),
        in: formatPdfMoney(totIn),
        out: formatPdfMoney(totOut),
      },
    });
  }

  public static renderManagementSummaryReport(
    doc: typeof PDFDocument.prototype,
    fonts: { regular: string; bold: string },
    data: ManagementSummaryReportDTO,
    headerOpts: PdfHeaderOptions
  ): void {
    PdfBuilder.drawHeader(doc, fonts, headerOpts);

    const { financialSummary, accountingHealth, insights } = data;

    // 1. KPI Cards
    PdfBuilder.drawSectionTitle(doc, fonts, "Executive Key Performance Indicators");
    PdfBuilder.drawKPICards(doc, fonts, [
      { label: "Operating Revenue", value: formatPdfMoney(financialSummary.totalIncome), color: PDF_COLORS.incomeGreen },
      { label: "Operating Expenses", value: formatPdfMoney(financialSummary.totalExpenses), color: PDF_COLORS.expenseRed },
      { label: "Net Operating Result", value: formatPdfMoney(financialSummary.netResult), color: financialSummary.netResult.isPositive() ? PDF_COLORS.incomeGreen : PDF_COLORS.expenseRed },
      { label: "Closing Liquidity", value: formatPdfMoney(financialSummary.closingBalance), color: PDF_COLORS.netBlue },
    ]);

    // 2. Deterministic Insights Box (Phase 6 rule-based insights - Requirement 32 & 85)
    if (insights.length > 0) {
      const leftX = doc.page.margins.left;
      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const boxY = doc.y;
      const boxHeight = 24 + insights.length * 14;

      doc.roundedRect(leftX, boxY, usableWidth, boxHeight, 4).fillColor(PDF_COLORS.cardBg).fill();
      doc.roundedRect(leftX, boxY, usableWidth, boxHeight, 4).strokeColor(PDF_COLORS.borderLight).lineWidth(1).stroke();
      doc.roundedRect(leftX, boxY, 3, boxHeight, 2).fillColor(PDF_COLORS.netBlue).fill();

      doc.font(fonts.bold).fontSize(9).fillColor(PDF_COLORS.netBlue);
      doc.text("DETERMINISTIC BUSINESS INSIGHTS", leftX + 10, boxY + 6);

      let textY = boxY + 20;
      doc.font(fonts.regular).fontSize(8).fillColor(PDF_COLORS.primaryText);
      insights.forEach((ins) => {
        doc.text(`• ${ins}`, leftX + 10, textY, { width: usableWidth - 20 });
        textY += 14;
      });

      doc.y = boxY + boxHeight + 10;
    }

    // 3. Accounting Health Box (Requirement 84)
    const healthLeftX = doc.page.margins.left;
    const healthWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const healthY = doc.y;
    const isHealthy = accountingHealth.status === "BALANCED";

    doc.roundedRect(healthLeftX, healthY, healthWidth, 40, 4).fillColor(isHealthy ? PDF_COLORS.incomeLight : PDF_COLORS.amberLight).fill();
    doc.roundedRect(healthLeftX, healthY, healthWidth, 40, 4).strokeColor(isHealthy ? PDF_COLORS.incomeGreen : PDF_COLORS.amber).lineWidth(0.5).stroke();

    doc.font(fonts.bold).fontSize(8.5).fillColor(isHealthy ? PDF_COLORS.incomeGreen : PDF_COLORS.amber);
    doc.text(`ACCOUNTING RECONCILIATION HEALTH: ${accountingHealth.status}`, healthLeftX + 10, healthY + 7);

    doc.font(fonts.regular).fontSize(7.5).fillColor(PDF_COLORS.secondaryText);
    const healthDesc = isHealthy
      ? "All financial payment allocations reconcile with invoices. No unallocated gaps or duplicate postings detected."
      : `${accountingHealth.discrepancyCount} reconciliation discrepancy(s) require review. Please consult the Month-End checklist.`;
    doc.text(healthDesc, healthLeftX + 10, healthY + 20);

    doc.y = healthY + 48;

    // 4. Top Revenue Categories Table
    PdfBuilder.drawTable(doc, fonts, {
      title: "Top Revenue Drivers (Categories)",
      columns: [
        { id: "name", header: "Category", width: 220 },
        { id: "count", header: "Count", width: 80, align: "center" },
        { id: "amount", header: "Total Income", width: 120, align: "right" },
        { id: "pct", header: "% of Revenue", width: 100, align: "right" },
      ],
      rows: data.topIncomeCategories.map((c) => ({
        name: c.name,
        count: c.transactionCount,
        amount: formatPdfMoney(c.incomeAmount),
        pct: `${c.percentageOfTotal.toFixed(1)}%`,
      })),
    });
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  private static getReportTitle(reportType: PdfReportType): string {
    const titles: Record<PdfReportType, string> = {
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
      CUSTOMER_LEDGER: "Customer Detailed Ledger",
      SUPPLIER_STATEMENT: "Supplier Statement of Account",
      SUPPLIER_LEDGER: "Supplier Detailed Ledger",
      CATEGORY_SUMMARY: "Category Performance Analysis",
      PAYMENT_METHOD_SUMMARY: "Payment Method Distribution",
      DAILY_SUMMARY: "Daily Financial Activity Report",
      MONTHLY_SUMMARY: "12-Month Financial Summary",
      MANAGEMENT_SUMMARY: "Executive Management Report",
    };
    return titles[reportType] || "Accounting Report";
  }

  private static resolvePeriodLabel(filters: TransactionFilterParams): string {
    if (filters.period) {
      return filters.period
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
    }
    if (filters.startDate && filters.endDate) {
      return `${formatPdfDate(filters.startDate)} to ${formatPdfDate(filters.endDate)}`;
    }
    if (filters.financialPeriodYear && filters.financialPeriodMonth) {
      return `${filters.financialPeriodYear}-${String(filters.financialPeriodMonth).padStart(2, "0")}`;
    }
    return "Current Accounting Period";
  }
}
