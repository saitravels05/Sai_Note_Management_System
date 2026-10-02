import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ImporterService } from "../src/server/services/importer.service";
import * as XLSX from "xlsx";

describe("Phase 7 Excel & CSV Intelligent Import Engine", () => {
  // Requirement 91: Test Simple CSV
  test("Requirement 91: parses simple CSV and extracts valid headers and rows", () => {
    const csvContent =
      "Date,Type,Description,Amount\n" +
      "29-09-2026,Income,Client Flight Booking,45000\n" +
      "30-09-2026,Expense,Diesel Fuel Fleet,12500\n";
    const csvBuffer = Buffer.from(csvContent, "utf-8");

    const analysis = ImporterService.analyzeWorkbook(csvBuffer, "daily_txns.csv");

    assert.equal(analysis.fileType, "csv");
    assert.equal(analysis.sheetCount, 1);
    assert.equal(analysis.detectedColumns.length, 4);
    assert.deepEqual(analysis.detectedColumns, ["Date", "Type", "Description", "Amount"]);
    assert.equal(analysis.sampleRows.length, 2);
    assert.equal(analysis.sampleRows[0]["Amount"], "45000");
    assert.equal(analysis.sampleRows[1]["Description"], "Diesel Fuel Fleet");
  });

  // Requirement 92: Test XLSX Workbook
  test("Requirement 92: parses XLSX workbook with multiple entity types and suggests mappings", () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Txn Date", "Txn Type", "Party", "Head", "Amt", "Remarks"],
      ["29-09-2026", "Income", "Ramesh Kumar", "Tour Package", "50000", "Kashmir Booking"],
      ["29-09-2026", "Expense", "Indigo Airlines", "Flight Tickets", "18000", "PNR-XYZ123"],
      ["30-09-2026", "Receivable", "Global Corporate", "Conferences", "120000", "Corporate Invoice"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Accounts");

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const analysis = ImporterService.analyzeWorkbook(xlsxBuffer, "monthly_accounts.xlsx");

    assert.equal(analysis.fileType, "xlsx");
    assert.equal(analysis.sheetNames[0], "Accounts");
    assert.equal(analysis.detectedColumns.length, 6);
    assert.equal(analysis.sampleRows.length, 3);

    // Verify deterministic intelligent suggestions
    assert.equal(analysis.suggestedMappings["Txn Date"], "transactionDate");
    assert.equal(analysis.suggestedMappings["Txn Type"], "transactionType");
    assert.equal(analysis.suggestedMappings["Amt"], "amount");
    assert.equal(analysis.suggestedMappings["Remarks"], "description");
    assert.equal(analysis.suggestedMappings["Party"], "customer");
  });

  // Requirement 93: Multiple Sheets Selection
  test("Requirement 93: workbook with multiple sheets allows selecting active sheet while ignoring summary", () => {
    const wb = XLSX.utils.book_new();

    const janData = [
      ["Date", "Amount", "Description"],
      ["15-01-2026", "25000", "January Booking"],
    ];
    const febData = [
      ["Date", "Amount", "Description"],
      ["10-02-2026", "32000", "February Booking"],
    ];
    const summaryData = [
      ["Month", "Total"],
      ["January", "25000"],
      ["February", "32000"],
      ["GRAND TOTAL", "57000"],
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(janData), "January");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(febData), "February");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Inspect sheets available
    const initial = ImporterService.analyzeWorkbook(xlsxBuffer, "q1_data.xlsx");
    assert.deepEqual(initial.sheetNames, ["January", "February", "Summary"]);

    // Choose February explicitly
    const febAnalysis = ImporterService.analyzeWorkbook(xlsxBuffer, "q1_data.xlsx", "February");
    assert.equal(febAnalysis.sampleRows[0]["Description"], "February Booking");
    assert.equal(febAnalysis.sampleRows[0]["Amount"], "32000");
  });

  // Requirement 94: Header Offset Detection
  test("Requirement 94: detects header starting at row 5 when metadata rows are present", () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Sai Tours & Travels Private Limited"],
      ["Monthly Accounting Report"],
      ["September 2026"],
      [""],
      ["Date", "Particulars", "Customer", "Amount", "Mode"],
      ["29-09-2026", "Tour Package", "Ramesh Kumar", "45000", "UPI"],
      ["30-09-2026", "Hotel Booking", "Hotel Grand", "12000", "Bank"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Statement");

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const analysis = ImporterService.analyzeWorkbook(xlsxBuffer, "statement.xlsx");

    // Automatically detects row 5 as the true header row
    assert.equal(analysis.detectedHeaderRow, 5);
    assert.deepEqual(analysis.detectedColumns, ["Date", "Particulars", "Customer", "Amount", "Mode"]);
    assert.equal(analysis.sampleRows.length, 2);
    assert.equal(analysis.sampleRows[0]["Date"], "29-09-2026");

    // Allows manual override if user specifies row 5
    const overridden = ImporterService.analyzeWorkbook(xlsxBuffer, "statement.xlsx", "Statement", 5);
    assert.equal(overridden.detectedHeaderRow, 5);
  });

  // Requirement 95: Indian Money Parsing
  test("Requirement 95: safely parses Indian numbering system without floating point drift", () => {
    const testCases = [
      { input: "₹1,25,000.50", expected: "125000.50" },
      { input: "12,50,000", expected: "1250000.00" },
      { input: "1,00,00,000.00", expected: "10000000.00" },
      { input: "₹ 50,000", expected: "50000.00" },
      { input: "45000", expected: "45000.00" },
      { input: "(5000.00)", expected: "-5000.00" }, // Parentheses negative
      { input: "-12000.50", expected: "-12000.50" },
    ];

    for (const tc of testCases) {
      const res = ImporterService.parseImportAmount(tc.input);
      assert.equal(res.valid, true, `Expected valid for input ${tc.input}`);
      assert.equal(res.money?.toDecimalString(), tc.expected);
    }
  });

  // Requirement 96: Date Normalization
  test("Requirement 96: normalizes DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, and Excel serial numbers", () => {
    // 1. DD-MM-YYYY
    const d1 = ImporterService.parseImportDate("30-09-2026");
    assert.equal(d1.valid, true);
    assert.equal(d1.formatted, "30-09-2026");

    // 2. DD/MM/YYYY
    const d2 = ImporterService.parseImportDate("30/09/2026");
    assert.equal(d2.valid, true);
    assert.equal(d2.formatted, "30-09-2026");

    // 3. YYYY-MM-DD
    const d3 = ImporterService.parseImportDate("2026-09-30");
    assert.equal(d3.valid, true);
    assert.equal(d3.formatted, "30-09-2026");

    // 4. Excel serial date (46295 = 2026-09-30)
    const d4 = ImporterService.parseImportDate(46295);
    assert.equal(d4.valid, true);
    assert.equal(d4.formatted, "30-09-2026");
  });

  // Requirement 97: Ambiguous Date Safety
  test("Requirement 97: handles ambiguous 01/02/2026 with warning, defaulting safely to DD-MM-YYYY", () => {
    const res = ImporterService.parseImportDate("01/02/2026");

    assert.equal(res.valid, true);
    assert.equal(res.isAmbiguous, true);
    // Indian standard default: 1st February 2026
    assert.equal(res.formatted, "01-02-2026");
  });

  // Requirement 101: Invalid Money Rejected (Never converted to ₹0)
  test("Requirement 101: flags text, malformed currency, or empty amounts as ERROR without converting to ₹0", () => {
    const invalidCases = ["ABC", "₹XYZ", "NaN", "50000.50.20", "Text123", "", null, undefined];

    for (const val of invalidCases) {
      const res = ImporterService.parseImportAmount(val);
      assert.equal(res.valid, false, `Expected ${val} to be rejected`);
      assert.equal(res.money, undefined, "Invalid money must not return a Money instance");
    }
  });

  // Requirement 102: Summary and Total Rows Excluded
  test("Requirement 102: identifies and excludes summary and total rows from transaction import", () => {
    const totalRow1 = ["TOTAL", "50000", ""];
    const totalRow2 = ["GRAND TOTAL ₹5,00,000", ""];
    const totalRow3 = ["Month Total", "125000"];
    const validRow = ["29-09-2026", "45000", "Regular Sale"];

    assert.equal(ImporterService.isSummaryRow(totalRow1), true);
    assert.equal(ImporterService.isSummaryRow(totalRow2), true);
    assert.equal(ImporterService.isSummaryRow(totalRow3), true);
    assert.equal(ImporterService.isSummaryRow(validRow), false);
  });

  // Requirement 105: Tamil & Unicode Data Preservation
  test("Requirement 105: preserves Tamil names, notes, and Unicode descriptions without corruption", () => {
    const tamilData = [
      ["Date", "Customer", "Amount", "Description"],
      ["29-09-2026", "ஸ்ரீ சாய் டூர்ஸ் & டிராவல்ஸ்", "45000", "சென்னை டிரிப் முன்பதிவு"],
      ["30-09-2026", "மோகன் ராம்", "12000", "டீசல் மற்றும் சுங்க கட்டணம்"],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tamilData), "TamilSheet");

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const analysis = ImporterService.analyzeWorkbook(xlsxBuffer, "tamil_accounts.xlsx");

    assert.equal(analysis.sampleRows[0]["Customer"], "ஸ்ரீ சாய் டூர்ஸ் & டிராவல்ஸ்");
    assert.equal(analysis.sampleRows[0]["Description"], "சென்னை டிரிப் முன்பதிவு");
    assert.equal(analysis.sampleRows[1]["Customer"], "மோகன் ராம்");
    assert.equal(analysis.sampleRows[1]["Description"], "டீசல் மற்றும் சுங்க கட்டணம்");
  });

  // Requirement 106: File Limits & Memory Safety
  test("Requirement 106: rejects files exceeding maximum size limit or empty buffers", () => {
    // 1. Empty buffer
    assert.throws(
      () => ImporterService.validateFile(Buffer.alloc(0), "empty.xlsx"),
      /Uploaded file is empty/
    );

    // 2. Oversized buffer (> 15MB)
    const largeBuffer = Buffer.alloc(16 * 1024 * 1024);
    assert.throws(
      () => ImporterService.validateFile(largeBuffer, "huge.xlsx"),
      /This file is too large/
    );

    // 3. Unsupported extension
    assert.throws(
      () => ImporterService.validateFile(Buffer.from("dummy"), "document.pdf"),
      /Unsupported file format/
    );
  });

  // Duplicate Headers Handling
  test("Requirement 78: duplicate header names are disambiguated with column letters", () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Date", "Amount", "Description", "Amount"],
      ["29-09-2026", "45000", "Sale", "5000"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Duplicates");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const analysis = ImporterService.analyzeWorkbook(buffer, "dupe_headers.xlsx");

    assert.equal(analysis.detectedColumns[1], "Amount");
    assert.equal(analysis.detectedColumns[3], "Amount (Column D)");
  });

  // Downloadable Template Headers
  test("Requirement 69 & 70: generates clean standard templates with proper column documentation", () => {
    const incomeTemplate = ImporterService.getTemplateHeaders("INCOME");
    assert.ok(incomeTemplate.headers.includes("Date"));
    assert.ok(incomeTemplate.headers.includes("Amount"));
    assert.ok(incomeTemplate.headers.includes("Customer"));
    assert.ok(incomeTemplate.columnDocumentation["Date"].includes("Required"));
    assert.ok(incomeTemplate.columnDocumentation["Customer"].includes("Optional"));

    const expenseTemplate = ImporterService.getTemplateHeaders("EXPENSE");
    assert.ok(expenseTemplate.headers.includes("Supplier"));
    assert.ok(expenseTemplate.columnDocumentation["Supplier"].includes("Optional"));
  });
});
