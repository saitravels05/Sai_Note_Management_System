import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { RecordService } from "@/server/services/record.service";
import { RecordsWorkspace, type SavedFilterDefinition } from "@/components/records/RecordsWorkspace";
import { type SerializedRecord } from "@/components/records/RecordCard";
import { TransactionType, PaymentStatus, TransactionStatus } from "@prisma/client";

interface RecordsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  const user = await requireCurrentUser();
  const sp = await searchParams;

  const getString = (val: string | string[] | undefined) =>
    Array.isArray(val) ? val[0] : val || undefined;

  const search = getString(sp.search);
  const typeStr = getString(sp.type);
  const statusStr = getString(sp.status);
  const paymentStatusStr = getString(sp.paymentStatus);
  const categoryId = getString(sp.categoryId);
  const customerId = getString(sp.customerId);
  const supplierId = getString(sp.supplierId);
  const startDateStr = getString(sp.startDate);
  const endDateStr = getString(sp.endDate);
  const minAmountStr = getString(sp.minAmount);
  const maxAmountStr = getString(sp.maxAmount);
  const sortByStr = getString(sp.sortBy);
  const pageStr = getString(sp.page);
  const pageSizeStr = getString(sp.pageSize);

  const type = typeStr && Object.values(TransactionType).includes(typeStr as TransactionType)
    ? (typeStr as TransactionType)
    : undefined;

  const status = statusStr && Object.values(TransactionStatus).includes(statusStr as TransactionStatus)
    ? (statusStr as TransactionStatus)
    : undefined;

  const paymentStatus = paymentStatusStr && Object.values(PaymentStatus).includes(paymentStatusStr as PaymentStatus)
    ? (paymentStatusStr as PaymentStatus)
    : undefined;

  const startDate = startDateStr ? new Date(startDateStr) : undefined;
  const endDate = endDateStr ? new Date(endDateStr) : undefined;
  const minAmount = minAmountStr ? parseFloat(minAmountStr) : undefined;
  const maxAmount = maxAmountStr ? parseFloat(maxAmountStr) : undefined;
  const page = pageStr ? parseInt(pageStr, 10) : 1;
  const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : 20;

  const sortBy = (sortByStr as "newest" | "oldest" | "highest_amount" | "lowest_amount" | "recently_updated") || "newest";

  // Fetch filtered records
  const result = await RecordService.getRecords(
    {
      search,
      type,
      status,
      paymentStatus,
      categoryId,
      customerId,
      supplierId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy,
      page,
      pageSize,
    },
    {
      businessId: user.businessId,
      userId: user.id,
    }
  );

  // Fetch filter metadata in parallel
  const [categories, customers, suppliers, savedFilters] = await Promise.all([
    prisma.category.findMany({
      where: { businessId: user.businessId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      where: { businessId: user.businessId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { businessId: user.businessId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.savedFilter.findMany({
      where: { businessId: user.businessId, userId: user.id, module: "RECORDS" },
      select: { id: true, name: true, filterDefinition: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Serialize records for client components
  const serializedRecords: SerializedRecord[] = result.records.map((r) => ({
    id: r.id,
    transactionNumber: r.transactionNumber,
    transactionDate: r.transactionDate.toISOString(),
    transactionType: r.transactionType,
    title: r.title,
    description: r.description,
    referenceNumber: r.referenceNumber,
    amount: r.amount.toString(),
    totalAmount: r.totalAmount.toString(),
    paymentStatus: r.paymentStatus,
    status: r.status,
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
    categoryName: r.category.name,
    customerName: r.customer ? r.customer.name : null,
    supplierName: r.supplier ? r.supplier.name : null,
    tags: r.tags.map((t) => t.tag.name),
  }));

  const serializedSavedFilters = savedFilters.map((sf) => ({
    id: sf.id,
    name: sf.name,
    filterDefinition: (sf.filterDefinition as unknown as SavedFilterDefinition) || {},
  }));

  return (
    <RecordsWorkspace
      records={serializedRecords}
      pagination={result.pagination}
      categories={categories}
      customers={customers}
      suppliers={suppliers}
      savedFilters={serializedSavedFilters}
    />
  );
}
