import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { CRMService } from "@/server/services/crm/crm.service";
import { SupplierListWorkspace } from "@/components/crm/SupplierListWorkspace";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suppliers & Vendors Directory | Sai Tours & Travels",
  description: "Manage travel suppliers, airlines, hoteliers, payables, payment commitments, and running ledgers.",
};

export default async function SuppliersPage() {
  const user = await requireCurrentUser();

  const [supplierResult, businessUsers] = await Promise.all([
    CRMService.getSupplierList({
      businessId: user.businessId,
      status: "ALL",
      sortBy: "name",
      sortOrder: "asc",
      page: 1,
      pageSize: 50,
    }),
    prisma.userProfile.findMany({
      where: { businessId: user.businessId, status: "ACTIVE" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return (
    <SupplierListWorkspace
      initialSuppliers={supplierResult.items}
      totalCount={supplierResult.totalCount}
      businessUsers={businessUsers}
    />
  );
}
