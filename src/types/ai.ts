import { TransactionType, PaymentStatus, TransactionStatus, PaymentMethodType } from "@prisma/client";

// ===================================================================
// AI INTENT TAXONOMY (STRICT WHITELIST)
// ===================================================================

export const AI_INTENTS = [
  "FILTER_RECORDS",
  "GET_FINANCIAL_SUMMARY",
  "GET_INCOME_TOTAL",
  "GET_EXPENSE_TOTAL",
  "GET_NET_RESULT",
  "GET_CASH_FLOW",
  "GET_RECEIVABLES",
  "GET_PAYABLES",
  "GET_CUSTOMER_LEDGER",
  "GET_SUPPLIER_LEDGER",
  "GET_CATEGORY_ANALYSIS",
  "GET_PERIOD_COMPARISON",
  "GET_ACCOUNTING_HEALTH",
  "GET_MONTH_END_STATUS",
  "EXPLAIN_CLOSE_FAILURE",
  "FIND_DUPLICATES",
  "SEARCH_NOTES",
  "SEARCH_RECORDS",
  "EXPLAIN_CONCEPT",
  "PREPARE_EXPORT",
  "GET_FOLLOW_UPS_DUE",
  "GET_PROMISES_DUE",
  "GET_CUSTOMER_SUMMARY",
  "GET_SUPPLIER_PAYABLES_DUE",
  "CLARIFICATION_NEEDED",
  "UNKNOWN",
] as const;

export type AIIntent = (typeof AI_INTENTS)[number];

// ===================================================================
// STRUCTURED FILTER SCHEMA (SAFE WHITELIST)
// ===================================================================

export interface AISafeFilters {
  periodType?: "today" | "yesterday" | "this-week" | "last-week" | "this-month" | "last-month" | "this-year" | "last-year" | "custom";
  startDate?: string; // ISO date string
  endDate?: string;   // ISO date string
  year?: number;
  month?: number;     // 1-12
  isAsClosed?: boolean; // When true, query historical closing snapshot instead of live data
  transactionType?: TransactionType;
  transactionStatus?: TransactionStatus;
  paymentStatus?: PaymentStatus;
  paymentMethodType?: PaymentMethodType;
  paymentMethodName?: string;
  minAmount?: number;
  maxAmount?: number;
  exactAmount?: number;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  categoryId?: string;
  categoryName?: string;
  tagId?: string;
  tagName?: string;
  searchKeyword?: string;
  sortBy?: "newest" | "oldest" | "highest_amount" | "lowest_amount";
}

// ===================================================================
// INTERPRETATION RESULT
// ===================================================================

export interface AIInterpretationResult {
  intent: AIIntent;
  confidence: number; // 0.0 to 1.0
  filters: AISafeFilters;
  detectedLanguage: "en" | "ta";
  clarificationPrompt?: string;
  clarificationOptions?: Array<{ label: string; value: string }>;
  explanationText?: string;
  contextReset?: boolean;
}

// ===================================================================
// VERIFIED FINANCIAL DATA DTOs (RETURNED FROM ACCOUNTING SERVICES)
// ===================================================================

export interface AIFinancialSummaryData {
  periodLabel: string;
  startDate: string;
  endDate: string;
  openingBalance: string;
  totalIncome: string;
  totalExpenses: string;
  netResult: string;
  moneyReceived: string;
  moneyPaid: string;
  closingCashPosition: string;
  receivablesOutstanding: string;
  payablesOutstanding: string;
  transactionCount: number;
  accountingBasis: string;
  isAsClosed: boolean;
  snapshotVersion?: number;
}

export interface AIRecordItemDTO {
  id: string;
  transactionNumber: string;
  title: string;
  transactionType: TransactionType;
  status: TransactionStatus;
  paymentStatus: PaymentStatus;
  transactionDate: string;
  amount: string;
  categoryName: string;
  partyName?: string;
  partyType?: "CUSTOMER" | "SUPPLIER";
  paymentMethodName?: string;
}

export interface AIRecordsData {
  totalCount: number;
  displayedCount: number;
  records: AIRecordItemDTO[];
  summaryAmount: string;
  filterLabel: string;
  filterUrl: string;
}

export interface AIReceivablePayableData {
  partyType: "CUSTOMER" | "SUPPLIER";
  totalOutstanding: string;
  totalOverdue: string;
  partyCount: number;
  items: Array<{
    partyId: string;
    partyName: string;
    partyCode: string;
    totalBilled: string;
    totalPaid: string;
    outstanding: string;
    overdueAmount: string;
    agingBucket?: string;
  }>;
  agingSchedule?: {
    current: string;
    days1To30: string;
    days31To60: string;
    days61To90: string;
    days90Plus: string;
  };
  isAsClosed: boolean;
}

