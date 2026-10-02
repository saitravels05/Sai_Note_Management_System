"use server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { CustomReportService } from "../services/reporting/custom-report.service";
import { AIReportPlannerService } from "../services/reporting/ai-report-planner.service";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";

export async function previewCustomReportAction(definition: unknown) {
  try {
    const user = await requireCurrentUser();
    const canView =
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_BUILDER_VIEW) ||
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_VIEW);

    if (!canView) {
      return { success: false as const, error: "Permission denied: reports.builder.view required." };
    }

    const result = await CustomReportService.previewReport(
      user.businessId,
      definition,
      user.permissions,
      user.roles
    );

    return { success: true as const, data: result };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to execute action." };
  }
}

export async function getDrillDownAction(
  definition: unknown,
  groupField: string,
  groupValue: string
) {
  try {
    const user = await requireCurrentUser();
    const result = await CustomReportService.getDrillDown(
      user.businessId,
      definition,
      groupField,
      groupValue,
      user.permissions,
      user.roles
    );

    return { success: true as const, data: result };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch drill-down records." };
  }
}

export async function saveCustomReportAction(
  definition: unknown,
  options?: { visibility?: "PRIVATE" | "SHARED" | "RESTRICTED"; allowedRoles?: string[]; tags?: string[] }
) {
  try {
    const user = await requireCurrentUser();
    const canCreate =
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_BUILDER_CREATE) ||
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_VIEW);

    if (!canCreate) {
      return { success: false as const, error: "Permission denied: reports.builder.create required." };
    }

    const saved = await CustomReportService.saveReport(
      user.businessId,
      user.id,
      definition,
      user.permissions,
      user.roles,
      options
    );

    revalidatePath("/reports");
    revalidatePath("/reports/builder");

    return { success: true as const, data: saved };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to save custom report." };
  }
}

export async function updateCustomReportAction(
  reportId: string,
  definition: unknown,
  changeNote?: string
) {
  try {
    const user = await requireCurrentUser();
    const canEdit =
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_BUILDER_EDIT) ||
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_VIEW);

    if (!canEdit) {
      return { success: false as const, error: "Permission denied: reports.builder.edit required." };
    }

    const updated = await CustomReportService.updateReport(
      user.businessId,
      user.id,
      reportId,
      definition,
      user.permissions,
      user.roles,
      changeNote
    );

    revalidatePath("/reports");
    revalidatePath("/reports/builder");

    return { success: true as const, data: updated };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to update custom report." };
  }
}

export async function duplicateCustomReportAction(reportId: string) {
  try {
    const user = await requireCurrentUser();
    const canCreate =
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_BUILDER_CREATE) ||
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_VIEW);

    if (!canCreate) {
      return { success: false as const, error: "Permission denied: reports.builder.create required." };
    }

    const duplicated = await CustomReportService.duplicateReport(user.businessId, user.id, reportId);

    revalidatePath("/reports");
    revalidatePath("/reports/builder");

    return { success: true as const, data: duplicated };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to duplicate report." };
  }
}

export async function archiveCustomReportAction(reportId: string) {
  try {
    const user = await requireCurrentUser();
    await CustomReportService.archiveReport(user.businessId, user.id, reportId);

    revalidatePath("/reports");
    revalidatePath("/reports/builder");

    return { success: true as const };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to archive report." };
  }
}

export async function deleteCustomReportAction(reportId: string) {
  try {
    const user = await requireCurrentUser();
    const canDelete =
      hasPermission(user.permissions, user.roles, PERMISSIONS.REPORTS_BUILDER_DELETE) ||
      user.roles.includes("OWNER") ||
      user.roles.includes("ADMIN");

    if (!canDelete) {
      return { success: false as const, error: "Permission denied: reports.builder.delete required." };
    }

    await CustomReportService.deleteSavedReport(user.businessId, user.id, reportId);

    revalidatePath("/reports");
    revalidatePath("/reports/builder");

    return { success: true as const };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to delete report." };
  }
}

export async function proposeAiReportAction(prompt: string) {
  try {
    const user = await requireCurrentUser();
    const proposal = AIReportPlannerService.proposeReportDefinition(
      prompt,
      user.permissions,
      user.roles
    );

    return { success: true as const, data: proposal };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to parse report intent." };
  }
}

export async function listSavedReportsAction() {
  try {
    const user = await requireCurrentUser();
    const reports = await CustomReportService.listSavedReports(
      user.businessId,
      user.id,
      user.roles
    );
    return { success: true as const, data: reports };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to list saved reports." };
  }
}

export async function getTemplatesAction() {
  try {
    const templates = CustomReportService.getTemplates();
    return { success: true as const, data: templates };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to get templates." };
  }
}
