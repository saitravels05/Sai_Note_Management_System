import { requireCurrentUser } from "@/lib/auth/current-user";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  ReportHistoryView,
  type SerializedHistoryRecord,
} from "@/components/reports/ReportHistoryView";

export const metadata = {
  title: "Report History & Audit Log | Sai Tours & Travels",
  description: "View and download previously generated PDF statements and Excel accounting exports.",
};

export default async function ReportHistoryPage() {
  const user = await requireCurrentUser();

  const canViewReports =
    hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_VIEW) ||
    hasPermission(user.permissions, user.roles, PERMISSIONS.EXPORTS_EXECUTE);

  if (!canViewReports) {
    redirect("/unauthorized");
  }

  const rawHistory = await prisma.reportHistory.findMany({
    where: {
      businessId: user.businessId,
    },
    orderBy: { generatedAt: "desc" },
    take: 100,
  });

  const serializedHistory: SerializedHistoryRecord[] = rawHistory.map((h) => {
    const p = (h.parameters as Record<string, unknown>) || {};
    const fileName =
      typeof p.fileName === "string"
        ? p.fileName
        : `Report_${h.reportType}_${h.id.slice(0, 8)}.${h.format === "PDF" ? "pdf" : h.format === "EXCEL" ? "xlsx" : "csv"}`;
    const fileSize = typeof p.fileSize === "number" ? p.fileSize : 0;
    const status = typeof p.status === "string" ? p.status : "COMPLETED";

    return {
      id: h.id,
      reportType: h.reportType,
      format: h.format,
      periodStart: h.periodStart.toISOString(),
      periodEnd: h.periodEnd.toISOString(),
      fileName,
      fileSize,
      status,
      generatedAt: h.generatedAt.toISOString(),
      generatedBy: h.generatedBy || "System",
      downloadUrl: `/api/exports/${h.id}/download`,
    };
  });

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    select: { name: true },
  });

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6">
      <ReportHistoryView
        businessName={business?.name || user.businessName}
        initialHistory={serializedHistory}
      />
    </div>
  );
}
