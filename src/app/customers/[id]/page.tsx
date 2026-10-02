import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { CRMService } from "@/server/services/crm/crm.service";
import { LedgerService } from "@/server/services/ledger.service";
import { CommunicationService } from "@/server/services/crm/communication.service";
import { PromiseService } from "@/server/services/crm/promise.service";
import { Customer360Workspace } from "@/components/crm/Customer360Workspace";
import { notFound } from "next/navigation";
import { TransactionType, TransactionStatus, FollowUpStatus } from "@prisma/client";
import { Money } from "@/lib/money";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer 360° Profile | Sai Tours & Travels",
  description: "Comprehensive customer financial profile, invoices, payments, running ledger, and CRM follow-up timeline.",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function Customer360Page({ params, searchParams }: PageProps) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const { month, year } = await searchParams;

  const historicalMonth = month ? parseInt(month, 10) : undefined;
  const historicalYear = year ? parseInt(year, 10) : undefined;

  let profile360;
  try {
    profile360 = await CRMService.getCustomer360Profile({
      businessId: user.businessId,
      customerId: id,
      historicalMonth,
      historicalYear,
    });
  } catch {
    notFound();
  }

  const now = new Date();

  const [ledgerResult, rawReceivables, rawPayments, rawFollowUps, promisesResult, activities, businessUsers, rawDocuments] =
    await Promise.all([
      LedgerService.getCustomerLedger({
        businessId: user.businessId,
        customerId: id,
      }),
      prisma.transaction.findMany({
        where: {
          businessId: user.businessId,
          customerId: id,
          status: TransactionStatus.POSTED,
          transactionType: TransactionType.RECEIVABLE,
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
          customerId: id,
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
          customerId: id,
        },
        include: {
          assignedUser: { select: { id: true, displayName: true } },
          customer: { select: { name: true, customerCode: true, phone: true } },
        },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      }),
      PromiseService.getPromises({
        businessId: user.businessId,
        customerId: id,
        status: "ALL",
        pageSize: 100,
      }),
      CommunicationService.getPartyActivityTimeline({
        businessId: user.businessId,
        customerId: id,
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
            { documentLinks: { some: { entityType: "CUSTOMER", entityId: id } } },
            { entityType: "CUSTOMER", entityId: id },
          ],
          status: { not: "ARCHIVED" },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  // Serialize receivables
  const receivables = rawReceivables.map((r) => {
    let paid = Money.zero();
    for (const a of r.allocations) {
      if (a.payment.status === TransactionStatus.POSTED) {
        paid = paid.add(Money.fromDecimal(a.amount));
      }
    }
    const total = Money.fromDecimal(r.totalAmount);
    const outstanding = total.subtract(paid);
    const daysOverdue =
      r.dueDate && outstanding.greaterThan(Money.zero())
        ? Math.max(0, Math.floor((now.getTime() - r.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

    return {
      id: r.id,
      transactionNumber: r.transactionNumber,
      transactionDate: r.transactionDate.toISOString(),
      title: r.title,
      totalAmount: total.format(),
      paidAmount: paid.format(),
      outstandingAmount: (outstanding.isNegative() ? Money.zero() : outstanding).format(),
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      daysOverdue,
      paymentStatus: r.paymentStatus,
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
    customerId: f.customerId,
    customerName: f.customer ? f.customer.name : null,
    customerCode: f.customer ? f.customer.customerCode : null,
    customerPhone: f.customer ? f.customer.phone : null,
    supplierId: null,
    supplierName: null,
    supplierCode: null,
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

  const promises = promisesResult.items;

  // Serialize customer documents
  const customerDocuments = rawDocuments.map((d) => ({
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
    <Customer360Workspace
      data={profile360}
      ledgerEntries={ledgerResult.entries}
      receivables={receivables}
      payments={payments}
      followUps={followUps}
      promises={promises}
      activities={activities}
      businessUsers={businessUsers}
      documents={customerDocuments}
    />
  );
}
