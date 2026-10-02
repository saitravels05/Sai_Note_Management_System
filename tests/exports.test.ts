import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { Money } from "../src/lib/money";
import {
  ExcelExportService,
  sanitizeExcelCellValue,
  moneyToExcelNumber,
  autoFitColumns,
} from "../src/server/services/excel-export.service";
import {
  CsvExportService,
  sanitizeCsvCell,
  escapeCsvField,
} from "../src/server/services/csv-export.service";
import { ExportService } from "../src/server/services/export.service";
import {
  type MonthlyWorkbookDataDTO,
  type TransactionReportRowDTO,
  type FinancialSummaryReportDTO,
} from "../src/server/services/report-data.service";
import { type CustomerLedgerResult } from "../src/server/services/ledger.service";
import { TransactionType, TransactionStatus, PaymentStatus } from "@prisma/client";

describe("Phase 8 Excel & CSV Export Engine & Accounting Workbook Generator", () => {
  // Helper to create mock summary
  function createMockSummary(): FinancialSummaryReportDTO {
    return {
      business: {
        id: "biz-1",
        name: "Sai Tours & Travels",
        currency: "INR",
        timezone: "Asia/Kolkata",
        accountingBasis: "ACCRUAL",
      },
      period: {
        label: "September 2026",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2026-09-30"),
      },
      openingBalance: Money.of(250000),
      totalIncome: Money.of(485000.5),
      totalExpenses: Money.of(195000.25),
      netResult: Money.of(290000.25),
      moneyReceived: Money.of(450000),
      moneyPaid: Money.of(180000),
      netCashFlow: Money.of(270000),
      receivablesOutstanding: Money.of(125000),
      payablesOutstanding: Money.of(65000),
      closingBalance: Money.of(520000),
      transactionCount: 42,
    };
  }

  // Helper to create sample transactions
  function createMockTransactions(): TransactionReportRowDTO[] {
    return [
      {
        id: "tx-1",
        transactionNumber: "TXN-2026-001",
        date: new Date("2026-09-10"),
        type: TransactionType.INCOME,
        partyName: "Mohamed Ibrahim",
        partyCode: "CUST-001",
        categoryName: "Flight Booking",
        description: "Chennai to Dubai Return",
        referenceNumber: "PNR-DXB-99",
        amount: Money.of(50000.1),
        paidAmount: Money.of(50000.1),
        outstandingAmount: Money.zero(),
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: "UPI",
        status: TransactionStatus.POSTED,
        dueDate: null,
        daysOverdue: 0,
        createdBy: "Staff User",
        createdAt: new Date("2026-09-10"),
        tags: ["International", "Urgent"],
      },
      {
        id: "tx-2",
        transactionNumber: "TXN-2026-002",
        date: new Date("2026-09-15"),
        type: TransactionType.EXPENSE,
        partyName: "Indigo Airlines",
        partyCode: "SUPP-001",
        categoryName: "Airline Settlement",
        description: "Bulk Ticket Purchase",
        referenceNumber: "INV-IND-450",
        amount: Money.of(25000.05),
        paidAmount: Money.of(25000.05),
        outstandingAmount: Money.zero(),
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: "BANK_TRANSFER",
        status: TransactionStatus.POSTED,
        dueDate: null,
        daysOverdue: 0,
        createdBy: "Staff User",
        createdAt: new Date("2026-09-15"),
        tags: ["Fleet"],
      },
    ];
  }

  // Requirement 82: Test Monthly Workbook Generation (All 13 Sheets)
  test("Requirement 82: generates complete 13-sheet monthly workbook with verified totals", () => {
    const summary = createMockSummary();
    const txns = createMockTransactions();

    const mockData: MonthlyWorkbookDataDTO = {
      summary,
      incomeRows: txns.filter((t) => t.type === TransactionType.INCOME),
      expenseRows: txns.filter((t) => t.type === TransactionType.EXPENSE),
      allTransactions: txns,
      payments: [],
      receivables: [
        {
          id: "rec-1",
          transactionNumber: "REC-001",
          date: new Date("2026-09-20"),
          type: TransactionType.RECEIVABLE,
          partyName: "Tamil Holidays",
          partyCode: "CUST-002",
          categoryName: "Tour Package",
          description: "Ooty Group Tour",
          referenceNumber: "INV-OOTY-10",
          amount: Money.of(50000),
          paidAmount: Money.of(20000),
          outstandingAmount: Money.of(30000),
          paymentStatus: PaymentStatus.PARTIALLY_PAID,
          status: TransactionStatus.POSTED,
          dueDate: new Date("2026-09-25"),
          daysOverdue: 5,
          createdBy: "Admin",
          createdAt: new Date("2026-09-20"),
          tags: [],
        },
      ],
      payables: [],
      customerSummary: [],
      supplierSummary: [],
      categorySummary: [],
      paymentSummary: [],
      dailySummary: [],
      monthlyAnalysis: [],
    };

    const buffer = ExcelExportService.generateMonthlyAccountingWorkbook(mockData);
    assert.ok(buffer && buffer.length > 0, "Workbook buffer must not be empty");

    // Read workbook back
    const wb = XLSX.read(buffer, { type: "buffer" });
    const expectedSheets = [
      "Summary",
      "Income",
      "Expenses",
      "Transactions",
      "Payments",
      "Receivables",
      "Payables",
      "Customer Summary",
      "Supplier Summary",
      "Category Summary",
      "Payment Summary",
      "Daily Summary",
      "Monthly Analysis",
    ];

    assert.equal(wb.SheetNames.length, 13, "Workbook must contain exactly 13 sheets");
    assert.deepEqual(wb.SheetNames, expectedSheets);

    // Verify Summary Sheet contents
    const summarySheet = wb.Sheets["Summary"];
    assert.ok(summarySheet, "Summary sheet must exist");
    const summaryRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(summarySheet, { header: 1 });
    const flattened = summaryRows.flat().map((c) => String(c));

    assert.ok(flattened.some((c) => c.includes("Operating Income (Recognized)")));
    assert.ok(flattened.some((c) => c.includes("485000.5")));
    assert.ok(flattened.some((c) => c.includes("195000.25")));
    assert.ok(flattened.some((c) => c.includes("290000.25")));
    assert.ok(flattened.some((c) => c.includes("Closing Cash & Bank Position")));
  });

  // Requirement 83: Test Dashboard Match
  test("Requirement 83: Excel Summary totals exactly match Dashboard financial figures", () => {
    const summary = createMockSummary();
    const mockData: MonthlyWorkbookDataDTO = {
      summary,
      incomeRows: [],
      expenseRows: [],
      allTransactions: [],
      payments: [],
      receivables: [],
      payables: [],
      customerSummary: [],
      supplierSummary: [],
      categorySummary: [],
      paymentSummary: [],
      dailySummary: [],
      monthlyAnalysis: [],
    };

    const buffer = ExcelExportService.generateMonthlyAccountingWorkbook(mockData);
    const wb = XLSX.read(buffer, { type: "buffer" });
    const summarySheet = wb.Sheets["Summary"];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(summarySheet, { header: 1 });

    // Extract numbers from summary rows
    const incomeRow = rows.find((r) => r[0] === "Operating Income (Recognized)");
    const expenseRow = rows.find((r) => r[0] === "Operating Expenses (Recognized)");
    const netRow = rows.find((r) => r[0] === "Net Accounting Result (Profit / Loss)");
    const recRow = rows.find((r) => r[0] === "Accounts Receivable (Debtors)");
    const payRow = rows.find((r) => r[0] === "Accounts Payable (Creditors)");

    assert.ok(incomeRow && expenseRow && netRow && recRow && payRow);
    assert.equal(incomeRow[1], 485000.5, "Excel Summary Income must match Dashboard exactly");
    assert.equal(expenseRow[1], 195000.25, "Excel Summary Expenses must match Dashboard exactly");
    assert.equal(netRow[1], 290000.25, "Excel Summary Net Result must match Dashboard exactly");
    assert.equal(recRow[1], 125000, "Excel Summary Receivables must match Dashboard exactly");
    assert.equal(payRow[1], 65000, "Excel Summary Payables must match Dashboard exactly");
  });

  // Requirement 84: Test Filtered Export
  test("Requirement 84: Filtered export strictly preserves active filters and totals", () => {
    const allRecords = createMockTransactions();
    // Filter by EXPENSE only
    const filteredRecords = allRecords.filter(
      (r) => r.type === TransactionType.EXPENSE && r.paymentMethod === "BANK_TRANSFER"
    );

    const buffer = ExcelExportService.generateTransactionsWorkbook(
      filteredRecords,
      "Filtered Expenses (Bank Transfer)"
    );

    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets["Records"];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });

    // Row 3 is headers: Date, Transaction No, Type, Party, Category, Description, Reference, Total Amount...
    const dataRows = rows.slice(4).filter((r) => r.length > 0 && r[0] !== "TOTAL");
    assert.equal(dataRows.length, 1);
    assert.equal(dataRows[0][2], "EXPENSE");
    assert.equal(dataRows[0][11], "BANK_TRANSFER");
    assert.equal(dataRows[0][7], 25000.05);

    // Verify Total row
    const totalRow = rows.find((r) => r[0] === "TOTAL");
    assert.ok(totalRow, "Total row must be present");
    assert.equal(totalRow[7], 25000.05);
  });

  // Requirement 85: Test Partial Payment Handling in Receivables
  test("Requirement 85: Receivables export clearly shows Original, Paid, and Outstanding amounts", () => {
    const recRow: TransactionReportRowDTO = {
      id: "rec-test",
      transactionNumber: "REC-2026-09",
      date: new Date("2026-09-22"),
      type: TransactionType.RECEIVABLE,
      partyName: "ABC Corporates",
      partyCode: "CUST-050",
      categoryName: "Flight Tickets",
      description: "Annual Retreat Bookings",
      referenceNumber: "INV-ABC-50",
      amount: Money.of(50000),
      paidAmount: Money.of(20000),
      outstandingAmount: Money.of(30000),
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      status: TransactionStatus.POSTED,
      dueDate: new Date("2026-09-30"),
      daysOverdue: 0,
      createdBy: "Admin",
      createdAt: new Date("2026-09-22"),
      tags: [],
    };

    // Test in Excel
    const xlsxBuffer = ExcelExportService.generateTransactionsWorkbook([recRow], "Receivables");
    const wb = XLSX.read(xlsxBuffer, { type: "buffer" });
    const sheet = wb.Sheets["Records"];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });
    const dataRow = rows[4];

    assert.equal(dataRow[7], 50000, "Original Amount must be 50,000");
    assert.equal(dataRow[8], 20000, "Paid Amount must be 20,000");
    assert.equal(dataRow[9], 30000, "Outstanding Amount must be 30,000");

    // Test in CSV
    const csvBuffer = CsvExportService.exportTransactionsCsv([recRow], "Receivables");
    const csvStr = csvBuffer.toString("utf-8");
    assert.ok(csvStr.includes("50000.00"), "CSV must include original 50000.00");
    assert.ok(csvStr.includes("20000.00"), "CSV must include paid 20000.00");
    assert.ok(csvStr.includes("30000.00"), "CSV must include outstanding 30000.00");
  });

  // Requirement 86: Test Customer Ledger Running Balance
  test("Requirement 86: Customer Ledger export preserves Debits, Credits, and exact Running Balance", () => {
    const mockLedger: CustomerLedgerResult = {
      customer: {
        id: "c-1",
        name: "Ramesh Kumar",
        customerCode: "CUST-007",
        companyName: "Ramesh Travels",
        phone: "+91 9876543210",
        email: "ramesh@example.com",
      },
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-30"),
      openingBalance: Money.of(10000),
      totalDebits: Money.of(45000),
      totalCredits: Money.of(20000),
      closingBalance: Money.of(35000),
      totalOutstanding: Money.of(35000),
      entries: [
        {
          id: "entry-1",
          date: new Date("2026-09-05"),
          entityNumber: "INV-101",
          referenceNumber: "REF-01",
          description: "Flight Booking to Delhi",
          type: "TRANSACTION",
          rawType: "RECEIVABLE",
          debit: Money.of(45000),
          credit: Money.zero(),
          runningBalance: Money.of(55000),
          status: "POSTED",
        },
        {
          id: "entry-2",
          date: new Date("2026-09-12"),
          entityNumber: "PAY-201",
          referenceNumber: "UPI-TXN-88",
          description: "GPay Payment Received",
          type: "PAYMENT",
          rawType: "PAYMENT_IN",
          debit: Money.zero(),
          credit: Money.of(20000),
          runningBalance: Money.of(35000),
          status: "POSTED",
        },
      ],
    };

    // Excel Ledger
    const xlsxBuffer = ExcelExportService.generateCustomerLedgerWorkbook(mockLedger);
    const wb = XLSX.read(xlsxBuffer, { type: "buffer" });
    const sheet = wb.Sheets["Statement"];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });

    // Row 7 is Opening Balance (index 7)
    const openingRow = rows[7];
    assert.equal(openingRow[1], "OPENING");
    assert.equal(openingRow[7], 10000, "Opening balance must be 10,000");

    // Entry 1 (Debit 45,000 -> Running 55,000)
    const entry1 = rows[8];
    assert.equal(entry1[5], 45000);
    assert.equal(entry1[6], 0);
    assert.equal(entry1[7], 55000);

    // Entry 2 (Credit 20,000 -> Running 35,000)
    const entry2 = rows[9];
    assert.equal(entry2[5], 0);
    assert.equal(entry2[6], 20000);
    assert.equal(entry2[7], 35000);

    // Closing row
    const closingRow = rows[11];
    assert.equal(closingRow[0], "TOTALS / CLOSING BALANCE");
    assert.equal(closingRow[5], 45000);
    assert.equal(closingRow[6], 20000);
    assert.equal(closingRow[7], 35000);

    // CSV Ledger
    const csvBuffer = CsvExportService.exportCustomerLedgerCsv(mockLedger);
    const csvStr = csvBuffer.toString("utf-8");
    assert.ok(csvStr.includes("CUST-007"));
    assert.ok(csvStr.includes("35000.00"));
  });

  // Requirement 87: Test Money Precision Without Floating Point Drift
  test("Requirement 87: preserves exact currency decimal precision without floating point drift", () => {
    const m1 = Money.of("100000.10");
    const m2 = Money.of("25000.05");

    const n1 = moneyToExcelNumber(m1);
    const n2 = moneyToExcelNumber(m2);

    assert.equal(n1, 100000.1);
    assert.equal(n2, 25000.05);

    // Addition in Money
    const sum = m1.plus(m2);
    assert.equal(moneyToExcelNumber(sum), 125000.15);
  });

  // Requirement 88: Test Tamil / Unicode Characters
  test("Requirement 88: exports Tamil names, descriptions, and notes without mojibake", () => {
    const tamilTxn: TransactionReportRowDTO = {
      id: "tx-tamil",
      transactionNumber: "TXN-TAMIL-01",
      date: new Date("2026-09-28"),
      type: TransactionType.INCOME,
      partyName: "முருகன் டிராவல்ஸ்",
      partyCode: "CUST-TAMIL",
      categoryName: "விமான டிக்கெட்",
      description: "சென்னை முதல் மதுரை விமான முன்பதிவு",
      referenceNumber: "REF-தமிழ்-99",
      amount: Money.of(15000),
      paidAmount: Money.of(15000),
      outstandingAmount: Money.zero(),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: "UPI",
      status: TransactionStatus.POSTED,
      dueDate: null,
      daysOverdue: 0,
      createdBy: "சாய் நிர்வாகி",
      createdAt: new Date("2026-09-28"),
      tags: ["உள்ளூர்"],
    };

    // Excel Unicode
    const xlsxBuffer = ExcelExportService.generateTransactionsWorkbook([tamilTxn]);
    const wb = XLSX.read(xlsxBuffer, { type: "buffer" });
    const sheet = wb.Sheets["Records"];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });
    const dataRow = rows[4];

    assert.equal(dataRow[3], "முருகன் டிராவல்ஸ்");
    assert.equal(dataRow[4], "விமான டிக்கெட்");
    assert.equal(dataRow[5], "சென்னை முதல் மதுரை விமான முன்பதிவு");

    // CSV Unicode & BOM
    const csvBuffer = CsvExportService.exportTransactionsCsv([tamilTxn]);
    // Check UTF-8 BOM: 0xEF, 0xBB, 0xBF
    assert.equal(csvBuffer[0], 0xef);
    assert.equal(csvBuffer[1], 0xbb);
    assert.equal(csvBuffer[2], 0xbf);

    const csvStr = csvBuffer.toString("utf-8");
    assert.ok(csvStr.includes("முருகன் டிராவல்ஸ்"));
    assert.ok(csvStr.includes("சென்னை முதல் மதுரை விமான முன்பதிவு"));
  });

  // Requirement 89: Test Formula Injection Protection (CSV & Excel)
  test("Requirement 89: sanitizes dangerous formula characters (=, +, -, @) against spreadsheet injection", () => {
    // Malicious formula strings
    const malicious1 = "=cmd|'/C calc'!A0";
    const malicious2 = "+cmd|'/C calc'!A0";
    const malicious3 = "-2+3+cmd";
    const malicious4 = "@SUM(A1:A10)";

    // Should prepend single quote
    assert.equal(sanitizeExcelCellValue(malicious1), "'=cmd|'/C calc'!A0");
    assert.equal(sanitizeExcelCellValue(malicious2), "'+cmd|'/C calc'!A0");
    assert.equal(sanitizeExcelCellValue(malicious3), "'-2+3+cmd");
    assert.equal(sanitizeExcelCellValue(malicious4), "'@SUM(A1:A10)");
    assert.equal(sanitizeCsvCell(malicious1), "'=cmd|'/C calc'!A0");
    assert.equal(sanitizeCsvCell(malicious2), "'+cmd|'/C calc'!A0");
    assert.equal(sanitizeCsvCell(malicious3), "'-2+3+cmd");
    assert.equal(sanitizeCsvCell(malicious4), "'@SUM(A1:A10)");

    // Legitimate negative/positive numbers should NOT be prepended with quote
    assert.equal(sanitizeExcelCellValue("-500"), "-500");
    assert.equal(sanitizeExcelCellValue("+1500.50"), "+1500.50");
    assert.equal(sanitizeCsvCell("-500"), "-500");
    assert.equal(sanitizeCsvCell("+1500.50"), "+1500.50");

    // Test in full CSV escape
    const escaped = escapeCsvField("=SUM(A1:A10),danger");
    assert.equal(escaped, `"'=SUM(A1:A10),danger"`);
  });

  // Requirement 90 & 91: Test Column Auto-fit and Large Text Safety
  test("Requirement 90 & 91: caps maximum column width to prevent giant spreadsheet cells", () => {
    const longText = "A".repeat(500);
    const txnWithLongDesc: TransactionReportRowDTO = {
      id: "tx-long",
      transactionNumber: "TXN-LONG",
      date: new Date("2026-09-01"),
      type: TransactionType.INCOME,
      partyName: "Normal Party",
      categoryName: "General",
      description: longText,
      referenceNumber: null,
      amount: Money.of(100),
      paidAmount: Money.zero(),
      outstandingAmount: Money.of(100),
      paymentStatus: PaymentStatus.UNPAID,
      status: TransactionStatus.POSTED,
      dueDate: null,
      daysOverdue: 0,
      createdBy: "System",
      createdAt: new Date("2026-09-01"),
      tags: [],
    };

    const rows = [
      ["Date", "Description", "Amount"],
      ["29-09-2026", longText, 100],
    ];

    const cols = autoFitColumns(rows);
    assert.ok(cols && cols.length === 3, "Cols array must be calculated for all 3 columns");
    assert.ok(
      cols[1].wch !== undefined && cols[1].wch <= 45,
      `Column width ${cols[1].wch} must be capped at 45 characters despite 500-char input`
    );

    const xlsxBuffer = ExcelExportService.generateTransactionsWorkbook([txnWithLongDesc]);
    assert.ok(xlsxBuffer && xlsxBuffer.length > 0, "Workbook with long text generates safely");
  });

  // Requirement 93: Test Permission Enforcement
  test("Requirement 93: enforces server-side export and entity permissions", () => {
    // 1. Missing exports.execute
    assert.throws(
      () => {
        ExportService.validateExportPermissions("TRANSACTIONS", ["records.view"], ["STAFF"]);
      },
      /exports\.execute required/,
      "User without exports.execute must be blocked"
    );

    // 2. Has exports.execute, but lacks payables.view when requesting PAYABLES
    assert.throws(
      () => {
        ExportService.validateExportPermissions(
          "PAYABLES",
          ["exports.execute", "income.view"],
          ["STAFF"]
        );
      },
      /payables \/ supplier records/,
      "User without payables.view must not export payables"
    );

    // 3. User with proper permissions succeeds
    assert.doesNotThrow(() => {
      ExportService.validateExportPermissions(
        "PAYABLES",
        ["exports.execute", "payables.view"],
        ["STAFF"]
      );
    });

    // 4. OWNER role succeeds unconditionally
    assert.doesNotThrow(() => {
      ExportService.validateExportPermissions("PAYABLES", [], ["OWNER"]);
    });
  });
});
