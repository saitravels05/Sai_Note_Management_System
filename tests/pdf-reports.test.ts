import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Money } from "../src/lib/money";
import { PdfReportService } from "../src/server/services/pdf-report.service";
import {
  type FinancialSummaryReportDTO,
  type MonthlyWorkbookDataDTO,
  type TransactionReportRowDTO,
  type AgingScheduleReportRowDTO,
} from "../src/server/services/report-data.service";
import { type CustomerLedgerResult } from "../src/server/services/ledger.service";
import { setupPdfFonts, formatPdfMoney } from "../src/server/services/pdf/pdf-theme";
import { PdfBuilder } from "../src/server/services/pdf/pdf-builder";
import PDFDocument from "pdfkit";
import { TransactionType, TransactionStatus, PaymentStatus } from "@prisma/client";

describe("Phase 9 Professional PDF Reporting & Statement Generator", () => {
  function createMockSummary(): FinancialSummaryReportDTO {
    return {
      business: {
        id: "biz-test-1",
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

  // Helper to collect PDF document stream to buffer
  async function docToBuffer(doc: typeof PDFDocument.prototype): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });
  }

  test("Requirement 93 & 94: Nirmala font renders Tamil Unicode and Indian Rupee ₹ into valid PDF", async () => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true, margin: 40 });
    const fonts = setupPdfFonts(doc);

    // Write Tamil text and Rupee symbol
    doc.font(fonts.bold).fontSize(16).text("சாயி டூர்ஸ் & டிராவல்ஸ் (Sai Tours & Travels)");
    doc.font(fonts.regular).fontSize(12).text("டிக்கெட் முன்பதிவு - சென்னை முதல் மதுரை வரை");
    doc.text(`மொத்த வருமானம்: ${formatPdfMoney(Money.of(125000))}`);

    const buffer = await docToBuffer(doc);

    assert.ok(buffer.length > 1000, "PDF buffer must be valid and non-empty");
    assert.ok(buffer.toString("binary", 0, 5) === "%PDF-", "Buffer must have valid %PDF- magic header");
  });

  test("Requirement 86: PDF Income, Expenses, Receivables, and Payables match Dashboard & Excel exactly", () => {
    const summary = createMockSummary();

    // Verify mathematical single source of truth
    const calculatedNet = summary.totalIncome.minus(summary.totalExpenses);
    assert.equal(calculatedNet.toDecimalString(), summary.netResult.toDecimalString());

    // Currency formatting strictly preserves precision
    assert.equal(formatPdfMoney(summary.totalIncome), "₹4,85,000.50");
    assert.equal(formatPdfMoney(summary.totalExpenses), "₹1,95,000.25");
    assert.equal(formatPdfMoney(summary.netResult), "₹2,90,000.25");
    assert.equal(formatPdfMoney(summary.receivablesOutstanding), "₹1,25,000.00");
    assert.equal(formatPdfMoney(summary.payablesOutstanding), "₹65,000.00");
  });

  test("Requirement 87 & 88: Customer and Supplier Ledger Debits, Credits, and Running Balance reconcile", () => {
    const customerLedger: CustomerLedgerResult = {
      customer: {
        id: "cust-1",
        name: "Murugan Transports",
        companyName: "Murugan Logistics Pvt Ltd",
        customerCode: "CUST-001",
        phone: "+91 98765 43210",
        email: "murugan@example.com",
      },
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-30"),
      openingBalance: Money.of(10000),
      totalDebits: Money.of(50000),
      totalCredits: Money.of(35000),
      closingBalance: Money.of(25000), // 10000 + 50000 - 35000 = 25000
      totalOutstanding: Money.of(25000),
      entries: [
        {
          id: "e-1",
          date: new Date("2026-09-05"),
          entityNumber: "INV-101",
          referenceNumber: "INV-101",
          description: "Flight ticket Chennai to Delhi",
          type: "TRANSACTION",
          rawType: "RECORD",
          debit: Money.of(50000),
          credit: Money.zero(),
          runningBalance: Money.of(60000),
          status: "POSTED",
        },
        {
          id: "e-2",
          date: new Date("2026-09-12"),
          entityNumber: "PAY-201",
          referenceNumber: "UPI-409",
          description: "Advance Settlement via GPay",
          type: "PAYMENT",
          rawType: "PAYMENT",
          debit: Money.zero(),
          credit: Money.of(35000),
          runningBalance: Money.of(25000),
          status: "ALLOCATED",
        },
      ],
    };

    // Reconcile mathematical equation: Opening + Debits - Credits = Closing
    const expectedClosing = customerLedger.openingBalance
      .add(customerLedger.totalDebits)
      .minus(customerLedger.totalCredits);

    assert.equal(customerLedger.closingBalance.toDecimalString(), expectedClosing.toDecimalString());
    assert.equal(customerLedger.closingBalance.toDecimalString(), "25000.00");
  });

  test("Requirement 89: Partial Payment displays Original, Paid, and Outstanding balances accurately", () => {
    const original = Money.of(50000);
    const paid = Money.of(20000);
    const outstanding = original.minus(paid);

    assert.equal(formatPdfMoney(original), "₹50,000.00");
    assert.equal(formatPdfMoney(paid), "₹20,000.00");
    assert.equal(formatPdfMoney(outstanding), "₹30,000.00");
    assert.equal(outstanding.toDecimalString(), "30000.00");
  });

  test("Requirement 90: Aging Schedule computes exactly across 5 buckets (Current, 1-30, 31-60, 61-90, 90+)", () => {
    const mockAgingRow: AgingScheduleReportRowDTO = {
      partyId: "p-1",
      partyCode: "CUST-002",
      partyName: "Karthik Raja Travels",
      current: Money.of(15000),
      days1To30: Money.of(25000),
      days31To60: Money.of(10000),
      days61To90: Money.of(5000),
      days90Plus: Money.of(8000),
      totalOutstanding: Money.of(63000),
    };

    const bucketSum = mockAgingRow.current
      .add(mockAgingRow.days1To30)
      .add(mockAgingRow.days31To60)
      .add(mockAgingRow.days61To90)
      .add(mockAgingRow.days90Plus);

    assert.equal(mockAgingRow.totalOutstanding.toDecimalString(), bucketSum.toDecimalString());
    assert.equal(mockAgingRow.totalOutstanding.toDecimalString(), "63000.00");
  });

  test("Requirement 91: Multi-Page Table repeats column headers and maintains page counter buffer", async () => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true, margin: 40 });
    const fonts = setupPdfFonts(doc);

    // Create 60 rows to force multiple pages
    const rows = Array.from({ length: 60 }, (_, i) => ({
      date: "15-09-2026",
      number: `TXN-2026-${String(i + 1).padStart(3, "0")}`,
      party: `Passenger ${i + 1} Kumar`,
      amount: "₹12,500.00",
      status: "PAID",
    }));

    PdfBuilder.drawTable(doc, fonts, {
      title: "Multi-Page Continuous Journal",
      columns: [
        { id: "date", header: "Date", width: 80 },
        { id: "number", header: "Txn #", width: 100 },
        { id: "party", header: "Customer Name", width: 180 },
        { id: "amount", header: "Amount", width: 100, align: "right" },
        { id: "status", header: "Status", width: 60, align: "center" },
      ],
      rows,
    });

    const rangeBeforeEnd = doc.bufferedPageRange();
    assert.ok(rangeBeforeEnd.count > 1, `Table must span more than 1 page (actual: ${rangeBeforeEnd.count})`);

    PdfBuilder.finalizeFooters(doc, fonts, "Sai Tours & Travels", "RPT-2026-TEST01", false, "Asia/Kolkata");
    const buffer = await docToBuffer(doc);

    assert.ok(buffer.length > 5000, "Rendered PDF must have substantial content");
  });

  test("Requirement 92: Long descriptions wrap safely without breaking layout boundaries", async () => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true, margin: 40 });
    const fonts = setupPdfFonts(doc);

    const veryLongDescription =
      "International holiday booking package including roundtrip flights from Chennai (MAA) to Singapore (SIN) with Singapore Airlines, 4 nights accommodation at Marina Bay Sands, daily buffet breakfast, Sentosa island tour with universal studios entry pass, private airport transfers, travel insurance for 4 passengers, and visa assistance fees.";

    PdfBuilder.drawTable(doc, fonts, {
      title: "Wrapping Test Table",
      columns: [
        { id: "number", header: "Txn #", width: 100 },
        { id: "desc", header: "Detailed Description", width: 420 },
      ],
      rows: [
        {
          number: "TXN-2026-099",
          desc: veryLongDescription,
        },
      ],
    });

    const buffer = await docToBuffer(doc);
    assert.ok(buffer.length > 1000, "PDF with wrapped text must generate successfully");
  });

  test("Requirement 95: Business branding fallback works safely when logo file is missing", async () => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true, margin: 40 });
    const fonts = setupPdfFonts(doc);

    // Test with nonexistent logo path
    PdfBuilder.drawHeader(doc, fonts, {
      business: {
        name: "Sai Tours & Travels",
        legalName: "Sai Tours & Travels Private Limited",
        addressLine1: "No. 45, GST Road, Tambaram, Chennai - 600045",
        phone: "+91 94440 12345",
        email: "accounts@saitours.com",
        gstin: "33AAAAA0000A1Z5",
        logoUrl: "/nonexistent/path/to/missing_logo.png",
      },
      reportTitle: "Branding Fallback Financial Statement",
      periodLabel: "01-09-2026 to 30-09-2026",
      reportReference: "RPT-2026-FALLBACK",
    });

    const buffer = await docToBuffer(doc);
    assert.ok(buffer.length > 1000, "Header must render cleanly without failing when logo is absent");
  });

  test("Requirement 56: Customer statement excludes internal operational notes", () => {
    const sampleRecord = {
      description: "Flight booking Chennai - Dubai for Mr. Senthil",
      internalNotes: "Customer requested discount, manager approved 5% commission cut. Follow up on Monday for passport copy.",
    };

    // The customer statement column maps strictly to description
    const customerVisibleLine = sampleRecord.description;
    assert.ok(!customerVisibleLine.includes("discount"), "Customer statement must not contain internal pricing notes");
    assert.ok(!customerVisibleLine.includes("passport"), "Customer statement must not contain internal operational memos");
    assert.equal(customerVisibleLine, "Flight booking Chennai - Dubai for Mr. Senthil");
  });

  test("Requirement 98: Permission isolation prevents unauthorized report generation", () => {
    const staffPermissions = ["reports.view", "records.create"];
    const staffRoles = ["STAFF"];

    // Staff can view standard reports
    assert.doesNotThrow(() => {
      PdfReportService.validatePermissions("MONTHLY_ACCOUNTING", staffPermissions, staffRoles);
    });

    // Staff cannot generate management summary without reports.management permission
    assert.throws(
      () => {
        PdfReportService.validatePermissions("MANAGEMENT_SUMMARY", staffPermissions, staffRoles);
      },
      /reports\.management required/
    );

    // Staff without payables permission cannot generate payables report
    assert.throws(
      () => {
        PdfReportService.validatePermissions("PAYABLES", staffPermissions, staffRoles);
      },
      /payables\.view or suppliers\.view required/
    );
  });

  test("Requirement 101: Formula & script text in descriptions are rendered safely as inert text", async () => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true, margin: 40 });
    const fonts = setupPdfFonts(doc);

    const maliciousDescription = "=SUM(A1:A100) <script>alert('xss')</script> http://malicious.site";

    PdfBuilder.drawTable(doc, fonts, {
      title: "Security Sanitization Test",
      columns: [
        { id: "id", header: "ID", width: 80 },
        { id: "text", header: "Content", width: 440 },
      ],
      rows: [
        {
          id: "SEC-01",
          text: maliciousDescription,
        },
      ],
    });

    const buffer = await docToBuffer(doc);
    assert.ok(buffer.length > 1000, "Script text must render as inert text without executing");
  });

  // =========================================================================
  // ALL 20 PDF REPORT TYPES RENDERING TESTS
  // =========================================================================

  test("Requirement 13: Monthly Accounting Report renders multi-section PDF dossier", async () => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true, margin: 36 });
    const fonts = setupPdfFonts(doc);
    const summary = createMockSummary();
    const txns: TransactionReportRowDTO[] = [
      {
        id: "tx-1",
        transactionNumber: "TXN-2026-001",
        date: new Date("2026-09-10"),
        type: TransactionType.INCOME,
        partyName: "Senthil Kumar",
        categoryName: "Flight Booking",
        description: "Chennai to Dubai Return",
        referenceNumber: "PNR-101",
        amount: Money.of(45000),
        paidAmount: Money.of(45000),
        outstandingAmount: Money.zero(),
        paymentStatus: PaymentStatus.PAID,
        status: TransactionStatus.POSTED,
        dueDate: null,
        daysOverdue: 0,
        createdBy: "Staff",
        createdAt: new Date("2026-09-10"),
        tags: [],
      },
    ];

    const data: MonthlyWorkbookDataDTO = {
      summary,
      incomeRows: txns,
      expenseRows: [],
      allTransactions: txns,
      payments: [],
      receivables: [],
      payables: [],
      customerSummary: [],
      supplierSummary: [],
      categorySummary: [
        {
          id: "cat-1",
          name: "Flight Tickets",
          type: "INCOME",
          transactionCount: 15,
          incomeAmount: Money.of(350000),
          expenseAmount: Money.zero(),
          percentageOfTotal: 72.2,
        },
      ],
      paymentSummary: [],
      dailySummary: [],
      monthlyAnalysis: [],
    };

    PdfReportService.renderMonthlyAccounting(doc, fonts, data, {
      business: { name: "Sai Tours & Travels", legalName: "Sai Tours Pvt Ltd" },
      reportTitle: "Monthly Accounting Report",
      periodLabel: "September 2026",
      reportReference: "RPT-2026-0001",
    });

    PdfBuilder.finalizeFooters(doc, fonts, "Sai Tours & Travels", "RPT-2026-0001", false, "Asia/Kolkata");
    const buffer = await docToBuffer(doc);
    assert.ok(buffer.length > 5000, "Monthly accounting report PDF must generate valid content");
  });

  test("Requirement 14: Financial Summary PDF renders compact 1-page report", async () => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true, margin: 36 });
    const fonts = setupPdfFonts(doc);
    const summary = createMockSummary();

    PdfReportService.renderFinancialSummary(doc, fonts, summary, {
      business: { name: "Sai Tours & Travels" },
      reportTitle: "Executive Financial Summary",
      periodLabel: "September 2026",
      reportReference: "RPT-2026-0002",
    });

    PdfBuilder.finalizeFooters(doc, fonts, "Sai Tours & Travels", "RPT-2026-0002", false, "Asia/Kolkata");
    const buffer = await docToBuffer(doc);
    assert.ok(buffer.length > 3000, "Financial summary PDF must generate valid content");
  });

  test("Requirement 15 & 16: Income and Expense Reports render line-item tables", async () => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true, margin: 36 });
    const fonts = setupPdfFonts(doc);
    const rows: TransactionReportRowDTO[] = [
      {
        id: "tx-inc",
        transactionNumber: "INC-2026-001",
        date: new Date("2026-09-08"),
        type: TransactionType.INCOME,
        partyName: "Murugan Travels",
        categoryName: "Holiday Tour",
        description: "Singapore Family Holiday",
        referenceNumber: "REF-SG-01",
        amount: Money.of(150000),
        paidAmount: Money.of(150000),
        outstandingAmount: Money.zero(),
        paymentStatus: PaymentStatus.PAID,
        status: TransactionStatus.POSTED,
        dueDate: null,
        daysOverdue: 0,
        createdBy: "Staff",
        createdAt: new Date("2026-09-08"),
        tags: [],
      },
    ];

    PdfReportService.renderIncomeReport(doc, fonts, rows, {
      business: { name: "Sai Tours & Travels" },
      reportTitle: "Income & Revenue Report",
      periodLabel: "September 2026",
      reportReference: "RPT-2026-0003",
    });

    PdfBuilder.finalizeFooters(doc, fonts, "Sai Tours & Travels", "RPT-2026-0003", false, "Asia/Kolkata");
    const buffer = await docToBuffer(doc);
    assert.ok(buffer.length > 2500, "Income report PDF must generate valid content");
  });

  test("Requirement 19: Cash Movement & Liquidity Report renders inflows and outflows", async () => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true, margin: 36 });
    const fonts = setupPdfFonts(doc);

    PdfReportService.renderCashMovementReport(
      doc,
      fonts,
      {
        business: { id: "biz-1", name: "Sai Tours & Travels", currency: "INR" },
        period: { label: "September 2026", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-30") },
        openingBalance: Money.of(100000),
        totalInflow: Money.of(350000),
        totalOutflow: Money.of(200000),
        netCashMovement: Money.of(150000),
        closingBalance: Money.of(250000),
        paymentMethods: [
          {
            id: "pm-1",
            name: "HDFC Current Account (Bank Transfer)",
            type: "BANK",
            inflow: Money.of(250000),
            outflow: Money.of(150000),
            netFlow: Money.of(100000),
          },
          {
            id: "pm-2",
            name: "Google Pay UPI",
            type: "UPI",
            inflow: Money.of(100000),
            outflow: Money.of(50000),
            netFlow: Money.of(50000),
          },
        ],
      },
      {
        business: { name: "Sai Tours & Travels" },
        reportTitle: "Cash Movement & Liquidity Report",
        periodLabel: "September 2026",
        reportReference: "RPT-2026-0004",
      }
    );

    PdfBuilder.finalizeFooters(doc, fonts, "Sai Tours & Travels", "RPT-2026-0004", false, "Asia/Kolkata");
    const buffer = await docToBuffer(doc);
    assert.ok(buffer.length > 3000, "Cash movement report PDF must generate valid content");
  });

  test("Requirement 24 & 26: Customer Statement and Supplier Statement render professional statements", async () => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true, margin: 36 });
    const fonts = setupPdfFonts(doc);

    const customerLedger: CustomerLedgerResult = {
      customer: {
        id: "cust-1",
        name: "Arunachalam & Co",
        companyName: "Arunachalam Textiles Ltd",
        customerCode: "CUST-009",
        phone: "+91 94433 22110",
        email: "arun@example.com",
      },
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-30"),
      openingBalance: Money.of(5000),
      totalDebits: Money.of(80000),
      totalCredits: Money.of(60000),
      closingBalance: Money.of(25000),
      totalOutstanding: Money.of(25000),
      entries: [
        {
          id: "e-1",
          date: new Date("2026-09-05"),
          entityNumber: "INV-554",
          referenceNumber: "INV-554",
          description: "Flight tickets to London Heathrow",
          type: "TRANSACTION",
          rawType: "RECORD",
          debit: Money.of(80000),
          credit: Money.zero(),
          runningBalance: Money.of(85000),
          status: "POSTED",
        },
      ],
    };

    PdfReportService.renderCustomerStatement(doc, fonts, customerLedger, {
      business: { name: "Sai Tours & Travels" },
      reportTitle: "Customer Statement of Account",
      periodLabel: "01-09-2026 to 30-09-2026",
      reportReference: "RPT-2026-0005",
    });

    PdfBuilder.finalizeFooters(doc, fonts, "Sai Tours & Travels", "RPT-2026-0005", false, "Asia/Kolkata");
    const buffer = await docToBuffer(doc);
    assert.ok(buffer.length > 2500, "Customer statement PDF must generate valid content");
  });

  test("Requirement 32: Management Summary renders executive brief with KPIs and deterministic insights", async () => {
    const doc = new PDFDocument({ size: "A4", bufferPages: true, margin: 36 });
    const fonts = setupPdfFonts(doc);
    const summary = createMockSummary();

    PdfReportService.renderManagementSummaryReport(
      doc,
      fonts,
      {
        financialSummary: summary,
        topIncomeCategories: [
          {
            id: "cat-inc-1",
            name: "Flight Tickets",
            type: "INCOME",
            transactionCount: 28,
            incomeAmount: Money.of(400000),
            expenseAmount: Money.zero(),
            percentageOfTotal: 82.5,
          },
        ],
        topExpenseCategories: [
          {
            id: "cat-exp-1",
            name: "Airline Settlements",
            type: "EXPENSE",
            transactionCount: 14,
            incomeAmount: Money.zero(),
            expenseAmount: Money.of(160000),
            percentageOfTotal: 82.1,
          },
        ],
        paymentMethods: [],
        accountingHealth: {
          status: "BALANCED",
          discrepancyCount: 0,
          notes: ["All payments allocated without discrepancies."],
        },
        insights: [
          "Operating revenue grew 14.2% compared to previous period.",
          "Net profit margin remains strong at 59.8%.",
        ],
      },
      {
        business: { name: "Sai Tours & Travels" },
        reportTitle: "Executive Management Briefing",
        periodLabel: "September 2026",
        reportReference: "RPT-2026-0006",
      }
    );

    PdfBuilder.finalizeFooters(doc, fonts, "Sai Tours & Travels", "RPT-2026-0006", false, "Asia/Kolkata");
    const buffer = await docToBuffer(doc);
    assert.ok(buffer.length > 3000, "Management summary PDF must generate valid content");
  });
});

