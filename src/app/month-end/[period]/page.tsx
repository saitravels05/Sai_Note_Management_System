import { requireCurrentUser } from "@/lib/auth/current-user";
import { MonthEndService } from "@/server/services/month-end.service";
import { PeriodDetailDashboard } from "@/components/month-end/PeriodDetailDashboard";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PeriodPageProps {
  params: Promise<{
    period: string;
  }>;
}

export default async function PeriodDetailPage({ params }: PeriodPageProps) {
  const { period } = await params;
  const user = await requireCurrentUser();

  // Parse YYYY-MM
  const match = period.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) {
    notFound();
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    notFound();
  }

  const [checklist, snapshot, versionDiff] = await Promise.all([
    MonthEndService.runPreCloseChecklist(user.businessId, year, month),
    MonthEndService.getClosingSnapshot(user.businessId, year, month),
    MonthEndService.getVersionComparison(user.businessId, year, month),
  ]);

  return (
    <PeriodDetailDashboard
      year={year}
      month={month}
      initialChecklist={checklist}
      initialSnapshot={snapshot}
      initialDiff={versionDiff}
    />
  );
}