export interface AILedgerData {
  partyId: string;
  partyName: string;
  partyType: "CUSTOMER" | "SUPPLIER";
  openingBalance: string;
  totalBilled: string;
  totalPaid: string;
  currentBalance: string;
  periodLabel: string;
  entriesCount: number;
  recentEntries: Array<{
    date: string;
    reference: string;
    description: string;
    type: string;
    debit: string;
    credit: string;
    runningBalance: string;
  }>;
  ledgerUrl: string;
}

export interface AIComparisonData {
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  income: { current: string; previous: string; diff: string; percentChange: number | null; trend: "UP" | "DOWN" | "FLAT" };
  expenses: { current: string; previous: string; diff: string; percentChange: number | null; trend: "UP" | "DOWN" | "FLAT" };
  netResult: { current: string; previous: string; diff: string; percentChange: number | null; trend: "UP" | "DOWN" | "FLAT" };
  moneyIn: { current: string; previous: string; diff: string; percentChange: number | null; trend: "UP" | "DOWN" | "FLAT" };
  moneyOut: { current: string; previous: string; diff: string; percentChange: number | null; trend: "UP" | "DOWN" | "FLAT" };
  receivables: { current: string; previous: string; diff: string; percentChange: number | null; trend: "UP" | "DOWN" | "FLAT" };
}

export interface AIMonthEndStatusData {
  periodLabel: string;
  year: number;
  month: number;
  periodStatus: "OPEN" | "CLOSED" | "LOCKED";
  closingVersion?: number | null;
  overallStatus: "READY" | "WARNINGS" | "BLOCKED";
  blockingCount: number;
  warningCount: number;
  passedCount: number;
  blockingReasons: Array<{ title: string; description: string; count?: number }>;
  warningReasons: Array<{ title: string; description: string; count?: number }>;
  monthEndUrl: string;
}

export interface AIDuplicateData {
  duplicateGroupCount: number;
  groups: Array<{
    amount: string;
    date: string;
    referenceOrTitle: string;
    records: Array<{ id: string; transactionNumber: string; title: string; status: string }>;
  }>;
}

export interface AINoteItemDTO {
  id: string;
  title: string;
  content: string;
  category?: string;
  isPinned: boolean;
  createdAt: string;
  author: string;
}

export interface AIExportPreparationData {
  reportType: "INCOME" | "EXPENSE" | "RECEIVABLE" | "PAYABLE" | "MONTHLY_CLOSING";
  periodLabel: string;
  startDate: string;
  endDate: string;
  suggestedFormats: Array<"EXCEL" | "PDF" | "CSV">;
  exportUrl: string;
}

// ===================================================================
// COMPLETE CHAT MESSAGE MODEL
// ===================================================================

export interface AIChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  intent?: AIIntent;
  sourceAttribution?: "VERIFIED_ACCOUNTING_DATA" | "CLOSING_SNAPSHOT" | "CUSTOMER_LEDGER" | "SUPPLIER_LEDGER" | "GENERAL_KNOWLEDGE" | "NONE";
  sourceLabel?: string;
  dataFreshnessTimestamp?: string;
  activeFilters?: AISafeFilters;
  handoffAction?: {
    type: "RECORDS" | "DASHBOARD" | "MONTH_END" | "REPORT" | "LEDGER";
    label: string;
    url: string;
  };
  structuredData?: {
    type:
      | "FINANCIAL_SUMMARY"
      | "RECORDS_LIST"
      | "RECEIVABLE_LIST"
      | "PAYABLE_LIST"
      | "LEDGER_SUMMARY"
      | "COMPARISON"
      | "MONTH_END_STATUS"
      | "DUPLICATE_LIST"
      | "NOTES_LIST"
      | "EXPORT_PREPARATION"
      | "CLARIFICATION"
      | "PERMISSION_DENIED"
      | "ERROR";
    financialSummary?: AIFinancialSummaryData;
    recordsData?: AIRecordsData;
    receivableData?: AIReceivablePayableData;
    payableData?: AIReceivablePayableData;
    ledgerData?: AILedgerData;
    comparisonData?: AIComparisonData;
    monthEndData?: AIMonthEndStatusData;
    duplicateData?: AIDuplicateData;
    notesData?: { count: number; notes: AINoteItemDTO[] };
    exportPreparation?: AIExportPreparationData;
    clarification?: { prompt: string; options: Array<{ label: string; value: string }> };
    permissionDenied?: { missingPermission: string; explanation: string };
    errorDetails?: { message: string; code?: string };
  };
}

// ===================================================================
// CLIENT/SERVER REQUEST PAYLOADS
// ===================================================================

export interface AIQueryRequest {
  query: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  currentFilters?: AISafeFilters;
}

export interface AIQueryResponse {
  success: boolean;
  message?: AIChatMessage;
  error?: string;
}
