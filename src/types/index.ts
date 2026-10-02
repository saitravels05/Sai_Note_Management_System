export type Role = "SUPER_ADMIN" | "ADMIN" | "ACCOUNTANT" | "STAFF" | "VIEWER";

export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";

export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "UPI"
  | "CHEQUE"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "OTHER";

export type PaymentStatus = "PAID" | "PENDING" | "PARTIAL" | "DRAFT" | "VOID";

export type PartyType = "CUSTOMER" | "SUPPLIER" | "BOTH";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  businessId: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  brandTagline?: string;
  logoUrl?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  currency: string;
  currencySymbol: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  colorCode?: string;
  description?: string;
}

export interface Party {
  id: string;
  name: string;
  type: PartyType;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  openingBalance: string;
  currentBalance?: string;
}

export interface CustomFieldDefinition {
  id: string;
  fieldName: string;
  fieldType: "TEXT" | "NUMBER" | "DATE" | "SELECT";
  options?: string[];
  isRequired: boolean;
}

export interface TransactionRecord {
  id: string;
  businessId: string;
  referenceNo?: string;
  date: string; // YYYY-MM-DD
  time?: string;
  type: TransactionType;
  partyId?: string;
  partyName?: string;
  partyPhone?: string;
  categoryId: string;
  categoryName?: string;
  title: string;
  description?: string;
  amount: string; // Decimal string e.g. "25000.00"
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  dueDate?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
  tags?: string[];
  attachmentsCount?: number;
  isVoid: boolean;
  voidReason?: string;
  periodClosed: boolean;
  createdById: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardKPIs {
  period: string; // e.g. "September 2026"
  todayIncome: string;
  todayExpenses: string;
  todayNet: string;
  monthIncome: string;
  monthExpenses: string;
  monthNet: string;
  receivablesTotal: string;
  payablesTotal: string;
  cashBalance: string;
  bankBalance: string;
  upiBalance: string;
  transactionCount: number;
  pendingTransactionsCount: number;
}

export interface MonthlyClosingRecord {
  id: string;
  year: number;
  month: number;
  monthName: string;
  openingBalance: string;
  totalIncome: string;
  totalExpense: string;
  closingBalance: string;
  cashBalance: string;
  bankBalance: string;
  upiBalance: string;
  receivablesTotal: string;
  payablesTotal: string;
  transactionCount: number;
  isClosed: boolean;
  closedAt?: string;
  closedByName?: string;
  reopenedAt?: string;
  reopenedByName?: string;
  reopenReason?: string;
}

export interface AISmartFilterResult {
  interpretedQuery: string;
  type?: TransactionType;
  dateRange?: { from: string; to: string };
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  searchKeyword?: string;
  partyName?: string;
  categoryName?: string;
}
