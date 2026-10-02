import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, requirePermission } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AuditService } from "@/server/services/audit.service";
import { escapeCsvField, sanitizeCsvCell } from "@/server/services/csv-export.service";
import { AuditAction, AuditCategory, AuditSeverity } from "@prisma/client";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.AUDIT_EXPORT);

    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get("format") || "csv").toLowerCase();
    const query = searchParams.get("query") || undefined;
    const category = (searchParams.get("category") as AuditCategory) || undefined;
    const action = (searchParams.get("action") as AuditAction) || undefined;
    const severity = (searchParams.get("severity") as AuditSeverity) || undefined;
    const entityType = searchParams.get("entityType") || undefined;
    const entityId = searchParams.get("entityId") || undefined;
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined;
    const correlationId = searchParams.get("correlationId") || undefined;

    // Fetch up to 1000 logs for export
    const { items } = await AuditService.search(user.businessId, {
      query,
      category,
      action,
      severity,
      entityType,
      entityId,
      startDate,
      endDate,
      correlationId,
      limit: 1000,
    });

    // Audit the export action
    await AuditService.log({
      businessId: user.businessId,
      userId: user.id,
      action: AuditAction.AUDIT_EXPORTED,
      category: AuditCategory.EXPORT,
      severity: AuditSeverity.INFO,
      entityType: "AuditLog",
      entityId: user.businessId,
      reason: `Audit log export: ${items.length} records in ${format.toUpperCase()} format`,
      metadata: {
        format,
        exportedCount: items.length,
      },
    });

    const filename = `audit_trail_${new Date().toISOString().slice(0, 10)}.${format === "excel" ? "xlsx" : "csv"}`;

    if (format === "excel") {
      const dataRows = items.map((log) => ({
        "Timestamp (UTC)": log.createdAt.toISOString(),
        Action: log.action,
        Category: log.category,
        Severity: log.severity,
        "Entity Type": log.entityType,
        "Entity ID": log.entityId,
        "Actor Name": sanitizeCsvCell(log.actorNameSnapshot || "System"),
        "Actor Role": log.actorRoleSnapshot || "User",
        Reason: sanitizeCsvCell(log.reason || ""),
        "Changed Fields": log.changedFields.join(", "),
        "Previous Values": sanitizeCsvCell(log.previousValues ? JSON.stringify(log.previousValues) : ""),
        "New Values": sanitizeCsvCell(log.newValues ? JSON.stringify(log.newValues) : ""),
        "Correlation ID": log.correlationId || "",
        "Request ID": log.requestId || "",
        "Event Hash (SHA-256)": log.eventHash || "",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataRows);
      XLSX.utils.book_append_sheet(wb, ws, "Audit Trail");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Default CSV generation with UTF-8 BOM
    const headers = [
      "Timestamp (UTC)",
      "Action",
      "Category",
      "Severity",
      "Entity Type",
      "Entity ID",
      "Actor Name",
      "Actor Role",
      "Reason",
      "Changed Fields",
      "Previous Values",
      "New Values",
      "Correlation ID",
      "Request ID",
      "Event Hash",
    ];

    const csvLines = [headers.map(escapeCsvField).join(",")];

    for (const log of items) {
      const line = [
        escapeCsvField(log.createdAt.toISOString()),
        escapeCsvField(log.action),
        escapeCsvField(log.category),
        escapeCsvField(log.severity),
        escapeCsvField(log.entityType),
        escapeCsvField(log.entityId),
        escapeCsvField(log.actorNameSnapshot || "System"),
        escapeCsvField(log.actorRoleSnapshot || "User"),
        escapeCsvField(log.reason || ""),
        escapeCsvField(log.changedFields.join(", ")),
        escapeCsvField(log.previousValues ? JSON.stringify(log.previousValues) : ""),
        escapeCsvField(log.newValues ? JSON.stringify(log.newValues) : ""),
        escapeCsvField(log.correlationId || ""),
        escapeCsvField(log.requestId || ""),
        escapeCsvField(log.eventHash || ""),
      ];
      csvLines.push(line.join(","));
    }

    const utf8Bom = "\uFEFF";
    const csvContent = utf8Bom + csvLines.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
