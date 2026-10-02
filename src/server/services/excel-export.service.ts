import * as XLSX from "xlsx";
import { formatBusinessDate, formatBusinessDateTime } from "@/lib/date";
import { Money } from "@/lib/money";
import {
  type FinancialSummaryReportDTO,
  type TransactionReportRowDTO,
  type PaymentReportRowDTO,
  type PartySummaryReportRowDTO,
  type CategorySummaryReportRowDTO,
  type PaymentMethodReportRowDTO,
  type DailySummaryReportRowDTO,
  type MonthlyAnalysisReportRowDTO,
  type AgingScheduleReportRowDTO,
  type MonthlyWorkbookDataDTO,
} from "./report-data.service";
import { type CustomerLedgerResult, type SupplierLedgerResult } from "./ledger.service";

/**
 * Sanitize user-controlled text against spreadsheet formula injection (CWE-1236).
 * Prepends a single quote if the text begins with dangerous formula prefix characters: =, +, -, @
 * Plain numeric values and normal text are left intact.
 */
export function sanitizeExcelCellValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (!str) return "";

  // If string starts with =, +, -, @ and is not a clean standalone number
  const trimmed = str.trim();
  if (/^[=+\-@]/.test(trimmed)) {
    // If it's a valid standalone number like "-100" or "+5", don't quote if used as number
    if (/^[+\-]?\d+(\.\d+)?$/.test(trimmed)) {
      return trimmed;
    }
    return `'${trimmed}`;
  }

  return str;
}

/**
 * Convert Money to safe float number for numeric Excel cells.
 */
export function moneyToExcelNumber(money: Money | undefined | null): number {
  if (!money) return 0;
  return Number(money.getDecimal().toFixed(2));
}

/**
 * Calculate sensible column widths based on cell content lengths.
 */
export function autoFitColumns(rows: (string | number | null | undefined)[][]): XLSX.ColInfo[] {
  if (!rows || rows.length === 0) return [];
  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidths: number[] = new Array(colCount).fill(10);

  for (const row of rows) {
    row.forEach((cell, idx) => {
      if (cell !== null && cell !== undefined) {
        const len = String(cell).length;
        if (len > colWidths[idx]) {
          colWidths[idx] = len;
        }
      }
    });
  }

  // Cap max column width to 45 and min to 10
  return colWidths.map((w) => ({
    wch: Math.min(Math.max(w + 3, 10), 45),
  }));
}

/**
 * ExcelExportService — Production-grade multi-sheet XLSX workbook generator.
 */
