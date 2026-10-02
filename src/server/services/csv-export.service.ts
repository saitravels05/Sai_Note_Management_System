import { formatBusinessDate, formatBusinessDateTime } from "@/lib/date";
import { Money } from "@/lib/money";
import {
  type TransactionReportRowDTO,
  type PaymentReportRowDTO,
  type PartySummaryReportRowDTO,
  type AgingScheduleReportRowDTO,
} from "./report-data.service";
import { type CustomerLedgerResult, type SupplierLedgerResult } from "./ledger.service";

/**
 * Sanitize cell text for CSV export against CSV formula injection (CWE-1236).
 * Prepends a single quote if the cell begins with dangerous formula prefix characters: =, +, -, @
 * Standalone valid numbers (like -150 or +20) are preserved.
 */
export function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (!str) return "";

  if (/^[\t\r]/.test(str)) {
    return `'${str}`;
  }

  const trimmed = str.trim();
  if (/^[=+\-@]/.test(trimmed)) {
    if (/^[+\-]?\d+(\.\d+)?$/.test(trimmed)) {
      return trimmed;
    }
    return `'${trimmed}`;
  }

  return str;
}

/**
 * Escape a CSV field according to RFC 4180.
 * Wraps in double quotes if it contains commas, double quotes, or newlines.
 */
