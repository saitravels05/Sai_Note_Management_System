import {
  FollowUpType,
  FollowUpStatus,
  FollowUpPriority,
  FollowUpOutcome,
  PromiseStatus,
  PaymentCommitmentStatus,
  CommunicationChannel,
  CommunicationDirection,
  PartyStatus,
} from "@prisma/client";

// ===================================================================
// CUSTOMER CRM TYPES
// ===================================================================

export interface CustomerFinancialSummaryDTO {
  totalBusinessVolume: string; // Formatted Money
  moneyReceived: string;       // Formatted Money
  currentReceivables: string;  // Formatted Money
  overdueReceivables: string;  // Formatted Money
  unappliedPayments: string;   // Formatted Money
  oldestDueDate: string | null;// ISO Date string or null
  transactionCount: number;
  openFollowUpsCount: number;
  activePromisesCount: number;
  aging: {
    current: string;
    days1_30: string;
    days31_60: string;
    days61_90: string;
    days90Plus: string;
  };
}

export interface CustomerListItemDTO {
  id: string;
  customerCode: string;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  status: PartyStatus;
  currentReceivable: string;
  overdueReceivable: string;
  paymentStatus: "NO_BALANCE" | "UNPAID" | "PARTIALLY_PAID" | "OVERDUE";
  nextFollowUpDate: string | null;
  nextFollowUpTitle: string | null;
  assignedUser: { id: string; displayName: string } | null;
  tags: string[];
  isPinnedNote: string | null;
  createdAt: string;
}

export interface CustomerProfile360DTO {
  customer: {
    id: string;
    customerCode: string;
    name: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    alternatePhone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string;
    postalCode: string | null;
    gstin: string | null;
    notes: string | null;
    openingBalance: string;
    creditLimit: string;
    status: PartyStatus;
    preferredContactMethod: string | null;
    preferredContactTime: string | null;
    languagePreference: string;
    tags: string[];
    isPinnedNote: string | null;
    createdAt: string;
    assignedUser: { id: string; displayName: string; email: string } | null;
  };
  financialSummary: CustomerFinancialSummaryDTO;
  // Historical As-Closed comparison if requested
  historicalSnapshot?: {
    periodLabel: string;
    asClosedOutstanding: string;
    currentOutstanding: string;
    variance: string;
    closedAt: string;
  };
}

// ===================================================================
// SUPPLIER CRM TYPES
// ===================================================================

export interface SupplierFinancialSummaryDTO {
  totalPurchasesVolume: string; // Formatted Money
  moneyPaid: string;            // Formatted Money
  currentPayables: string;      // Formatted Money
  overduePayables: string;      // Formatted Money
  unappliedPayments: string;    // Formatted Money
  oldestDueDate: string | null; // ISO Date string or null
  transactionCount: number;
  openFollowUpsCount: number;
  activeCommitmentsCount: number;
  aging: {
    current: string;
    days1_30: string;
    days31_60: string;
    days61_90: string;
    days90Plus: string;
  };
}

export interface SupplierListItemDTO {
  id: string;
  supplierCode: string;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  status: PartyStatus;
  currentPayable: string;
  overduePayable: string;
  dueStatus: "NO_BALANCE" | "UNPAID" | "PARTIALLY_PAID" | "OVERDUE";
  nextFollowUpDate: string | null;
  nextFollowUpTitle: string | null;
  assignedUser: { id: string; displayName: string } | null;
  tags: string[];
  isPinnedNote: string | null;
  createdAt: string;
}

export interface SupplierProfile360DTO {
  supplier: {
    id: string;
    supplierCode: string;
    name: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    alternatePhone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string;
    postalCode: string | null;
    gstin: string | null;
    notes: string | null;
    openingBalance: string;
    creditLimit: string;
    status: PartyStatus;
    preferredContactMethod: string | null;
    preferredContactTime: string | null;
    languagePreference: string;
    tags: string[];
    isPinnedNote: string | null;
    createdAt: string;
    assignedUser: { id: string; displayName: string; email: string } | null;
  };
  financialSummary: SupplierFinancialSummaryDTO;
}

