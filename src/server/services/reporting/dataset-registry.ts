import { PERMISSIONS } from "@/lib/auth/permissions";

export type ColumnDataType = "STRING" | "NUMBER" | "MONEY" | "DATE" | "ENUM" | "BOOLEAN";

export type FilterOperator =
  // Text operators
  | "EQUALS"
  | "NOT_EQUALS"
  | "CONTAINS"
  | "STARTS_WITH"
  | "IS_EMPTY"
  | "IS_NOT_EMPTY"
  // Number / Money operators
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "BETWEEN"
  // Date operators
  | "ON"
  | "BEFORE"
  | "AFTER"
  | "RELATIVE"
  // Enum operators
  | "IS"
  | "IS_NOT"
  | "IS_ANY_OF"
  // Boolean operators
  | "YES"
  | "NO";

export type AggregationType = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

export interface ColumnDefinition {
  id: string;
  label: string;
  dataType: ColumnDataType;
  description?: string;
  isSensitive?: boolean;
  requiredPermission?: string;
  allowedOperators: FilterOperator[];
  sortable?: boolean;
  groupable?: boolean;
  aggregations?: AggregationType[];
}

export interface DatasetDefinition {
  id: string;
  displayName: string;
  description: string;
  category: "FINANCIAL" | "CRM" | "VAULT" | "AUDIT" | "OPERATIONAL";
  requiredPermission: string;
  columns: ColumnDefinition[];
  defaultColumns: string[];
  defaultSort: { columnId: string; direction: "asc" | "desc" };
  supportsCharts: boolean;
  supportsExcel: boolean;
  supportsPdf: boolean;
  supportsAsClosed: boolean;
  supportsDrillDown: boolean;
}

// Operator Whitelist by Data Type
export const TYPE_OPERATORS: Record<ColumnDataType, FilterOperator[]> = {
  STRING: ["EQUALS", "NOT_EQUALS", "CONTAINS", "STARTS_WITH", "IS_EMPTY", "IS_NOT_EMPTY"],
  NUMBER: ["EQUALS", "NOT_EQUALS", "GT", "GTE", "LT", "LTE", "BETWEEN"],
  MONEY: ["EQUALS", "NOT_EQUALS", "GT", "GTE", "LT", "LTE", "BETWEEN"],
  DATE: ["ON", "BEFORE", "AFTER", "BETWEEN", "RELATIVE"],
  ENUM: ["IS", "IS_NOT", "IS_ANY_OF"],
  BOOLEAN: ["YES", "NO"],
};

// ===================================================================
// DATASET REGISTRY (19 Whitelisted Controlled Datasets)
// ===================================================================

