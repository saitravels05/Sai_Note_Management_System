import { Money } from "@/lib/money";
import { PERMISSIONS } from "@/lib/auth/permissions";

export interface SemanticMeasureDefinition {
  id: string;
  label: string;
  description: string;
  category: "FINANCIAL_STATEMENT" | "CASH_FLOW" | "BALANCE_SHEET" | "OPERATIONAL";
  requiredPermission: string;
  isCurrency: boolean;
  supportedDatasets: string[];
}

export const FINANCIAL_MEASURE_REGISTRY: Record<string, SemanticMeasureDefinition> = {
  RECOGNIZED_INCOME: {
    id: "RECOGNIZED_INCOME",
    label: "Recognized Income",
    description: "Total earned revenue in period from tickets, tours, and services (Phase 5 Accounting Engine).",
    category: "FINANCIAL_STATEMENT",
    requiredPermission: PERMISSIONS.INCOME_VIEW,
    isCurrency: true,
    supportedDatasets: ["TRANSACTIONS", "INCOME", "CATEGORIES", "DAILY_FINANCIAL_SUMMARY", "MONTHLY_FINANCIAL_SUMMARY"],
  },

  RECOGNIZED_EXPENSES: {
    id: "RECOGNIZED_EXPENSES",
    label: "Recognized Expenses",
    description: "Total operational expenses incurred in period (Phase 5 Accounting Engine).",
    category: "FINANCIAL_STATEMENT",
    requiredPermission: PERMISSIONS.EXPENSES_VIEW,
    isCurrency: true,
    supportedDatasets: ["TRANSACTIONS", "EXPENSES", "CATEGORIES", "DAILY_FINANCIAL_SUMMARY", "MONTHLY_FINANCIAL_SUMMARY"],
  },

  NET_RESULT: {
    id: "NET_RESULT",
    label: "Net Result (Operating Margin)",
    description: "Recognized Income minus Recognized Expenses. Strictly independent of cash movement.",
    category: "FINANCIAL_STATEMENT",
    requiredPermission: PERMISSIONS.RECORDS_VIEW,
    isCurrency: true,
    supportedDatasets: ["TRANSACTIONS", "DAILY_FINANCIAL_SUMMARY", "MONTHLY_FINANCIAL_SUMMARY"],
  },

  MONEY_RECEIVED: {
    id: "MONEY_RECEIVED",
    label: "Money Received (Cash Inflow)",
    description: "Physical cash and bank payments received from customers.",
    category: "CASH_FLOW",
    requiredPermission: PERMISSIONS.PAYMENTS_VIEW,
    isCurrency: true,
    supportedDatasets: ["TRANSACTIONS", "PAYMENTS", "PAYMENT_METHODS", "DAILY_FINANCIAL_SUMMARY", "MONTHLY_FINANCIAL_SUMMARY"],
  },

  MONEY_PAID: {
    id: "MONEY_PAID",
    label: "Money Paid (Cash Outflow)",
    description: "Physical cash and bank disbursements paid to suppliers, airlines, and vendors.",
    category: "CASH_FLOW",
    requiredPermission: PERMISSIONS.PAYMENTS_VIEW,
    isCurrency: true,
    supportedDatasets: ["TRANSACTIONS", "PAYMENTS", "PAYMENT_METHODS", "DAILY_FINANCIAL_SUMMARY", "MONTHLY_FINANCIAL_SUMMARY"],
  },

  NET_CASH_FLOW: {
    id: "NET_CASH_FLOW",
    label: "Net Cash Flow",
    description: "Money Received minus Money Paid across Cash, Bank, and UPI accounts.",
    category: "CASH_FLOW",
    requiredPermission: PERMISSIONS.PAYMENTS_VIEW,
    isCurrency: true,
    supportedDatasets: ["PAYMENTS", "PAYMENT_METHODS", "DAILY_FINANCIAL_SUMMARY", "MONTHLY_FINANCIAL_SUMMARY"],
  },

  OUTSTANDING_RECEIVABLES: {
    id: "OUTSTANDING_RECEIVABLES",
    label: "Outstanding Receivables",
    description: "Total unpaid customer invoice balances currently outstanding.",
    category: "BALANCE_SHEET",
    requiredPermission: PERMISSIONS.RECEIVABLES_VIEW,
    isCurrency: true,
    supportedDatasets: ["RECEIVABLES", "CUSTOMERS", "MONTHLY_FINANCIAL_SUMMARY"],
  },

  OUTSTANDING_PAYABLES: {
    id: "OUTSTANDING_PAYABLES",
    label: "Outstanding Payables",
    description: "Total unpaid supplier bills and vendor obligations currently outstanding.",
    category: "BALANCE_SHEET",
    requiredPermission: PERMISSIONS.PAYABLES_VIEW,
    isCurrency: true,
    supportedDatasets: ["PAYABLES", "SUPPLIERS", "MONTHLY_FINANCIAL_SUMMARY"],
  },

  OVERDUE_RECEIVABLES: {
    id: "OVERDUE_RECEIVABLES",
    label: "Overdue Receivables",
    description: "Customer balances past agreed payment terms.",
    category: "BALANCE_SHEET",
    requiredPermission: PERMISSIONS.RECEIVABLES_VIEW,
    isCurrency: true,
    supportedDatasets: ["RECEIVABLES", "CUSTOMERS"],
  },

  OVERDUE_PAYABLES: {
    id: "OVERDUE_PAYABLES",
    label: "Overdue Payables",
    description: "Supplier balances past settlement due date.",
    category: "BALANCE_SHEET",
    requiredPermission: PERMISSIONS.PAYABLES_VIEW,
    isCurrency: true,
    supportedDatasets: ["PAYABLES", "SUPPLIERS"],
  },

  TRANSACTION_COUNT: {
    id: "TRANSACTION_COUNT",
    label: "Transaction Count",
    description: "Total number of authorized records in dataset scope.",
    category: "OPERATIONAL",
    requiredPermission: PERMISSIONS.RECORDS_VIEW,
    isCurrency: false,
    supportedDatasets: ["TRANSACTIONS", "INCOME", "EXPENSES", "PAYMENTS", "RECEIVABLES", "PAYABLES"],
  },

  PAYMENT_COUNT: {
    id: "PAYMENT_COUNT",
    label: "Payment Count",
    description: "Total number of payment receipts and vouchers.",
    category: "OPERATIONAL",
    requiredPermission: PERMISSIONS.PAYMENTS_VIEW,
    isCurrency: false,
    supportedDatasets: ["PAYMENTS", "PAYMENT_METHODS"],
  },
};