// ===================================================================
// FOLLOW-UP TYPES
// ===================================================================

export interface FollowUpItemDTO {
  id: string;
  type: FollowUpType;
  title: string;
  description: string | null;
  dueDate: string;
  dueTime: string | null;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  isOverdue: boolean;
  customerId: string | null;
  customerName: string | null;
  customerCode: string | null;
  customerPhone: string | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierCode: string | null;
  transactionId: string | null;
  transactionNumber: string | null;
  receivableOrPayableAmount: string | null;
  assignedUser: { id: string; displayName: string } | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  outcome: FollowUpOutcome | null;
  outcomeNotes: string | null;
  nextFollowUpDate: string | null;
}

export interface FollowUpSummaryMetricsDTO {
  dueToday: number;
  overdue: number;
  upcomingThisWeek: number;
  completedToday: number;
  customerFollowUps: number;
  supplierFollowUps: number;
  promisesDueCount: number;
  promisesOverdueCount: number;
  assignedToMeCount: number;
}

export interface CreateFollowUpInput {
  type: FollowUpType;
  title: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string;
  priority?: FollowUpPriority;
  customerId?: string;
  supplierId?: string;
  transactionId?: string;
  assignedUserId?: string;
}

export interface CompleteFollowUpInput {
  followUpId: string;
  outcome: FollowUpOutcome;
  outcomeNotes?: string;
  scheduleNextDate?: string;
  scheduleNextTime?: string;
  scheduleNextTitle?: string;
}

// ===================================================================
// PROMISE-TO-PAY & SUPPLIER COMMITMENT TYPES
// ===================================================================

export interface PromiseToPayItemDTO {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  transactionId: string | null;
  transactionNumber: string | null;
  promisedAmount: string; // Formatted Money
  fulfilledAmount: string;
  remainingAmount: string;
  promiseDate: string;
  isOverdue: boolean;
  notes: string | null;
  status: PromiseStatus;
  createdAt: string;
  fulfilledAt: string | null;
}

export interface CreatePromiseInput {
  customerId: string;
  transactionId?: string;
  followUpId?: string;
  promisedAmount: number | string;
  promiseDate: string; // YYYY-MM-DD
  notes?: string;
}

export interface PaymentCommitmentItemDTO {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string | null;
  transactionId: string | null;
  transactionNumber: string | null;
  plannedAmount: string;
  paidAmount: string;
  remainingAmount: string;
  commitmentDate: string;
  isOverdue: boolean;
  notes: string | null;
  status: PaymentCommitmentStatus;
  createdAt: string;
  fulfilledAt: string | null;
}

export interface CreateCommitmentInput {
  supplierId: string;
  transactionId?: string;
  followUpId?: string;
  plannedAmount: number | string;
  commitmentDate: string; // YYYY-MM-DD
  notes?: string;
}

// ===================================================================
// COMMUNICATION LOG & TIMELINE TYPES
// ===================================================================

export interface CommunicationLogItemDTO {
  id: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  subject: string | null;
  summary: string;
  communicationDate: string;
  userName: string;
  customerId: string | null;
  customerName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  createdAt: string;
}

export interface CreateCommunicationLogInput {
  channel: CommunicationChannel;
  direction?: CommunicationDirection;
  subject?: string;
  summary: string;
  communicationDate?: string;
  customerId?: string;
  supplierId?: string;
  followUpId?: string;
}

export interface CRMActivityItemDTO {
  id: string;
  date: string;
  type: "FOLLOW_UP" | "PROMISE" | "COMMITMENT" | "COMMUNICATION" | "PAYMENT" | "INVOICE" | "NOTE";
  title: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  author?: string;
  amount?: string;
}
