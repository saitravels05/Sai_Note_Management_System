import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { AccountingService } from "@/server/services/accounting.service";
import { PayablesWorkspace, type SerializedPayable } from "@/components/accounting/PayablesWorkspace";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { Money } from "@/lib/money";

export const metadata = {
  title: "Accounts Payable | Sai Tours & Travels",
  description: "Track supplier bills, airline/hotel settlements, aging schedules, and disbursements.",
};

export default async function PayablesPage() {
  const user = await requireCurrentUser();

  const [payables, summary, aging, paymentMethods] = await Promise.all([
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
