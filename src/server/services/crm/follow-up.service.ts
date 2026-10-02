import { prisma } from "@/lib/db";
import {
  FollowUpType,
  FollowUpStatus,
  FollowUpPriority,
  FollowUpOutcome,
  PromiseStatus,
  AuditAction,
} from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import {
  FollowUpItemDTO,
  FollowUpSummaryMetricsDTO,
  CreateFollowUpInput,
  CompleteFollowUpInput,
} from "@/types/crm";
import { AuditService } from "../audit.service";
import { Money } from "@/lib/money";

export interface FollowUpFilterParams {
  businessId: string;
  userId?: string;
  filter?: "all" | "my" | "today" | "overdue" | "upcoming" | "completed";
  type?: FollowUpType;
  priority?: FollowUpPriority;
  customerId?: string;
  supplierId?: string;
  transactionId?: string;
  page?: number;
  pageSize?: number;
}

export class FollowUpService {
  // ===================================================================
  // WORK QUEUE & FOLLOW-UPS LIST
  // ===================================================================

  public static async getFollowUps(params: FollowUpFilterParams): Promise<{
    items: FollowUpItemDTO[];
    totalCount: number;
    page: number;
    pageSize: number;
  }> {
    const {
      businessId,
      userId,
      filter = "all",
      type,
      priority,
      customerId,
      supplierId,
      transactionId,
      page = 1,
      pageSize = 25,
    } = params;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      businessId,
      ...(type ? { type } : {}),
      ...(priority ? { priority } : {}),
      ...(customerId ? { customerId } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(transactionId ? { transactionId } : {}),
    };

    if (filter === "my" && userId) {
      where.assignedUserId = userId;
      where.status = { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] };
    } else if (filter === "today") {
      where.status = { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] };
      where.dueDate = { gte: startOfToday, lte: endOfToday };
    } else if (filter === "overdue") {
      where.status = { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] };
      where.dueDate = { lt: startOfToday };
    } else if (filter === "upcoming") {
      where.status = { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] };
      where.dueDate = { gt: endOfToday, lte: endOfWeek };
    } else if (filter === "completed") {
      where.status = FollowUpStatus.COMPLETED;
    }

    const [followUps, totalCount] = await Promise.all([
      prisma.followUp.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, customerCode: true, phone: true } },
          supplier: { select: { id: true, name: true, supplierCode: true } },
          transaction: { select: { id: true, transactionNumber: true, totalAmount: true } },
          assignedUser: { select: { id: true, displayName: true } },
        },
        orderBy: [
          { status: "asc" },
          { dueDate: "asc" },
          { priority: "desc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.followUp.count({ where }),
    ]);

    const items: FollowUpItemDTO[] = followUps.map((f) => {
      const isOverdue =
        (f.status === FollowUpStatus.OPEN || f.status === FollowUpStatus.IN_PROGRESS) &&
        f.dueDate < startOfToday;

      return {
        id: f.id,
        type: f.type,
        title: f.title,
        description: f.description,
        dueDate: f.dueDate.toISOString(),
        dueTime: f.dueTime,
        priority: f.priority,
        status: f.status,
        isOverdue,
        customerId: f.customerId,
        customerName: f.customer?.name || null,
        customerCode: f.customer?.customerCode || null,
        customerPhone: f.customer?.phone || null,
        supplierId: f.supplierId,
        supplierName: f.supplier?.name || null,
        supplierCode: f.supplier?.supplierCode || null,
        transactionId: f.transactionId,
        transactionNumber: f.transaction?.transactionNumber || null,
        receivableOrPayableAmount: f.transaction?.totalAmount
          ? Money.fromDecimal(f.transaction.totalAmount).format()
          : null,
        assignedUser: f.assignedUser,
        createdBy: f.createdBy,
        createdAt: f.createdAt.toISOString(),
        completedAt: f.completedAt ? f.completedAt.toISOString() : null,
        outcome: f.outcome,
        outcomeNotes: f.outcomeNotes,
        nextFollowUpDate: f.nextFollowUpDate ? f.nextFollowUpDate.toISOString() : null,
      };
    });

    return {
      items,
      totalCount,
      page,
      pageSize,
    };
  }

  // ===================================================================
  // OPERATIONAL DASHBOARD METRICS (Requirements 31, 32)
  // ===================================================================

  public static async getFollowUpSummaryMetrics(params: {
    businessId: string;
    userId: string;
  }): Promise<FollowUpSummaryMetricsDTO> {
    const { businessId, userId } = params;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      dueToday,
      overdue,
      upcomingThisWeek,
      completedToday,
      customerFollowUps,
      supplierFollowUps,
      promisesDueCount,
      promisesOverdueCount,
      assignedToMeCount,
    ] = await Promise.all([
      prisma.followUp.count({
        where: {
          businessId,
          status: { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] },
          dueDate: { gte: startOfToday, lte: endOfToday },
        },
      }),
      prisma.followUp.count({
        where: {
          businessId,
          status: { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] },
          dueDate: { lt: startOfToday },
        },
      }),
      prisma.followUp.count({
        where: {
          businessId,
          status: { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] },
          dueDate: { gt: endOfToday, lte: endOfWeek },
        },
      }),
      prisma.followUp.count({
        where: {
          businessId,
          status: FollowUpStatus.COMPLETED,
          completedAt: { gte: startOfToday, lte: endOfToday },
        },
      }),
      prisma.followUp.count({
        where: {
          businessId,
          type: FollowUpType.CUSTOMER,
          status: { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] },
        },
      }),
      prisma.followUp.count({
        where: {
          businessId,
          type: FollowUpType.SUPPLIER,
          status: { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] },
        },
      }),
      prisma.promiseToPay.count({
        where: {
          businessId,
          status: PromiseStatus.ACTIVE,
          promiseDate: { gte: startOfToday, lte: endOfToday },
        },
      }),
      prisma.promiseToPay.count({
        where: {
          businessId,
          status: PromiseStatus.ACTIVE,
          promiseDate: { lt: startOfToday },
        },
      }),
      prisma.followUp.count({
        where: {
          businessId,
          assignedUserId: userId,
          status: { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] },
        },
      }),
    ]);

    return {
      dueToday,
      overdue,
      upcomingThisWeek,
      completedToday,
      customerFollowUps,
      supplierFollowUps,
      promisesDueCount,
      promisesOverdueCount,
      assignedToMeCount,
    };
  }

  // ===================================================================
  // CREATE FOLLOW-UP
  // ===================================================================

  public static async createFollowUp(
    input: CreateFollowUpInput,
    ctx: { businessId: string; userId: string; userEmail: string }
  ) {
    const { businessId, userId } = ctx;

    if (!input.title || input.title.trim().length === 0) {
      throw new AppError("Follow-up title is required.", 400);
    }
    if (!input.dueDate) {
      throw new AppError("Due date is required.", 400);
    }

    // Verify customer belongs to same business
    if (input.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, businessId },
      });
      if (!customer) {
        throw new NotFoundError("Customer not found in this business.");
      }
    }

    // Verify supplier belongs to same business
    if (input.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: input.supplierId, businessId },
      });
      if (!supplier) {
        throw new NotFoundError("Supplier not found in this business.");
      }
    }

    // Verify assigned user belongs to the SAME business (Requirement 54, 112)
    if (input.assignedUserId) {
      const assignedUser = await prisma.userProfile.findFirst({
        where: { id: input.assignedUserId, businessId },
      });
      if (!assignedUser) {
        throw new AppError("Assigned user does not belong to this business.", 403);
      }
    }

    const dueDate = new Date(input.dueDate);

    const followUp = await prisma.followUp.create({
      data: {
        businessId,
        type: input.type || FollowUpType.CUSTOMER,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        dueDate,
        dueTime: input.dueTime || null,
        priority: input.priority || FollowUpPriority.NORMAL,
        status: FollowUpStatus.OPEN,
        customerId: input.customerId || null,
        supplierId: input.supplierId || null,
        transactionId: input.transactionId || null,
        assignedUserId: input.assignedUserId || userId,
        createdBy: ctx.userEmail || userId,
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.FOLLOWUP_CREATED,
      entityType: "FOLLOW_UP",
      entityId: followUp.id,
      newValues: { title: followUp.title, dueDate: followUp.dueDate, type: followUp.type },
    });

    return followUp;
  }

  // ===================================================================
  // COMPLETE FOLLOW-UP (CRITICAL RULES 35 & 36)
  // Selecting "Payment Received" does NOT create a financial payment!
  // ===================================================================

  public static async completeFollowUp(
    input: CompleteFollowUpInput,
    ctx: { businessId: string; userId: string }
  ): Promise<{
    completedFollowUp: unknown;
    requiresPaymentRecord: boolean;
    scheduledNextFollowUp?: unknown;
    noticeMessage: string;
  }> {
    const { businessId, userId } = ctx;

    const followUp = await prisma.followUp.findFirst({
      where: { id: input.followUpId, businessId },
      include: {
        customer: { select: { id: true, name: true } },
        transaction: { select: { id: true, totalAmount: true } },
      },
    });

    if (!followUp) {
      throw new NotFoundError("Follow-up not found.");
    }

    const now = new Date();
    let nextFollowUpDate: Date | null = null;
    let scheduledNext: unknown = undefined;

    // Optional next follow-up scheduling (Requirement 37)
    if (input.scheduleNextDate) {
      nextFollowUpDate = new Date(input.scheduleNextDate);

      scheduledNext = await prisma.followUp.create({
        data: {
          businessId,
          type: followUp.type,
          title: input.scheduleNextTitle || `Follow-up: ${followUp.title}`,
          dueDate: nextFollowUpDate,
          dueTime: input.scheduleNextTime || null,
          priority: followUp.priority,
          status: FollowUpStatus.OPEN,
          customerId: followUp.customerId,
          supplierId: followUp.supplierId,
          transactionId: followUp.transactionId,
          assignedUserId: followUp.assignedUserId || userId,
          createdBy: userId,
        },
      });
    }

    const updated = await prisma.followUp.update({
      where: { id: input.followUpId },
      data: {
        status: FollowUpStatus.COMPLETED,
        completedAt: now,
        outcome: input.outcome,
        outcomeNotes: input.outcomeNotes || null,
        nextFollowUpDate,
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.FOLLOWUP_COMPLETED,
      entityType: "FOLLOW_UP",
      entityId: followUp.id,
      newValues: { outcome: input.outcome, completedAt: now },
    });

    // Check Critical Rule 36: Payment Received does NOT insert accounting payment
    const requiresPaymentRecord = input.outcome === FollowUpOutcome.PAYMENT_RECEIVED;

    let noticeMessage = "Follow-up completed successfully.";
    if (requiresPaymentRecord) {
      noticeMessage =
        "Follow-up outcome marked as Payment Received. NOTE: Operational follow-ups do not alter financial balances. Please click 'Record Payment' to post the verified payment through Phase 5 accounting.";
    }

    return {
      completedFollowUp: updated,
      requiresPaymentRecord,
      scheduledNextFollowUp: scheduledNext,
      noticeMessage,
    };
  }

  // ===================================================================
  // CANCEL FOLLOW-UP
  // ===================================================================

  public static async cancelFollowUp(
    followUpId: string,
    ctx: { businessId: string; userId: string; reason?: string }
  ) {
    const { businessId, userId, reason } = ctx;

    const followUp = await prisma.followUp.findFirst({
      where: { id: followUpId, businessId },
    });

    if (!followUp) {
      throw new NotFoundError("Follow-up not found.");
    }

    const updated = await prisma.followUp.update({
      where: { id: followUpId },
      data: {
        status: FollowUpStatus.CANCELLED,
        outcomeNotes: reason ? `Cancelled: ${reason}` : "Cancelled",
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.FOLLOWUP_CANCELLED,
      entityType: "FOLLOW_UP",
      entityId: followUpId,
      reason,
    });

    return updated;
  }
}
