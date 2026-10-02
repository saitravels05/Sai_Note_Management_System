import { requireCurrentUser } from "@/lib/auth/current-user";
import { DocumentService, DocumentUserContext } from "@/server/services/document/document.service";
import { DocumentCenterWorkspace, DocumentItemDTO } from "@/components/documents/DocumentCenterWorkspace";
import { prisma } from "@/lib/db";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documents",
  description: "Secure Business Document Management Vault for Sai Tours & Travels",
};

export default async function DocumentsPage() {
  const user = await requireCurrentUser();

  const ctx: DocumentUserContext = {
    userId: user.id,
    businessId: user.businessId,
    userRoles: user.roleTypes,
    userPermissions: user.permissions,
  };

  // Fetch initial documents, customers, suppliers, transactions for linking
  const [documentsResult, customers, suppliers, transactions] = await Promise.all([
    DocumentService.searchDocuments(
      {
        pageSize: 50,
        sortBy: "newest",
      },
      ctx
    ),
    prisma.customer.findMany({
      where: { businessId: user.businessId, status: "ACTIVE" },
      select: { id: true, name: true, customerCode: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.supplier.findMany({
      where: { businessId: user.businessId, status: "ACTIVE" },
      select: { id: true, name: true, supplierCode: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.transaction.findMany({
      where: { businessId: user.businessId, status: "POSTED" },
      select: { id: true, transactionNumber: true, title: true },
      orderBy: { transactionDate: "desc" },
      take: 50,
    }),
  ]);

  const serializedDocuments: DocumentItemDTO[] = documentsResult.items.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    originalFileName: doc.originalFileName,
    safeFileName: doc.safeFileName,
    displayName: doc.displayName,
    storageProvider: doc.storageProvider,
    storageKey: doc.storageKey,
    extension: doc.extension,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    checksum: doc.checksum,
    category: doc.category,
    sensitivity: doc.sensitivity,
    status: doc.status,
    description: doc.description,
    expiryDate: doc.expiryDate ? doc.expiryDate.toISOString() : null,
    versionNumber: doc.versionNumber,
    parentId: doc.parentId,
    changeNote: doc.changeNote,
    tags: doc.tags,
    uploadedById: doc.uploadedById,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
    expiryStatus: doc.expiryStatus,
    documentLinks: doc.documentLinks.map((l) => ({
      id: l.id,
      entityType: l.entityType,
      entityId: l.entityId,
      createdAt: l.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <DocumentCenterWorkspace
        initialDocuments={serializedDocuments}
        totalDocuments={documentsResult.total}
        customers={customers}
        suppliers={suppliers}
        transactions={transactions}
        currentUserId={user.id}
        userPermissions={user.permissions}
        userRoles={user.roles}
      />
    </div>
  );
}
