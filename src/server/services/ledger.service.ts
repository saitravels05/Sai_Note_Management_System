import { prisma } from "@/lib/db";
import { Money } from "@/lib/money";
import { TransactionType, TransactionStatus, PaymentDirection } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";

export interface LedgerEntry {
  id: string;
  date: Date;
  entityNumber: string;
  referenceNumber: string | null;
  description: string;
  type: "TRANSACTION" | "PAYMENT" | "ADJUSTMENT";
  rawType: string;
  debit: Money;
  credit: Money;
  runningBalance: Money;
  status: string;
}

export interface CustomerLedgerResult {
  customer: {
    id: string;
    name: string;
    customerCode: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
  };
  startDate?: Date;
  endDate?: Date;
  openingBalance: Money;
  totalDebits: Money;
  totalCredits: Money;
  closingBalance: Money;
  totalOutstanding: Money;
  entries: LedgerEntry[];
}

export interface SupplierLedgerResult {
  supplier: {
    id: string;
    name: string;
    supplierCode: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
  };
  startDate?: Date;
  endDate?: Date;
  openingBalance: Money;
  totalCredits: Money;
  totalDebits: Money;
  closingBalance: Money;
  totalOutstanding: Money;
  entries: LedgerEntry[];
}

export class LedgerService {
  /**
   * Customer Ledger
   * Sign Convention:
   *   Debit (+): Invoices / Receivables (what the customer owes)
   *   Credit (-): Payments received from customer
   *   Running Balance = Previous + Debit - Credit
   */
  public static async getCustomerLedger(params: {
    businessId: string;
    customerId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<CustomerLedgerResult> {
    const customer = await prisma.customer.findFirst({
      where: { id: params.customerId, businessId: params.businessId },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    // 1. Calculate Opening Balance as of params.startDate
    let opening = Money.fromDecimal(customer.openingBalance);

    if (params.startDate) {
      // Prior transactions before startDate
      const priorTxs = await prisma.transaction.findMany({
        where: {
          businessId: params.businessId,
          customerId: params.customerId,
          status: TransactionStatus.POSTED,
          transactionDate: { lt: params.startDate },
        },
        select: { totalAmount: true, transactionType: true },
      });

      for (const t of priorTxs) {
        const amt = Money.fromDecimal(t.totalAmount);
        if (t.transactionType === TransactionType.RECEIVABLE || t.transactionType === TransactionType.INCOME) {
          opening = opening.add(amt);
        } else if (t.transactionType === TransactionType.PAYMENT_IN) {
          opening = opening.subtract(amt);
        }
      }

      // Prior payments before startDate
      const priorPayments = await prisma.payment.findMany({
        where: {
          businessId: params.businessId,
          customerId: params.customerId,
          status: TransactionStatus.POSTED,
          paymentDate: { lt: params.startDate },
        },
        select: { amount: true, direction: true },
      });

      for (const p of priorPayments) {
        const amt = Money.fromDecimal(p.amount);
        if (p.direction === PaymentDirection.IN) {
          opening = opening.subtract(amt);
        } else {
          opening = opening.add(amt);
        }
      }
    }

    // 2. Fetch Transactions in date range
    const txWhere: Record<string, unknown> = {
      businessId: params.businessId,
      customerId: params.customerId,
      status: TransactionStatus.POSTED,
    };
    if (params.startDate || params.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (params.startDate) dateFilter.gte = params.startDate;
      if (params.endDate) dateFilter.lte = params.endDate;
      txWhere.transactionDate = dateFilter;
    }

    const transactions = await prisma.transaction.findMany({
      where: txWhere,
      select: {
        id: true,
        transactionDate: true,
        transactionNumber: true,
        referenceNumber: true,
        title: true,
        transactionType: true,
        totalAmount: true,
        paymentStatus: true,
      },
    });

    // 3. Fetch Payments in date range
    const paymentWhere: Record<string, unknown> = {
      businessId: params.businessId,
      customerId: params.customerId,
      status: TransactionStatus.POSTED,
    };
    if (params.startDate || params.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (params.startDate) dateFilter.gte = params.startDate;
      if (params.endDate) dateFilter.lte = params.endDate;
      paymentWhere.paymentDate = dateFilter;
    }

    const payments = await prisma.payment.findMany({
      where: paymentWhere,
      select: {
        id: true,
        paymentDate: true,
        paymentNumber: true,
        referenceNumber: true,
        notes: true,
        amount: true,
        direction: true,
      },
    });

    // 4. Combine into chronological timeline
    interface RawItem {
      date: Date;
      item:
        | { kind: "TX"; data: (typeof transactions)[0] }
        | { kind: "PAY"; data: (typeof payments)[0] };
    }

    const rawItems: RawItem[] = [
      ...transactions.map((t) => ({ date: new Date(t.transactionDate), item: { kind: "TX" as const, data: t } })),
      ...payments.map((p) => ({ date: new Date(p.paymentDate), item: { kind: "PAY" as const, data: p } })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let currentBalance = opening;
    let totalDebits = Money.zero();
    let totalCredits = Money.zero();
    const entries: LedgerEntry[] = [];

    for (const r of rawItems) {
      if (r.item.kind === "TX") {
        const tx = r.item.data;
        const amt = Money.fromDecimal(tx.totalAmount);

        let debit = Money.zero();
        let credit = Money.zero();

        if (tx.transactionType === TransactionType.RECEIVABLE || tx.transactionType === TransactionType.INCOME) {
          debit = amt;
          totalDebits = totalDebits.add(debit);
          currentBalance = currentBalance.add(debit);
        } else if (tx.transactionType === TransactionType.PAYMENT_IN) {
          credit = amt;
          totalCredits = totalCredits.add(credit);
          currentBalance = currentBalance.subtract(credit);
        }

        entries.push({
          id: tx.id,
          date: r.date,
          entityNumber: tx.transactionNumber,
          referenceNumber: tx.referenceNumber,
          description: tx.title,
          type: "TRANSACTION",
          rawType: tx.transactionType,
          debit,
          credit,
          runningBalance: currentBalance,
          status: tx.paymentStatus,
        });
      } else {
        const pay = r.item.data;
        const amt = Money.fromDecimal(pay.amount);

        let debit = Money.zero();
        let credit = Money.zero();

        if (pay.direction === PaymentDirection.IN) {
          credit = amt;
          totalCredits = totalCredits.add(credit);
          currentBalance = currentBalance.subtract(credit);
        } else {
          debit = amt;
          totalDebits = totalDebits.add(debit);
          currentBalance = currentBalance.add(debit);
        }

        entries.push({
          id: pay.id,
          date: r.date,
          entityNumber: pay.paymentNumber,
          referenceNumber: pay.referenceNumber,
          description: pay.notes || "Payment Received",
          type: "PAYMENT",
          rawType: pay.direction === PaymentDirection.IN ? "PAYMENT_IN" : "PAYMENT_OUT",
          debit,
          credit,
          runningBalance: currentBalance,
          status: "POSTED",
        });
      }
    }

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        customerCode: customer.customerCode,
        companyName: customer.companyName,
        phone: customer.phone,
        email: customer.email,
      },
      startDate: params.startDate,
      endDate: params.endDate,
      openingBalance: opening,
      totalDebits,
      totalCredits,
      closingBalance: currentBalance,
      totalOutstanding: currentBalance.isPositive() ? currentBalance : Money.zero(),
      entries,
    };
  }

  /**
   * Supplier Ledger
   * Sign Convention:
   *   Credit (+): Bills / Payables (what we owe the supplier)
   *   Debit (-): Payments made to supplier
   *   Running Balance = Previous + Credit - Debit
   */
  public static async getSupplierLedger(params: {
    businessId: string;
    supplierId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<SupplierLedgerResult> {
    const supplier = await prisma.supplier.findFirst({
      where: { id: params.supplierId, businessId: params.businessId },
    });

    if (!supplier) {
      throw new NotFoundError("Supplier not found");
    }

    // 1. Calculate Opening Balance as of params.startDate
    let opening = Money.fromDecimal(supplier.openingBalance);

    if (params.startDate) {
      const priorTxs = await prisma.transaction.findMany({
        where: {
          businessId: params.businessId,
          supplierId: params.supplierId,
          status: TransactionStatus.POSTED,
          transactionDate: { lt: params.startDate },
        },
        select: { totalAmount: true, transactionType: true },
      });

      for (const t of priorTxs) {
        const amt = Money.fromDecimal(t.totalAmount);
        if (t.transactionType === TransactionType.PAYABLE || t.transactionType === TransactionType.EXPENSE) {
          opening = opening.add(amt);
        } else if (t.transactionType === TransactionType.PAYMENT_OUT) {
          opening = opening.subtract(amt);
        }
      }

      const priorPayments = await prisma.payment.findMany({
        where: {
          businessId: params.businessId,
          supplierId: params.supplierId,
          status: TransactionStatus.POSTED,
          paymentDate: { lt: params.startDate },
        },
        select: { amount: true, direction: true },
      });

      for (const p of priorPayments) {
        const amt = Money.fromDecimal(p.amount);
        if (p.direction === PaymentDirection.OUT) {
          opening = opening.subtract(amt);
        } else {
          opening = opening.add(amt);
        }
      }
    }

    // 2. Fetch Transactions in date range
    const txWhere: Record<string, unknown> = {
      businessId: params.businessId,
      supplierId: params.supplierId,
      status: TransactionStatus.POSTED,
    };
    if (params.startDate || params.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (params.startDate) dateFilter.gte = params.startDate;
      if (params.endDate) dateFilter.lte = params.endDate;
      txWhere.transactionDate = dateFilter;
    }

    const transactions = await prisma.transaction.findMany({
      where: txWhere,
      select: {
        id: true,
        transactionDate: true,
        transactionNumber: true,
        referenceNumber: true,
        title: true,
        transactionType: true,
        totalAmount: true,
        paymentStatus: true,
      },
    });

    // 3. Fetch Payments in date range
    const paymentWhere: Record<string, unknown> = {
      businessId: params.businessId,
      supplierId: params.supplierId,
      status: TransactionStatus.POSTED,
    };
    if (params.startDate || params.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (params.startDate) dateFilter.gte = params.startDate;
      if (params.endDate) dateFilter.lte = params.endDate;
      paymentWhere.paymentDate = dateFilter;
    }

    const payments = await prisma.payment.findMany({
      where: paymentWhere,
      select: {
        id: true,
        paymentDate: true,
        paymentNumber: true,
        referenceNumber: true,
        notes: true,
        amount: true,
        direction: true,
      },
    });

    interface RawItem {
      date: Date;
      item:
        | { kind: "TX"; data: (typeof transactions)[0] }
        | { kind: "PAY"; data: (typeof payments)[0] };
    }

    const rawItems: RawItem[] = [
      ...transactions.map((t) => ({ date: new Date(t.transactionDate), item: { kind: "TX" as const, data: t } })),
      ...payments.map((p) => ({ date: new Date(p.paymentDate), item: { kind: "PAY" as const, data: p } })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let currentBalance = opening;
    let totalCredits = Money.zero();
    let totalDebits = Money.zero();
    const entries: LedgerEntry[] = [];

    for (const r of rawItems) {
      if (r.item.kind === "TX") {
        const tx = r.item.data;
        const amt = Money.fromDecimal(tx.totalAmount);

        let credit = Money.zero();
        let debit = Money.zero();

        if (tx.transactionType === TransactionType.PAYABLE || tx.transactionType === TransactionType.EXPENSE) {
          credit = amt;
          totalCredits = totalCredits.add(credit);
          currentBalance = currentBalance.add(credit);
        } else if (tx.transactionType === TransactionType.PAYMENT_OUT) {
          debit = amt;
          totalDebits = totalDebits.add(debit);
          currentBalance = currentBalance.subtract(debit);
        }

        entries.push({
          id: tx.id,
          date: r.date,
          entityNumber: tx.transactionNumber,
          referenceNumber: tx.referenceNumber,
          description: tx.title,
          type: "TRANSACTION",
          rawType: tx.transactionType,
          debit,
          credit,
          runningBalance: currentBalance,
          status: tx.paymentStatus,
        });
      } else {
        const pay = r.item.data;
        const amt = Money.fromDecimal(pay.amount);

        let credit = Money.zero();
        let debit = Money.zero();

        if (pay.direction === PaymentDirection.OUT) {
          debit = amt;
          totalDebits = totalDebits.add(debit);
          currentBalance = currentBalance.subtract(debit);
        } else {
          credit = amt;
          totalCredits = totalCredits.add(credit);
          currentBalance = currentBalance.add(credit);
        }

        entries.push({
          id: pay.id,
          date: r.date,
          entityNumber: pay.paymentNumber,
          referenceNumber: pay.referenceNumber,
          description: pay.notes || "Payment Made",
          type: "PAYMENT",
          rawType: pay.direction === PaymentDirection.OUT ? "PAYMENT_OUT" : "PAYMENT_IN",
          debit,
          credit,
          runningBalance: currentBalance,
          status: "POSTED",
        });
      }
    }

    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        supplierCode: supplier.supplierCode,
        companyName: supplier.companyName,
        phone: supplier.phone,
        email: supplier.email,
      },
      startDate: params.startDate,
      endDate: params.endDate,
      openingBalance: opening,
      totalCredits,
      totalDebits,
      closingBalance: currentBalance,
      totalOutstanding: currentBalance.isPositive() ? currentBalance : Money.zero(),
      entries,
    };
  }
}
