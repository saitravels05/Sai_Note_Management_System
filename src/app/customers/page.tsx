import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { CRMService } from "@/server/services/crm/crm.service";
import { CustomerListWorkspace } from "@/components/crm/CustomerListWorkspace";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customers Directory & CRM | Sai Tours & Travels",
  description: "Manage client accounts, follow-ups, receivables, contact preferences, and running ledgers.",
};

export default async function CustomersPage() {
  const user = await requireCurrentUser();

  const [customerResult, businessUsers] = await Promise.all([
    CRMService.getCustomerList({
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
    <CustomerListWorkspace
      initialCustomers={customerResult.items}
      totalCount={customerResult.totalCount}
      businessUsers={businessUsers}
    />
  );
}
