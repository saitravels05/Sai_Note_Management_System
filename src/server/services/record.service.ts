import { prisma } from "@/lib/db";
import { AppError, NotFoundError, ForbiddenError } from "@/lib/errors";
import { NumberingService } from "./numbering.service";
import { AuthorizationService } from "./authorization.service";
import { AuditService } from "./audit.service";
import { Money } from "@/lib/money";
import {
  TransactionType,
  TransactionStatus,
  PaymentStatus,
  AuditAction,
  Prisma,
} from "@prisma/client";

export interface RecordContext {
  userId: string;
  businessId: string;
  userRoles?: string[];
  permissions?: string[];
}

export interface CreateRecordInput {
  transactionType: TransactionType;
  transactionDate: Date;
  title: string;
  categoryId: string;
  amount: number | string;
  customerId?: string | null;
  supplierId?: string | null;
  paymentStatus?: PaymentStatus;
  status?: TransactionStatus;
  referenceNumber?: string | null;
  description?: string | null;
  dueDate?: Date | null;
  notes?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  voidReason?: string | null;
}

export interface UpdateRecordInput extends Partial<CreateRecordInput> {
  editReason?: string;
}

export interface RecordFilterOptions {
  search?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  paymentStatus?: PaymentStatus;
  customerId?: string;
  supplierId?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  tagId?: string;
  hasAttachment?: boolean;
  hasNotes?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "newest" | "oldest" | "highest_amount" | "lowest_amount" | "recently_updated";
}

