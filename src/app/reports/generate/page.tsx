import { requireCurrentUser } from "@/lib/auth/current-user";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { ReportGeneratorWizard } from "@/components/reports/ReportGeneratorWizard";
import { type PdfReportType } from "@/server/services/pdf-report.service";
import { type PeriodType } from "@/server/services/analytics.service";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Accounting PDF Report Generator | Sai Tours & Travels",
  description: "Configure and generate verified A4 accounting PDF statements, ledgers, and executive summaries.",
};

interface GeneratePageProps {
  searchParams: Promise<{
    type?: string;
    period?: string;
  }>;
}

export default async function GenerateReportPage({ searchParams }: GeneratePageProps) {
  const user = await requireCurrentUser();

  const canViewReports =
    hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_VIEW) ||
    hasPermission(user.permissions, user.roles, PERMISSIONS.EXPORTS_EXECUTE);

  if (!canViewReports) {
    redirect("/unauthorized");
  }

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    select: { name: true, currency: true },
  });

  const resolvedParams = await searchParams;
  const initialType = (resolvedParams.type as PdfReportType) || "MONTHLY_ACCOUNTING";
  const initialPeriod = (resolvedParams.period as PeriodType) || "this-month";

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6">
      <ReportGeneratorWizard
        businessName={business?.name || user.businessName}
        currency={business?.currency || "INR"}
        initialReportType={initialType}
        initialPeriod={initialPeriod}
      />
    </div>
  );
}
