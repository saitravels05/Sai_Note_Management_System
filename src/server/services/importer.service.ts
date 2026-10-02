import { prisma } from "@/lib/db";
import { AppError, NotFoundError, ForbiddenError } from "@/lib/errors";
import { Money } from "@/lib/money";
import { NumberingService } from "./numbering.service";
import { AuditService } from "./audit.service";
import { ReconciliationService } from "./reconciliation.service";
import {
  TransactionType,
  TransactionStatus,
  PaymentStatus,
  PaymentMethodType,
  ImportStatus,
  ImportRowStatus,
  AuditAction,
  Prisma,
} from "@prisma/client";
import * as XLSX from "xlsx";

export const IMPORT_MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit
export const MAX_IMPORT_ROWS = 10000; // Safe memory boundary

export interface ImporterContext {
  userId: string;
  businessId: string;
  userRoles?: string[];
  permissions?: string[];
}

export type TargetRecordType =
  | "TRANSACTION"
  | "INCOME"
  | "EXPENSE"
  | "RECEIVABLE"
  | "PAYABLE"
  | "CUSTOMER"
  | "SUPPLIER"
  | "MIXED";

export interface WorkbookAnalysisResult {
  fileName: string;
  fileSize: number;
  fileType: "xlsx" | "xls" | "csv";
  sheetCount: number;
  sheetNames: string[];
  estimatedRowCount: number;
  estimatedColumnCount: number;
  detectedHeaderRow: number; // 1-indexed
  sampleRows: Record<string, string>[];
  detectedColumns: string[];
  suggestedMappings: Record<string, string>;
}

export interface StagedRowValidation {
  rowNumber: number;
  status: ImportRowStatus;
  errors: { field: string; message: string; originalValue?: unknown }[];
  warnings: { field: string; message: string }[];
  normalized: Record<string, unknown>;
  duplicateMatch?: {
    isExact: boolean;
    existingId: string;
    existingNumber: string;
    reason: string;
  } | null;
}

export interface AccountingImpactPreview {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  excludedRows: number;
  transactionsToCreate: number;
  transactionsToPost: number;
  transactionsAsDraft: number;
  customersToCreate: string[];
  suppliersToCreate: string[];
  categoriesToCreate: string[];
  expectedIncomeImpact: string; // formatted Indian currency
  expectedExpenseImpact: string;
  expectedReceivablesCreated: string;
  expectedPayablesCreated: string;
  netImpact: string;
}

/**
 * Standard column aliases for intelligent deterministic mapping.
 */
export const STANDARD_COLUMN_ALIASES: Record<string, string[]> = {
  transactionDate: [
    "date",
    "txndate",
    "transactiondate",
    "entrydate",
    "bookingdate",
    "invoicedate",
    "billdate",
    "voucherdate",
    "receiptdate",
    "createdate",
    "dated",
  ],
  transactionType: [
    "type",
    "txntype",
    "transactiontype",
    "entrytype",
    "recordtype",
    "nature",
    "flow",
    "drcr",
    "debitcredit",
  ],
  amount: [
    "amount",
    "amt",
    "total",
    "totalamount",
    "value",
    "netamount",
    "grossamount",
    "price",
    "cost",
    "balance",
    "figure",
    "amountinr",
    "amountrs",
  ],
  title: [
    "title",
    "heading",
    "subject",
    "item",
    "itemname",
    "servicename",
    "package",
    "tourname",
    "particulars",
  ],
  description: [
    "description",
    "details",
    "remarks",
    "narration",
    "note",
    "comments",
    "memo",
    "reason",
  ],
  customer: [
    "customer",
    "customername",
    "client",
    "passenger",
    "party",
    "guest",
    "traveler",
    "buyer",
    "debtor",
  ],
  supplier: [
    "supplier",
    "suppliername",
    "vendor",
    "hotel",
    "airline",
    "transporter",
    "serviceprovider",
    "creditor",
  ],
  category: [
    "category",
    "head",
    "accounthead",
    "expensetype",
    "incometype",
    "ledger",
    "ledgerhead",
    "classification",
  ],
  paymentMethod: [
    "paymentmethod",
    "paymentmode",
    "mode",
    "paymode",
    "method",
    "instrument",
    "channel",
  ],
  paymentStatus: [
    "paymentstatus",
    "paystatus",
    "status",
    "paidstatus",
  ],
  referenceNumber: [
    "reference",
    "referencenumber",
    "refno",
    "invoiceno",
    "receiptno",
    "billno",
    "pnr",
    "ticketno",
    "voucher",
    "chequeno",
    "utr",
    "txnid",
  ],
  dueDate: ["duedate", "maturitydate", "expirydate", "payby"],
  notes: ["notes", "internalnotes", "officenotes", "diary"],
  tags: ["tags", "tag", "labels", "keywords"],
};

