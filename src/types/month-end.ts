import { FinancialPeriodStatus } from "@prisma/client";

export type CheckSeverity = "PASS" | "WARNING" | "BLOCKING";

export interface ChecklistItem {
  id: string;
  category: "RECORDS" | "PAYMENTS" | "RECEIVABLES" | "PAYABLES" | "ACCOUNTS" | "IMPORTS" | "CONTINUITY" | "HEALTH";
  title: string;
  description: string;
  severity: CheckSeverity;
  count?: number;
  amount?: string;
  details?: Array<{
    id: string;
    reference: string;
    description: string;
    amount?: string;
    date?: string;
    reason?: string;
  }>;
}

export interface PreCloseChecklistResult {
  year: number;
  month: number;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  periodStatus: FinancialPeriodStatus;
  overallStatus: "READY" | "WARNINGS" | "BLOCKED";
  dataChangeToken: string;
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  blockingChecks: number;
  items: ChecklistItem[];
  preliminaryFigures: {
    openingBalance: string;
    totalIncome: string;
    totalExpenses: string;
    netResult: string;
    moneyReceived: string;
    moneyPaid: string;
    receivablesOutstanding: string;
    payablesOutstanding: string;
    closingCashPosition: string;
    cashBalance: string;
    bankBalance: string;
    upiBalance: string;
    transactionCount: number;
    accountingBasis: string;
  };
}

export interface ClosingSnapshotDTO {
  version: number;
  integrityHash: string;
  businessId: string;
  financialPeriodId: string;
  periodLabel: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  accountingBasis: string;
  closedAt: string;
  closedBy: string;
  closingNotes: string | null;
  summary: {
    openingBalance: string;
    totalIncome: string;
    totalExpenses: string;
    netResult: string;
    closingBalance: string;
    totalReceivables: string;
    totalPayables: string;
    moneyReceived: string;
    moneyPaid: string;
    cashBalance: string;
    bankBalance: string;
    upiBalance: string;
    transactionCount: number;
  };
  categories: {
    income: Array<{ category: string; count: number; amount: string; percentage: number }>;
    expenses: Array<{ category: string; count: number; amount: string; percentage: number }>;
  };
  paymentMethods: Array<{ method: string; received: string; paid: string; net: string; count: number }>;
  receivables: {
    totalOutstanding: string;
    aging: {
      current: string;
      days1To30: string;
      days31To60: string;
      days61To90: string;
      days90Plus: string;
    };
    items: Array<{ customerName: string; customerCode: string; originalAmount: string; paidAmount: string; outstandingAmount: string; dueDate?: string }>;
  };
  payables: {
    totalOutstanding: string;
    aging: {
      current: string;
      days1To30: string;
      days31To60: string;
      days61To90: string;
      days90Plus: string;
    };
    items: Array<{ supplierName: string; supplierCode: string; originalAmount: string; paidAmount: string; outstandingAmount: string; dueDate?: string }>;
  };
  reports: {
    excelReportId?: string;
    pdfReportId?: string;
    excelStatus: "COMPLETED" | "FAILED" | "PENDING";
    pdfStatus: "COMPLETED" | "FAILED" | "PENDING";
  };
  history?: Array<{
    version: number;
    closedAt: string;
    closedBy: string;
    reopenedAt: string;
    reopenedBy: string;
    reopenReason: string;
    summary: Record<string, string | number>;
  }>;
}

export interface VersionDiffResult {
  periodLabel: string;
  v1: {
    version: number;
    closedAt: string;
    closedBy: string;
    income: string;
    expenses: string;
    netResult: string;
    receivables: string;
    payables: string;
    cashPosition: string;
    transactionCount: number;
  };
  v2: {
    version: number;
    closedAt: string;
    closedBy: string;
    income: string;
    expenses: string;
    netResult: string;
    receivables: string;
    payables: string;
    cashPosition: string;
    transactionCount: number;
  };
  differences: {
    incomeDiff: string;
    expensesDiff: string;
    netResultDiff: string;
    receivablesDiff: string;
    payablesDiff: string;
    cashPositionDiff: string;
    transactionCountDiff: number;
  };
}

export const REOPEN_REASON_CATEGORIES = [
  "Late Supplier Invoice",
  "Incorrect Transaction",
  "Missing Payment",
  "Incorrect Allocation",
  "Opening Balance Correction",
  "Import Correction",
  "Other",
] as const;

export type ReopenReasonCategory = (typeof REOPEN_REASON_CATEGORIES)[number];

export interface FinancialPeriodSummaryDTO {
  id: string;
  year: number;
  month: number;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  status: FinancialPeriodStatus;
  openedAt: Date;
  closedAt: Date | null;
  closedBy: string | null;
  reopenedAt: Date | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  closing: {
    id: string;
    version: number | null;
    openingBalance: string;
    totalIncome: string;
    totalExpenses: string;
    netResult: string;
    closingBalance: string;
    totalReceivables: string;
    totalPayables: string;
    transactionCount: number;
    closedAt: Date;
    closedBy: string;
  } | null;
}
