import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import {
  PromiseStatus,
  PaymentCommitmentStatus,
  AuditAction,
} from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import {
  PromiseToPayItemDTO,
  PaymentCommitmentItemDTO,
  CreatePromiseInput,
  CreateCommitmentInput,
} from "@/types/crm";
import { AuditService } from "../audit.service";

export class PromiseService {
  // ===================================================================
  // PROMISE-TO-PAY (Requirements 39, 40, 41, 104)
  // A promise is NOT a payment and NEVER modifies accounting balances.
  // ===================================================================

  public static async createPromise(
    input: CreatePromiseInput,
    ctx: { businessId: string; userId: string }
  ): Promise<PromiseToPayItemDTO> {
    const { businessId, userId } = ctx;

    if (!input.customerId) {
      throw new AppError("Customer ID is required.", 400);
    }
    if (!input.promiseDate) {
      throw new AppError("Promise date is required.", 400);
    }

    const promisedMoney = Money.parse(input.promisedAmount);
    if (promisedMoney.isZero() || promisedMoney.isNegative()) {
      throw new AppError("Promised amount must be greater than zero.", 400);
    }

    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, businessId },
    });
    if (!customer) {
      throw new NotFoundError("Customer not found in this business.");
    }

    if (input.transactionId) {
      const transaction = await prisma.transaction.findFirst({
        where: { id: input.transactionId, businessId },
      });
      if (!transaction) {
        throw new NotFoundError("Linked transaction not found in this business.");
      }
    }

    const promiseDate = new Date(input.promiseDate);

    const promise = await prisma.promiseToPay.create({
      data: {
        businessId,
        customerId: input.customerId,
        transactionId: input.transactionId || null,
        followUpId: input.followUpId || null,
        promisedAmount: promisedMoney.getDecimal(),
        fulfilledAmount: "0.0000",
        promiseDate,
        notes: input.notes?.trim() || null,
        status: PromiseStatus.ACTIVE,
        createdBy: userId,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        transaction: { select: { id: true, transactionNumber: true } },
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.PROMISE_CREATED,
      entityType: "PROMISE_TO_PAY",
      entityId: promise.id,
      newValues: {
        customerId: input.customerId,
        promisedAmount: promisedMoney.format(),
        promiseDate: input.promiseDate,
      },
    });

    const now = new Date();
    const isOverdue = promise.status === PromiseStatus.ACTIVE && promise.promiseDate < now;

    return {
      id: promise.id,
      customerId: promise.customerId,
      customerName: promise.customer.name,
      customerPhone: promise.customer.phone,
      transactionId: promise.transactionId,
      transactionNumber: promise.transaction?.transactionNumber || null,
      promisedAmount: promisedMoney.format(),
      fulfilledAmount: Money.zero().format(),
      remainingAmount: promisedMoney.format(),
      promiseDate: promise.promiseDate.toISOString(),
      isOverdue,
      notes: promise.notes,
      status: promise.status,
      createdAt: promise.createdAt.toISOString(),
      fulfilledAt: null,
    };
  }

  public static async getPromises(params: {
    businessId: string;
    customerId?: string;
    status?: PromiseStatus | "ALL";
    isOverdueOnly?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: PromiseToPayItemDTO[]; totalCount: number }> {
    const { businessId, customerId, status = PromiseStatus.ACTIVE, isOverdueOnly, page = 1, pageSize = 25 } = params;
    const now = new Date();

    const where: Record<string, unknown> = {
      businessId,
      ...(customerId ? { customerId } : {}),
      ...(status !== "ALL" ? { status } : {}),
      ...(isOverdueOnly ? { status: PromiseStatus.ACTIVE, promiseDate: { lt: now } } : {}),
    };

    const [promises, totalCount] = await Promise.all([
      prisma.promiseToPay.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          transaction: { select: { id: true, transactionNumber: true } },
        },
        orderBy: [{ status: "asc" }, { promiseDate: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.promiseToPay.count({ where }),
    ]);

    const items: PromiseToPayItemDTO[] = promises.map((p) => {
      const promised = Money.fromDecimal(p.promisedAmount);
      const fulfilled = Money.fromDecimal(p.fulfilledAmount);
      const remaining = promised.subtract(fulfilled);
      const isOverdue = p.status === PromiseStatus.ACTIVE && p.promiseDate < now;

      return {
        id: p.id,
        customerId: p.customerId,
        customerName: p.customer.name,
        customerPhone: p.customer.phone,
        transactionId: p.transactionId,
        transactionNumber: p.transaction?.transactionNumber || null,
        promisedAmount: promised.format(),
        fulfilledAmount: fulfilled.format(),
        remainingAmount: remaining.greaterThan(Money.zero()) ? remaining.format() : Money.zero().format(),
        promiseDate: p.promiseDate.toISOString(),
        isOverdue,
        notes: p.notes,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        fulfilledAt: p.fulfilledAt ? p.fulfilledAt.toISOString() : null,
      };
    });

    return { items, totalCount };
  }

  // ===================================================================
  // PROMISE FULFILLMENT MATCHING (Requirements 42, 43, 105)
  // Evaluates actual Phase 5 posted payment against active promise
  // ===================================================================

  public static async updatePromiseFulfillment(params: {
    promiseId: string;
    businessId: string;
    userId: string;
    actualPaidAmount: number | string;
  }) {
    const { promiseId, businessId, userId, actualPaidAmount } = params;

    const promise = await prisma.promiseToPay.findFirst({
      where: { id: promiseId, businessId },
    });

    if (!promise) {
      throw new NotFoundError("Promise not found.");
    }

    const promised = Money.fromDecimal(promise.promisedAmount);
    const paid = Money.parse(actualPaidAmount);

    let newStatus: PromiseStatus = PromiseStatus.ACTIVE;
    let fulfilledAt: Date | null = null;

    if (paid.greaterThanOrEqual(promised)) {
      newStatus = PromiseStatus.FULFILLED;
      fulfilledAt = new Date();
    } else if (paid.greaterThan(Money.zero())) {
      newStatus = PromiseStatus.PARTIALLY_FULFILLED;
    }

    const updated = await prisma.promiseToPay.update({
      where: { id: promiseId },
      data: {
        fulfilledAmount: paid.getDecimal(),
        status: newStatus,
        fulfilledAt,
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.PROMISE_UPDATED,
      entityType: "PROMISE_TO_PAY",
      entityId: promiseId,
      newValues: { newStatus, paidAmount: paid.format(), promisedAmount: promised.format() },
    });

    return updated;
  }

  // ===================================================================
  // SUPPLIER PAYMENT COMMITMENTS (Requirements 45, 107)
  // Planned payment does NOT reduce payable liability.
  // ===================================================================

  public static async createCommitment(
    input: CreateCommitmentInput,
    ctx: { businessId: string; userId: string }
  ): Promise<PaymentCommitmentItemDTO> {
    const { businessId, userId } = ctx;

    if (!input.supplierId) {
      throw new AppError("Supplier ID is required.", 400);
    }
    if (!input.commitmentDate) {
      throw new AppError("Commitment date is required.", 400);
    }

    const plannedMoney = Money.parse(input.plannedAmount);
    if (plannedMoney.isZero() || plannedMoney.isNegative()) {
      throw new AppError("Planned amount must be greater than zero.", 400);
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, businessId },
    });
    if (!supplier) {
      throw new NotFoundError("Supplier not found in this business.");
    }

    if (input.transactionId) {
      const transaction = await prisma.transaction.findFirst({
        where: { id: input.transactionId, businessId },
      });
      if (!transaction) {
        throw new NotFoundError("Linked payable not found in this business.");
      }
    }

    const commitmentDate = new Date(input.commitmentDate);

    const commitment = await prisma.paymentCommitment.create({
      data: {
        businessId,
        supplierId: input.supplierId,
        transactionId: input.transactionId || null,
        followUpId: input.followUpId || null,
        plannedAmount: plannedMoney.getDecimal(),
        paidAmount: "0.0000",
        commitmentDate,
        notes: input.notes?.trim() || null,
        status: PaymentCommitmentStatus.ACTIVE,
        createdBy: userId,
      },
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        transaction: { select: { id: true, transactionNumber: true } },
      },
    });

    const now = new Date();
    const isOverdue = commitment.status === PaymentCommitmentStatus.ACTIVE && commitment.commitmentDate < now;

    return {
      id: commitment.id,
      supplierId: commitment.supplierId,
      supplierName: commitment.supplier.name,
      supplierPhone: commitment.supplier.phone,
      transactionId: commitment.transactionId,
      transactionNumber: commitment.transaction?.transactionNumber || null,
      plannedAmount: plannedMoney.format(),
      paidAmount: Money.zero().format(),
      remainingAmount: plannedMoney.format(),
      commitmentDate: commitment.commitmentDate.toISOString(),
      isOverdue,
      notes: commitment.notes,
      status: commitment.status,
      createdAt: commitment.createdAt.toISOString(),
      fulfilledAt: null,
    };
  }

  public static async getCommitments(params: {
    businessId: string;
    supplierId?: string;
    status?: PaymentCommitmentStatus | "ALL";
    page?: number;
    pageSize?: number;
  }): Promise<{ items: PaymentCommitmentItemDTO[]; totalCount: number }> {
    const { businessId, supplierId, status = PaymentCommitmentStatus.ACTIVE, page = 1, pageSize = 25 } = params;
    const now = new Date();

    const where: Record<string, unknown> = {
      businessId,
      ...(supplierId ? { supplierId } : {}),
      ...(status !== "ALL" ? { status } : {}),
    };

    const [commitments, totalCount] = await Promise.all([
      prisma.paymentCommitment.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          transaction: { select: { id: true, transactionNumber: true } },
        },
        orderBy: [{ status: "asc" }, { commitmentDate: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.paymentCommitment.count({ where }),
    ]);

    const items: PaymentCommitmentItemDTO[] = commitments.map((c) => {
      const planned = Money.fromDecimal(c.plannedAmount);
      const paid = Money.fromDecimal(c.paidAmount);
      const remaining = planned.subtract(paid);
      const isOverdue = c.status === PaymentCommitmentStatus.ACTIVE && c.commitmentDate < now;

      return {
        id: c.id,
        supplierId: c.supplierId,
        supplierName: c.supplier.name,
        supplierPhone: c.supplier.phone,
        transactionId: c.transactionId,
        transactionNumber: c.transaction?.transactionNumber || null,
        plannedAmount: planned.format(),
        paidAmount: paid.format(),
        remainingAmount: remaining.greaterThan(Money.zero()) ? remaining.format() : Money.zero().format(),
        commitmentDate: c.commitmentDate.toISOString(),
        isOverdue,
        notes: c.notes,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        fulfilledAt: c.fulfilledAt ? c.fulfilledAt.toISOString() : null,
      };
    });

    return { items, totalCount };
  }
}
