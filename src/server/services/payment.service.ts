import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import { NumberingService } from "./numbering.service";
import { AuditService } from "./audit.service";
import {
  PaymentDirection,
  TransactionStatus,
  PaymentStatus,
  TransactionType,
  Prisma,
} from "@prisma/client";
import { ValidationError, NotFoundError, BusinessRuleError } from "@/lib/errors";
import { SystemMaintenanceService } from "./system-maintenance.service";

export interface CreateAllocationDto {
  transactionId: string;
  amount: string | number;
}

export interface RecordPaymentDto {
  businessId: string;
  userId: string;
  direction: PaymentDirection;
  amount: string | number;
  paymentDate: Date;
  paymentMethodId: string;
  customerId?: string | null;
  supplierId?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  allocations?: CreateAllocationDto[];
}

export interface VoidPaymentDto {
  paymentId: string;
  businessId: string;
  userId: string;
  voidReason: string;
}

export interface PaymentListFilter {
  businessId: string;
  direction?: PaymentDirection;
  customerId?: string;
  supplierId?: string;
  paymentMethodId?: string;
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
}

export class PaymentService {
  /**
   * Record a new financial payment with atomic allocations and derived status calculation.
   */
  public static async recordPayment(dto: RecordPaymentDto) {
    await SystemMaintenanceService.assertCanWrite(dto.businessId);

    const paymentMoney = Money.parse(dto.amount);
    if (!paymentMoney.isPositive()) {
      throw new ValidationError("Payment amount must be greater than zero");
    }

    // 1. Verify Payment Method belongs to business and is active
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: dto.paymentMethodId, businessId: dto.businessId, isActive: true },
    });
    if (!paymentMethod) {
      throw new ValidationError("The selected payment method is invalid or inactive");
    }

    // 2. Verify Party belongs to business if provided
    if (dto.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: dto.customerId, businessId: dto.businessId },
      });
      if (!customer) throw new ValidationError("Customer not found or belongs to another business");
    }

    if (dto.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: dto.supplierId, businessId: dto.businessId },
      });
      if (!supplier) throw new ValidationError("Supplier not found or belongs to another business");
    }

    // 3. Verify Financial Period is OPEN
    const year = dto.paymentDate.getFullYear();
    const month = dto.paymentDate.getMonth() + 1;
    const period = await prisma.financialPeriod.findFirst({
      where: { businessId: dto.businessId, year, month },
    });
    if (period && period.status !== "OPEN") {
      throw new BusinessRuleError(
        `This accounting period (${period.year}-${String(period.month).padStart(2, "0")}) is ${period.status.toLowerCase()}. Payments cannot be recorded in closed periods.`
      );
    }

    // 4. Validate Allocations
    let totalAllocated = Money.zero(paymentMoney.currency);
    const validatedAllocations: { transactionId: string; amount: Money }[] = [];

    if (dto.allocations && dto.allocations.length > 0) {
      for (const a of dto.allocations) {
        const allocMoney = Money.parse(a.amount, paymentMoney.currency);
        if (!allocMoney.isPositive()) {
          throw new ValidationError("Allocation amount must be greater than zero");
        }

        const targetTx = await prisma.transaction.findFirst({
          where: { id: a.transactionId, businessId: dto.businessId },
          select: {
            id: true,
            status: true,
            transactionType: true,
            totalAmount: true,
            title: true,
          },
        });

        if (!targetTx) {
          throw new NotFoundError("Target transaction for allocation was not found");
        }

        if (targetTx.status !== TransactionStatus.POSTED) {
          throw new BusinessRuleError("Cannot allocate payments against DRAFT or VOID transactions");
        }

        // Direction matching
        if (dto.direction === PaymentDirection.IN && targetTx.transactionType !== TransactionType.RECEIVABLE) {
          throw new BusinessRuleError(
            `Inward payments (Payment In) can only be allocated to Receivables. Transaction '${targetTx.title}' is a ${targetTx.transactionType}.`
          );
        }

        if (dto.direction === PaymentDirection.OUT && targetTx.transactionType !== TransactionType.PAYABLE) {
          throw new BusinessRuleError(
            `Outward payments (Payment Out) can only be allocated to Payables. Transaction '${targetTx.title}' is a ${targetTx.transactionType}.`
          );
        }

        totalAllocated = totalAllocated.add(allocMoney);
        validatedAllocations.push({ transactionId: a.transactionId, amount: allocMoney });
      }

      if (totalAllocated.greaterThan(paymentMoney)) {
        throw new ValidationError(
          `Total allocated amount (₹${totalAllocated.format()}) exceeds payment amount (₹${paymentMoney.format()})`
        );
      }
    }

    // 5. Generate Payment Number
    const prefix = dto.direction === PaymentDirection.IN ? "PAY-IN" : "PAY-OUT";
    const paymentNumber = await NumberingService.getNextSequenceNumber(
      dto.businessId,
      "PAYMENT",
      prefix,
      year
    );

    // 6. Execute Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Payment
      const payment = await tx.payment.create({
        data: {
          businessId: dto.businessId,
          paymentNumber,
          paymentDate: dto.paymentDate,
          direction: dto.direction,
          amount: paymentMoney.toDecimal(),
          currency: paymentMoney.currency,
          paymentMethodId: dto.paymentMethodId,
          customerId: dto.customerId || null,
          supplierId: dto.supplierId || null,
          referenceNumber: dto.referenceNumber?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: TransactionStatus.POSTED,
          createdById: dto.userId,
        },
      });

      // Create Allocations & Update Transaction Derived Statuses
      for (const alloc of validatedAllocations) {
        await tx.paymentAllocation.create({
          data: {
            businessId: dto.businessId,
            paymentId: payment.id,
            transactionId: alloc.transactionId,
            amount: alloc.amount.toDecimal(),
          },
        });

        // Query all active allocations for the target transaction
        const existingAllocs = await tx.paymentAllocation.findMany({
          where: {
            transactionId: alloc.transactionId,
            payment: { status: TransactionStatus.POSTED },
          },
          select: { amount: true },
        });

        let totalPaid = Money.zero(paymentMoney.currency);
        for (const ea of existingAllocs) {
          totalPaid = totalPaid.add(Money.fromDecimal(ea.amount));
        }

        const target = await tx.transaction.findUniqueOrThrow({
          where: { id: alloc.transactionId },
          select: { totalAmount: true },
        });
        const targetTotal = Money.fromDecimal(target.totalAmount);

        let newStatus: PaymentStatus = PaymentStatus.UNPAID;
        if (totalPaid.isZero()) {
          newStatus = PaymentStatus.UNPAID;
        } else if (totalPaid.greaterThan(targetTotal)) {
          newStatus = PaymentStatus.OVERPAID;
        } else if (totalPaid.equals(targetTotal)) {
          newStatus = PaymentStatus.PAID;
        } else {
          newStatus = PaymentStatus.PARTIALLY_PAID;
        }

        await tx.transaction.update({
          where: { id: alloc.transactionId },
          data: { paymentStatus: newStatus },
        });
      }

      return payment;
    });

    // 7. Record Audit Log
    const unapplied = paymentMoney.subtract(totalAllocated);
    await AuditService.log({
      businessId: dto.businessId,
      userId: dto.userId,
      action: "CREATE",
      entityType: "PAYMENT",
      entityId: result.id,
      reason: `Recorded Payment ${paymentNumber} of ₹${paymentMoney.format()} via ${paymentMethod.name}. Allocated: ₹${totalAllocated.format()}, Unapplied: ₹${unapplied.format()}.`,
      newValues: {
        paymentNumber,
        amount: paymentMoney.format(),
        direction: dto.direction,
        allocated: totalAllocated.format(),
        unapplied: unapplied.format(),
      },
    });

    return result;
  }

  /**
   * Void a payment with atomic reversal of its allocations and re-calculation of target transaction statuses.
   */
  public static async voidPayment(dto: VoidPaymentDto) {
    await SystemMaintenanceService.assertCanWrite(dto.businessId);

    if (!dto.voidReason || dto.voidReason.trim().length === 0) {
      throw new ValidationError("A reason is mandatory to void a financial payment");
    }

    const payment = await prisma.payment.findFirst({
      where: { id: dto.paymentId, businessId: dto.businessId },
      include: {
        allocations: { select: { transactionId: true, amount: true } },
      },
    });

    if (!payment) {
      throw new NotFoundError("Payment not found");
    }

    if (payment.status === TransactionStatus.VOID) {
      throw new BusinessRuleError("Payment is already voided");
    }

    // Verify Financial Period is OPEN
    const year = payment.paymentDate.getFullYear();
    const month = payment.paymentDate.getMonth() + 1;
    const period = await prisma.financialPeriod.findFirst({
      where: { businessId: dto.businessId, year, month },
    });
    if (period && period.status !== "OPEN") {
      throw new BusinessRuleError(
        `Accounting period (${period.year}-${String(period.month).padStart(2, "0")}) is ${period.status.toLowerCase()}. Voiding payments in closed periods is prohibited.`
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Mark payment as VOID
      await tx.payment.update({
        where: { id: dto.paymentId },
        data: {
          status: TransactionStatus.VOID,
          voidedAt: new Date(),
          voidedBy: dto.userId,
          voidReason: dto.voidReason.trim(),
        },
      });

      // 2. Re-calculate status for all target transactions
      for (const alloc of payment.allocations) {
        const remainingAllocs = await tx.paymentAllocation.findMany({
          where: {
            transactionId: alloc.transactionId,
            paymentId: { not: dto.paymentId },
            payment: { status: TransactionStatus.POSTED },
          },
          select: { amount: true },
        });

        let remainingPaid = Money.zero();
        for (const ra of remainingAllocs) {
          remainingPaid = remainingPaid.add(Money.fromDecimal(ra.amount));
        }

        const targetTx = await tx.transaction.findUniqueOrThrow({
          where: { id: alloc.transactionId },
          select: { totalAmount: true },
        });
        const targetTotal = Money.fromDecimal(targetTx.totalAmount);

        let newStatus: PaymentStatus = PaymentStatus.UNPAID;
        if (remainingPaid.isZero()) {
          newStatus = PaymentStatus.UNPAID;
        } else if (remainingPaid.greaterThan(targetTotal)) {
          newStatus = PaymentStatus.OVERPAID;
        } else if (remainingPaid.equals(targetTotal)) {
          newStatus = PaymentStatus.PAID;
        } else {
          newStatus = PaymentStatus.PARTIALLY_PAID;
        }

        await tx.transaction.update({
          where: { id: alloc.transactionId },
          data: { paymentStatus: newStatus },
        });
      }
    });

    // 3. Audit Log
    await AuditService.log({
      businessId: dto.businessId,
      userId: dto.userId,
      action: "VOID",
      entityType: "PAYMENT",
      entityId: dto.paymentId,
      reason: `Voided Payment ${payment.paymentNumber}. Reason: "${dto.voidReason}"`,
      previousValues: {
        status: payment.status,
      },
      newValues: {
        status: "VOID",
      },
    });
  }

  /**
   * Fetch single payment details with party, allocations, and payment method.
   */
  public static async getPaymentById(paymentId: string, businessId: string) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, businessId },
      include: {
        customer: { select: { id: true, name: true, customerCode: true, phone: true } },
        supplier: { select: { id: true, name: true, supplierCode: true, phone: true } },
        paymentMethod: { select: { id: true, name: true, type: true } },
        allocations: {
          include: {
            transaction: {
              select: {
                id: true,
                transactionNumber: true,
                title: true,
                transactionDate: true,
                totalAmount: true,
                paymentStatus: true,
              },
            },
          },
        },
      },
    });

    if (!payment) return null;

    const totalMoney = Money.fromDecimal(payment.amount);
    let totalAllocated = Money.zero(totalMoney.currency);
    for (const a of payment.allocations) {
      totalAllocated = totalAllocated.add(Money.fromDecimal(a.amount));
    }
    const unapplied = totalMoney.subtract(totalAllocated);

    return {
      ...payment,
      totalMoney,
      totalAllocated,
      unapplied: unapplied.isNegative() ? Money.zero() : unapplied,
    };
  }

  /**
   * List payments with server-side pagination and filters.
   */
  public static async listPayments(filter: PaymentListFilter) {
    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.PaymentWhereInput = {
      businessId: filter.businessId,
    };

    if (filter.direction) where.direction = filter.direction;
    if (filter.status) where.status = filter.status;
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.supplierId) where.supplierId = filter.supplierId;
    if (filter.paymentMethodId) where.paymentMethodId = filter.paymentMethodId;

    if (filter.startDate || filter.endDate) {
      where.paymentDate = {};
      if (filter.startDate) where.paymentDate.gte = filter.startDate;
      if (filter.endDate) where.paymentDate.lte = filter.endDate;
    }

    if (filter.search?.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { paymentNumber: { contains: q, mode: "insensitive" } },
        { referenceNumber: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [totalCount, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          paymentMethod: { select: { id: true, name: true, type: true } },
          allocations: { select: { amount: true } },
        },
        orderBy: { paymentDate: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      payments,
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
}