export function escapeCsvField(val: unknown): string {
  const sanitized = sanitizeCsvCell(val);
  if (
    sanitized.includes(",") ||
    sanitized.includes('"') ||
    sanitized.includes("\n") ||
    sanitized.includes("\r")
  ) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/**
 * Format Money to standard 2-decimal string for CSV.
 */
export function moneyToCsvString(money: Money | undefined | null): string {
  if (!money) return "0.00";
  return money.getDecimal().toFixed(2);
}

/**
 * CsvExportService — Production-grade CSV generator with UTF-8 BOM and formula injection protection.
 */
export class CsvExportService {
  /**
   * Prepend UTF-8 Byte Order Mark (\uFEFF) to string so Excel on Windows recognizes UTF-8 (Tamil/Unicode).
   */
  private static withBom(csvContent: string): Buffer {
    return Buffer.from("\uFEFF" + csvContent, "utf-8");
  }

  /**
   * 1. Export Transactions CSV
   */
  public static exportTransactionsCsv(
    transactions: TransactionReportRowDTO[],
    title = "Transactions"
  ): Buffer {
    const lines: string[] = [];

    // Header metadata
    lines.push(`# SAI TOURS & TRAVELS — ${title.toUpperCase()}`);
    lines.push(`# Generated: ${formatBusinessDateTime(new Date())}`);
    lines.push("");

    // Column headers
    const headers = [
      "Date",
      "Transaction Number",
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
    ];
    lines.push(headers.map(escapeCsvField).join(","));

    // Data rows
    transactions.forEach((t) => {
      const row = [
        formatBusinessDate(t.date),
        t.transactionNumber,
        t.type,
        t.partyName,
        t.categoryName,
        t.description,
        t.referenceNumber || "",
        moneyToCsvString(t.amount),
        moneyToCsvString(t.paidAmount),
        moneyToCsvString(t.outstandingAmount),
        t.paymentStatus,
        t.paymentMethod || "",
        t.status,
        t.createdBy,
      ];
      lines.push(row.map(escapeCsvField).join(","));
    });

    return this.withBom(lines.join("\r\n"));
  }

  /**
   * 2. Export Payments CSV
   */
  public static exportPaymentsCsv(payments: PaymentReportRowDTO[]): Buffer {
    const lines: string[] = [];

    lines.push("# SAI TOURS & TRAVELS — PAYMENTS REPORT");
    lines.push(`# Generated: ${formatBusinessDateTime(new Date())}`);
    lines.push("");

    const headers = [
      "Payment Date",
      "Payment Number",
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
    ];
    lines.push(headers.map(escapeCsvField).join(","));

    payments.forEach((p) => {
      const row = [
        formatBusinessDate(p.date),
        p.paymentNumber,
        p.direction === "IN" ? "MONEY RECEIVED" : "MONEY PAID",
        p.partyName,
        p.partyType,
        p.paymentMethod,
        p.referenceNumber || "",
        moneyToCsvString(p.amount),
        moneyToCsvString(p.allocatedAmount),
        moneyToCsvString(p.unappliedAmount),
        p.status,
        p.createdBy,
      ];
      lines.push(row.map(escapeCsvField).join(","));
    });

    return this.withBom(lines.join("\r\n"));
  }

  /**
   * 3. Export Customer Ledger CSV
   */
  public static exportCustomerLedgerCsv(ledger: CustomerLedgerResult): Buffer {
    const lines: string[] = [];

    lines.push(`# SAI TOURS & TRAVELS — CUSTOMER ACCOUNT STATEMENT`);
    lines.push(`# Customer: ${ledger.customer.name} (${ledger.customer.customerCode})`);
    lines.push(`# Company: ${ledger.customer.companyName || "N/A"}`);
    lines.push(`# Period: ${ledger.startDate ? formatBusinessDate(ledger.startDate) : "Beginning"} to ${ledger.endDate ? formatBusinessDate(ledger.endDate) : "Current"}`);
    lines.push(`# Generated: ${formatBusinessDateTime(new Date())}`);
    lines.push("");

    const headers = [
      "Date",
      "Entry Number",
      "Type",
      "Reference",
      "Description",
      "Debit (INR)",
      "Credit (INR)",
      "Running Balance (INR)",
      "Status",
    ];
    lines.push(headers.map(escapeCsvField).join(","));

    // Opening Balance
    lines.push(
      [
        ledger.startDate ? formatBusinessDate(ledger.startDate) : "-",
        "OPENING",
        "BALANCE",
        "-",
        "Opening Balance Forward",
        "0.00",
        "0.00",
        moneyToCsvString(ledger.openingBalance),
        "POSTED",
      ]
        .map(escapeCsvField)
        .join(",")
    );

    // Entries
    ledger.entries.forEach((e) => {
      lines.push(
        [
          formatBusinessDate(e.date),
          e.entityNumber,
          e.type,
          e.referenceNumber || "-",
          e.description,
          moneyToCsvString(e.debit),
          moneyToCsvString(e.credit),
          moneyToCsvString(e.runningBalance),
          e.status,
        ]
          .map(escapeCsvField)
          .join(",")
      );
    });

    // Totals
    lines.push(
      [
        "TOTALS / CLOSING BALANCE",
        "",
        "",
        "",
        "",
        moneyToCsvString(ledger.totalDebits),
        moneyToCsvString(ledger.totalCredits),
        moneyToCsvString(ledger.closingBalance),
        "",
      ]
        .map(escapeCsvField)
        .join(",")
    );

    return this.withBom(lines.join("\r\n"));
  }

  /**
   * 4. Export Supplier Ledger CSV
   */
  public static exportSupplierLedgerCsv(ledger: SupplierLedgerResult): Buffer {
    const lines: string[] = [];

    lines.push(`# SAI TOURS & TRAVELS — SUPPLIER ACCOUNT STATEMENT`);
    lines.push(`# Supplier: ${ledger.supplier.name} (${ledger.supplier.supplierCode})`);
    lines.push(`# Company: ${ledger.supplier.companyName || "N/A"}`);
    lines.push(`# Period: ${ledger.startDate ? formatBusinessDate(ledger.startDate) : "Beginning"} to ${ledger.endDate ? formatBusinessDate(ledger.endDate) : "Current"}`);
    lines.push(`# Generated: ${formatBusinessDateTime(new Date())}`);
    lines.push("");

    const headers = [
      "Date",
      "Entry Number",
      "Type",
      "Reference",
      "Description",
      "Credit (Payable)",
      "Debit (Paid)",
      "Running Balance (INR)",
      "Status",
    ];
    lines.push(headers.map(escapeCsvField).join(","));

    // Opening Balance
    lines.push(
      [
        ledger.startDate ? formatBusinessDate(ledger.startDate) : "-",
        "OPENING",
        "BALANCE",
        "-",
        "Opening Balance Forward",
        "0.00",
        "0.00",
        moneyToCsvString(ledger.openingBalance),
        "POSTED",
      ]
        .map(escapeCsvField)
        .join(",")
    );

    // Entries
    ledger.entries.forEach((e) => {
      lines.push(
        [
          formatBusinessDate(e.date),
          e.entityNumber,
          e.type,
          e.referenceNumber || "-",
          e.description,
          moneyToCsvString(e.credit),
          moneyToCsvString(e.debit),
          moneyToCsvString(e.runningBalance),
          e.status,
        ]
          .map(escapeCsvField)
          .join(",")
      );
    });

    // Totals
    lines.push(
      [
        "TOTALS / CLOSING BALANCE",
        "",
        "",
        "",
        "",
        moneyToCsvString(ledger.totalCredits),
        moneyToCsvString(ledger.totalDebits),
        moneyToCsvString(ledger.closingBalance),
        "",
      ]
        .map(escapeCsvField)
        .join(",")
    );

    return this.withBom(lines.join("\r\n"));
  }

  /**
   * 5. Export Party Summary CSV (Customers or Suppliers)
   */
  public static exportPartySummaryCsv(
    parties: PartySummaryReportRowDTO[],
    partyType: "Customer" | "Supplier"
  ): Buffer {
    const lines: string[] = [];

    lines.push(`# SAI TOURS & TRAVELS — ${partyType.toUpperCase()} SUMMARY`);
    lines.push(`# Generated: ${formatBusinessDateTime(new Date())}`);
    lines.push("");

    const headers = [
      "Code",
      `${partyType} Name`,
      "Company Name",
      "Phone",
      "Email",
      "Transaction Count",
      "Total Billed (INR)",
      "Total Settled (INR)",
      "Current Balance (INR)",
    ];
    lines.push(headers.map(escapeCsvField).join(","));

    parties.forEach((p) => {
      lines.push(
        [
          p.code,
          p.name,
          p.companyName || "-",
          p.phone || "-",
          p.email || "-",
          p.transactionCount,
          moneyToCsvString(p.totalBilled),
          moneyToCsvString(p.totalPaid),
          moneyToCsvString(p.outstanding),
        ]
          .map(escapeCsvField)
          .join(",")
      );
    });

    return this.withBom(lines.join("\r\n"));
  }

  /**
   * 6. Export Aging Schedule CSV
   */
  public static exportAgingScheduleCsv(
    rows: AgingScheduleReportRowDTO[],
    type: "RECEIVABLES" | "PAYABLES"
  ): Buffer {
    const lines: string[] = [];
    const partyCol = type === "RECEIVABLES" ? "Customer" : "Supplier";

    lines.push(`# SAI TOURS & TRAVELS — ${type} AGING SCHEDULE`);
    lines.push(`# Generated: ${formatBusinessDateTime(new Date())}`);
    lines.push("");

    const headers = [
      "Code",
      partyCol,
      "Current",
      "1 - 30 Days",
      "31 - 60 Days",
      "61 - 90 Days",
      "90+ Days",
      "Total Outstanding (INR)",
    ];
    lines.push(headers.map(escapeCsvField).join(","));

    rows.forEach((r) => {
      lines.push(
        [
          r.partyCode,
          r.partyName,
          moneyToCsvString(r.current),
          moneyToCsvString(r.days1To30),
          moneyToCsvString(r.days31To60),
          moneyToCsvString(r.days61To90),
          moneyToCsvString(r.days90Plus),
          moneyToCsvString(r.totalOutstanding),
        ]
          .map(escapeCsvField)
          .join(",")
      );
    });

    return this.withBom(lines.join("\r\n"));
  }
}
