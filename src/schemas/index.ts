import { z } from "zod";
import {
  TransactionType,
  PaymentStatus,
  TransactionStatus,
  CategoryType,
  PaymentDirection,
  CustomFieldType,
  CustomFieldEntity,
} from "@prisma/client";

// ===================================================================
// CUSTOMERS & SUPPLIERS SCHEMAS
// ===================================================================

export const CustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required").max(200),
  companyName: z.string().max(200).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  alternatePhone: z.string().max(20).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().default("India"),
  gstin: z.string().max(15).regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format").optional().or(z.literal("")),
  notes: z.string().optional(),
  openingBalance: z.coerce.number().default(0),
  creditLimit: z.coerce.number().default(0),
});

export const SupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required").max(200),
  companyName: z.string().max(200).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  alternatePhone: z.string().max(20).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().default("India"),
  gstin: z.string().max(15).regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format").optional().or(z.literal("")),
  notes: z.string().optional(),
  openingBalance: z.coerce.number().default(0),
  creditLimit: z.coerce.number().default(0),
});

// ===================================================================
// CATEGORY SCHEMA
// ===================================================================

export const CategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
  type: z.nativeEnum(CategoryType).default(CategoryType.BOTH),
  parentId: z.string().optional().nullable(),
  description: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().default(0),
});

// ===================================================================
// TRANSACTION & ITEM SCHEMAS
// ===================================================================

export const TransactionItemSchema = z.object({
  description: z.string().min(1, "Item description is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0").default(1),
  unitPrice: z.coerce.number().min(0, "Unit price must be non-negative"),
  discountAmount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  lineTotal: z.coerce.number().min(0),
});

export const TransactionSchema = z.object({
  transactionDate: z.coerce.date(),
  transactionTime: z.string().optional(),
  transactionType: z.nativeEnum(TransactionType),
  categoryId: z.string().min(1, "Category is required"),
  customerId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  referenceNumber: z.string().max(100).optional(),
  currency: z.string().default("INR"),
  amount: z.coerce.number().min(0, "Amount must be non-negative"),
  taxableAmount: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  discountAmount: z.coerce.number().min(0).default(0),
  totalAmount: z.coerce.number().min(0, "Total amount must be non-negative"),
  paymentStatus: z.nativeEnum(PaymentStatus).default(PaymentStatus.UNPAID),
  status: z.nativeEnum(TransactionStatus).default(TransactionStatus.POSTED),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
  items: z.array(TransactionItemSchema).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

// ===================================================================
// PAYMENTS & ALLOCATIONS SCHEMAS
// ===================================================================

export const PaymentAllocationSchema = z.object({
  transactionId: z.string().min(1, "Transaction ID is required"),
  amount: z.coerce.number().positive("Allocation amount must be greater than 0"),
});

export const PaymentSchema = z.object({
  paymentDate: z.coerce.date(),
  direction: z.nativeEnum(PaymentDirection),
  customerId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  amount: z.coerce.number().positive("Payment amount must be greater than 0"),
  currency: z.string().default("INR"),
  paymentMethodId: z.string().min(1, "Payment method is required"),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().optional(),
  allocations: z.array(PaymentAllocationSchema).optional(),
});

// ===================================================================
// NOTES SCHEMA (NON-FINANCIAL BUSINESS MEMOS)
// ===================================================================

export const NoteSchema = z.object({
  title: z.string().min(1, "Note title is required").max(200),
  content: z.string().min(1, "Note content is required"),
  noteType: z.string().default("GENERAL"),
  customerId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  transactionId: z.string().optional().nullable(),
  isPinned: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
});

// ===================================================================
// CUSTOM FIELDS SCHEMA
// ===================================================================

export const CustomFieldDefinitionSchema = z.object({
  entityType: z.nativeEnum(CustomFieldEntity),
  fieldName: z.string().min(1, "Field name is required").regex(/^[a-z0-9_]+$/, "Field name must be lowercase alphanumeric with underscores"),
  fieldLabel: z.string().min(1, "Field label is required").max(100),
  fieldType: z.nativeEnum(CustomFieldType),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().default(false),
  defaultValue: z.string().optional(),
});
