import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import {
  PartyStatus,
  TransactionType,
  TransactionStatus,
  FollowUpStatus,
  PromiseStatus,
  PaymentCommitmentStatus,
  AuditAction,
} from "@prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import {
  CustomerProfile360DTO,
  CustomerFinancialSummaryDTO,
  CustomerListItemDTO,
  SupplierProfile360DTO,
  SupplierFinancialSummaryDTO,
  SupplierListItemDTO,
} from "@/types/crm";
import { AuditService } from "../audit.service";

export interface CustomerListFilterParams {
  businessId: string;
  search?: string;
  status?: PartyStatus | "ALL";
  balanceFilter?: "ALL" | "HAS_OUTSTANDING" | "NO_OUTSTANDING" | "OVERDUE";
  assignedUserId?: string;
  tag?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: "name" | "recentlyAdded" | "recentlyUpdated" | "highestOutstanding" | "oldestOutstanding" | "nextFollowUp";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface SupplierListFilterParams {
  businessId: string;
  search?: string;
  status?: PartyStatus | "ALL";
  balanceFilter?: "ALL" | "HAS_OUTSTANDING" | "NO_OUTSTANDING" | "OVERDUE";
  assignedUserId?: string;
  tag?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: "name" | "recentlyAdded" | "recentlyUpdated" | "highestOutstanding" | "oldestOutstanding" | "nextFollowUp";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export class CRMService {
  // ===================================================================
  // CUSTOMER DIRECTORY & CRM LIST
  // ===================================================================

  public static async getCustomerList(params: CustomerListFilterParams): Promise<{
    items: CustomerListItemDTO[];
    totalCount: number;
    page: number;
    pageSize: number;
  }> {
    const {
      businessId,
      search,
      status = PartyStatus.ACTIVE,
      assignedUserId,
      tag,
      sortBy = "name",
      sortOrder = "asc",
      page = 1,
      pageSize = 25,
    } = params;

    const q = search?.trim() || "";

    // 1. Fetch matching customers
    const whereClause: Record<string, unknown> = {
      businessId,
      ...(status !== "ALL" ? { status } : {}),
      ...(assignedUserId ? { assignedUserId } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { companyName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { customerCode: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        assignedUser: { select: { id: true, displayName: true } },
        followUps: {
          where: { status: { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] } },
          orderBy: { dueDate: "asc" },
          take: 1,
          select: { dueDate: true, title: true },
        },
        transactions: {
          where: {
            status: TransactionStatus.POSTED,
            transactionType: TransactionType.RECEIVABLE,
          },
          select: {
            id: true,
            totalAmount: true,
            dueDate: true,
            allocations: {
              select: {
                amount: true,
                payment: { select: { status: true } },
              },
            },
          },
        },
      },
    });

    const now = new Date();

    // 2. Compute live balances strictly from Phase 5 accounting data
    const computedItems: CustomerListItemDTO[] = customers.map((c) => {
      let totalOutstanding = Money.zero();
      let overdueOutstanding = Money.zero();

      for (const t of c.transactions) {
        let paid = Money.zero();
        for (const a of t.allocations) {
          if (a.payment.status === TransactionStatus.POSTED) {
            paid = paid.add(Money.fromDecimal(a.amount));
          }
        }
        const total = Money.fromDecimal(t.totalAmount);
        const outstanding = total.subtract(paid);

        if (outstanding.greaterThan(Money.zero())) {
          totalOutstanding = totalOutstanding.add(outstanding);
          if (t.dueDate && t.dueDate < now) {
            overdueOutstanding = overdueOutstanding.add(outstanding);
          }
        }
      }

      let paymentStatus: CustomerListItemDTO["paymentStatus"] = "NO_BALANCE";
      if (overdueOutstanding.greaterThan(Money.zero())) {
        paymentStatus = "OVERDUE";
      } else if (totalOutstanding.greaterThan(Money.zero())) {
        paymentStatus = "UNPAID";
      }

      const nextFollowUp = c.followUps[0] || null;

      return {
        id: c.id,
        customerCode: c.customerCode,
        name: c.name,
        companyName: c.companyName,
        phone: c.phone,
        email: c.email,
        status: c.status,
        currentReceivable: totalOutstanding.format(),
        overdueReceivable: overdueOutstanding.format(),
        paymentStatus,
        nextFollowUpDate: nextFollowUp ? nextFollowUp.dueDate.toISOString() : null,
        nextFollowUpTitle: nextFollowUp ? nextFollowUp.title : null,
        assignedUser: c.assignedUser,
        tags: c.tags,
        isPinnedNote: c.isPinnedNote,
        createdAt: c.createdAt.toISOString(),
      };
    });

    // 3. In-memory filter for balance condition
    let filtered = computedItems;
    if (params.balanceFilter === "HAS_OUTSTANDING") {
      filtered = filtered.filter((i) => i.paymentStatus !== "NO_BALANCE");
    } else if (params.balanceFilter === "NO_OUTSTANDING") {
      filtered = filtered.filter((i) => i.paymentStatus === "NO_BALANCE");
    } else if (params.balanceFilter === "OVERDUE") {
      filtered = filtered.filter((i) => i.paymentStatus === "OVERDUE");
    }

    if (params.minAmount !== undefined) {
      filtered = filtered.filter((i) => Money.parse(i.currentReceivable).toNumber() >= params.minAmount!);
    }
    if (params.maxAmount !== undefined) {
      filtered = filtered.filter((i) => Money.parse(i.currentReceivable).toNumber() <= params.maxAmount!);
    }

    // 4. Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "highestOutstanding") {
        comparison = Money.parse(b.currentReceivable).toNumber() - Money.parse(a.currentReceivable).toNumber();
      } else if (sortBy === "nextFollowUp") {
        if (!a.nextFollowUpDate && !b.nextFollowUpDate) comparison = 0;
        else if (!a.nextFollowUpDate) comparison = 1;
        else if (!b.nextFollowUpDate) comparison = -1;
        else comparison = new Date(a.nextFollowUpDate).getTime() - new Date(b.nextFollowUpDate).getTime();
      } else if (sortBy === "recentlyAdded") {
        comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        comparison = a.name.localeCompare(b.name);
      }

      return sortOrder === "desc" ? -comparison : comparison;
    });

