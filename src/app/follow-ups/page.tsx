import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { FollowUpService } from "@/server/services/crm/follow-up.service";
import { FollowUpWorkspace } from "@/components/crm/FollowUpWorkspace";
import { PartyStatus } from "@prisma/client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Operational Follow-Ups Queue | Sai Tours & Travels",
  description: "Work queue for receivable collections, supplier payment planning, callbacks, and promises-to-pay.",
};

export default async function FollowUpsPage() {
  const user = await requireCurrentUser();

  const [followUpsResult, summary, businessUsers, customers, suppliers] = await Promise.all([
    FollowUpService.getFollowUps({
      businessId: user.businessId,
      filter: "all",
      page: 1,
      pageSize: 50,
    }),
    FollowUpService.getFollowUpSummaryMetrics({
      businessId: user.businessId,
      userId: user.id,
    }),
    prisma.userProfile.findMany({
      where: { businessId: user.businessId, status: "ACTIVE" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.customer.findMany({
      where: { businessId: user.businessId, status: PartyStatus.ACTIVE },
      select: { id: true, name: true, customerCode: true },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { businessId: user.businessId, status: PartyStatus.ACTIVE },
      select: { id: true, name: true, supplierCode: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <FollowUpWorkspace
      initialFollowUps={followUpsResult.items}
      summary={summary}
      businessUsers={businessUsers}
      currentUserId={user.id}
      customers={customers}
      suppliers={suppliers}
    />
  );
}