/**
 * Division-by-zero safe ratio / percentage calculation.
 * Never throws NaN or Infinity. Returns deterministic string representation.
 */
export function calculateSafeRatio(
  numerator: number | Money,
  denominator: number | Money,
  asPercentage: boolean = false
): { value: number; formatted: string; isZeroDenominator: boolean } {
  const num = numerator instanceof Money ? numerator.toNumber() : Number(numerator);
  const den = denominator instanceof Money ? denominator.toNumber() : Number(denominator);

  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    return {
      value: 0,
      formatted: "N/A (New Activity)",
      isZeroDenominator: true,
    };
  }

  const rawRatio = num / den;
  if (!Number.isFinite(rawRatio)) {
    return {
      value: 0,
      formatted: "N/A (New Activity)",
      isZeroDenominator: true,
    };
  }

  if (asPercentage) {
    const pct = rawRatio * 100;
    return {
      value: Math.round(pct * 100) / 100,
      formatted: `${(pct >= 0 ? "+" : "") + pct.toFixed(1)}%`,
      isZeroDenominator: false,
    };
  }

  return {
    value: Math.round(rawRatio * 1000) / 1000,
    formatted: rawRatio.toFixed(2),
    isZeroDenominator: false,
  };
}

/**
 * Period comparison calculations with zero-previous-period safety.
 */
export function calculatePeriodComparison(
  current: Money | number,
  previous: Money | number
): {
  currentValue: number;
  previousValue: number;
  difference: number;
  percentageChange: string;
  trend: "UP" | "DOWN" | "FLAT";
} {
  const curr = current instanceof Money ? current.toNumber() : Number(current);
  const prev = previous instanceof Money ? previous.toNumber() : Number(previous);
  const diff = curr - prev;

  let trend: "UP" | "DOWN" | "FLAT" = "FLAT";
  if (diff > 0.001) trend = "UP";
  else if (diff < -0.001) trend = "DOWN";

  if (prev === 0) {
    return {
      currentValue: curr,
      previousValue: prev,
      difference: diff,
      percentageChange: curr === 0 ? "0.0%" : "N/A (New Activity)",
      trend,
    };
  }

  const pct = (diff / Math.abs(prev)) * 100;
  const percentageChange = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

  return {
    currentValue: curr,
    previousValue: prev,
    difference: diff,
    percentageChange,
    trend,
  };
}
