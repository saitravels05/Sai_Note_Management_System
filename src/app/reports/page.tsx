import { requireCurrentUser } from "@/lib/auth/current-user";
import { ExportService } from "@/server/services/export.service";
import { CustomReportService } from "@/server/services/reporting/custom-report.service";
import {
  ReportLibraryWorkspace,
  type SerializedExportHistoryItem,
  type SerializedSavedReportItem,
} from "@/components/reports/ReportLibraryWorkspace";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Reports Library & Custom Analytics | Sai Tours & Travels",
  description: "Enterprise report builder, financial statements, and management reporting.",
};

export default async function ReportsPage() {
  const user = await requireCurrentUser();

  const canViewReports =
    hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_VIEW) ||
    hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_BUILDER_VIEW) ||
    hasPermission(user.permissions, user.roles, PERMISSIONS.EXPORTS_EXECUTE);

  if (!canViewReports) {
    redirect("/unauthorized");
  }

  const [rawHistory, rawSavedReports] = await Promise.all([
    ExportService.listExportHistory(user.businessId, 50),
    CustomReportService.listSavedReports(user.businessId, user.id, user.roles),
  ]);

  const serializedHistory: SerializedExportHistoryItem[] = rawHistory.map((h) => ({
    id: h.id,
    reportType: h.reportType,
    format: h.format,
    periodStart: h.periodStart.toISOString(),
    periodEnd: h.periodEnd.toISOString(),
    fileName: h.fileName,
    fileSize: h.fileSize,
    generatedAt: h.generatedAt.toISOString(),
    downloadUrl: h.downloadUrl,
  }));

  const serializedSavedReports: SerializedSavedReportItem[] = rawSavedReports.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    datasetId: r.datasetId,
    visibility: r.visibility,
    versionNumber: r.versionNumber,
    isFavorite: r.isFavorite,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const templates = CustomReportService.getTemplates();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ReportLibraryWorkspace
        businessName={user.businessName}
        initialHistory={serializedHistory}
        savedReports={serializedSavedReports}
        templates={templates}
        userPermissions={user.permissions}
        userRoles={user.roles}
      />
    </div>
  );
}