export class ImporterService {
  /**
   * 1. Validate raw file buffer and format against MIME/Magic bytes and size limits.
   */
  public static validateFile(fileBuffer: Buffer, fileName: string) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError("Uploaded file is empty.", 400);
    }

    if (fileBuffer.length > IMPORT_MAX_FILE_SIZE) {
      throw new AppError(
        `This file is too large (${(fileBuffer.length / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 15MB. Please upload a smaller file or split it into multiple files.`,
        400
      );
    }

    const lowerName = fileName.toLowerCase();
    const ext = lowerName.split(".").pop();

    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
      throw new AppError("Unsupported file format. Please upload .xlsx, .xls, or .csv files only.", 400);
    }

    // Verify magic bytes
    if (ext === "xlsx") {
      // ZIP magic bytes: PK (0x50, 0x4B)
      if (fileBuffer[0] !== 0x50 || fileBuffer[1] !== 0x4b) {
        throw new AppError("Malformed Excel workbook. File signature does not match XLSX specification.", 400);
      }
    } else if (ext === "xls") {
      // OLE2 magic bytes: 0xD0, 0xCF, 0x11, 0xE0
      if (
        fileBuffer[0] !== 0xd0 ||
        fileBuffer[1] !== 0xcf ||
        fileBuffer[2] !== 0x11 ||
        fileBuffer[3] !== 0xe0
      ) {
        throw new AppError("Malformed Excel file. File signature does not match XLS specification.", 400);
      }
    }

    return { ext: ext as "xlsx" | "xls" | "csv", size: fileBuffer.length };
  }

  /**
   * 2. Analyze Workbook safely without touching transactions or databases.
   */
  public static analyzeWorkbook(
    fileBuffer: Buffer,
    fileName: string,
    sheetOverride?: string,
    headerRowOverride?: number
  ): WorkbookAnalysisResult {
    const ext = fileName.toLowerCase().endsWith(".csv")
      ? "csv"
      : fileName.toLowerCase().endsWith(".xls")
      ? "xls"
      : "xlsx";

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, {
        type: "buffer",
        cellDates: true,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid or corrupt file";
      throw new AppError(`Failed to parse spreadsheet: ${msg}`, 400);
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new AppError("Spreadsheet does not contain any readable sheets.", 400);
    }

    const selectedSheetName =
      sheetOverride && workbook.SheetNames.includes(sheetOverride)
        ? sheetOverride
        : workbook.SheetNames[0];

    const worksheet = workbook.Sheets[selectedSheetName];
    if (!worksheet) {
      throw new AppError(`Sheet '${selectedSheetName}' could not be read.`, 400);
    }

    // Convert sheet to array of rows (2D array)
    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as unknown[][];

    if (rawRows.length === 0) {
      throw new AppError(`Sheet '${selectedSheetName}' is completely empty.`, 400);
    }

    // Auto-detect header row if not overridden
    const detectedHeaderRow =
      headerRowOverride && headerRowOverride > 0
        ? headerRowOverride
        : this.detectHeaderRow(rawRows);

    const headerIndex = detectedHeaderRow - 1;
    const rawHeaderRow = (rawRows[headerIndex] || []) as unknown[];

    // Sanitize headers and handle duplicate/empty headers
    const detectedColumns = this.extractSanitizedHeaders(rawHeaderRow);

    // Build sample rows (first 10–20 data rows after the header)
    const dataRows = rawRows.slice(headerIndex + 1);
    const sampleRows: Record<string, string>[] = [];

    const maxSamples = Math.min(20, dataRows.length);
    for (let r = 0; r < maxSamples; r++) {
      const rowArr = dataRows[r];
      if (this.isRowEmpty(rowArr) || this.isSummaryRow(rowArr)) continue;

      const rowObj: Record<string, string> = {};
      detectedColumns.forEach((colName, cIdx) => {
        rowObj[colName] = rowArr[cIdx] !== undefined ? String(rowArr[cIdx]).trim() : "";
      });
      sampleRows.push(rowObj);
    }

    // Determine deterministic intelligent suggestions
    const suggestedMappings = this.suggestColumnMappings(detectedColumns);

    return {
      fileName,
      fileSize: fileBuffer.length,
      fileType: ext,
      sheetCount: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames,
      estimatedRowCount: Math.max(0, rawRows.length - detectedHeaderRow),
      estimatedColumnCount: detectedColumns.length,
      detectedHeaderRow,
      sampleRows,
      detectedColumns,
      suggestedMappings,
    };
  }

  /**
   * Detect likely header row by scoring text density and keyword matches.
   */
  private static detectHeaderRow(rawRows: unknown[][]): number {
    const maxScanRows = Math.min(15, rawRows.length);
    let bestRow = 1;
    let highestScore = -1;

    const keywords = [
      "date",
      "amount",
      "amt",
      "name",
      "party",
      "customer",
      "supplier",
      "description",
      "details",
      "particulars",
      "type",
      "total",
      "reference",
      "ref",
      "invoice",
      "bill",
    ];

    for (let i = 0; i < maxScanRows; i++) {
      const row = rawRows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      let stringCount = 0;
      let keywordHits = 0;

      for (const cell of row) {
        if (cell === null || cell === undefined) continue;
        const cellStr = String(cell).trim().toLowerCase();
        if (cellStr.length > 0 && isNaN(Number(cellStr))) {
          stringCount++;
          if (keywords.some((kw) => cellStr.includes(kw))) {
            keywordHits++;
          }
        }
      }

      const score = keywordHits * 5 + stringCount;
      if (score > highestScore) {
        highestScore = score;
        bestRow = i + 1; // 1-indexed
      }
    }

    return bestRow;
  }

  /**
   * Sanitize headers: trim, avoid duplicates by appending Column letter/index, strip dangerous chars.
   */
  private static extractSanitizedHeaders(rawHeaderRow: unknown[]): string[] {
    const seen = new Map<string, number>();
    const headers: string[] = [];

    rawHeaderRow.forEach((cell, idx) => {
      let name = cell !== null && cell !== undefined ? String(cell).trim() : "";
      if (!name) {
        name = `Column_${XLSX.utils.encode_col(idx)}`;
      }

      // Formula injection safeguard: strip leading = + - @
      if (/^[=+\-@]/.test(name)) {
        name = name.substring(1).trim();
      }

      const lower = name.toLowerCase();
      if (seen.has(lower)) {
        const count = seen.get(lower)! + 1;
        seen.set(lower, count);
        const colLetter = XLSX.utils.encode_col(idx);
        name = `${name} (Column ${colLetter})`;
      } else {
        seen.set(lower, 1);
      }

      headers.push(name);
    });

    return headers;
  }

  /**
   * Deterministic column mapping suggestions based on aliases.
   */
  public static suggestColumnMappings(detectedColumns: string[]): Record<string, string> {
    const suggestions: Record<string, string> = {};

    for (const col of detectedColumns) {
      const normalizedCol = col.toLowerCase().replace(/[^a-z0-9]/g, "");

      for (const [targetField, aliases] of Object.entries(STANDARD_COLUMN_ALIASES)) {
        if (aliases.some((alias) => normalizedCol === alias || normalizedCol.includes(alias))) {
          // Do not overwrite if already mapped
          if (!Object.values(suggestions).includes(targetField)) {
            suggestions[col] = targetField;
            break;
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Check if an entire spreadsheet row is empty.
   */
  public static isRowEmpty(row: unknown[]): boolean {
    if (!row || !Array.isArray(row)) return true;
    return row.every((c) => c === null || c === undefined || String(c).trim() === "");
  }

  /**
   * Check if a row represents a summary/total row.
   */
  public static isSummaryRow(row: unknown[]): boolean {
    if (!row || !Array.isArray(row)) return false;
    const summaryKeywords = ["total", "grand total", "sub total", "subtotal", "month total", "balance c/f", "balance b/f"];
    for (const cell of row) {
      if (cell === null || cell === undefined) continue;
      const str = String(cell).trim().toLowerCase();
      if (summaryKeywords.some((kw) => str === kw || str.startsWith(kw + " ") || str.endsWith(" " + kw))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Decimal-safe Money parser for imports.
   * Strictly flags invalid currency strings without converting them to zero.
   */
  public static parseImportAmount(
    raw: unknown
  ): { valid: boolean; money?: Money; raw: string; error?: string } {
    if (raw === null || raw === undefined) {
      return { valid: false, raw: "", error: "Amount is missing." };
    }

    const str = String(raw).trim();
    if (!str) {
      return { valid: false, raw: "", error: "Amount cannot be blank." };
    }

    // Check for parentheses negatives: "(5000)" -> "-5000"
    let cleanStr = str;
    const isParenNegative = /^\((.*)\)$/.test(str);
    if (isParenNegative) {
      cleanStr = "-" + str.replace(/^\((.*)\)$/, "$1");
    }

    // Remove Indian Rupee symbol, INR, Rs., commas, whitespace
    const stripped = cleanStr
      .replace(/₹|INR|Rs\.?|,/gi, "")
      .replace(/\s+/g, "")
      .trim();

    // Check if valid numeric format
    if (!/^-?\d+(\.\d+)?$/.test(stripped)) {
      return {
        valid: false,
        raw: str,
        error: `Invalid monetary value: '${str}'. Letters or malformed characters are not allowed.`,
      };
    }

    try {
      const money = new Money(stripped);
      return { valid: true, money, raw: str };
    } catch {
      return { valid: false, raw: str, error: `Invalid number format: '${str}'.` };
    }
  }

  /**
   * Date Normalization for imports.
   */
  public static parseImportDate(
    raw: unknown
  ): { valid: boolean; date?: Date; formatted?: string; error?: string; isAmbiguous?: boolean } {
    if (raw === null || raw === undefined) {
      return { valid: false, error: "Date is required." };
    }

    // If SheetJS already parsed to a Date
    if (raw instanceof Date) {
      if (isNaN(raw.getTime())) {
        return { valid: false, error: "Invalid date object." };
      }
      return {
        valid: true,
        date: raw,
        formatted: this.formatStandardDate(raw),
      };
    }

    // If Excel serial number (e.g. 44500)
    if (typeof raw === "number" || (!isNaN(Number(raw)) && Number(raw) > 20000 && Number(raw) < 80000)) {
      const serial = Number(raw);
      // Excel epoch starts Dec 30 1899
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const parsed = new Date(excelEpoch.getTime() + serial * 86400000);
      if (isNaN(parsed.getTime())) {
        return { valid: false, error: `Invalid Excel serial date '${raw}'.` };
      }
      return {
        valid: true,
        date: parsed,
        formatted: this.formatStandardDate(parsed),
      };
    }

    const str = String(raw).trim();
    if (!str) {
      return { valid: false, error: "Date cannot be empty." };
    }

    // 1. DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
      const p1 = parseInt(dmyMatch[1], 10);
      const p2 = parseInt(dmyMatch[2], 10);
      const year = parseInt(dmyMatch[3], 10);

      let day = p1;
      let month = p2;
      let isAmbiguous = false;

      // Ambiguity check: e.g. 01/02/2026 could be 1st Feb (DD/MM) or 2nd Jan (MM/DD)
      if (p1 <= 12 && p2 <= 12) {
        isAmbiguous = true;
        // Standard business practice: DD-MM-YYYY default
        day = p1;
        month = p2;
      } else if (p1 > 12 && p2 <= 12) {
        day = p1;
        month = p2;
      } else if (p1 <= 12 && p2 > 12) {
        month = p1;
        day = p2;
      }

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return { valid: false, error: `Impossible calendar date '${str}'.` };
      }

      const d = new Date(Date.UTC(year, month - 1, day));
      if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
        return { valid: false, error: `Invalid calendar date '${str}'.` };
      }

      return {
        valid: true,
        date: d,
        formatted: this.formatStandardDate(d),
        isAmbiguous,
      };
    }

    // 2. YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10);
      const day = parseInt(ymdMatch[3], 10);

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return { valid: false, error: `Impossible calendar date '${str}'.` };
      }

      const d = new Date(Date.UTC(year, month - 1, day));
      return {
        valid: true,
        date: d,
        formatted: this.formatStandardDate(d),
      };
    }

    // 3. Fallback ISO string
    const isoDate = new Date(str);
    if (!isNaN(isoDate.getTime())) {
      return {
        valid: true,
        date: isoDate,
        formatted: this.formatStandardDate(isoDate),
      };
    }

    return { valid: false, error: `Unrecognized date format '${str}'. Use DD-MM-YYYY or YYYY-MM-DD.` };
  }

  private static formatStandardDate(date: Date): string {
    const d = String(date.getUTCDate()).padStart(2, "0");
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const y = date.getUTCFullYear();
    return `${d}-${m}-${y}`;
  }

  /**
   * 3. Stage and Validate Import Rows.
   */
  public static async stageImportBatch(
    input: {
      fileBuffer: Buffer;
      fileName: string;
      sheetName: string;
      headerRowIndex: number;
      targetType: TargetRecordType;
      columnMappings: Record<string, string>;
      importMode?: "DRAFT" | "POSTED";
      templateName?: string;
    },
    ctx: ImporterContext
  ) {
    const { businessId, userId } = ctx;

    // 1. Permission check
    if (
      !ctx.userRoles?.includes("OWNER") &&
      !ctx.permissions?.includes("imports.execute") &&
      !ctx.permissions?.includes("*")
    ) {
      throw new ForbiddenError("You do not have permission to execute imports.");
    }

    // 2. Validate file
    const fileInfo = this.validateFile(input.fileBuffer, input.fileName);

    // 3. Parse workbook
    const workbook = XLSX.read(input.fileBuffer, {
      type: "buffer",
      cellDates: true,
    });

    const worksheet = workbook.Sheets[input.sheetName];
    if (!worksheet) {
      throw new AppError(`Sheet '${input.sheetName}' not found in workbook.`, 400);
    }

    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as unknown[][];

    const headerIdx = (input.headerRowIndex || 1) - 1;
    const headerRow = (rawRows[headerIdx] || []) as unknown[];
    const sanitizedHeaders = this.extractSanitizedHeaders(headerRow);
    const dataRows = rawRows.slice(headerIdx + 1);

    if (dataRows.length === 0) {
      throw new AppError("The selected sheet contains no data rows to import.", 400);
    }

    if (dataRows.length > MAX_IMPORT_ROWS) {
      throw new AppError(
        `The file contains ${dataRows.length} rows, which exceeds the single-batch maximum of ${MAX_IMPORT_ROWS} rows. Please split your file into smaller batches.`,
        400
      );
    }

    // Pre-fetch reference data
    const [existingCustomers, existingSuppliers, existingCategories, closedPeriods, existingTransactions] =
      await Promise.all([
        prisma.customer.findMany({
          where: { businessId },
          select: { id: true, customerCode: true, name: true, phone: true, email: true },
        }),
        prisma.supplier.findMany({
          where: { businessId },
          select: { id: true, supplierCode: true, name: true, phone: true, email: true },
        }),
        prisma.category.findMany({
          where: { businessId, isActive: true },
          select: { id: true, name: true, type: true },
        }),
        prisma.financialPeriod.findMany({
          where: { businessId, status: { in: ["CLOSED", "LOCKED"] } },
          select: { year: true, month: true, status: true, startDate: true, endDate: true },
        }),
        prisma.transaction.findMany({
          where: { businessId },
          select: {
            id: true,
            transactionNumber: true,
            transactionDate: true,
            totalAmount: true,
            transactionType: true,
            referenceNumber: true,
            customerId: true,
            supplierId: true,
          },
          take: 5000,
          orderBy: { transactionDate: "desc" },
        }),
      ]);

    // Build lookups
    const customerMapByName = new Map<string, (typeof existingCustomers)[0]>();
    const customerMapByCode = new Map<string, (typeof existingCustomers)[0]>();
    for (const c of existingCustomers) {
      customerMapByName.set(c.name.trim().toLowerCase(), c);
      if (c.customerCode) customerMapByCode.set(c.customerCode.trim().toLowerCase(), c);
    }

    const supplierMapByName = new Map<string, (typeof existingSuppliers)[0]>();
    const supplierMapByCode = new Map<string, (typeof existingSuppliers)[0]>();
    for (const s of existingSuppliers) {
      supplierMapByName.set(s.name.trim().toLowerCase(), s);
      if (s.supplierCode) supplierMapByCode.set(s.supplierCode.trim().toLowerCase(), s);
    }

    const categoryMapByName = new Map<string, (typeof existingCategories)[0]>();
    for (const cat of existingCategories) {
      categoryMapByName.set(cat.name.trim().toLowerCase(), cat);
    }

    // Invert mapping for fast lookup
    const fieldToCol: Record<string, string> = {};
    for (const [colName, targetField] of Object.entries(input.columnMappings)) {
      if (targetField && targetField !== "IGNORE") {
        fieldToCol[targetField] = colName;
      }
    }

    const defaultIncomeCategory = existingCategories.find((c) => c.type === "INCOME" || c.type === "BOTH");
    const defaultExpenseCategory = existingCategories.find((c) => c.type === "EXPENSE" || c.type === "BOTH");

    // Process and validate rows
    const stagedRows: {
      rowNumber: number;
      rawData: Record<string, unknown>;
      normalizedData: Record<string, unknown>;
      validationStatus: ImportRowStatus;
      validationErrors: { field: string; message: string; originalValue?: unknown }[];
      duplicateMatch?: unknown;
    }[] = [];

    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const rowArr = dataRows[i];
      const rowNum = i + headerIdx + 2;

      if (this.isRowEmpty(rowArr) || this.isSummaryRow(rowArr)) {
        continue;
      }

      const rawObj: Record<string, unknown> = {};
      sanitizedHeaders.forEach((header, colIdx) => {
        rawObj[header] = rowArr[colIdx] !== undefined ? rowArr[colIdx] : "";
      });

      const errors: { field: string; message: string; originalValue?: unknown }[] = [];
      const warnings: { field: string; message: string }[] = [];
      const normalized: Record<string, unknown> = {};

      // 1. Transaction Date
      const dateCol = fieldToCol["transactionDate"];
      const rawDateVal = dateCol ? rawObj[dateCol] : null;
      const dateResult = this.parseImportDate(rawDateVal);

      if (!dateResult.valid || !dateResult.date) {
        errors.push({
          field: "transactionDate",
          message: dateResult.error || "Missing or invalid transaction date.",
          originalValue: rawDateVal,
        });
      } else {
        normalized.transactionDate = dateResult.date;
        normalized.transactionDateFormatted = dateResult.formatted;

        const txnYear = dateResult.date.getUTCFullYear();
        const txnMonth = dateResult.date.getUTCMonth() + 1;
        const closedPeriod = closedPeriods.find((p) => p.year === txnYear && p.month === txnMonth);

        if (closedPeriod) {
          errors.push({
            field: "transactionDate",
            message: `Financial period ${txnMonth}/${txnYear} is ${closedPeriod.status}. Posting records into closed periods is strictly forbidden.`,
            originalValue: dateResult.formatted,
          });
        }

        if (dateResult.isAmbiguous) {
          warnings.push({
            field: "transactionDate",
            message: `Ambiguous date format interpreted as DD-MM-YYYY (${dateResult.formatted}).`,
          });
        }
      }

      // 2. Amount
      const amtCol = fieldToCol["amount"];
      const rawAmtVal = amtCol ? rawObj[amtCol] : null;
      const amtResult = this.parseImportAmount(rawAmtVal);

      if (!amtResult.valid || !amtResult.money) {
        errors.push({
          field: "amount",
          message: amtResult.error || "Invalid monetary amount.",
          originalValue: rawAmtVal,
        });
      } else {
        normalized.amount = amtResult.money.toDecimalString();
        normalized.amountFormatted = amtResult.money.format();

        if (amtResult.money.isZero()) {
          warnings.push({
            field: "amount",
            message: "Amount is zero. Financial records typically require a non-zero value.",
          });
        }
      }

      // 3. Transaction Type
      let resolvedType: TransactionType = TransactionType.INCOME;
      if (input.targetType === "INCOME") {
        resolvedType = TransactionType.INCOME;
      } else if (input.targetType === "EXPENSE") {
        resolvedType = TransactionType.EXPENSE;
      } else if (input.targetType === "RECEIVABLE") {
        resolvedType = TransactionType.RECEIVABLE;
      } else if (input.targetType === "PAYABLE") {
        resolvedType = TransactionType.PAYABLE;
      } else if (input.targetType === "MIXED" || input.targetType === "TRANSACTION") {
        const typeCol = fieldToCol["transactionType"];
        const rawTypeStr = typeCol ? String(rawObj[typeCol] || "").trim().toUpperCase() : "";

        if (rawTypeStr.includes("INC") || rawTypeStr.includes("RECEIPT") || rawTypeStr === "CR") {
          resolvedType = TransactionType.INCOME;
        } else if (rawTypeStr.includes("EXP") || rawTypeStr.includes("PAYMENT") || rawTypeStr === "DR") {
          resolvedType = TransactionType.EXPENSE;
        } else if (rawTypeStr.includes("REC") || rawTypeStr.includes("INVOICE")) {
          resolvedType = TransactionType.RECEIVABLE;
        } else if (rawTypeStr.includes("PAY") || rawTypeStr.includes("BILL")) {
          resolvedType = TransactionType.PAYABLE;
        } else {
          if (typeCol && rawTypeStr) {
            errors.push({
              field: "transactionType",
              message: `Unknown transaction type '${rawTypeStr}'. Allowed: Income, Expense, Receivable, Payable.`,
              originalValue: rawTypeStr,
            });
          }
          resolvedType = TransactionType.INCOME;
        }
      }
      normalized.transactionType = resolvedType;

      // 4. Title & Description
      const titleCol = fieldToCol["title"];
      const descCol = fieldToCol["description"];
      const titleVal = titleCol ? String(rawObj[titleCol] || "").trim() : "";
      const descVal = descCol ? String(rawObj[descCol] || "").trim() : "";

      normalized.title = titleVal || descVal || `${resolvedType} Import Record`;
      normalized.description = descVal || titleVal || null;

      if (typeof normalized.title === "string" && /^[=+\-@]/.test(normalized.title)) {
        normalized.title = "'" + normalized.title;
      }
      if (typeof normalized.description === "string" && /^[=+\-@]/.test(normalized.description)) {
        normalized.description = "'" + normalized.description;
      }

      // 5. Customer Matching
      const custCol = fieldToCol["customer"];
      const rawCustName = custCol ? String(rawObj[custCol] || "").trim() : "";
      if (rawCustName) {
        const normalizedCustName = rawCustName.toLowerCase();
        const matchedCust =
          customerMapByName.get(normalizedCustName) || customerMapByCode.get(normalizedCustName);

        if (matchedCust) {
          normalized.customerId = matchedCust.id;
          normalized.customerName = matchedCust.name;
          normalized.customerMatchStatus = "MATCHED";
        } else {
          normalized.customerName = rawCustName;
          normalized.customerMatchStatus = "NEW";
          warnings.push({
            field: "customer",
            message: `Customer '${rawCustName}' not found. Will be created as a new customer upon import.`,
          });
        }
      }

      // 6. Supplier Matching
      const suppCol = fieldToCol["supplier"];
      const rawSuppName = suppCol ? String(rawObj[suppCol] || "").trim() : "";
      if (rawSuppName) {
        const normalizedSuppName = rawSuppName.toLowerCase();
        const matchedSupp =
          supplierMapByName.get(normalizedSuppName) || supplierMapByCode.get(normalizedSuppName);

        if (matchedSupp) {
          normalized.supplierId = matchedSupp.id;
          normalized.supplierName = matchedSupp.name;
          normalized.supplierMatchStatus = "MATCHED";
        } else {
          normalized.supplierName = rawSuppName;
          normalized.supplierMatchStatus = "NEW";
          warnings.push({
            field: "supplier",
            message: `Supplier '${rawSuppName}' not found. Will be created as a new supplier upon import.`,
          });
        }
      }

      // 7. Category Matching
      const catCol = fieldToCol["category"];
      const rawCatName = catCol ? String(rawObj[catCol] || "").trim() : "";
      if (rawCatName) {
        const matchedCat = categoryMapByName.get(rawCatName.toLowerCase());
        if (matchedCat) {
          normalized.categoryId = matchedCat.id;
          normalized.categoryName = matchedCat.name;
        } else {
          normalized.categoryName = rawCatName;
          normalized.categoryMatchStatus = "NEW";
          warnings.push({
            field: "category",
            message: `Category '${rawCatName}' does not exist. Will be created automatically.`,
          });
        }
      } else {
        const defaultCat =
          resolvedType === TransactionType.INCOME || resolvedType === TransactionType.RECEIVABLE
            ? defaultIncomeCategory
            : defaultExpenseCategory;

        if (defaultCat) {
          normalized.categoryId = defaultCat.id;
          normalized.categoryName = defaultCat.name;
        }
      }

      // 8. Reference Number
      const refCol = fieldToCol["referenceNumber"];
      normalized.referenceNumber = refCol ? String(rawObj[refCol] || "").trim() : null;

      // 9. Payment Method
      const pmCol = fieldToCol["paymentMethod"];
      const rawPm = pmCol ? String(rawObj[pmCol] || "").trim().toUpperCase() : "";
      if (rawPm) {
        if (rawPm.includes("CASH")) normalized.paymentMethod = PaymentMethodType.CASH;
        else if (rawPm.includes("UPI") || rawPm.includes("GPAY") || rawPm.includes("PHONEPE") || rawPm.includes("PAYTM"))
          normalized.paymentMethod = PaymentMethodType.UPI;
        else if (rawPm.includes("BANK") || rawPm.includes("NEFT") || rawPm.includes("RTGS") || rawPm.includes("IMPS"))
          normalized.paymentMethod = PaymentMethodType.BANK_TRANSFER;
        else if (rawPm.includes("CARD")) normalized.paymentMethod = PaymentMethodType.CARD;
        else if (rawPm.includes("CHEQUE") || rawPm.includes("CHECK"))
          normalized.paymentMethod = PaymentMethodType.CHEQUE;
        else normalized.paymentMethod = PaymentMethodType.OTHER;
      }

      // 10. Payment Status
      const psCol = fieldToCol["paymentStatus"];
      const rawPs = psCol ? String(rawObj[psCol] || "").trim().toUpperCase() : "";
      if (rawPs) {
        if (rawPs.includes("PAID") && !rawPs.includes("UN")) normalized.paymentStatus = PaymentStatus.PAID;
        else if (rawPs.includes("PART")) normalized.paymentStatus = PaymentStatus.PARTIALLY_PAID;
        else normalized.paymentStatus = PaymentStatus.UNPAID;
      } else {
        normalized.paymentStatus =
          resolvedType === TransactionType.RECEIVABLE || resolvedType === TransactionType.PAYABLE
            ? PaymentStatus.UNPAID
            : PaymentStatus.PAID;
      }

      // 11. Tags
      const tagsCol = fieldToCol["tags"];
      if (tagsCol && rawObj[tagsCol]) {
        const rawTags = String(rawObj[tagsCol]);
        normalized.tags = rawTags
          .split(/[,;|]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
      }

      // 12. Duplicate Detection
      let duplicateMatch: unknown = null;
      if (normalized.transactionDate && normalized.amount) {
        const matchAmt = new Money(normalized.amount as string);
        const matchDateStr = normalized.transactionDateFormatted as string;

        for (const ex of existingTransactions) {
          const exDateStr = this.formatStandardDate(new Date(ex.transactionDate));
          const exAmt = Money.fromDecimal(ex.totalAmount);

          if (exDateStr === matchDateStr && exAmt.equals(matchAmt)) {
            if (
              normalized.referenceNumber &&
              ex.referenceNumber &&
              (normalized.referenceNumber as string).toLowerCase() === ex.referenceNumber.toLowerCase()
            ) {
              duplicateMatch = {
                isExact: true,
                existingId: ex.id,
                existingNumber: ex.transactionNumber,
                reason: `Exact match: Same Date (${matchDateStr}), Amount (${matchAmt.format()}), and Reference Number (${ex.referenceNumber}).`,
              };
              break;
            }

            if (ex.transactionType === resolvedType) {
              duplicateMatch = {
                isExact: false,
                existingId: ex.id,
                existingNumber: ex.transactionNumber,
                reason: `Possible duplicate: Same Date (${matchDateStr}), Amount (${matchAmt.format()}), and Type (${resolvedType}).`,
              };
            }
          }
        }
      }

      let rowStatus: ImportRowStatus = ImportRowStatus.VALID;
      if (errors.length > 0) {
        rowStatus = ImportRowStatus.ERROR;
        errorCount++;
      } else if (duplicateMatch) {
        rowStatus = ImportRowStatus.DUPLICATE;
        duplicateCount++;
      } else if (warnings.length > 0) {
        rowStatus = ImportRowStatus.WARNING;
        warningCount++;
      } else {
        rowStatus = ImportRowStatus.VALID;
        validCount++;
      }

      stagedRows.push({
        rowNumber: rowNum,
        rawData: rawObj,
        normalizedData: normalized,
        validationStatus: rowStatus,
        validationErrors: [...errors, ...warnings],
        duplicateMatch: duplicateMatch || null,
      });
    }

    // 4. Save ImportBatch and ImportRows
    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.importBatch.create({
        data: {
          businessId,
          originalFileName: input.fileName,
          fileType: fileInfo.ext,
          status: errorCount > 0 ? ImportStatus.VALIDATING : ImportStatus.VALIDATED,
          totalRows: stagedRows.length,
          validRows: validCount,
          warningRows: warningCount,
          errorRows: errorCount,
          duplicateRows: duplicateCount,
          mappingConfiguration: {
            sheetName: input.sheetName,
            headerRowIndex: input.headerRowIndex,
            targetType: input.targetType,
            columnMappings: input.columnMappings,
            importMode: input.importMode || "DRAFT",
            templateName: input.templateName || null,
          } as Prisma.InputJsonValue,
          uploadedById: userId,
          validatedAt: new Date(),
        },
      });

      await tx.importRow.createMany({
        data: stagedRows.map((r) => ({
          importBatchId: createdBatch.id,
          rowNumber: r.rowNumber,
          rawData: r.rawData as Prisma.InputJsonValue,
          normalizedData: r.normalizedData as Prisma.InputJsonValue,
          validationStatus: r.validationStatus,
          validationErrors: (r.validationErrors.length > 0 ? r.validationErrors : Prisma.JsonNull) as Prisma.InputJsonValue,
          duplicateMatch: (r.duplicateMatch ? r.duplicateMatch : Prisma.JsonNull) as Prisma.InputJsonValue,
        })),
      });

      return createdBatch;
    });

    if (input.templateName && input.templateName.trim().length > 0) {
      await this.saveMappingTemplate(
        {
          name: input.templateName.trim(),
          targetType: input.targetType,
          columnMappings: input.columnMappings,
        },
        ctx
      );
    }

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.IMPORT,
      entityType: "IMPORT_BATCH",
      entityId: batch.id,
      newValues: {
        fileName: input.fileName,
        totalRows: stagedRows.length,
        validRows: validCount,
        errors: errorCount,
        duplicates: duplicateCount,
      },
      reason: "Excel/CSV spreadsheet staged for validation",
    });

    return batch;
  }

  /**
   * 4. Retrieve batch details with pagination for staged rows.
   */
  public static async getImportBatch(
    batchId: string,
    businessId: string,
    options?: { statusFilter?: ImportRowStatus; page?: number; pageSize?: number }
  ) {
    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, businessId },
      include: {
        _count: {
          select: { rows: true, transactions: true },
        },
      },
    });

    if (!batch) {
      throw new NotFoundError("Import batch not found or you do not have permission to access it.");
    }

    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.min(100, options?.pageSize || 50);
    const skip = (page - 1) * pageSize;

    const rowWhere: Prisma.ImportRowWhereInput = {
      importBatchId: batchId,
      ...(options?.statusFilter ? { validationStatus: options.statusFilter } : {}),
    };

    const [rows, totalFilteredRows] = await Promise.all([
      prisma.importRow.findMany({
        where: rowWhere,
        orderBy: { rowNumber: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.importRow.count({ where: rowWhere }),
    ]);

    return {
      batch,
      rows,
      pagination: {
        page,
        pageSize,
        totalRows: totalFilteredRows,
        totalPages: Math.ceil(totalFilteredRows / pageSize),
      },
    };
  }

  /**
   * 5. Inline Correction of a staged ImportRow.
   */
  public static async updateImportRow(
    rowId: string,
    input: {
      action: "UPDATE_DATA" | "EXCLUDE" | "RESTORE" | "OVERRIDE_DUPLICATE";
      normalizedDataUpdates?: Record<string, unknown>;
    },
    ctx: ImporterContext
  ) {
    const { businessId } = ctx;

    const row = await prisma.importRow.findUnique({
      where: { id: rowId },
      include: { batch: true },
    });

    if (!row || row.batch.businessId !== businessId) {
      throw new NotFoundError("Import row not found.");
    }

    if (row.batch.status === ImportStatus.COMMITTED) {
      throw new AppError("Cannot modify rows in an import batch that has already been committed.", 400);
    }

    let newStatus = row.validationStatus;
    let newNormalized = (row.normalizedData as Record<string, unknown>) || {};
    let newErrors = (row.validationErrors as { field?: string; message?: string }[]) || [];

    if (input.action === "EXCLUDE") {
      newStatus = ImportRowStatus.EXCLUDED;
    } else if (input.action === "RESTORE") {
      newStatus = newErrors.some((e) => e.field && !e.field.startsWith("warning"))
        ? ImportRowStatus.ERROR
        : row.duplicateMatch
        ? ImportRowStatus.DUPLICATE
        : ImportRowStatus.VALID;
    } else if (input.action === "OVERRIDE_DUPLICATE") {
      if (
        !ctx.userRoles?.includes("OWNER") &&
        !ctx.permissions?.includes("imports.override_duplicate") &&
        !ctx.permissions?.includes("*")
      ) {
        throw new ForbiddenError("Permission required to override duplicates.");
      }
      newStatus = ImportRowStatus.VALID;
    } else if (input.action === "UPDATE_DATA" && input.normalizedDataUpdates) {
      newNormalized = { ...newNormalized, ...input.normalizedDataUpdates };

      if (input.normalizedDataUpdates.amount) {
        const amtRes = this.parseImportAmount(input.normalizedDataUpdates.amount);
        if (amtRes.valid && amtRes.money) {
          newNormalized.amount = amtRes.money.toDecimalString();
          newNormalized.amountFormatted = amtRes.money.format();
          newErrors = newErrors.filter((e) => e.field !== "amount");
        } else {
          newErrors = newErrors.filter((e) => e.field !== "amount");
          newErrors.push({ field: "amount", message: amtRes.error || "Invalid amount." });
        }
      }

      if (input.normalizedDataUpdates.transactionDate) {
        const dtRes = this.parseImportDate(input.normalizedDataUpdates.transactionDate);
        if (dtRes.valid && dtRes.date) {
          newNormalized.transactionDate = dtRes.date;
          newNormalized.transactionDateFormatted = dtRes.formatted;
          newErrors = newErrors.filter((e) => e.field !== "transactionDate");
        } else {
          newErrors = newErrors.filter((e) => e.field !== "transactionDate");
          newErrors.push({ field: "transactionDate", message: dtRes.error || "Invalid date." });
        }
      }

      newStatus = newErrors.length > 0 ? ImportRowStatus.ERROR : ImportRowStatus.VALID;
    }

    const updatedRow = await prisma.importRow.update({
      where: { id: rowId },
      data: {
        normalizedData: newNormalized as Prisma.InputJsonValue,
        validationStatus: newStatus,
        validationErrors: (newErrors.length > 0 ? newErrors : Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    await this.refreshBatchCounts(row.importBatchId);

    return updatedRow;
  }

  private static async refreshBatchCounts(batchId: string) {
    const [total, valid, warnings, errors, duplicates] = await Promise.all([
      prisma.importRow.count({ where: { importBatchId: batchId } }),
      prisma.importRow.count({ where: { importBatchId: batchId, validationStatus: ImportRowStatus.VALID } }),
      prisma.importRow.count({ where: { importBatchId: batchId, validationStatus: ImportRowStatus.WARNING } }),
      prisma.importRow.count({ where: { importBatchId: batchId, validationStatus: ImportRowStatus.ERROR } }),
      prisma.importRow.count({ where: { importBatchId: batchId, validationStatus: ImportRowStatus.DUPLICATE } }),
    ]);

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        totalRows: total,
        validRows: valid,
        warningRows: warnings,
        errorRows: errors,
        duplicateRows: duplicates,
        status: errors > 0 ? ImportStatus.VALIDATING : ImportStatus.VALIDATED,
      },
    });
  }

  /**
   * 6. Calculate Accounting Impact Preview before final commit.
   */
  public static async calculateAccountingImpact(
    batchId: string,
    businessId: string
  ): Promise<AccountingImpactPreview> {
    const rows = await prisma.importRow.findMany({
      where: {
        importBatchId: batchId,
        batch: { businessId },
        validationStatus: { in: [ImportRowStatus.VALID, ImportRowStatus.WARNING] },
      },
    });

    const [totalRows, validRows, warningRows, errorRows, duplicateRows, excludedRows] =
      await Promise.all([
        prisma.importRow.count({ where: { importBatchId: batchId } }),
        prisma.importRow.count({ where: { importBatchId: batchId, validationStatus: ImportRowStatus.VALID } }),
        prisma.importRow.count({ where: { importBatchId: batchId, validationStatus: ImportRowStatus.WARNING } }),
        prisma.importRow.count({ where: { importBatchId: batchId, validationStatus: ImportRowStatus.ERROR } }),
        prisma.importRow.count({ where: { importBatchId: batchId, validationStatus: ImportRowStatus.DUPLICATE } }),
        prisma.importRow.count({ where: { importBatchId: batchId, validationStatus: ImportRowStatus.EXCLUDED } }),
      ]);

    let incomeSum = Money.zero();
    let expenseSum = Money.zero();
    let receivableSum = Money.zero();
    let payableSum = Money.zero();

    const customersToCreate = new Set<string>();
    const suppliersToCreate = new Set<string>();
    const categoriesToCreate = new Set<string>();

    for (const row of rows) {
      const norm = row.normalizedData as Record<string, unknown>;
      if (!norm) continue;

      const amt = Money.parse(norm.amount as string);
      const type = norm.transactionType as TransactionType;

      if (type === TransactionType.INCOME) {
        incomeSum = incomeSum.add(amt);
      } else if (type === TransactionType.EXPENSE) {
        expenseSum = expenseSum.add(amt);
      } else if (type === TransactionType.RECEIVABLE) {
        receivableSum = receivableSum.add(amt);
      } else if (type === TransactionType.PAYABLE) {
        payableSum = payableSum.add(amt);
      }

      if (norm.customerMatchStatus === "NEW" && typeof norm.customerName === "string") {
        customersToCreate.add(norm.customerName);
      }
      if (norm.supplierMatchStatus === "NEW" && typeof norm.supplierName === "string") {
        suppliersToCreate.add(norm.supplierName);
      }
      if (norm.categoryMatchStatus === "NEW" && typeof norm.categoryName === "string") {
        categoriesToCreate.add(norm.categoryName);
      }
    }

    const netImpact = incomeSum.subtract(expenseSum);

    return {
      totalRows,
      validRows,
      warningRows,
      errorRows,
      duplicateRows,
      excludedRows,
      transactionsToCreate: rows.length,
      transactionsToPost: rows.length,
      transactionsAsDraft: 0,
      customersToCreate: Array.from(customersToCreate),
      suppliersToCreate: Array.from(suppliersToCreate),
      categoriesToCreate: Array.from(categoriesToCreate),
      expectedIncomeImpact: incomeSum.format(),
      expectedExpenseImpact: expenseSum.format(),
      expectedReceivablesCreated: receivableSum.format(),
      expectedPayablesCreated: payableSum.format(),
      netImpact: netImpact.format(),
    };
  }

  /**
   * 7. Server-Side Commit.
   */
  public static async commitImportBatch(
    batchId: string,
    options: {
      importMode: "DRAFT" | "POSTED";
      allowDuplicates?: boolean;
    },
    ctx: ImporterContext
  ) {
    const { businessId, userId } = ctx;

    if (
      !ctx.userRoles?.includes("OWNER") &&
      !ctx.permissions?.includes("imports.execute") &&
      !ctx.permissions?.includes("*")
    ) {
      throw new ForbiddenError("Permission denied: You do not have permission to execute imports.");
    }

    if (options.importMode === "POSTED") {
      const canPost =
        ctx.userRoles?.includes("OWNER") ||
        ctx.permissions?.includes("imports.post_financial") ||
        ctx.permissions?.includes("records.create") ||
        ctx.permissions?.includes("*");
      if (!canPost) {
        throw new ForbiddenError(
          "Permission denied: You do not have permission to post financial records directly from import. Use DRAFT mode instead."
        );
      }
    }

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, businessId },
    });

    if (!batch) {
      throw new NotFoundError("Import batch not found.");
    }

    if (batch.status === ImportStatus.COMMITTED) {
      throw new AppError("This import batch has already been committed to the ledger.", 400);
    }

    const eligibleStatuses: ImportRowStatus[] = [ImportRowStatus.VALID, ImportRowStatus.WARNING];
    if (options.allowDuplicates) {
      eligibleStatuses.push(ImportRowStatus.DUPLICATE);
    }

    const rowsToCommit = await prisma.importRow.findMany({
      where: {
        importBatchId: batchId,
        validationStatus: { in: eligibleStatuses },
      },
      orderBy: { rowNumber: "asc" },
    });

    if (rowsToCommit.length === 0) {
      throw new AppError("There are no valid rows to import in this batch. Please review errors or fix excluded rows.", 400);
    }

    const closedPeriods = await prisma.financialPeriod.findMany({
      where: { businessId, status: { in: ["CLOSED", "LOCKED"] } },
      select: { year: true, month: true, status: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      let createdTransactionsCount = 0;
      let createdCustomersCount = 0;
      let createdSuppliersCount = 0;
      let createdCategoriesCount = 0;

      const createdCustomerMap = new Map<string, string>();
      const createdSupplierMap = new Map<string, string>();
      const createdCategoryMap = new Map<string, string>();

      let defaultCat = await tx.category.findFirst({
        where: { businessId, isActive: true },
      });

      if (!defaultCat) {
        defaultCat = await tx.category.create({
          data: {
            businessId,
            name: "General Import",
            type: "BOTH",
          },
        });
      }

      for (const row of rowsToCommit) {
        const norm = row.normalizedData as Record<string, unknown>;
        if (!norm) continue;

        const txnDate = new Date(norm.transactionDate as string | Date);

        const yr = txnDate.getUTCFullYear();
        const mo = txnDate.getUTCMonth() + 1;
        const isClosed = closedPeriods.some((p) => p.year === yr && p.month === mo);
        if (isClosed) {
          throw new AppError(
            `Row ${row.rowNumber} belongs to closed/locked period ${mo}/${yr}. Import aborted to prevent accounting corruption.`,
            400
          );
        }

        let customerId = (norm.customerId as string) || null;
        if (!customerId && typeof norm.customerName === "string") {
          const custNameKey = norm.customerName.trim().toLowerCase();
          if (createdCustomerMap.has(custNameKey)) {
            customerId = createdCustomerMap.get(custNameKey)!;
          } else {
            let existingCust = await tx.customer.findFirst({
              where: { businessId, name: { equals: norm.customerName.trim(), mode: "insensitive" } },
            });
            if (!existingCust) {
              const custCode = await NumberingService.getNextSequenceNumber(businessId, "CUSTOMER", "CUST");
              existingCust = await tx.customer.create({
                data: {
                  businessId,
                  customerCode: custCode,
                  name: norm.customerName.trim(),
                },
              });
              createdCustomersCount++;
            }
            customerId = existingCust.id;
            createdCustomerMap.set(custNameKey, customerId);
          }
        }

        let supplierId = (norm.supplierId as string) || null;
        if (!supplierId && typeof norm.supplierName === "string") {
          const suppNameKey = norm.supplierName.trim().toLowerCase();
          if (createdSupplierMap.has(suppNameKey)) {
            supplierId = createdSupplierMap.get(suppNameKey)!;
          } else {
            let existingSupp = await tx.supplier.findFirst({
              where: { businessId, name: { equals: norm.supplierName.trim(), mode: "insensitive" } },
            });
            if (!existingSupp) {
              const suppCode = await NumberingService.getNextSequenceNumber(businessId, "SUPPLIER", "SUPP");
              existingSupp = await tx.supplier.create({
                data: {
                  businessId,
                  supplierCode: suppCode,
                  name: norm.supplierName.trim(),
                },
              });
              createdSuppliersCount++;
            }
            supplierId = existingSupp.id;
            createdSupplierMap.set(suppNameKey, supplierId);
          }
        }

        let categoryId = (norm.categoryId as string) || null;
        if (!categoryId && typeof norm.categoryName === "string") {
          const catNameKey = norm.categoryName.trim().toLowerCase();
          if (createdCategoryMap.has(catNameKey)) {
            categoryId = createdCategoryMap.get(catNameKey)!;
          } else {
            let existingCat = await tx.category.findFirst({
              where: { businessId, name: { equals: norm.categoryName.trim(), mode: "insensitive" } },
            });
            if (!existingCat) {
              existingCat = await tx.category.create({
                data: {
                  businessId,
                  name: norm.categoryName.trim(),
                  type: "BOTH",
                },
              });
              createdCategoriesCount++;
            }
            categoryId = existingCat.id;
            createdCategoryMap.set(catNameKey, categoryId);
          }
        }

        if (!categoryId) {
          categoryId = defaultCat.id;
        }

        const txnType = norm.transactionType as TransactionType;
        const prefix =
          txnType === TransactionType.INCOME
            ? "INC"
            : txnType === TransactionType.EXPENSE
            ? "EXP"
            : txnType === TransactionType.RECEIVABLE
            ? "REC"
            : txnType === TransactionType.PAYABLE
            ? "PAY"
            : "TXN";

        const txnNumber = await NumberingService.getNextSequenceNumber(
          businessId,
          "TRANSACTION",
          prefix,
          yr
        );

        const moneyAmount = new Money((norm.amount as string) || 0);
        const finalStatus =
          options.importMode === "DRAFT" ? TransactionStatus.DRAFT : TransactionStatus.POSTED;

        const sheetNameStr = (batch.mappingConfiguration as { sheetName?: string })?.sheetName || "Sheet1";

        await tx.transaction.create({
          data: {
            businessId,
            transactionNumber: txnNumber,
            transactionDate: txnDate,
            transactionType: txnType,
            categoryId,
            customerId,
            supplierId,
            title: (norm.title as string) || `${txnType} Import`,
            description: (norm.description as string) || null,
            referenceNumber: (norm.referenceNumber as string) || null,
            currency: "INR",
            amount: moneyAmount.toDecimal(),
            totalAmount: moneyAmount.toDecimal(),
            paymentStatus: (norm.paymentStatus as PaymentStatus) || PaymentStatus.UNPAID,
            status: finalStatus,
            dueDate: norm.dueDate ? new Date(norm.dueDate as string) : null,
            notes: (norm.notes as string) || null,
            createdById: userId,
            importBatchId: batchId,
            source: "IMPORT",
            postedAt: finalStatus === TransactionStatus.POSTED ? new Date() : null,
            metadata: {
              importBatchId: batchId,
              sourceRowNumber: row.rowNumber,
              sourceSheet: sheetNameStr,
              legacyReference: norm.referenceNumber || null,
            } as Prisma.InputJsonValue,
          },
        });

        createdTransactionsCount++;
      }

      const updatedBatch = await tx.importBatch.update({
        where: { id: batchId },
        data: {
          status: ImportStatus.COMMITTED,
          committedAt: new Date(),
        },
      });

      return {
        batch: updatedBatch,
        createdTransactionsCount,
        createdCustomersCount,
        createdSuppliersCount,
        createdCategoriesCount,
      };
    });

    const reconciliation = await ReconciliationService.runReconciliation(businessId);

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.IMPORT,
      entityType: "IMPORT_BATCH",
      entityId: batchId,
      newValues: {
        createdTransactions: result.createdTransactionsCount,
        createdCustomers: result.createdCustomersCount,
        createdSuppliers: result.createdSuppliersCount,
        createdCategories: result.createdCategoriesCount,
        importMode: options.importMode,
        reconciliationHealthy: reconciliation.isHealthy,
      },
      reason: `Import batch committed: ${result.createdTransactionsCount} transactions created (${options.importMode})`,
    });

    return {
      success: true,
      batchId,
      createdTransactions: result.createdTransactionsCount,
      createdCustomers: result.createdCustomersCount,
      createdSuppliers: result.createdSuppliersCount,
      createdCategories: result.createdCategoriesCount,
      importMode: options.importMode,
      reconciliation,
    };
  }

  /**
   * 8. Controlled Rollback Architecture.
   */
  public static async rollbackImportBatch(
    batchId: string,
    reason: string,
    ctx: ImporterContext
  ) {
    const { businessId, userId } = ctx;

    if (
      !ctx.userRoles?.includes("OWNER") &&
      !ctx.permissions?.includes("imports.rollback") &&
      !ctx.permissions?.includes("*")
    ) {
      throw new ForbiddenError("Permission denied: You do not have permission to rollback imports.");
    }

    if (!reason || reason.trim().length < 5) {
      throw new AppError("A detailed explanation is required to rollback an import batch.", 400);
    }

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, businessId },
      include: {
        transactions: {
          include: {
            allocations: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundError("Import batch not found.");
    }

    if (batch.status !== ImportStatus.COMMITTED) {
      throw new AppError("Only committed import batches can be rolled back.", 400);
    }

    const hasAllocations = batch.transactions.some((t) => t.allocations.length > 0);
    if (hasAllocations) {
      throw new AppError(
        "Cannot rollback this import: Some transactions have subsequent payment allocations attached. Please reverse allocations first.",
        400
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const t of batch.transactions) {
        if (t.status === TransactionStatus.DRAFT) {
          await tx.transaction.delete({ where: { id: t.id } });
        } else {
          await tx.transaction.update({
            where: { id: t.id },
            data: {
              status: TransactionStatus.VOID,
              voidedAt: new Date(),
              voidedBy: userId,
              voidReason: `Import rollback: ${reason.trim()}`,
            },
          });
        }
      }

      await tx.importBatch.update({
        where: { id: batchId },
        data: { status: ImportStatus.FAILED },
      });
    });

    await ReconciliationService.runReconciliation(businessId);

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.VOID,
      entityType: "IMPORT_BATCH",
      entityId: batchId,
      reason: `Rollback import: ${reason.trim()}`,
    });

    return { success: true, rolledBackTransactionsCount: batch.transactions.length };
  }

  /**
   * 9. Saved Mapping Templates Management using BusinessSetting.
   */
  public static async saveMappingTemplate(
    input: {
      name: string;
      targetType: TargetRecordType;
      columnMappings: Record<string, string>;
    },
    ctx: ImporterContext
  ) {
    const { businessId, userId } = ctx;
    const sanitizedKey = `import_template:${input.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`;

    const templateData = {
      name: input.name.trim(),
      targetType: input.targetType,
      columnMappings: input.columnMappings,
      createdById: userId,
      createdAt: new Date().toISOString(),
    };

    const setting = await prisma.businessSetting.upsert({
      where: {
        businessId_key: {
          businessId,
          key: sanitizedKey,
        },
      },
      create: {
        businessId,
        key: sanitizedKey,
        value: templateData as Prisma.InputJsonValue,
      },
      update: {
        value: templateData as Prisma.InputJsonValue,
      },
    });

    return setting.value;
  }

  public static async getMappingTemplates(businessId: string): Promise<Record<string, unknown>[]> {
    const settings = await prisma.businessSetting.findMany({
      where: {
        businessId,
        key: { startsWith: "import_template:" },
      },
      orderBy: { createdAt: "desc" },
    });

    return settings.map((s) => s.value as Record<string, unknown>);
  }

  /**
   * 10. Generate Downloadable Clean Import Templates.
   */
  public static getTemplateHeaders(
    templateType: "INCOME" | "EXPENSE" | "RECEIVABLE" | "PAYABLE" | "TRANSACTIONS" | "CUSTOMERS" | "SUPPLIERS"
  ): { headers: string[]; columnDocumentation: Record<string, string>; sampleRows: string[][] } {
    switch (templateType) {
      case "INCOME":
        return {
          headers: ["Date", "Customer", "Category", "Amount", "Payment Method", "Reference", "Description"],
          columnDocumentation: {
            Date: "Required. Business transaction date (e.g. 29-09-2026).",
            Customer: "Optional. Customer/Client name (e.g. Ramesh Kumar).",
            Category: "Optional. Income category (e.g. Tour Package Booking).",
            Amount: "Required. Transaction amount in INR (e.g. 45000.00).",
            "Payment Method": "Optional. Cash, UPI, Bank Transfer, Card, Cheque.",
            Reference: "Optional. Invoice number, PNR, or receipt reference.",
            Description: "Optional. Narrative or booking details.",
          },
          sampleRows: [
            ["29-09-2026", "Ramesh Kumar", "Tour Package", "45000", "UPI", "INV-2026-001", "Kashmir Holiday Booking"],
          ],
        };

      case "EXPENSE":
        return {
          headers: ["Date", "Supplier", "Category", "Amount", "Payment Method", "Reference", "Description"],
          columnDocumentation: {
            Date: "Required. Transaction date (e.g. 29-09-2026).",
            Supplier: "Optional. Vendor/Hotel/Airline name (e.g. Indigo Airlines).",
            Category: "Optional. Expense category (e.g. Flight Tickets).",
            Amount: "Required. Amount in INR (e.g. 18500.00).",
            "Payment Method": "Optional. Bank Transfer, UPI, Cash, Card.",
            Reference: "Optional. Bill number or airline PNR.",
            Description: "Optional. Expense narration.",
          },
          sampleRows: [
            ["29-09-2026", "Indigo Airlines", "Flight Tickets", "18500", "Bank Transfer", "PNR-6X9QW2", "Client Flight Tickets"],
          ],
        };

      case "RECEIVABLE":
        return {
          headers: ["Date", "Customer", "Amount", "Due Date", "Reference", "Description"],
          columnDocumentation: {
            Date: "Required. Invoice issue date.",
            Customer: "Required. Customer name.",
            Amount: "Required. Invoice total receivable amount.",
            "Due Date": "Optional. Due date for payment collection.",
            Reference: "Optional. Invoice number.",
            Description: "Optional. Booking details.",
          },
          sampleRows: [
            ["29-09-2026", "Priya Tours", "85000", "15-10-2026", "INV-2026-042", "Corporate Group Tour Invoice"],
          ],
        };

      case "PAYABLE":
        return {
          headers: ["Date", "Supplier", "Amount", "Due Date", "Reference", "Description"],
          columnDocumentation: {
            Date: "Required. Bill issue date.",
            Supplier: "Required. Vendor/Hotel name.",
            Amount: "Required. Bill total payable amount.",
            "Due Date": "Optional. Due date for vendor payment.",
            Reference: "Optional. Vendor invoice/bill number.",
            Description: "Optional. Accommodation or transport services.",
          },
          sampleRows: [
            ["29-09-2026", "Grand Hotel Kochi", "35000", "10-10-2026", "BILL-8891", "Hotel Rooms October Booking"],
          ],
        };

      case "CUSTOMERS":
        return {
          headers: ["Customer Code", "Customer Name", "Phone", "Email", "City", "Opening Balance"],
          columnDocumentation: {
            "Customer Code": "Optional. Unique customer code or left blank for auto-generation.",
            "Customer Name": "Required. Full name or company name.",
            Phone: "Optional. Mobile number.",
            Email: "Optional. Email address.",
            City: "Optional. City or location.",
            "Opening Balance": "Optional. Initial outstanding receivable balance.",
          },
          sampleRows: [["CUST-001", "Mohamed Ibrahim", "9876543210", "ibrahim@example.com", "Chennai", "15000"]],
        };

      case "SUPPLIERS":
        return {
          headers: ["Supplier Code", "Supplier Name", "Phone", "Email", "City", "Opening Balance"],
          columnDocumentation: {
            "Supplier Code": "Optional. Unique supplier code or left blank for auto-generation.",
            "Supplier Name": "Required. Vendor or agency name.",
            Phone: "Optional. Contact phone number.",
            Email: "Optional. Email address.",
            City: "Optional. City or headquarters.",
            "Opening Balance": "Optional. Initial outstanding payable balance.",
          },
          sampleRows: [["SUPP-001", "Southern Travels Fleet", "9840123456", "fleet@southern.com", "Madurai", "25000"]],
        };

      default:
        return {
          headers: ["Date", "Type", "Party", "Category", "Amount", "Payment Method", "Reference", "Description"],
          columnDocumentation: {
            Date: "Required. Transaction date.",
            Type: "Required. Income, Expense, Receivable, or Payable.",
            Party: "Optional. Customer or Supplier name.",
            Category: "Optional. Category head.",
            Amount: "Required. Amount in INR.",
            "Payment Method": "Optional. Payment mode.",
            Reference: "Optional. Reference number.",
            Description: "Optional. Narration.",
          },
          sampleRows: [
            ["29-09-2026", "Income", "Anand Sharma", "Tour Package", "52000", "UPI", "INV-2026-101", "Dubai Holiday Trip"],
          ],
        };
    }
  }
}
