import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { AccountingService } from "@/server/services/accounting.service";
import { ReceivablesWorkspace, type SerializedReceivable } from "@/components/accounting/ReceivablesWorkspace";
import { TransactionType, TransactionStatus, PaymentMethodType, Prisma } from "@prisma/client";
import { Money } from "@/lib/money";

export const metadata = {
  title: "Accounts Receivable | Sai Tours & Travels",
  description: "Track customer invoices, collections, aging schedules, and outstanding balances.",
};

export default async function ReceivablesPage() {
  const user = await requireCurrentUser();

  type ReceivablesData = Prisma.TransactionGetPayload<{
    include: {
      customer: { select: { id: true; name: true; customerCode: true } };
      category: { select: { name: true } };
      allocations: {
        select: {
          amount: true;
          payment: { select: { status: true } };
        };
      };
    };
  }>;
  type AgingData = Awaited<ReturnType<typeof AccountingService.getAgingAnalysis>>;
  type SummaryData = Awaited<ReturnType<typeof AccountingService.getReceivablesSummary>>;
  type PaymentMethodData = { id: string; name: string; type: PaymentMethodType };

  let receivables: ReceivablesData[] = [];
  let summary: SummaryData = {
    totalReceivables: Money.zero(),
    totalOriginalAmount: Money.zero(),
    totalPaidAmount: Money.zero(),
    dueTodayAmount: Money.zero(),
    overdueAmount: Money.zero(),
    partiallyPaidAmount: Money.zero(),
    unpaidAmount: Money.zero(),
    totalCount: 0,
    dueTodayCount: 0,
    overdueCount: 0,
    partiallyPaidCount: 0,
    unpaidCount: 0,
  };
  let aging: AgingData = {
    current: { label: "Current", count: 0, amount: Money.zero(), percentage: 0 },
    days1To30: { label: "1–30 Days", count: 0, amount: Money.zero(), percentage: 0 },
    days31To60: { label: "31–60 Days", count: 0, amount: Money.zero(), percentage: 0 },
    days61To90: { label: "61–90 Days", count: 0, amount: Money.zero(), percentage: 0 },
    days90Plus: { label: "90+ Days", count: 0, amount: Money.zero(), percentage: 0 },
    total: Money.zero(),
  };
  let paymentMethods: PaymentMethodData[] = [];

  try {
    [receivables, summary, aging, paymentMethods] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          businessId: user.businessId,
          status: TransactionStatus.POSTED,
          transactionType: TransactionType.RECEIVABLE,
        },
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
          category: { select: { name: true } },
          allocations: {
            select: {
              amount: true,
              payment: { select: { status: true } },
            },
          },
        },
        orderBy: { transactionDate: "desc" },
      }),
      AccountingService.getReceivablesSummary({ businessId: user.businessId }),
      AccountingService.getAgingAnalysis({ businessId: user.businessId, type: "RECEIVABLE" }),
      prisma.paymentMethod.findMany({
        where: { businessId: user.businessId, isActive: true },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
      }),
    ]);
  } catch (err) {
    console.warn("Database offline in ReceivablesPage, using clean zero state:", err);
  }

  const serialized: SerializedReceivable[] = receivables.map((r) => {
    let paid = Money.zero();
    for (const a of r.allocations) {
      if (a.payment.status === TransactionStatus.POSTED) {
        paid = paid.add(Money.fromDecimal(a.amount));
      }
    }
    const total = Money.fromDecimal(r.totalAmount);
    const outstanding = total.subtract(paid);

    return {
      id: r.id,
      transactionNumber: r.transactionNumber,
      transactionDate: r.transactionDate.toISOString(),
      title: r.title,
      referenceNumber: r.referenceNumber,
      totalAmount: total.getDecimal().toString(),
      paidAmount: paid.getDecimal().toString(),
      outstandingAmount: (outstanding.isNegative() ? Money.zero() : outstanding).getDecimal().toString(),
      paymentStatus: r.paymentStatus,
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      customerId: r.customerId,
      customerName: r.customer ? r.customer.name : null,
      customerCode: r.customer ? r.customer.customerCode : null,
      categoryName: r.category.name,
    };
  });

  return (
    <ReceivablesWorkspace
      receivables={serialized}
      summary={summary}
      aging={aging}
      paymentMethods={paymentMethods}
    />
  );
}
