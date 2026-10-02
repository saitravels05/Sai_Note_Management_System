import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { CRMService } from "@/server/services/crm/crm.service";
import { LedgerService } from "@/server/services/ledger.service";
import { CommunicationService } from "@/server/services/crm/communication.service";
import { PromiseService } from "@/server/services/crm/promise.service";
import { Supplier360Workspace } from "@/components/crm/Supplier360Workspace";
import { notFound } from "next/navigation";
import { TransactionType, TransactionStatus, FollowUpStatus } from "@prisma/client";
import { Money } from "@/lib/money";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Supplier 360° Profile | Sai Tours & Travels",
  description: "Comprehensive vendor profile, bills, disbursements, running ledger, and payment commitments.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Supplier360Page({ params }: PageProps) {
  const user = await requireCurrentUser();
  const { id } = await params;

  let profile360;
  try {
    profile360 = await CRMService.getSupplier360Profile({
      businessId: user.businessId,
      supplierId: id,
    });
  } catch {
    notFound();
  }

  const now = new Date();

  const [ledgerResult, rawPayables, rawPayments, rawFollowUps, commitmentsResult, activities, businessUsers, rawDocuments] =
    await Promise.all([
      LedgerService.getSupplierLedger({
        businessId: user.businessId,
        supplierId: id,
      }),
      prisma.transaction.findMany({
        where: {
          businessId: user.businessId,
          supplierId: id,
          status: TransactionStatus.POSTED,
          transactionType: TransactionType.PAYABLE,
        },
        include: {
          allocations: {
            select: {
              amount: true,
              payment: { select: { status: true } },
            },
          },
        },
        orderBy: { transactionDate: "desc" },
      }),
      prisma.payment.findMany({
        where: {
          businessId: user.businessId,
          supplierId: id,
          status: TransactionStatus.POSTED,
        },
        include: {
          paymentMethod: { select: { name: true } },
          allocations: { select: { amount: true } },
        },
        orderBy: { paymentDate: "desc" },
      }),
      prisma.followUp.findMany({
        where: {
          businessId: user.businessId,
          supplierId: id,
        },
        include: {
          assignedUser: { select: { id: true, displayName: true } },
          supplier: { select: { name: true, supplierCode: true } },
        },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      }),
      PromiseService.getCommitments({
        businessId: user.businessId,
        supplierId: id,
        status: "ALL",
        pageSize: 100,
      }),
      CommunicationService.getPartyActivityTimeline({
        businessId: user.businessId,
        supplierId: id,
      }),
      prisma.userProfile.findMany({
        where: { businessId: user.businessId, status: "ACTIVE" },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
      }),
      prisma.attachment.findMany({
        where: {
          businessId: user.businessId,
          OR: [
            { documentLinks: { some: { entityType: "SUPPLIER", entityId: id } } },
            { entityType: "SUPPLIER", entityId: id },
          ],
          status: { not: "ARCHIVED" },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  // Serialize payables
  const payables = rawPayables.map((p) => {
    let paid = Money.zero();
    for (const a of p.allocations) {
      if (a.payment.status === TransactionStatus.POSTED) {
        paid = paid.add(Money.fromDecimal(a.amount));
      }
    }
    const total = Money.fromDecimal(p.totalAmount);
    const outstanding = total.subtract(paid);
    const daysOverdue =
      p.dueDate && outstanding.greaterThan(Money.zero())
        ? Math.max(0, Math.floor((now.getTime() - p.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

    return {
      id: p.id,
      transactionNumber: p.transactionNumber,
      transactionDate: p.transactionDate.toISOString(),
      title: p.title,
      totalAmount: total.format(),
      paidAmount: paid.format(),
      outstandingAmount: (outstanding.isNegative() ? Money.zero() : outstanding).format(),
      dueDate: p.dueDate ? p.dueDate.toISOString() : null,
      daysOverdue,
      paymentStatus: p.paymentStatus,
    };
  });

  // Serialize payments
  const payments = rawPayments.map((p) => {
    const totalAmount = Money.fromDecimal(p.amount);
    let allocated = Money.zero();
    for (const a of p.allocations) {
      allocated = allocated.add(Money.fromDecimal(a.amount));
    }
    const unallocated = totalAmount.subtract(allocated);

    return {
      id: p.id,
      paymentNumber: p.paymentNumber,
      paymentDate: p.paymentDate.toISOString(),
      method: p.paymentMethod?.name || "Cash",
      amount: totalAmount.format(),
      allocatedAmount: allocated.format(),
      unallocatedAmount: (unallocated.isNegative() ? Money.zero() : unallocated).format(),
      status: p.status,
    };
  });

  // Serialize follow-ups
  const followUps = rawFollowUps.map((f) => ({
    id: f.id,
    type: f.type,
    title: f.title,
    description: f.description,
    dueDate: f.dueDate.toISOString().split("T")[0],
    dueTime: f.dueTime,
    priority: f.priority,
    status: f.status,
    isOverdue: f.dueDate < now && f.status !== FollowUpStatus.COMPLETED,
    customerId: null,
    customerName: null,
    customerCode: null,
    customerPhone: null,
    supplierId: f.supplierId,
    supplierName: f.supplier ? f.supplier.name : null,
    supplierCode: f.supplier ? f.supplier.supplierCode : null,
    transactionId: f.transactionId,
    transactionNumber: null,
    receivableOrPayableAmount: null,
    assignedUser: f.assignedUser ? { id: f.assignedUser.id, displayName: f.assignedUser.displayName } : null,
    createdBy: f.createdBy,
    createdAt: f.createdAt.toISOString(),
    completedAt: f.completedAt ? f.completedAt.toISOString() : null,
    outcome: f.outcome,
    outcomeNotes: f.outcomeNotes,
    nextFollowUpDate: f.nextFollowUpDate ? f.nextFollowUpDate.toISOString().split("T")[0] : null,
  }));

  const commitments = commitmentsResult.items;

  // Serialize supplier documents
  const supplierDocuments = rawDocuments.map((d) => ({
    id: d.id,
    displayName: d.displayName || d.fileName,
    originalFileName: d.originalFileName,
    category: d.category,
    fileSize: d.fileSize,
    extension: d.extension || d.fileName.split(".").pop() || "bin",
    versionNumber: d.versionNumber,
    status: d.status,
    expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
    uploadedById: d.uploadedById,
  }));

  return (
    <Supplier360Workspace
      data={profile360}
      ledgerEntries={ledgerResult.entries}
      payables={payables}
      payments={payments}
      followUps={followUps}
      commitments={commitments}
      activities={activities}
      businessUsers={businessUsers}
      documents={supplierDocuments}
    />
  );
}
