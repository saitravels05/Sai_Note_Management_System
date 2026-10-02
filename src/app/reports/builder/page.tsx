import { requireCurrentUser } from "@/lib/auth/current-user";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { ReportBuilderWizard } from "@/components/reports/ReportBuilderWizard";

export const metadata = {
  title: "Custom Report Builder | Sai Tours & Travels",
  description: "Advanced custom report builder, analytics, and management reporting without SQL.",
};

export default async function ReportBuilderPage() {
  const user = await requireCurrentUser();

  const canView =
    hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_BUILDER_VIEW) ||
    hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_VIEW);

  if (!canView) {
    redirect("/unauthorized");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ReportBuilderWizard
        businessName={user.businessName}
        userPermissions={user.permissions}
        userRoles={user.roles}
      />
    </div>
  );
}