export const DATASET_REGISTRY: Record<string, DatasetDefinition> = {
  TRANSACTIONS: {
    id: "TRANSACTIONS",
    displayName: "All Financial Transactions",
    description: "Detailed double-entry financial transactions across income, expense, and adjustments.",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.RECORDS_VIEW,
    columns: [
      { id: "date", label: "Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true, groupable: true },
      { id: "transactionNumber", label: "Transaction #", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "type", label: "Type", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, sortable: true, groupable: true },
      { id: "partyName", label: "Customer / Supplier", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true, groupable: true },
      { id: "partyId", label: "Party ID", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "customerId", label: "Customer ID", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "supplierId", label: "Supplier ID", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "categoryName", label: "Category", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true, groupable: true },
      { id: "description", label: "Description", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "referenceNumber", label: "Reference", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "amount", label: "Amount", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM", "AVG", "MIN", "MAX"] },
      { id: "paidAmount", label: "Paid Amount", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "outstandingAmount", label: "Outstanding", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "paymentStatus", label: "Payment Status", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, sortable: true, groupable: true },
      { id: "status", label: "Status", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, sortable: true, groupable: true },
      { id: "dueDate", label: "Due Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true },
      { id: "paymentMethod", label: "Payment Method", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, groupable: true },
      { id: "createdBy", label: "Created By", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, groupable: true },
    ],
    defaultColumns: ["date", "transactionNumber", "type", "partyName", "categoryName", "amount", "paymentStatus"],
    defaultSort: { columnId: "date", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: true,
  },

  INCOME: {
    id: "INCOME",
    displayName: "Recognized Income & Revenue",
    description: "Operating income earned from flight tickets, holiday packages, hotel bookings, and commissions.",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.INCOME_VIEW,
    columns: [
      { id: "date", label: "Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true, groupable: true },
      { id: "transactionNumber", label: "Invoice #", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "customerName", label: "Customer", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true, groupable: true },
      { id: "customerId", label: "Customer ID", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "categoryName", label: "Category", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true, groupable: true },
      { id: "description", label: "Description", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "amount", label: "Amount", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM", "AVG", "MIN", "MAX"] },
      { id: "paidAmount", label: "Received", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "outstandingAmount", label: "Receivable Balance", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "paymentStatus", label: "Payment Status", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
    ],
    defaultColumns: ["date", "transactionNumber", "customerName", "categoryName", "amount", "paidAmount", "outstandingAmount"],
    defaultSort: { columnId: "date", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: true,
  },

  EXPENSES: {
    id: "EXPENSES",
    displayName: "Operating Expenses & Costs",
    description: "Airline disbursements, hotel supplier settlements, visa fees, rent, salaries, and operating expenses.",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.EXPENSES_VIEW,
    columns: [
      { id: "date", label: "Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true, groupable: true },
      { id: "transactionNumber", label: "Expense #", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "supplierName", label: "Supplier / Vendor", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true, groupable: true },
      { id: "supplierId", label: "Supplier ID", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "categoryName", label: "Category", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true, groupable: true },
      { id: "description", label: "Description", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "amount", label: "Amount", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM", "AVG", "MIN", "MAX"] },
      { id: "paidAmount", label: "Disbursed", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "outstandingAmount", label: "Payable Balance", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "paymentStatus", label: "Payment Status", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
    ],
    defaultColumns: ["date", "transactionNumber", "supplierName", "categoryName", "amount", "paidAmount", "outstandingAmount"],
    defaultSort: { columnId: "date", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: true,
  },

  PAYMENTS: {
    id: "PAYMENTS",
    displayName: "Cash Flow & Payment Records",
    description: "Actual physical money received and disbursed across Cash, Bank, and UPI accounts.",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.PAYMENTS_VIEW,
    columns: [
      { id: "paymentDate", label: "Payment Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true, groupable: true },
      { id: "paymentNumber", label: "Payment #", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "direction", label: "Direction (In/Out)", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, sortable: true, groupable: true },
      { id: "partyName", label: "Party", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true, groupable: true },
      { id: "amount", label: "Amount", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM", "AVG"] },
      { id: "paymentMethodName", label: "Payment Method", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, groupable: true },
      { id: "paymentMethodType", label: "Account Type", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      { id: "referenceNumber", label: "Reference #", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "status", label: "Status", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
    ],
    defaultColumns: ["paymentDate", "paymentNumber", "direction", "partyName", "amount", "paymentMethodName", "referenceNumber"],
    defaultSort: { columnId: "paymentDate", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: true,
  },

  RECEIVABLES: {
    id: "RECEIVABLES",
    displayName: "Outstanding Receivables & Invoices",
    description: "Open customer balances, aging buckets, and collection status.",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.RECEIVABLES_VIEW,
    columns: [
      { id: "date", label: "Invoice Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true, groupable: true },
      { id: "transactionNumber", label: "Invoice #", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "customerName", label: "Customer", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true, groupable: true },
      { id: "customerId", label: "Customer ID", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "categoryName", label: "Category", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, groupable: true },
      { id: "amount", label: "Total Amount", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "paidAmount", label: "Paid Amount", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "outstandingAmount", label: "Outstanding Balance", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "dueDate", label: "Due Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true },
      { id: "daysOverdue", label: "Days Overdue", dataType: "NUMBER", allowedOperators: TYPE_OPERATORS.NUMBER, sortable: true },
      { id: "agingBucket", label: "Aging Bucket", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
    ],
    defaultColumns: ["date", "transactionNumber", "customerName", "amount", "outstandingAmount", "dueDate", "daysOverdue", "agingBucket"],
    defaultSort: { columnId: "daysOverdue", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: true,
  },

  PAYABLES: {
    id: "PAYABLES",
    displayName: "Outstanding Payables & Supplier Bills",
    description: "Open supplier settlements, airline bills, and disbursement aging.",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.PAYABLES_VIEW,
    columns: [
      { id: "date", label: "Bill Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true, groupable: true },
      { id: "transactionNumber", label: "Bill #", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "supplierName", label: "Supplier", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true, groupable: true },
      { id: "supplierId", label: "Supplier ID", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "categoryName", label: "Category", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, groupable: true },
      { id: "amount", label: "Total Amount", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "paidAmount", label: "Disbursed", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "outstandingAmount", label: "Outstanding Balance", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "dueDate", label: "Due Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true },
      { id: "daysOverdue", label: "Days Overdue", dataType: "NUMBER", allowedOperators: TYPE_OPERATORS.NUMBER, sortable: true },
      { id: "agingBucket", label: "Aging Bucket", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
    ],
    defaultColumns: ["date", "transactionNumber", "supplierName", "amount", "outstandingAmount", "dueDate", "daysOverdue", "agingBucket"],
    defaultSort: { columnId: "daysOverdue", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: true,
  },

  CUSTOMERS: {
    id: "CUSTOMERS",
    displayName: "Customers Master & Balance",
    description: "Customer accounts, current receivable balance, credit limits, and contact info.",
    category: "CRM",
    requiredPermission: PERMISSIONS.CUSTOMERS_VIEW,
    columns: [
      { id: "name", label: "Customer Name", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "code", label: "Code", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "city", label: "City", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, groupable: true },
      { id: "outstandingBalance", label: "Outstanding Balance", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "totalBilled", label: "Total Invoiced", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "totalPaid", label: "Total Paid", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "status", label: "Status", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      // Sensitive columns:
      { id: "phone", label: "Phone", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, isSensitive: true, requiredPermission: PERMISSIONS.CUSTOMERS_MANAGE },
      { id: "email", label: "Email", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, isSensitive: true, requiredPermission: PERMISSIONS.CUSTOMERS_MANAGE },
      { id: "notes", label: "Internal Notes", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, isSensitive: true, requiredPermission: PERMISSIONS.CUSTOMERS_MANAGE },
    ],
    defaultColumns: ["code", "name", "city", "outstandingBalance", "totalBilled", "totalPaid", "status"],
    defaultSort: { columnId: "outstandingBalance", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: true,
  },

  SUPPLIERS: {
    id: "SUPPLIERS",
    displayName: "Suppliers Master & Balance",
    description: "Airlines, hotel chains, and vendor balances with disbursement status.",
    category: "CRM",
    requiredPermission: PERMISSIONS.SUPPLIERS_VIEW,
    columns: [
      { id: "name", label: "Supplier Name", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "code", label: "Code", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "city", label: "City", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, groupable: true },
      { id: "outstandingBalance", label: "Outstanding Balance", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "totalBilled", label: "Total Billed", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "totalPaid", label: "Total Paid", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "status", label: "Status", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      // Sensitive columns:
      { id: "phone", label: "Phone", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, isSensitive: true, requiredPermission: PERMISSIONS.SUPPLIERS_MANAGE },
      { id: "email", label: "Email", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, isSensitive: true, requiredPermission: PERMISSIONS.SUPPLIERS_MANAGE },
      { id: "notes", label: "Internal Notes", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, isSensitive: true, requiredPermission: PERMISSIONS.SUPPLIERS_MANAGE },
    ],
    defaultColumns: ["code", "name", "city", "outstandingBalance", "totalBilled", "totalPaid", "status"],
    defaultSort: { columnId: "outstandingBalance", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: true,
  },

  CUSTOMER_LEDGER: {
    id: "CUSTOMER_LEDGER",
    displayName: "Customer Detailed Ledger",
    description: "Chronological debit/credit journal entries with running balance per customer.",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.CUSTOMERS_VIEW,
    columns: [
      { id: "date", label: "Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true },
      { id: "entryType", label: "Entry Type", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "referenceNumber", label: "Reference #", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "description", label: "Description", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "debit", label: "Debit (Invoiced)", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "credit", label: "Credit (Payment)", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "runningBalance", label: "Running Balance", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY },
    ],
    defaultColumns: ["date", "entryType", "referenceNumber", "description", "debit", "credit", "runningBalance"],
    defaultSort: { columnId: "date", direction: "asc" },
    supportsCharts: false,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: false,
    supportsDrillDown: false,
  },

  SUPPLIER_LEDGER: {
    id: "SUPPLIER_LEDGER",
    displayName: "Supplier Detailed Ledger",
    description: "Chronological debit/credit journal entries with running balance per supplier.",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.SUPPLIERS_VIEW,
    columns: [
      { id: "date", label: "Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true },
      { id: "entryType", label: "Entry Type", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "referenceNumber", label: "Reference #", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "description", label: "Description", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "debit", label: "Debit (Disbursed)", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "credit", label: "Credit (Billed)", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "runningBalance", label: "Running Balance", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY },
    ],
    defaultColumns: ["date", "entryType", "referenceNumber", "description", "debit", "credit", "runningBalance"],
    defaultSort: { columnId: "date", direction: "asc" },
    supportsCharts: false,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: false,
    supportsDrillDown: false,
  },

  CATEGORIES: {
    id: "CATEGORIES",
    displayName: "Category Breakdown & Distribution",
    description: "Aggregated financial breakdown by travel categories (Flights, Hotels, Visas, Transport, Rent, Salaries).",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.SETTINGS_VIEW,
    columns: [
      { id: "name", label: "Category Name", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "type", label: "Type", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      { id: "transactionCount", label: "Transaction Count", dataType: "NUMBER", allowedOperators: TYPE_OPERATORS.NUMBER, sortable: true, aggregations: ["SUM"] },
      { id: "totalAmount", label: "Total Amount", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "percentage", label: "% of Total", dataType: "NUMBER", allowedOperators: TYPE_OPERATORS.NUMBER, sortable: true },
    ],
    defaultColumns: ["name", "type", "transactionCount", "totalAmount", "percentage"],
    defaultSort: { columnId: "totalAmount", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: true,
  },

  PAYMENT_METHODS: {
    id: "PAYMENT_METHODS",
    displayName: "Payment Methods & Account Flow",
    description: "Summary of inflows, outflows, and net movements across Cash, Bank, and UPI accounts.",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.PAYMENTS_VIEW,
    columns: [
      { id: "name", label: "Account Name", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "type", label: "Type", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      { id: "inflow", label: "Money Received (In)", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "outflow", label: "Money Paid (Out)", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "netFlow", label: "Net Cash Flow", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "paymentCount", label: "Payment Count", dataType: "NUMBER", allowedOperators: TYPE_OPERATORS.NUMBER, sortable: true, aggregations: ["SUM"] },
    ],
    defaultColumns: ["name", "type", "inflow", "outflow", "netFlow", "paymentCount"],
    defaultSort: { columnId: "inflow", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: true,
  },

  DAILY_FINANCIAL_SUMMARY: {
    id: "DAILY_FINANCIAL_SUMMARY",
    displayName: "Daily Financial Trends",
    description: "Day-by-day recognized income, operating expenses, and cashflow movements.",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.REPORTS_VIEW,
    columns: [
      { id: "date", label: "Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true },
      { id: "income", label: "Recognized Income", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "expenses", label: "Recognized Expenses", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "netResult", label: "Net Operating Margin", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "moneyIn", label: "Money Received", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "moneyOut", label: "Money Paid", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "transactionCount", label: "Count", dataType: "NUMBER", allowedOperators: TYPE_OPERATORS.NUMBER, aggregations: ["SUM"] },
    ],
    defaultColumns: ["date", "income", "expenses", "netResult", "moneyIn", "moneyOut"],
    defaultSort: { columnId: "date", direction: "asc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: true,
  },

  MONTHLY_FINANCIAL_SUMMARY: {
    id: "MONTHLY_FINANCIAL_SUMMARY",
    displayName: "Monthly Financial Analysis",
    description: "Month-by-month comparative analysis of income, expenses, profit, and receivables/payables balance.",
    category: "FINANCIAL",
    requiredPermission: PERMISSIONS.REPORTS_VIEW,
    columns: [
      { id: "month", label: "Month", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "income", label: "Income", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "expenses", label: "Expenses", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "netResult", label: "Net Result", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "moneyIn", label: "Money In", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "moneyOut", label: "Money Out", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "receivables", label: "Ending Receivables", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY },
      { id: "payables", label: "Ending Payables", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY },
    ],
    defaultColumns: ["month", "income", "expenses", "netResult", "moneyIn", "moneyOut", "receivables", "payables"],
    defaultSort: { columnId: "month", direction: "asc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: false,
  },

  FOLLOWUPS: {
    id: "FOLLOWUPS",
    displayName: "CRM Follow-Ups & Tasks",
    description: "Customer & supplier communication reminders, pending tasks, and staff assignments.",
    category: "CRM",
    requiredPermission: PERMISSIONS.FOLLOWUPS_VIEW,
    columns: [
      { id: "dueDate", label: "Due Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true, groupable: true },
      { id: "partyName", label: "Party Name", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true, groupable: true },
      { id: "partyType", label: "Party Type", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      { id: "priority", label: "Priority", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      { id: "status", label: "Status", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      { id: "type", label: "Type", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      { id: "assignedStaff", label: "Assigned Staff", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, groupable: true },
      { id: "notes", label: "Notes", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, isSensitive: true, requiredPermission: PERMISSIONS.FOLLOWUPS_EDIT },
    ],
    defaultColumns: ["dueDate", "partyName", "partyType", "priority", "status", "type", "assignedStaff"],
    defaultSort: { columnId: "dueDate", direction: "asc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: false,
    supportsDrillDown: false,
  },

  PROMISES: {
    id: "PROMISES",
    displayName: "CRM Payment Promises",
    description: "Documented customer payment commitments and settlement promises with fulfillment status.",
    category: "CRM",
    requiredPermission: PERMISSIONS.PROMISES_VIEW,
    columns: [
      { id: "promisedDate", label: "Promised Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true },
      { id: "customerName", label: "Customer Name", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true, groupable: true },
      { id: "amount", label: "Promised Amount", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, sortable: true, aggregations: ["SUM"] },
      { id: "status", label: "Status", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      { id: "fulfilledAmount", label: "Fulfilled Amount", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "notes", label: "Notes", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, isSensitive: true, requiredPermission: PERMISSIONS.PROMISES_MANAGE },
    ],
    defaultColumns: ["promisedDate", "customerName", "amount", "status", "fulfilledAmount"],
    defaultSort: { columnId: "promisedDate", direction: "asc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: false,
    supportsDrillDown: false,
  },

  DOCUMENTS_METADATA: {
    id: "DOCUMENTS_METADATA",
    displayName: "Document Vault Metadata",
    description: "Business file vault metadata, passport/visa expiration schedules, and party attachments.",
    category: "VAULT",
    requiredPermission: PERMISSIONS.DOCUMENTS_VIEW,
    columns: [
      { id: "title", label: "Document Title", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "category", label: "Category", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      { id: "partyName", label: "Associated Party", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, groupable: true },
      { id: "expiryDate", label: "Expiry Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true },
      { id: "fileSize", label: "File Size (KB)", dataType: "NUMBER", allowedOperators: TYPE_OPERATORS.NUMBER, aggregations: ["SUM"] },
      { id: "isConfidential", label: "Confidential", dataType: "BOOLEAN", allowedOperators: TYPE_OPERATORS.BOOLEAN, groupable: true },
      { id: "createdAt", label: "Uploaded Date", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true },
    ],
    defaultColumns: ["title", "category", "partyName", "expiryDate", "fileSize", "createdAt"],
    defaultSort: { columnId: "createdAt", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: false,
    supportsDrillDown: false,
  },

  MONTH_END_CLOSINGS: {
    id: "MONTH_END_CLOSINGS",
    displayName: "Month-End Closings History",
    description: "Official closed financial periods, locked snapshot balances, and closing audit records.",
    category: "AUDIT",
    requiredPermission: PERMISSIONS.MONTH_END_VIEW,
    columns: [
      { id: "periodLabel", label: "Financial Period", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, sortable: true },
      { id: "closedAt", label: "Closed At", dataType: "DATE", allowedOperators: TYPE_OPERATORS.DATE, sortable: true },
      { id: "closedBy", label: "Closed By", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, groupable: true },
      { id: "netIncome", label: "Snapshot Net Margin", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "totalReceivables", label: "Receivables Position", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "totalPayables", label: "Payables Position", dataType: "MONEY", allowedOperators: TYPE_OPERATORS.MONEY, aggregations: ["SUM"] },
      { id: "transactionCount", label: "Transaction Count", dataType: "NUMBER", allowedOperators: TYPE_OPERATORS.NUMBER, aggregations: ["SUM"] },
    ],
    defaultColumns: ["periodLabel", "closedAt", "closedBy", "netIncome", "totalReceivables", "totalPayables", "transactionCount"],
    defaultSort: { columnId: "closedAt", direction: "desc" },
    supportsCharts: true,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: true,
    supportsDrillDown: false,
  },

  ACCOUNTING_HEALTH: {
    id: "ACCOUNTING_HEALTH",
    displayName: "Accounting Health & Discrepancies",
    description: "Operational audit of unallocated payments, draft records, and month-end integrity status.",
    category: "AUDIT",
    requiredPermission: PERMISSIONS.ACCOUNTING_RECONCILE,
    columns: [
      { id: "checkName", label: "Integrity Check", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
      { id: "category", label: "Area", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING, groupable: true },
      { id: "status", label: "Status", dataType: "ENUM", allowedOperators: TYPE_OPERATORS.ENUM, groupable: true },
      { id: "itemCount", label: "Discrepancy Count", dataType: "NUMBER", allowedOperators: TYPE_OPERATORS.NUMBER, aggregations: ["SUM"] },
      { id: "details", label: "Audit Details", dataType: "STRING", allowedOperators: TYPE_OPERATORS.STRING },
    ],
    defaultColumns: ["checkName", "category", "status", "itemCount", "details"],
    defaultSort: { columnId: "itemCount", direction: "desc" },
    supportsCharts: false,
    supportsExcel: true,
    supportsPdf: true,
    supportsAsClosed: false,
    supportsDrillDown: false,
  },
};

export function getDatasetDefinition(datasetId: string): DatasetDefinition | null {
  return DATASET_REGISTRY[datasetId] || null;
}

export function listAvailableDatasets(userPermissions: string[], userRoles: string[]): DatasetDefinition[] {
  const isOwnerOrAdmin = userRoles.includes("OWNER") || userRoles.includes("ADMIN");
  return Object.values(DATASET_REGISTRY).filter((dataset) => {
    if (isOwnerOrAdmin) return true;
    return userPermissions.includes(dataset.requiredPermission);
  });
}