export class ExcelExportService {
  /**
   * 1. Generate Complete 13-Sheet Monthly Accounting Workbook
   */
  public static generateMonthlyAccountingWorkbook(data: MonthlyWorkbookDataDTO): Buffer {
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summarySheet = this.createSummarySheet(data.summary);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // 2. Income Sheet
    const incomeSheet = this.createTransactionsSheet(data.incomeRows, "Income Transactions", true, false);
    XLSX.utils.book_append_sheet(wb, incomeSheet, "Income");

    // 3. Expenses Sheet
    const expenseSheet = this.createTransactionsSheet(data.expenseRows, "Expense Transactions", false, true);
    XLSX.utils.book_append_sheet(wb, expenseSheet, "Expenses");

    // 4. All Transactions Sheet
    const allTxnSheet = this.createTransactionsSheet(data.allTransactions, "All Transactions", true, true);
    XLSX.utils.book_append_sheet(wb, allTxnSheet, "Transactions");

    // 5. Payments Sheet
    const paymentsSheet = this.createPaymentsSheet(data.payments);
    XLSX.utils.book_append_sheet(wb, paymentsSheet, "Payments");

    // 6. Receivables Sheet
    const receivablesSheet = this.createReceivablesSheet(data.receivables);
    XLSX.utils.book_append_sheet(wb, receivablesSheet, "Receivables");

    // 7. Payables Sheet
    const payablesSheet = this.createPayablesSheet(data.payables);
    XLSX.utils.book_append_sheet(wb, payablesSheet, "Payables");

    // 8. Customer Summary Sheet
    const customerSummarySheet = this.createPartySummarySheet(data.customerSummary, "Customer Summary", "Customer");
    XLSX.utils.book_append_sheet(wb, customerSummarySheet, "Customer Summary");

    // 9. Supplier Summary Sheet
    const supplierSummarySheet = this.createPartySummarySheet(data.supplierSummary, "Supplier Summary", "Supplier");
    XLSX.utils.book_append_sheet(wb, supplierSummarySheet, "Supplier Summary");

    // 10. Category Summary Sheet
    const categorySheet = this.createCategorySummarySheet(data.categorySummary);
    XLSX.utils.book_append_sheet(wb, categorySheet, "Category Summary");

    // 11. Payment Summary Sheet
    const paymentSummarySheet = this.createPaymentMethodSummarySheet(data.paymentSummary);
    XLSX.utils.book_append_sheet(wb, paymentSummarySheet, "Payment Summary");

    // 12. Daily Summary Sheet
    const dailySheet = this.createDailySummarySheet(data.dailySummary);
    XLSX.utils.book_append_sheet(wb, dailySheet, "Daily Summary");

    // 13. Monthly Analysis Sheet
    const monthlySheet = this.createMonthlyAnalysisSheet(data.monthlyAnalysis);
    XLSX.utils.book_append_sheet(wb, monthlySheet, "Monthly Analysis");

    return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  }

  /**
   * 2. Generate Filtered / Custom Transaction Workbook
   */
  public static generateTransactionsWorkbook(
    rows: TransactionReportRowDTO[],
    title = "Transaction Records",
    businessName = "Sai Tours & Travels"
  ): Buffer {
    const wb = XLSX.utils.book_new();
    const ws = this.createTransactionsSheet(rows, title, true, true, businessName);
    XLSX.utils.book_append_sheet(wb, ws, "Records");
    return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  }

