import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { CustomReportService } from "@/server/services/reporting/custom-report.service";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canExport =
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_BUILDER_EXPORT) ||
      hasPermission(user.permissions, user.roles, PERMISSIONS.EXPORTS_EXECUTE) ||
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_VIEW);

    if (!canExport) {
      return NextResponse.json(
        { error: "Forbidden: reports.builder.export permission required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const definition = body.definition;
    if (!definition) {
      return NextResponse.json({ error: "Report definition is required." }, { status: 400 });
    }

    const { buffer, fileName } = await CustomReportService.exportPdf(
      user.businessId,
      definition,
      user.permissions,
      user.roles,
      user.displayName || user.email
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: unknown) {
    console.error("Custom report PDF export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export PDF report." },
      { status: 500 }
    );
  }
}
