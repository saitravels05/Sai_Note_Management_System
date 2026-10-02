import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { AccountingService } from "@/server/services/accounting.service";
import { PayablesWorkspace, type SerializedPayable } from "@/components/accounting/PayablesWorkspace";
import { TransactionType, TransactionStatus, PaymentMethodType, Prisma } from "@prisma/client";
import { Money } from "@/lib/money";

export const metadata = {
  title: "Accounts Payable | Sai Tours & Travels",
  description: "Track supplier bills, airline/hotel settlements, aging schedules, and disbursements.",
};

export default async function PayablesPage() {
  const user = await requireCurrentUser();

  type PayablesData = Prisma.TransactionGetPayload<{
    include: {
      supplier: { select: { id: true; name: true; supplierCode: true } };
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
  type SummaryData = Awaited<ReturnType<typeof AccountingService.getPayablesSummary>>;
  type PaymentMethodData = { id: string; name: string; type: PaymentMethodType };

  let payables: PayablesData[] = [];
  let summary: SummaryData = {
    totalPayables: Money.zero(),
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
    [payables, summary, aging, paymentMethods] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          businessId: user.businessId,
          status: TransactionStatus.POSTED,
          transactionType: TransactionType.PAYABLE,
        },
        include: {
          supplier: { select: { id: true, name: true, supplierCode: true } },
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
      AccountingService.getPayablesSummary({ businessId: user.businessId }),
      AccountingService.getAgingAnalysis({ businessId: user.businessId, type: "PAYABLE" }),
      prisma.paymentMethod.findMany({
        where: { businessId: user.businessId, isActive: true },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
      }),
    ]);
  } catch (err) {
    console.warn("Database offline in PayablesPage, using clean zero state:", err);
  }

  const serialized: SerializedPayable[] = payables.map((p) => {
    let paid = Money.zero();
    for (const a of p.allocations) {
      if (a.payment.status === TransactionStatus.POSTED) {
        paid = paid.add(Money.fromDecimal(a.amount));
      }
    }
    const total = Money.fromDecimal(p.totalAmount);
    const outstanding = total.subtract(paid);

    return {
      id: p.id,
      transactionNumber: p.transactionNumber,
      transactionDate: p.transactionDate.toISOString(),
      title: p.title,
      referenceNumber: p.referenceNumber,
      totalAmount: total.getDecimal().toString(),
      paidAmount: paid.getDecimal().toString(),
      outstandingAmount: (outstanding.isNegative() ? Money.zero() : outstanding).getDecimal().toString(),
      paymentStatus: p.paymentStatus,
      dueDate: p.dueDate ? p.dueDate.toISOString() : null,
      supplierId: p.supplierId,
      supplierName: p.supplier ? p.supplier.name : null,
      supplierCode: p.supplier ? p.supplier.supplierCode : null,
      categoryName: p.category.name,
    };
  });

  return (
    <PayablesWorkspace
      payables={serialized}
      summary={summary}
      aging={aging}
      paymentMethods={paymentMethods}
    />
  );
}