    const totalCount = filtered.length;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: paginated,
      totalCount,
      page,
      pageSize,
    };
  }

  // ===================================================================
  // CUSTOMER 360° PROFILE (VERIFIED FINANCIAL TRUTH)
  // ===================================================================

  public static async getCustomer360Profile(params: {
    businessId: string;
    customerId: string;
    historicalMonth?: number;
    historicalYear?: number;
  }): Promise<CustomerProfile360DTO> {
    const { businessId, customerId, historicalMonth, historicalYear } = params;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
      include: {
        assignedUser: { select: { id: true, displayName: true, email: true } },
      },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    // Fetch transactions strictly from Phase 5 accounting
    const transactions = await prisma.transaction.findMany({
      where: {
        businessId,
        customerId,
        status: TransactionStatus.POSTED,
      },
      include: {
        allocations: {
          select: {
            amount: true,
            payment: { select: { status: true } },
          },
        },
      },
      orderBy: { transactionDate: "asc" },
    });

    // Fetch payments received from customer
    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        customerId,
        status: TransactionStatus.POSTED,
      },
      select: {
        amount: true,
        allocations: { select: { amount: true } },
      },
    });

    // Fetch follow-ups & promises count
    const [openFollowUpsCount, activePromisesCount] = await Promise.all([
      prisma.followUp.count({
        where: {
          businessId,
          customerId,
          status: { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] },
        },
      }),
      prisma.promiseToPay.count({
        where: {
          businessId,
          customerId,
          status: PromiseStatus.ACTIVE,
        },
      }),
    ]);

    const now = new Date();
    let totalBusinessVolume = Money.zero();
    let totalMoneyReceived = Money.zero();
    let currentReceivables = Money.zero();
    let overdueReceivables = Money.zero();
    let oldestDueDate: Date | null = null;

    // Aging buckets
    let agingCurrent = Money.zero();
    let aging1_30 = Money.zero();
    let aging31_60 = Money.zero();
    let aging61_90 = Money.zero();
    let aging90Plus = Money.zero();

    for (const t of transactions) {
      const amount = Money.fromDecimal(t.totalAmount);

      if (t.transactionType === TransactionType.INCOME || t.transactionType === TransactionType.RECEIVABLE) {
        totalBusinessVolume = totalBusinessVolume.add(amount);
      }

      if (t.transactionType === TransactionType.RECEIVABLE) {
        let paid = Money.zero();
        for (const a of t.allocations) {
          if (a.payment.status === TransactionStatus.POSTED) {
            paid = paid.add(Money.fromDecimal(a.amount));
          }
        }
        const outstanding = amount.subtract(paid);

        if (outstanding.greaterThan(Money.zero())) {
          currentReceivables = currentReceivables.add(outstanding);

          if (t.dueDate) {
            if (!oldestDueDate || t.dueDate < oldestDueDate) {
              oldestDueDate = t.dueDate;
            }

            const daysOverdue = Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysOverdue > 0) {
              overdueReceivables = overdueReceivables.add(outstanding);

              if (daysOverdue <= 30) aging1_30 = aging1_30.add(outstanding);
              else if (daysOverdue <= 60) aging31_60 = aging31_60.add(outstanding);
              else if (daysOverdue <= 90) aging61_90 = aging61_90.add(outstanding);
              else aging90Plus = aging90Plus.add(outstanding);
            } else {
              agingCurrent = agingCurrent.add(outstanding);
            }
          } else {
            agingCurrent = agingCurrent.add(outstanding);
          }
        }
      }
    }

    // Money received from payments
    for (const p of payments) {
      totalMoneyReceived = totalMoneyReceived.add(Money.fromDecimal(p.amount));
    }

    // Unapplied payment credits
    let unappliedPayments = Money.zero();
    for (const p of payments) {
      let allocated = Money.zero();
      for (const a of p.allocations) {
        allocated = allocated.add(Money.fromDecimal(a.amount));
      }
      const unapplied = Money.fromDecimal(p.amount).subtract(allocated);
      if (unapplied.greaterThan(Money.zero())) {
        unappliedPayments = unappliedPayments.add(unapplied);
      }
    }

    const financialSummary: CustomerFinancialSummaryDTO = {
      totalBusinessVolume: totalBusinessVolume.format(),
      moneyReceived: totalMoneyReceived.format(),
      currentReceivables: currentReceivables.format(),
      overdueReceivables: overdueReceivables.format(),
      unappliedPayments: unappliedPayments.format(),
      oldestDueDate: oldestDueDate ? oldestDueDate.toISOString() : null,
      transactionCount: transactions.length,
      openFollowUpsCount,
      activePromisesCount,
      aging: {
        current: agingCurrent.format(),
        days1_30: aging1_30.format(),
        days31_60: aging31_60.format(),
        days61_90: aging61_90.format(),
        days90Plus: aging90Plus.format(),
      },
    };

    // Historical As-Closed check if requested (Requirement 11, 110)
    let historicalSnapshot: CustomerProfile360DTO["historicalSnapshot"] = undefined;
    if (historicalMonth && historicalYear) {
      const closing = await prisma.monthlyClosing.findFirst({
        where: {
          businessId,
          financialPeriod: {
            year: historicalYear,
            month: historicalMonth,
          },
        },
        include: {
          financialPeriod: true,
        },
      });

      if (closing && closing.snapshotData) {
        const snap = closing.snapshotData as Record<string, unknown>;
        const snapSummary = snap.summary as Record<string, unknown> | undefined;
        const asClosedTotal = snapSummary?.totalReceivables ? String(snapSummary.totalReceivables) : closing.totalReceivables.toString();

        const monthNames = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];
        const periodLabel = `${monthNames[closing.financialPeriod.month - 1]} ${closing.financialPeriod.year}`;

        historicalSnapshot = {
          periodLabel,
          asClosedOutstanding: `₹${asClosedTotal}`,
          currentOutstanding: currentReceivables.format(),
          variance: Money.parse(asClosedTotal).subtract(currentReceivables).format(),
          closedAt: closing.closedAt.toISOString(),
        };
      }
    }

    return {
      customer: {
        id: customer.id,
        customerCode: customer.customerCode,
        name: customer.name,
        companyName: customer.companyName,
        email: customer.email,
        phone: customer.phone,
        alternatePhone: customer.alternatePhone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        country: customer.country,
        postalCode: customer.postalCode,
        gstin: customer.gstin,
        notes: customer.notes,
        openingBalance: Money.fromDecimal(customer.openingBalance).format(),
        creditLimit: Money.fromDecimal(customer.creditLimit).format(),
        status: customer.status,
        preferredContactMethod: customer.preferredContactMethod,
        preferredContactTime: customer.preferredContactTime,
        languagePreference: customer.languagePreference || "en",
        tags: customer.tags,
        isPinnedNote: customer.isPinnedNote,
        createdAt: customer.createdAt.toISOString(),
        assignedUser: customer.assignedUser,
      },
      financialSummary,
      historicalSnapshot,
    };
  }

  // ===================================================================
  // SUPPLIER DIRECTORY & CRM LIST
  // ===================================================================

  public static async getSupplierList(params: SupplierListFilterParams): Promise<{
    items: SupplierListItemDTO[];
    totalCount: number;
    page: number;
    pageSize: number;
  }> {
    const {
      businessId,
      search,
      status = PartyStatus.ACTIVE,
      assignedUserId,
      tag,
      sortBy = "name",
      sortOrder = "asc",
      page = 1,
      pageSize = 25,
    } = params;

    const q = search?.trim() || "";

    const whereClause: Record<string, unknown> = {
      businessId,
      ...(status !== "ALL" ? { status } : {}),
      ...(assignedUserId ? { assignedUserId } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { companyName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { supplierCode: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const suppliers = await prisma.supplier.findMany({
      where: whereClause,
      include: {
        assignedUser: { select: { id: true, displayName: true } },
        followUps: {
          where: { status: { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] } },
          orderBy: { dueDate: "asc" },
          take: 1,
          select: { dueDate: true, title: true },
        },
        transactions: {
          where: {
            status: TransactionStatus.POSTED,
            transactionType: TransactionType.PAYABLE,
          },
          select: {
            id: true,
            totalAmount: true,
            dueDate: true,
            allocations: {
              select: {
                amount: true,
                payment: { select: { status: true } },
              },
            },
          },
        },
      },
    });

    const now = new Date();

    const computedItems: SupplierListItemDTO[] = suppliers.map((s) => {
      let totalOutstanding = Money.zero();
      let overdueOutstanding = Money.zero();

      for (const t of s.transactions) {
        let paid = Money.zero();
        for (const a of t.allocations) {
          if (a.payment.status === TransactionStatus.POSTED) {
            paid = paid.add(Money.fromDecimal(a.amount));
          }
        }
        const total = Money.fromDecimal(t.totalAmount);
        const outstanding = total.subtract(paid);

        if (outstanding.greaterThan(Money.zero())) {
          totalOutstanding = totalOutstanding.add(outstanding);
          if (t.dueDate && t.dueDate < now) {
            overdueOutstanding = overdueOutstanding.add(outstanding);
          }
        }
      }

      let dueStatus: SupplierListItemDTO["dueStatus"] = "NO_BALANCE";
      if (overdueOutstanding.greaterThan(Money.zero())) {
        dueStatus = "OVERDUE";
      } else if (totalOutstanding.greaterThan(Money.zero())) {
        dueStatus = "UNPAID";
      }

      const nextFollowUp = s.followUps[0] || null;

      return {
        id: s.id,
        supplierCode: s.supplierCode,
        name: s.name,
        companyName: s.companyName,
        phone: s.phone,
        email: s.email,
        status: s.status,
        currentPayable: totalOutstanding.format(),
        overduePayable: overdueOutstanding.format(),
        dueStatus,
        nextFollowUpDate: nextFollowUp ? nextFollowUp.dueDate.toISOString() : null,
        nextFollowUpTitle: nextFollowUp ? nextFollowUp.title : null,
        assignedUser: s.assignedUser,
        tags: s.tags,
        isPinnedNote: s.isPinnedNote,
        createdAt: s.createdAt.toISOString(),
      };
    });

    let filtered = computedItems;
    if (params.balanceFilter === "HAS_OUTSTANDING") {
      filtered = filtered.filter((i) => i.dueStatus !== "NO_BALANCE");
    } else if (params.balanceFilter === "NO_OUTSTANDING") {
      filtered = filtered.filter((i) => i.dueStatus === "NO_BALANCE");
    } else if (params.balanceFilter === "OVERDUE") {
      filtered = filtered.filter((i) => i.dueStatus === "OVERDUE");
    }

    if (params.minAmount !== undefined) {
      filtered = filtered.filter((i) => Money.parse(i.currentPayable).toNumber() >= params.minAmount!);
    }
    if (params.maxAmount !== undefined) {
      filtered = filtered.filter((i) => Money.parse(i.currentPayable).toNumber() <= params.maxAmount!);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "highestOutstanding") {
        comparison = Money.parse(b.currentPayable).toNumber() - Money.parse(a.currentPayable).toNumber();
      } else if (sortBy === "nextFollowUp") {
        if (!a.nextFollowUpDate && !b.nextFollowUpDate) comparison = 0;
        else if (!a.nextFollowUpDate) comparison = 1;
        else if (!b.nextFollowUpDate) comparison = -1;
        else comparison = new Date(a.nextFollowUpDate).getTime() - new Date(b.nextFollowUpDate).getTime();
      } else if (sortBy === "recentlyAdded") {
        comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        comparison = a.name.localeCompare(b.name);
      }

      return sortOrder === "desc" ? -comparison : comparison;
    });

    const totalCount = filtered.length;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: paginated,
      totalCount,
      page,
      pageSize,
    };
  }

  // ===================================================================
  // SUPPLIER 360° PROFILE
  // ===================================================================

  public static async getSupplier360Profile(params: {
    businessId: string;
    supplierId: string;
  }): Promise<SupplierProfile360DTO> {
    const { businessId, supplierId } = params;

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
      include: {
        assignedUser: { select: { id: true, displayName: true, email: true } },
      },
    });

    if (!supplier) {
      throw new NotFoundError("Supplier not found");
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        businessId,
        supplierId,
        status: TransactionStatus.POSTED,
      },
      include: {
        allocations: {
          select: {
            amount: true,
            payment: { select: { status: true } },
          },
        },
      },
      orderBy: { transactionDate: "asc" },
    });

    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        supplierId,
        status: TransactionStatus.POSTED,
      },
      select: {
        amount: true,
        allocations: { select: { amount: true } },
      },
    });

    const [openFollowUpsCount, activeCommitmentsCount] = await Promise.all([
      prisma.followUp.count({
        where: {
          businessId,
          supplierId,
          status: { in: [FollowUpStatus.OPEN, FollowUpStatus.IN_PROGRESS] },
        },
      }),
      prisma.paymentCommitment.count({
        where: {
          businessId,
          supplierId,
          status: PaymentCommitmentStatus.ACTIVE,
        },
      }),
    ]);

    const now = new Date();
    let totalPurchasesVolume = Money.zero();
    let totalMoneyPaid = Money.zero();
    let currentPayables = Money.zero();
    let overduePayables = Money.zero();
    let oldestDueDate: Date | null = null;

    let agingCurrent = Money.zero();
    let aging1_30 = Money.zero();
    let aging31_60 = Money.zero();
    let aging61_90 = Money.zero();
    let aging90Plus = Money.zero();

    for (const t of transactions) {
      const amount = Money.fromDecimal(t.totalAmount);

      if (t.transactionType === TransactionType.EXPENSE || t.transactionType === TransactionType.PAYABLE) {
        totalPurchasesVolume = totalPurchasesVolume.add(amount);
      }

      if (t.transactionType === TransactionType.PAYABLE) {
        let paid = Money.zero();
        for (const a of t.allocations) {
          if (a.payment.status === TransactionStatus.POSTED) {
            paid = paid.add(Money.fromDecimal(a.amount));
          }
        }
        const outstanding = amount.subtract(paid);

        if (outstanding.greaterThan(Money.zero())) {
          currentPayables = currentPayables.add(outstanding);

          if (t.dueDate) {
            if (!oldestDueDate || t.dueDate < oldestDueDate) {
              oldestDueDate = t.dueDate;
            }

            const daysOverdue = Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysOverdue > 0) {
              overduePayables = overduePayables.add(outstanding);

              if (daysOverdue <= 30) aging1_30 = aging1_30.add(outstanding);
              else if (daysOverdue <= 60) aging31_60 = aging31_60.add(outstanding);
              else if (daysOverdue <= 90) aging61_90 = aging61_90.add(outstanding);
              else aging90Plus = aging90Plus.add(outstanding);
            } else {
              agingCurrent = agingCurrent.add(outstanding);
            }
          } else {
            agingCurrent = agingCurrent.add(outstanding);
          }
        }
      }
    }

    for (const p of payments) {
      totalMoneyPaid = totalMoneyPaid.add(Money.fromDecimal(p.amount));
    }

    let unappliedPayments = Money.zero();
    for (const p of payments) {
      let allocated = Money.zero();
      for (const a of p.allocations) {
        allocated = allocated.add(Money.fromDecimal(a.amount));
      }
      const unapplied = Money.fromDecimal(p.amount).subtract(allocated);
      if (unapplied.greaterThan(Money.zero())) {
        unappliedPayments = unappliedPayments.add(unapplied);
      }
    }

    const financialSummary: SupplierFinancialSummaryDTO = {
      totalPurchasesVolume: totalPurchasesVolume.format(),
      moneyPaid: totalMoneyPaid.format(),
      currentPayables: currentPayables.format(),
      overduePayables: overduePayables.format(),
      unappliedPayments: unappliedPayments.format(),
      oldestDueDate: oldestDueDate ? oldestDueDate.toISOString() : null,
      transactionCount: transactions.length,
      openFollowUpsCount,
      activeCommitmentsCount,
      aging: {
        current: agingCurrent.format(),
        days1_30: aging1_30.format(),
        days31_60: aging31_60.format(),
        days61_90: aging61_90.format(),
        days90Plus: aging90Plus.format(),
      },
    };

    return {
      supplier: {
        id: supplier.id,
        supplierCode: supplier.supplierCode,
        name: supplier.name,
        companyName: supplier.companyName,
        email: supplier.email,
        phone: supplier.phone,
        alternatePhone: supplier.alternatePhone,
        address: supplier.address,
        city: supplier.city,
        state: supplier.state,
        country: supplier.country,
        postalCode: supplier.postalCode,
        gstin: supplier.gstin,
        notes: supplier.notes,
        openingBalance: Money.fromDecimal(supplier.openingBalance).format(),
        creditLimit: Money.fromDecimal(supplier.creditLimit).format(),
        status: supplier.status,
        preferredContactMethod: supplier.preferredContactMethod,
        preferredContactTime: supplier.preferredContactTime,
        languagePreference: supplier.languagePreference || "en",
        tags: supplier.tags,
        isPinnedNote: supplier.isPinnedNote,
        createdAt: supplier.createdAt.toISOString(),
        assignedUser: supplier.assignedUser,
      },
      financialSummary,
    };
  }

  // ===================================================================
  // DUPLICATE PARTY PROTECTION (Requirements 64, 65)
  // ===================================================================

  public static async findDuplicateParties(params: {
    businessId: string;
    type: "CUSTOMER" | "SUPPLIER";
    name: string;
    phone?: string;
    email?: string;
    excludeId?: string;
  }): Promise<Array<{ id: string; name: string; code: string; matchReason: string }>> {
    const { businessId, type, name, phone, email, excludeId } = params;
    const cleanName = name.trim().toLowerCase();
    const cleanPhone = phone?.trim() || "";
    const cleanEmail = email?.trim().toLowerCase() || "";

    const matches: Array<{ id: string; name: string; code: string; matchReason: string }> = [];

    if (type === "CUSTOMER") {
      const candidates = await prisma.customer.findMany({
        where: {
          businessId,
          status: { not: PartyStatus.ARCHIVED },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, name: true, customerCode: true, phone: true, email: true },
      });

      for (const c of candidates) {
        if (cleanPhone && c.phone && c.phone.trim() === cleanPhone) {
          matches.push({ id: c.id, name: c.name, code: c.customerCode, matchReason: `Exact Phone Match (${c.phone})` });
        } else if (cleanEmail && c.email && c.email.trim().toLowerCase() === cleanEmail) {
          matches.push({ id: c.id, name: c.name, code: c.customerCode, matchReason: `Exact Email Match (${c.email})` });
        } else if (c.name.trim().toLowerCase() === cleanName) {
          matches.push({ id: c.id, name: c.name, code: c.customerCode, matchReason: `Exact Name Match` });
        }
      }
    } else {
      const candidates = await prisma.supplier.findMany({
        where: {
          businessId,
          status: { not: PartyStatus.ARCHIVED },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, name: true, supplierCode: true, phone: true, email: true },
      });

      for (const s of candidates) {
        if (cleanPhone && s.phone && s.phone.trim() === cleanPhone) {
          matches.push({ id: s.id, name: s.name, code: s.supplierCode, matchReason: `Exact Phone Match (${s.phone})` });
        } else if (cleanEmail && s.email && s.email.trim().toLowerCase() === cleanEmail) {
          matches.push({ id: s.id, name: s.name, code: s.supplierCode, matchReason: `Exact Email Match (${s.email})` });
        } else if (s.name.trim().toLowerCase() === cleanName) {
          matches.push({ id: s.id, name: s.name, code: s.supplierCode, matchReason: `Exact Name Match` });
        }
      }
    }

    return matches;
  }

  // ===================================================================
  // ARCHIVE & RESTORE (Requirements 62, 63, 114)
  // Preserves 100% of historical transactions and ledger records
  // ===================================================================

  public static async archiveCustomer(customerId: string, businessId: string, userId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        status: PartyStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CUSTOMER_ARCHIVED,
      entityType: "CUSTOMER",
      entityId: customerId,
      previousValues: { status: customer.status },
      newValues: { status: PartyStatus.ARCHIVED },
    });

    return updated;
  }

  public static async archiveSupplier(supplierId: string, businessId: string, userId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
    });

    if (!supplier) {
      throw new NotFoundError("Supplier not found");
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        status: PartyStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.SUPPLIER_ARCHIVED,
      entityType: "SUPPLIER",
      entityId: supplierId,
      previousValues: { status: supplier.status },
      newValues: { status: PartyStatus.ARCHIVED },
    });

    return updated;
  }

  // ===================================================================
  // CRM METADATA & STAFF ASSIGNMENT (Requirements 18, 19, 54, 112)
  // ===================================================================

  public static async updateCustomerCRMDetails(params: {
    customerId: string;
    businessId: string;
    userId: string;
    assignedUserId?: string | null;
    preferredContactMethod?: string | null;
    preferredContactTime?: string | null;
    languagePreference?: string;
    tags?: string[];
    isPinnedNote?: string | null;
  }) {
    const { customerId, businessId, userId, assignedUserId, preferredContactMethod, preferredContactTime, languagePreference, tags, isPinnedNote } = params;

    // Verify customer belongs to business
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found in this business");
    }

    // Verify assigned user belongs to the SAME business (Requirement 112)
    if (assignedUserId) {
      const assignedUser = await prisma.userProfile.findFirst({
        where: { id: assignedUserId, businessId },
      });
      if (!assignedUser) {
        throw new AppError("Assigned user does not belong to this business.", 403);
      }
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(assignedUserId !== undefined ? { assignedUserId } : {}),
        ...(preferredContactMethod !== undefined ? { preferredContactMethod } : {}),
        ...(preferredContactTime !== undefined ? { preferredContactTime } : {}),
        ...(languagePreference !== undefined ? { languagePreference } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(isPinnedNote !== undefined ? { isPinnedNote } : {}),
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CUSTOMER_UPDATED,
      entityType: "CUSTOMER",
      entityId: customerId,
      newValues: params,
    });

    return updated;
  }

  public static async updateSupplierCRMDetails(params: {
    supplierId: string;
    businessId: string;
    userId: string;
    assignedUserId?: string | null;
    preferredContactMethod?: string | null;
    preferredContactTime?: string | null;
    languagePreference?: string;
    tags?: string[];
    isPinnedNote?: string | null;
  }) {
    const { supplierId, businessId, userId, assignedUserId, preferredContactMethod, preferredContactTime, languagePreference, tags, isPinnedNote } = params;

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
    });

    if (!supplier) {
      throw new NotFoundError("Supplier not found in this business");
    }

    if (assignedUserId) {
      const assignedUser = await prisma.userProfile.findFirst({
        where: { id: assignedUserId, businessId },
      });
      if (!assignedUser) {
        throw new AppError("Assigned user does not belong to this business.", 403);
      }
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(assignedUserId !== undefined ? { assignedUserId } : {}),
        ...(preferredContactMethod !== undefined ? { preferredContactMethod } : {}),
        ...(preferredContactTime !== undefined ? { preferredContactTime } : {}),
        ...(languagePreference !== undefined ? { languagePreference } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(isPinnedNote !== undefined ? { isPinnedNote } : {}),
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.SUPPLIER_UPDATED,
      entityType: "SUPPLIER",
      entityId: supplierId,
      newValues: params,
    });

    return updated;
  }
}