  /**
   * 3. Generate Customer Ledger Workbook
   */
  public static generateCustomerLedgerWorkbook(
    ledger: CustomerLedgerResult,
    businessName = "Sai Tours & Travels"
  ): Buffer {
    const wb = XLSX.utils.book_new();
    const rows: (string | number | null)[][] = [
      [`${businessName.toUpperCase()} — CUSTOMER ACCOUNT STATEMENT`],
      [`Customer: ${ledger.customer.name} (${ledger.customer.customerCode})`],
      [`Company: ${ledger.customer.companyName || "N/A"}`],
      [`Period: ${ledger.startDate ? formatBusinessDate(ledger.startDate) : "Beginning"} to ${ledger.endDate ? formatBusinessDate(ledger.endDate) : "Current"}`],
      [`Generated: ${formatBusinessDateTime(new Date())} | Currency: INR`],
      [],
      ["Date", "Entry No", "Type", "Reference", "Description", "Debit (INR)", "Credit (INR)", "Running Balance (INR)", "Status"],
    ];

    // Opening balance row
    rows.push([
      ledger.startDate ? formatBusinessDate(ledger.startDate) : "-",
      "OPENING",
      "BALANCE",
      "-",
      "Opening Balance Forward",
      0,
      0,
      moneyToExcelNumber(ledger.openingBalance),
      "POSTED",
    ]);

    // Ledger rows
    ledger.entries.forEach((e) => {
      rows.push([
        formatBusinessDate(e.date),
        sanitizeExcelCellValue(e.entityNumber),
        e.type,
        sanitizeExcelCellValue(e.referenceNumber || "-"),
        sanitizeExcelCellValue(e.description),
        moneyToExcelNumber(e.debit),
        moneyToExcelNumber(e.credit),
        moneyToExcelNumber(e.runningBalance),
        e.status,
      ]);
    });

    // Summary Totals
    rows.push([]);
    rows.push([
      "TOTALS / CLOSING BALANCE",
      "",
      "",
      "",
      "",
      moneyToExcelNumber(ledger.totalDebits),
      moneyToExcelNumber(ledger.totalCredits),
      moneyToExcelNumber(ledger.closingBalance),
      "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = autoFitColumns(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 7, topLeftCell: "A8", state: "frozen" };
    ws["!autofilter"] = { ref: `A7:I${rows.length}` };

    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  }

  /**
   * 4. Generate Supplier Ledger Workbook
   */
  public static generateSupplierLedgerWorkbook(
    ledger: SupplierLedgerResult,
    businessName = "Sai Tours & Travels"
  ): Buffer {
    const wb = XLSX.utils.book_new();
    const rows: (string | number | null)[][] = [
      [`${businessName.toUpperCase()} — SUPPLIER ACCOUNT STATEMENT`],
      [`Supplier: ${ledger.supplier.name} (${ledger.supplier.supplierCode})`],
      [`Company: ${ledger.supplier.companyName || "N/A"}`],
      [`Period: ${ledger.startDate ? formatBusinessDate(ledger.startDate) : "Beginning"} to ${ledger.endDate ? formatBusinessDate(ledger.endDate) : "Current"}`],
      [`Generated: ${formatBusinessDateTime(new Date())} | Currency: INR`],
      [],
      ["Date", "Entry No", "Type", "Reference", "Description", "Credit (Payable)", "Debit (Paid)", "Running Balance (INR)", "Status"],
    ];

    // Opening balance row
    rows.push([
      ledger.startDate ? formatBusinessDate(ledger.startDate) : "-",
      "OPENING",
      "BALANCE",
      "-",
      "Opening Balance Forward",
      0,
      0,
      moneyToExcelNumber(ledger.openingBalance),
      "POSTED",
    ]);

    // Ledger rows
    ledger.entries.forEach((e) => {
      rows.push([
        formatBusinessDate(e.date),
        sanitizeExcelCellValue(e.entityNumber),
        e.type,
        sanitizeExcelCellValue(e.referenceNumber || "-"),
        sanitizeExcelCellValue(e.description),
        moneyToExcelNumber(e.credit),
        moneyToExcelNumber(e.debit),
        moneyToExcelNumber(e.runningBalance),
        e.status,
      ]);
    });

    // Summary Totals
    rows.push([]);
    rows.push([
      "TOTALS / CLOSING BALANCE",
      "",
      "",
      "",
      "",
      moneyToExcelNumber(ledger.totalCredits),
      moneyToExcelNumber(ledger.totalDebits),
      moneyToExcelNumber(ledger.closingBalance),
      "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = autoFitColumns(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 7, topLeftCell: "A8", state: "frozen" };
    ws["!autofilter"] = { ref: `A7:I${rows.length}` };

    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  }

  /**
   * 5. Generate Aging Schedule Workbook (Receivables / Payables)
   */
  public static generateAgingScheduleWorkbook(
    rows: AgingScheduleReportRowDTO[],
    type: "RECEIVABLES" | "PAYABLES"
  ): Buffer {
    const wb = XLSX.utils.book_new();
    const title = type === "RECEIVABLES" ? "RECEIVABLE AGING ANALYSIS" : "PAYABLE AGING ANALYSIS";
    const partyCol = type === "RECEIVABLES" ? "Customer" : "Supplier";

    const tableRows: (string | number | null)[][] = [
      [`SAI TOURS & TRAVELS — ${title}`],
      [`As of Date: ${formatBusinessDate(new Date())} | Currency: INR`],
      [],
      ["Code", partyCol, "Current", "1 - 30 Days", "31 - 60 Days", "61 - 90 Days", "90+ Days", "Total Outstanding (INR)"],
    ];

    let sumCurrent = 0;
    let sum1To30 = 0;
    let sum31To60 = 0;
    let sum61To90 = 0;
    let sum90Plus = 0;
    let sumTotal = 0;

    rows.forEach((r) => {
      const c = moneyToExcelNumber(r.current);
      const d1 = moneyToExcelNumber(r.days1To30);
      const d2 = moneyToExcelNumber(r.days31To60);
      const d3 = moneyToExcelNumber(r.days61To90);
      const d4 = moneyToExcelNumber(r.days90Plus);
      const tot = moneyToExcelNumber(r.totalOutstanding);

      sumCurrent += c;
      sum1To30 += d1;
      sum31To60 += d2;
      sum61To90 += d3;
      sum90Plus += d4;
      sumTotal += tot;

      tableRows.push([
        r.partyCode,
        sanitizeExcelCellValue(r.partyName),
        c,
        d1,
        d2,
        d3,
        d4,
        tot,
      ]);
    });

    tableRows.push([]);
    tableRows.push(["TOTALS", "", sumCurrent, sum1To30, sum31To60, sum61To90, sum90Plus, sumTotal]);

    const ws = XLSX.utils.aoa_to_sheet(tableRows);
    ws["!cols"] = autoFitColumns(tableRows);
    ws["!freeze"] = { xSplit: 0, ySplit: 4, topLeftCell: "A5", state: "frozen" };
    ws["!autofilter"] = { ref: `A4:H${tableRows.length}` };

    XLSX.utils.book_append_sheet(wb, ws, "Aging Schedule");
    return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  }

  // =========================================================================
  // INTERNAL SHEET BUILDERS
  // =========================================================================

  private static createSummarySheet(summary: FinancialSummaryReportDTO): XLSX.WorkSheet {
    const rows: (string | number | null)[][] = [
      ["SAI TOURS & TRAVELS — EXECUTIVE FINANCIAL SUMMARY"],
      [`Business: ${summary.business.name}`],
      [`Period: ${summary.period.label} (${formatBusinessDate(summary.period.startDate)} to ${formatBusinessDate(summary.period.endDate)})`],
      [`Generated On: ${formatBusinessDateTime(new Date())} | Accounting Basis: ${summary.business.accountingBasis} | Currency: ${summary.business.currency}`],
      [],
      ["FINANCIAL POSITION METRIC", "AMOUNT (INR)", "ACCOUNTING DEFINITION & NOTES"],
      ["Operating Income (Recognized)", moneyToExcelNumber(summary.totalIncome), "Total recognized revenue from flight bookings, packages & commissions."],
      ["Operating Expenses (Recognized)", moneyToExcelNumber(summary.totalExpenses), "Total recognized operating overheads, supplier costs & expenses."],
      ["Net Accounting Result (Profit / Loss)", moneyToExcelNumber(summary.netResult), "Income minus Expenses (Recognized operating margin)."],
      [],
      ["CASH FLOW & LIQUIDITY MOVEMENT", "AMOUNT (INR)", "PHYSICAL LIQUIDITY NOTES"],
      ["Opening Cash & Bank Balance", moneyToExcelNumber(summary.openingBalance), "Cash & liquid bank balance at the start of reporting period."],
      ["Total Money Received (Inflow)", moneyToExcelNumber(summary.moneyReceived), "Physical customer payments, receipts & cash collections."],
      ["Total Money Paid (Outflow)", moneyToExcelNumber(summary.moneyPaid), "Physical supplier payments, vendor settlements & cash disbursements."],
      ["Net Cash Flow Movement", moneyToExcelNumber(summary.netCashFlow), "Money Received minus Money Paid."],
      ["Closing Cash & Bank Position", moneyToExcelNumber(summary.closingBalance), "Opening Balance plus Net Cash Flow (Current liquid position)."],
      [],
      ["OUTSTANDING WORKING CAPITAL", "AMOUNT (INR)", "BALANCE SHEET IMPACT"],
      ["Accounts Receivable (Debtors)", moneyToExcelNumber(summary.receivablesOutstanding), "Unpaid invoices and pending customer balances."],
      ["Accounts Payable (Creditors)", moneyToExcelNumber(summary.payablesOutstanding), "Pending supplier liabilities and vendor dues."],
      [],
      ["Total Transactions Processed", summary.transactionCount, "Count of posted transactions during this period."],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 38 },
      { wch: 18 },
      { wch: 55 },
    ];
    return ws;
  }

  private static createTransactionsSheet(
    transactions: TransactionReportRowDTO[],
    title: string,
    showCustomer: boolean,
    showSupplier: boolean,
    businessName = "Sai Tours & Travels"
  ): XLSX.WorkSheet {
    const rows: (string | number | null)[][] = [
      [`${businessName.toUpperCase()} — ${title.toUpperCase()}`],
      [`Generated: ${formatBusinessDateTime(new Date())} | Records Count: ${transactions.length}`],
      [],
      [
        "Date",
        "Transaction No",
        "Type",
        "Party",
        "Category",
        "Description",
        "Reference",
        "Total Amount (INR)",
        "Paid Amount (INR)",
        "Outstanding (INR)",
        "Payment Status",
        "Payment Method",
        "Status",
        "Created By",
      ],
    ];

    let sumTotal = 0;
    let sumPaid = 0;
    let sumOut = 0;

    transactions.forEach((t) => {
      const tot = moneyToExcelNumber(t.amount);
      const pd = moneyToExcelNumber(t.paidAmount);
      const out = moneyToExcelNumber(t.outstandingAmount);

      sumTotal += tot;
      sumPaid += pd;
      sumOut += out;

      rows.push([
        formatBusinessDate(t.date),
        sanitizeExcelCellValue(t.transactionNumber),
        t.type,
        sanitizeExcelCellValue(t.partyName),
        sanitizeExcelCellValue(t.categoryName),
        sanitizeExcelCellValue(t.description),
        sanitizeExcelCellValue(t.referenceNumber || "-"),
        tot,
        pd,
        out,
        t.paymentStatus,
        sanitizeExcelCellValue(t.paymentMethod || "-"),
        t.status,
        sanitizeExcelCellValue(t.createdBy),
      ]);
    });

    // Summary Totals Row
    rows.push([]);
    rows.push([
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
      sumTotal,
      sumPaid,
      sumOut,
      "",
      "",
      "",
      "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = autoFitColumns(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 4, topLeftCell: "A5", state: "frozen" };
    ws["!autofilter"] = { ref: `A4:N${rows.length}` };

    return ws;
  }

  private static createPaymentsSheet(payments: PaymentReportRowDTO[]): XLSX.WorkSheet {
    const rows: (string | number | null)[][] = [
      ["SAI TOURS & TRAVELS — CASH & BANK PAYMENTS RECORD"],
      [`Generated: ${formatBusinessDateTime(new Date())} | Total Payments: ${payments.length}`],
      [],
      [
        "Payment Date",
        "Payment No",
        "Direction",
        "Party Name",
        "Party Type",
        "Payment Method",
        "Reference",
        "Amount (INR)",
        "Allocated (INR)",
        "Unapplied (INR)",
        "Status",
        "Created By",
      ],
    ];

    let sumAmount = 0;
    let sumAllocated = 0;
    let sumUnapplied = 0;

    payments.forEach((p) => {
      const amt = moneyToExcelNumber(p.amount);
      const alloc = moneyToExcelNumber(p.allocatedAmount);
      const unapp = moneyToExcelNumber(p.unappliedAmount);

      sumAmount += amt;
      sumAllocated += alloc;
      sumUnapplied += unapp;

      rows.push([
        formatBusinessDate(p.date),
        sanitizeExcelCellValue(p.paymentNumber),
        p.direction === "IN" ? "MONEY RECEIVED" : "MONEY PAID",
        sanitizeExcelCellValue(p.partyName),
        p.partyType,
        sanitizeExcelCellValue(p.paymentMethod),
        sanitizeExcelCellValue(p.referenceNumber || "-"),
        amt,
        alloc,
        unapp,
        p.status,
        sanitizeExcelCellValue(p.createdBy),
      ]);
    });

    rows.push([]);
    rows.push(["TOTAL", "", "", "", "", "", "", sumAmount, sumAllocated, sumUnapplied, "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = autoFitColumns(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 4, topLeftCell: "A5", state: "frozen" };
    ws["!autofilter"] = { ref: `A4:L${rows.length}` };

    return ws;
  }

  private static createReceivablesSheet(receivables: TransactionReportRowDTO[]): XLSX.WorkSheet {
    const rows: (string | number | null)[][] = [
      ["SAI TOURS & TRAVELS — ACCOUNTS RECEIVABLE (PENDING INVOICES)"],
      [`Generated: ${formatBusinessDateTime(new Date())} | Invoices Count: ${receivables.length}`],
      [],
      [
        "Invoice Date",
        "Invoice No",
        "Customer",
        "Category",
        "Reference",
        "Original (INR)",
        "Received (INR)",
        "Outstanding (INR)",
        "Due Date",
        "Days Overdue",
        "Status",
      ],
    ];

    let sumOriginal = 0;
    let sumReceived = 0;
    let sumOut = 0;

    receivables.forEach((r) => {
      const orig = moneyToExcelNumber(r.amount);
      const rec = moneyToExcelNumber(r.paidAmount);
      const out = moneyToExcelNumber(r.outstandingAmount);

      sumOriginal += orig;
      sumReceived += rec;
      sumOut += out;

      rows.push([
        formatBusinessDate(r.date),
        sanitizeExcelCellValue(r.transactionNumber),
        sanitizeExcelCellValue(r.partyName),
        sanitizeExcelCellValue(r.categoryName),
        sanitizeExcelCellValue(r.referenceNumber || "-"),
        orig,
        rec,
        out,
        r.dueDate ? formatBusinessDate(r.dueDate) : "-",
        r.daysOverdue > 0 ? r.daysOverdue : 0,
        r.paymentStatus,
      ]);
    });

    rows.push([]);
    rows.push(["TOTAL", "", "", "", "", sumOriginal, sumReceived, sumOut, "", "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = autoFitColumns(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 4, topLeftCell: "A5", state: "frozen" };
    ws["!autofilter"] = { ref: `A4:K${rows.length}` };

    return ws;
  }

  private static createPayablesSheet(payables: TransactionReportRowDTO[]): XLSX.WorkSheet {
    const rows: (string | number | null)[][] = [
      ["SAI TOURS & TRAVELS — ACCOUNTS PAYABLE (VENDOR LIABILITIES)"],
      [`Generated: ${formatBusinessDateTime(new Date())} | Bills Count: ${payables.length}`],
      [],
      [
        "Bill Date",
        "Bill No",
        "Supplier",
        "Category",
        "Reference",
        "Original (INR)",
        "Paid (INR)",
        "Outstanding (INR)",
        "Due Date",
        "Days Overdue",
        "Status",
      ],
    ];

    let sumOriginal = 0;
    let sumPaid = 0;
    let sumOut = 0;

    payables.forEach((p) => {
      const orig = moneyToExcelNumber(p.amount);
      const pd = moneyToExcelNumber(p.paidAmount);
      const out = moneyToExcelNumber(p.outstandingAmount);

      sumOriginal += orig;
      sumPaid += pd;
      sumOut += out;

      rows.push([
        formatBusinessDate(p.date),
        sanitizeExcelCellValue(p.transactionNumber),
        sanitizeExcelCellValue(p.partyName),
        sanitizeExcelCellValue(p.categoryName),
        sanitizeExcelCellValue(p.referenceNumber || "-"),
        orig,
        pd,
        out,
        p.dueDate ? formatBusinessDate(p.dueDate) : "-",
        p.daysOverdue > 0 ? p.daysOverdue : 0,
        p.paymentStatus,
      ]);
    });

    rows.push([]);
    rows.push(["TOTAL", "", "", "", "", sumOriginal, sumPaid, sumOut, "", "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = autoFitColumns(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 4, topLeftCell: "A5", state: "frozen" };
    ws["!autofilter"] = { ref: `A4:K${rows.length}` };

    return ws;
  }

  private static createPartySummarySheet(
    parties: PartySummaryReportRowDTO[],
    title: string,
    partyType: string
  ): XLSX.WorkSheet {
    const rows: (string | number | null)[][] = [
      [`SAI TOURS & TRAVELS — ${title.toUpperCase()}`],
      [`Generated: ${formatBusinessDateTime(new Date())} | Total ${partyType}s: ${parties.length}`],
      [],
      [
        "Code",
        `${partyType} Name`,
        "Company Name",
        "Phone",
        "Email",
        "Txn Count",
        "Total Billed (INR)",
        "Total Settled (INR)",
        "Current Balance (INR)",
      ],
    ];

    let sumBilled = 0;
    let sumSettled = 0;
    let sumBalance = 0;

    parties.forEach((p) => {
      const b = moneyToExcelNumber(p.totalBilled);
      const s = moneyToExcelNumber(p.totalPaid);
      const bal = moneyToExcelNumber(p.outstanding);

      sumBilled += b;
      sumSettled += s;
      sumBalance += bal;

      rows.push([
        p.code,
        sanitizeExcelCellValue(p.name),
        sanitizeExcelCellValue(p.companyName || "-"),
        sanitizeExcelCellValue(p.phone || "-"),
        sanitizeExcelCellValue(p.email || "-"),
        p.transactionCount,
        b,
        s,
        bal,
      ]);
    });

    rows.push([]);
    rows.push(["TOTAL", "", "", "", "", "", sumBilled, sumSettled, sumBalance]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = autoFitColumns(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 4, topLeftCell: "A5", state: "frozen" };
    ws["!autofilter"] = { ref: `A4:I${rows.length}` };

    return ws;
  }

  private static createCategorySummarySheet(categories: CategorySummaryReportRowDTO[]): XLSX.WorkSheet {
    const rows: (string | number | null)[][] = [
      ["SAI TOURS & TRAVELS — CATEGORY REVENUE & COST BREAKDOWN"],
      [`Generated: ${formatBusinessDateTime(new Date())} | Total Categories: ${categories.length}`],
      [],
      ["Category Name", "Classification", "Txn Count", "Income (INR)", "Expenses (INR)", "% Contribution"],
    ];

    let sumInc = 0;
    let sumExp = 0;

    categories.forEach((c) => {
      const inc = moneyToExcelNumber(c.incomeAmount);
      const exp = moneyToExcelNumber(c.expenseAmount);
      sumInc += inc;
      sumExp += exp;

      rows.push([
        sanitizeExcelCellValue(c.name),
        c.type,
        c.transactionCount,
        inc,
        exp,
        `${c.percentageOfTotal.toFixed(1)}%`,
      ]);
    });

    rows.push([]);
    rows.push(["TOTAL", "", "", sumInc, sumExp, "100.0%"]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = autoFitColumns(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 4, topLeftCell: "A5", state: "frozen" };
    ws["!autofilter"] = { ref: `A4:F${rows.length}` };

    return ws;
  }

  private static createPaymentMethodSummarySheet(methods: PaymentMethodReportRowDTO[]): XLSX.WorkSheet {
    const rows: (string | number | null)[][] = [
      ["SAI TOURS & TRAVELS — PAYMENT METHOD SETTLEMENT BREAKDOWN"],
      [`Generated: ${formatBusinessDateTime(new Date())} | Payment Channels: ${methods.length}`],
      [],
      ["Payment Channel", "Type", "Transactions", "Money In (INR)", "Money Out (INR)", "Net Flow (INR)", "% of Inflows"],
    ];

    let sumIn = 0;
    let sumOut = 0;
    let sumNet = 0;

    methods.forEach((m) => {
      const mi = moneyToExcelNumber(m.moneyReceived);
      const mo = moneyToExcelNumber(m.moneyPaid);
      const mn = moneyToExcelNumber(m.netMovement);

      sumIn += mi;
      sumOut += mo;
      sumNet += mn;

      rows.push([
        sanitizeExcelCellValue(m.name),
        m.type,
        m.transactionCount,
        mi,
        mo,
        mn,
        `${m.percentageOfInflows.toFixed(1)}%`,
      ]);
    });

    rows.push([]);
    rows.push(["TOTAL", "", "", sumIn, sumOut, sumNet, "100.0%"]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = autoFitColumns(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 4, topLeftCell: "A5", state: "frozen" };
    ws["!autofilter"] = { ref: `A4:G${rows.length}` };

    return ws;
  }

  private static createDailySummarySheet(days: DailySummaryReportRowDTO[]): XLSX.WorkSheet {
    const rows: (string | number | null)[][] = [
      ["SAI TOURS & TRAVELS — DAILY OPERATIONAL LEDGER CURVE"],
      [`Generated: ${formatBusinessDateTime(new Date())} | Days Count: ${days.length}`],
      [],
      ["Date", "Day", "Income (INR)", "Expenses (INR)", "Net Result (INR)", "Cash In (INR)", "Cash Out (INR)"],
    ];

    let sumInc = 0;
    let sumExp = 0;
    let sumNet = 0;
    let sumIn = 0;
    let sumOut = 0;

    days.forEach((d) => {
      const inc = moneyToExcelNumber(d.income);
      const exp = moneyToExcelNumber(d.expenses);
      const net = moneyToExcelNumber(d.netResult);
      const ci = moneyToExcelNumber(d.moneyIn);
      const co = moneyToExcelNumber(d.moneyOut);

      sumInc += inc;
      sumExp += exp;
      sumNet += net;
      sumIn += ci;
      sumOut += co;

      rows.push([
        d.date,
        d.label,
        inc,
        exp,
        net,
        ci,
        co,
      ]);
    });

    rows.push([]);
    rows.push(["TOTAL", "", sumInc, sumExp, sumNet, sumIn, sumOut]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = autoFitColumns(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 4, topLeftCell: "A5", state: "frozen" };
    ws["!autofilter"] = { ref: `A4:G${rows.length}` };

    return ws;
  }

  private static createMonthlyAnalysisSheet(months: MonthlyAnalysisReportRowDTO[]): XLSX.WorkSheet {
    const rows: (string | number | null)[][] = [
      ["SAI TOURS & TRAVELS — ANNUAL MONTH-BY-MONTH TREND ANALYSIS"],
      [`Generated: ${formatBusinessDateTime(new Date())}`],
      [],
      ["Month", "Income (INR)", "Expenses (INR)", "Net Result (INR)", "Cash In (INR)", "Cash Out (INR)", "Txn Count"],
    ];

    let sumInc = 0;
    let sumExp = 0;
    let sumNet = 0;
    let sumIn = 0;
    let sumOut = 0;
    let sumCount = 0;

    months.forEach((m) => {
      const inc = moneyToExcelNumber(m.income);
      const exp = moneyToExcelNumber(m.expenses);
      const net = moneyToExcelNumber(m.netResult);
      const ci = moneyToExcelNumber(m.moneyIn);
      const co = moneyToExcelNumber(m.moneyOut);

      sumInc += inc;
      sumExp += exp;
      sumNet += net;
      sumIn += ci;
      sumOut += co;
      sumCount += m.transactionCount;

      rows.push([
        m.month,
        inc,
        exp,
        net,
        ci,
        co,
        m.transactionCount,
      ]);
    });

    rows.push([]);
    rows.push(["TOTAL", sumInc, sumExp, sumNet, sumIn, sumOut, sumCount]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = autoFitColumns(rows);
    ws["!freeze"] = { xSplit: 0, ySplit: 4, topLeftCell: "A5", state: "frozen" };
    ws["!autofilter"] = { ref: `A4:G${rows.length}` };

    return ws;
  }
}