export class RecordService {
  /**
   * Create a new Financial Record (Draft or Posted).
   */
  public static async createRecord(input: CreateRecordInput, ctx: RecordContext) {
    const { businessId, userId } = ctx;

    // 1. Period Lock Protection: Check if financial period is open
    await AuthorizationService.requireOpenFinancialPeriod(businessId, input.transactionDate);

    // 2. Adjustments require special financial permission
    if (input.transactionType === TransactionType.ADJUSTMENT) {
      const hasPerm =
        ctx.userRoles?.includes("OWNER") ||
        ctx.permissions?.includes("settings.manage") ||
        ctx.permissions?.includes("month_end.close");
      if (!hasPerm) {
        throw new ForbiddenError("Creating financial adjustments requires Owner or Accountant permissions.");
      }
      if (!input.notes || input.notes.trim().length < 5) {
        throw new AppError("A detailed explanation is mandatory when posting financial adjustments.", 400);
      }
    }

    // 3. Amount Validation
    const moneyAmount = new Money(input.amount || 0);
    if (input.status === TransactionStatus.POSTED && moneyAmount.isZero()) {
      throw new AppError("Financial record amount must be greater than zero when posting.", 400);
    }

    // 4. Verify Category belongs to this business
    const category = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        businessId,
        isActive: true,
      },
    });

    if (!category) {
      throw new AppError("The selected category is invalid or inactive for this business.", 400);
    }

    // 5. Verify Customer if provided belongs to this business
    if (input.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, businessId },
      });
      if (!customer) {
        throw new AppError("The selected customer does not exist in your business.", 400);
      }
    }

    // 6. Verify Supplier if provided belongs to this business
    if (input.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: input.supplierId, businessId },
      });
      if (!supplier) {
        throw new AppError("The selected supplier does not exist in your business.", 400);
      }
    }

    // 7. Safe Concurrency Numbering
    const year = input.transactionDate.getFullYear();
    const prefix = input.transactionType === TransactionType.INCOME ? "INC" :
      input.transactionType === TransactionType.EXPENSE ? "EXP" :
      input.transactionType === TransactionType.RECEIVABLE ? "REC" :
      input.transactionType === TransactionType.PAYABLE ? "PAY" : "TXN";

    const transactionNumber = await NumberingService.getNextSequenceNumber(
      businessId,
      "TRANSACTION",
      prefix,
      year
    );

    // 8. Create Transaction atomically
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          businessId,
          transactionNumber,
          transactionDate: input.transactionDate,
          transactionType: input.transactionType,
          categoryId: category.id,
          customerId: input.customerId || null,
          supplierId: input.supplierId || null,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          referenceNumber: input.referenceNumber?.trim() || null,
          currency: "INR",
          amount: moneyAmount.toDecimal(),
          totalAmount: moneyAmount.toDecimal(),
          paymentStatus: input.paymentStatus || PaymentStatus.UNPAID,
          status: input.status || TransactionStatus.POSTED,
          dueDate: input.dueDate || null,
          notes: input.notes?.trim() || null,
          createdById: userId,
          postedAt: input.status === TransactionStatus.DRAFT ? null : new Date(),
        },
        include: {
          category: true,
          customer: true,
          supplier: true,
        },
      });

      // Link tags if provided
      if (input.tags && input.tags.length > 0) {
        for (const tagName of input.tags) {
          const trimmedTag = tagName.trim();
          if (!trimmedTag) continue;

          const tag = await tx.tag.upsert({
            where: {
              businessId_name: {
                businessId,
                name: trimmedTag,
              },
            },
            update: {},
            create: {
              businessId,
              name: trimmedTag,
            },
          });

          await tx.transactionTag.create({
            data: {
              transactionId: created.id,
              tagId: tag.id,
            },
          });
        }
      }

      // Link custom fields if provided
      if (input.customFields && Object.keys(input.customFields).length > 0) {
        for (const [fieldName, val] of Object.entries(input.customFields)) {
          if (val === undefined || val === null || val === "") continue;

          const definition = await tx.customFieldDefinition.findFirst({
            where: {
              businessId,
              fieldName,
              isActive: true,
            },
          });

          if (definition) {
            await tx.customFieldValue.create({
              data: {
                businessId,
                definitionId: definition.id,
                entityId: created.id,
                value: val as Prisma.InputJsonValue,
              },
            });
          }
        }
      }

      return created;
    });

    // 9. Audit Event
    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CREATE,
      entityType: "TRANSACTION",
      entityId: record.id,
      newValues: {
        transactionNumber: record.transactionNumber,
        title: record.title,
        type: record.transactionType,
        amount: record.totalAmount.toString(),
        status: record.status,
      },
      reason: input.status === TransactionStatus.DRAFT ? "Draft record saved" : "Record posted to ledger",
    });

    return record;
  }

  /**
   * Update an existing financial record with historical diff audit and period lock.
   */
  public static async updateRecord(id: string, input: UpdateRecordInput, ctx: RecordContext) {
    const { businessId, userId } = ctx;

    const existing = await prisma.transaction.findFirst({
      where: { id, businessId },
      include: {
        category: true,
        customer: true,
        supplier: true,
      },
    });

    if (!existing) {
      throw new NotFoundError("Transaction not found or you do not have permission to access it.");
    }

    if (existing.status === TransactionStatus.VOID) {
      throw new AppError("Cannot modify a voided transaction.", 400);
    }

    // Check period lock on previous date and new date
    await AuthorizationService.requireOpenFinancialPeriod(businessId, existing.transactionDate);
    if (input.transactionDate) {
      await AuthorizationService.requireOpenFinancialPeriod(businessId, input.transactionDate);
    }

    // Prepare update data
    const updateData: Prisma.TransactionUpdateInput = {};

    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim() || null;
    if (input.referenceNumber !== undefined) updateData.referenceNumber = input.referenceNumber?.trim() || null;
    if (input.transactionDate !== undefined) updateData.transactionDate = input.transactionDate;
    if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
    if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;
    if (input.paymentStatus !== undefined) updateData.paymentStatus = input.paymentStatus;

    if (input.amount !== undefined) {
      const newMoney = new Money(input.amount);
      updateData.amount = newMoney.toDecimal();
      updateData.totalAmount = newMoney.toDecimal();
    }

    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === TransactionStatus.POSTED && !existing.postedAt) {
        updateData.postedAt = new Date();
      }
    }

    if (input.categoryId && input.categoryId !== existing.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: input.categoryId, businessId, isActive: true },
      });
      if (!cat) throw new AppError("Selected category is invalid.", 400);
      updateData.category = { connect: { id: cat.id } };
    }

    if (input.customerId !== undefined) {
      if (input.customerId) {
        const cust = await prisma.customer.findFirst({ where: { id: input.customerId, businessId } });
        if (!cust) throw new AppError("Customer not found.", 400);
        updateData.customer = { connect: { id: cust.id } };
      } else {
        updateData.customer = { disconnect: true };
      }
    }

    if (input.supplierId !== undefined) {
      if (input.supplierId) {
        const supp = await prisma.supplier.findFirst({ where: { id: input.supplierId, businessId } });
        if (!supp) throw new AppError("Supplier not found.", 400);
        updateData.supplier = { connect: { id: supp.id } };
      } else {
        updateData.supplier = { disconnect: true };
      }
    }

    updateData.updatedById = userId;

    const updated = await prisma.transaction.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        category: true,
        customer: true,
        supplier: true,
      },
    });

    // Audit change
    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.UPDATE,
      entityType: "TRANSACTION",
      entityId: updated.id,
      previousValues: {
        title: existing.title,
        amount: existing.totalAmount.toString(),
        date: existing.transactionDate.toISOString(),
        status: existing.status,
      },
      newValues: {
        title: updated.title,
        amount: updated.totalAmount.toString(),
        date: updated.transactionDate.toISOString(),
        status: updated.status,
      },
      reason: input.editReason || "Record updated",
    });

    return updated;
  }

  /**
   * Void a financial record with mandatory reason. Never hard-deletes financial history.
   */
  public static async voidRecord(id: string, reason: string, ctx: RecordContext) {
    const { businessId, userId } = ctx;

    if (!reason || reason.trim().length < 3) {
      throw new AppError("A reason is mandatory to void a financial transaction.", 400);
    }

    const existing = await prisma.transaction.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundError("Transaction not found.");
    }

    if (existing.status === TransactionStatus.VOID) {
      throw new AppError("Transaction is already voided.", 400);
    }

    // Period Lock Check
    await AuthorizationService.requireOpenFinancialPeriod(businessId, existing.transactionDate);

    const voided = await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        status: TransactionStatus.VOID,
        voidedAt: new Date(),
        voidedBy: userId,
        voidReason: reason.trim(),
      },
    });

    // Audit VOID
    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.VOID,
      entityType: "TRANSACTION",
      entityId: voided.id,
      previousValues: { status: existing.status },
      newValues: { status: TransactionStatus.VOID, voidReason: reason.trim() },
      reason: `Voided: ${reason.trim()}`,
    });

    return voided;
  }

  /**
   * Delete a DRAFT record. Posted financial transactions can NEVER be deleted.
   */
  public static async deleteDraft(id: string, ctx: RecordContext) {
    const { businessId, userId } = ctx;

    const existing = await prisma.transaction.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundError("Record not found.");
    }

    if (existing.status !== TransactionStatus.DRAFT) {
      throw new AppError("Security Violation: Only DRAFT records may be deleted. Posted transactions must be Voided.", 400);
    }

    await prisma.transaction.delete({
      where: { id: existing.id },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.VOID,
      entityType: "TRANSACTION_DRAFT",
      entityId: id,
      reason: "Draft deleted by user",
    });

    return { success: true };
  }

  /**
   * Pre-flight Duplicate Detection. Checks if a matching transaction already exists.
   */
  public static async checkDuplicate(
    businessId: string,
    params: {
      amount: number | string;
      transactionDate: Date;
      referenceNumber?: string | null;
      customerId?: string | null;
      supplierId?: string | null;
      excludeId?: string;
    }
  ) {
    const moneyAmount = new Money(params.amount || 0);

    const matches = await prisma.transaction.findMany({
      where: {
        businessId,
        id: params.excludeId ? { not: params.excludeId } : undefined,
        status: { in: [TransactionStatus.POSTED, TransactionStatus.DRAFT] },
        transactionDate: params.transactionDate,
        totalAmount: moneyAmount.toDecimal(),
        OR: [
          params.referenceNumber ? { referenceNumber: params.referenceNumber.trim() } : {},
          params.customerId ? { customerId: params.customerId } : {},
          params.supplierId ? { supplierId: params.supplierId } : {},
        ].filter((c) => Object.keys(c).length > 0),
      },
      select: {
        id: true,
        transactionNumber: true,
        title: true,
        totalAmount: true,
        referenceNumber: true,
        transactionDate: true,
      },
      take: 3,
    });

    return {
      isPossibleDuplicate: matches.length > 0,
      matches,
    };
  }

  /**
   * Query records with comprehensive filters, server-side pagination, and sorting.
   */
  public static async getRecords(opts: RecordFilterOptions, ctx: RecordContext) {
    const { businessId } = ctx;
    const page = Math.max(1, opts.page || 1);
    const pageSize = Math.min(100, Math.max(10, opts.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.TransactionWhereInput = {
      businessId,
    };

    if (opts.type) where.transactionType = opts.type;
    if (opts.status) where.status = opts.status;
    if (opts.paymentStatus) where.paymentStatus = opts.paymentStatus;
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.supplierId) where.supplierId = opts.supplierId;
    if (opts.categoryId) where.categoryId = opts.categoryId;

    if (opts.startDate || opts.endDate) {
      where.transactionDate = {};
      if (opts.startDate) where.transactionDate.gte = opts.startDate;
      if (opts.endDate) where.transactionDate.lte = opts.endDate;
    }

    if (opts.minAmount !== undefined || opts.maxAmount !== undefined) {
      where.totalAmount = {};
      if (opts.minAmount !== undefined) where.totalAmount.gte = new Money(opts.minAmount).toDecimal();
      if (opts.maxAmount !== undefined) where.totalAmount.lte = new Money(opts.maxAmount).toDecimal();
    }

    if (opts.tagId) {
      where.tags = {
        some: {
          tagId: opts.tagId,
        },
      };
    }

    if (opts.hasNotes) {
      where.notes = { not: null };
    }

    if (opts.search && opts.search.trim().length > 0) {
      const q = opts.search.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { transactionNumber: { contains: q, mode: "insensitive" } },
        { referenceNumber: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    // Determine sorting
    let orderBy: Prisma.TransactionOrderByWithRelationInput = { transactionDate: "desc" };
    switch (opts.sortBy) {
      case "oldest":
        orderBy = { transactionDate: "asc" };
        break;
      case "highest_amount":
        orderBy = { totalAmount: "desc" };
        break;
      case "lowest_amount":
        orderBy = { totalAmount: "asc" };
        break;
      case "recently_updated":
        orderBy = { updatedAt: "desc" };
        break;
      case "newest":
      default:
        orderBy = { transactionDate: "desc" };
        break;
    }

    const [totalCount, records] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        include: {
          category: true,
          customer: true,
          supplier: true,
          tags: {
            include: { tag: true },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      records,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get single record by ID with full details, notes, attachments, and audit history.
   */
  public static async getRecordById(id: string, ctx: RecordContext) {
    const { businessId } = ctx;

    const record = await prisma.transaction.findFirst({
      where: { id, businessId },
      include: {
        category: true,
        customer: true,
        supplier: true,
        items: true,
        tags: {
          include: { tag: true },
        },
        notesRel: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!record) {
      throw new NotFoundError("Transaction not found or inaccessible.");
    }

    // Fetch related audit events
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        businessId,
        entityType: "TRANSACTION",
        entityId: record.id,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Fetch custom field values
    const customFieldValues = await prisma.customFieldValue.findMany({
      where: {
        businessId,
        entityId: record.id,
      },
      include: {
        definition: true,
      },
    });

    return {
      record,
      auditLogs,
      customFieldValues,
    };
  }
}
