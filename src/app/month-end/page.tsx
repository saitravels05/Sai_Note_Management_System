import { requireCurrentUser } from "@/lib/auth/current-user";
import { MonthEndService } from "@/server/services/month-end.service";
import { MonthEndOverview } from "@/components/month-end/MonthEndOverview";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MonthEndPage() {
  const user = await requireCurrentUser();

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    select: { name: true },
  });

  const periods = await MonthEndService.getPeriodList(user.businessId);

  return (
    <MonthEndOverview
      businessName={business?.name || "Business"}
      periods={periods}
    />
  );
}
