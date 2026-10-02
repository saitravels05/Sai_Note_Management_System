import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ExportService } from "@/server/services/export.service";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canExport =
      hasPermission(user.permissions, user.roles, PERMISSIONS.EXPORTS_EXECUTE) ||
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_VIEW);

    if (!canExport) {
      return NextResponse.json(
        { error: "Forbidden: exports.execute or reports.view permission required." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    // ExportService.getExportFileForDownload enforces businessId multi-tenant isolation
    const fileData = await ExportService.getExportFileForDownload(id, user.businessId);

    return new NextResponse(new Uint8Array(fileData.fileBuffer), {
      headers: {
        "Content-Type": fileData.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileData.fileName)}"`,
        "Content-Length": fileData.fileSize.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Export download error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retrieve export file." },
      { status: 404 }
    );
  }
}
