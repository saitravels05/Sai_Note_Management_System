"use server";

import { requirePermission } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  ImporterService,
  TargetRecordType,
  WorkbookAnalysisResult,
  AccountingImpactPreview,
} from "@/server/services/importer.service";
import { prisma } from "@/lib/db";
import { ImportRowStatus, ImportStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StagedBatchSummary {
  batchId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
}

export interface CommitResultSummary {
  success: boolean;
  batchId: string;
  createdTransactions: number;
  createdCustomers: number;
  createdSuppliers: number;
  createdCategories: number;
  importMode: string;
  reconciliation: unknown;
}

/**
 * 1. Analyze spreadsheet on file upload.
 */
export async function analyzeSpreadsheetAction(
  formData: FormData
): Promise<ActionResult<WorkbookAnalysisResult>> {
  try {
    await requirePermission(PERMISSIONS.IMPORTS_EXECUTE);

    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "Please select an Excel or CSV file to upload." };
    }

    const sheetOverride = (formData.get("sheetName") as string) || undefined;
    const headerRowStr = formData.get("headerRowIndex") as string;
    const headerRowOverride = headerRowStr ? parseInt(headerRowStr, 10) : undefined;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    ImporterService.validateFile(buffer, file.name);
    const analysis = ImporterService.analyzeWorkbook(
      buffer,
      file.name,
      sheetOverride,
      headerRowOverride
    );

    return { success: true, data: analysis };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to analyze spreadsheet.";
    return { success: false, error: msg };
  }
}

/**
 * 2. Stage Import Batch and validate all candidate rows.
 */
export async function stageImportBatchAction(input: {
  fileName: string;
  fileBase64: string;
  sheetName: string;
  headerRowIndex: number;
  targetType: TargetRecordType;
  columnMappings: Record<string, string>;
  importMode?: "DRAFT" | "POSTED";
  templateName?: string;
}): Promise<ActionResult<StagedBatchSummary>> {
  try {
    const user = await requirePermission(PERMISSIONS.IMPORTS_EXECUTE);

    const fileBuffer = Buffer.from(input.fileBase64, "base64");

    const batch = await ImporterService.stageImportBatch(
      {
        fileBuffer,
        fileName: input.fileName,
        sheetName: input.sheetName,
        headerRowIndex: input.headerRowIndex,
        targetType: input.targetType,
        columnMappings: input.columnMappings,
        importMode: input.importMode || "DRAFT",
        templateName: input.templateName,
      },
      {
        userId: user.id,
        businessId: user.businessId,
        userRoles: user.roles,
        permissions: user.permissions,
      }
    );

    revalidatePath("/imports");
    return {
      success: true,
      data: {
        batchId: batch.id,
        totalRows: batch.totalRows,
        validRows: batch.validRows,
        errorRows: batch.errorRows,
        duplicateRows: batch.duplicateRows,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to stage import batch.";
    return { success: false, error: msg };
  }
}

/**
 * 3. Retrieve import batch details and paginated rows.
 */
export async function getImportBatchAction(
  batchId: string,
  options?: { statusFilter?: ImportRowStatus; page?: number; pageSize?: number }
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const user = await requirePermission(PERMISSIONS.IMPORTS_VIEW);

    const result = await ImporterService.getImportBatch(batchId, user.businessId, options);
    return { success: true, data: result as unknown as Record<string, unknown> };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve import batch.";
    return { success: false, error: msg };
  }
}

/**
 * 4. Inline row correction or status update.
 */
export async function updateImportRowAction(
  rowId: string,
  input: {
    action: "UPDATE_DATA" | "EXCLUDE" | "RESTORE" | "OVERRIDE_DUPLICATE";
    normalizedDataUpdates?: Record<string, unknown>;
  }
): Promise<ActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.IMPORTS_EXECUTE);

    await ImporterService.updateImportRow(
      rowId,
      input,
      {
        userId: user.id,
        businessId: user.businessId,
        userRoles: user.roles,
        permissions: user.permissions,
      }
    );

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update row.";
    return { success: false, error: msg };
  }
}

/**
 * 5. Calculate expected accounting impact before commit.
 */
export async function calculateAccountingImpactAction(
  batchId: string
): Promise<ActionResult<AccountingImpactPreview>> {
  try {
    const user = await requirePermission(PERMISSIONS.IMPORTS_VIEW);

    const preview = await ImporterService.calculateAccountingImpact(batchId, user.businessId);
    return { success: true, data: preview };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to calculate accounting impact.";
    return { success: false, error: msg };
  }
}

/**
 * 6. Commit staged import batch to database.
 */
export async function commitImportBatchAction(
  batchId: string,
  options: {
    importMode: "DRAFT" | "POSTED";
    allowDuplicates?: boolean;
  }
): Promise<ActionResult<CommitResultSummary>> {
  try {
    const user = await requirePermission(PERMISSIONS.IMPORTS_EXECUTE);

    const result = await ImporterService.commitImportBatch(
      batchId,
      options,
      {
        userId: user.id,
        businessId: user.businessId,
        userRoles: user.roles,
        permissions: user.permissions,
      }
    );

    revalidatePath("/imports");
    revalidatePath("/records");
    revalidatePath("/dashboard");
    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to commit import batch.";
    return { success: false, error: msg };
  }
}

/**
 * 7. Rollback an imported batch safely.
 */
export async function rollbackImportBatchAction(
  batchId: string,
  reason: string
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const user = await requirePermission(PERMISSIONS.IMPORTS_ROLLBACK);

    const result = await ImporterService.rollbackImportBatch(
      batchId,
      reason,
      {
        userId: user.id,
        businessId: user.businessId,
        userRoles: user.roles,
        permissions: user.permissions,
      }
    );

    revalidatePath("/imports");
    revalidatePath("/records");
    revalidatePath("/dashboard");
    return { success: true, data: result as Record<string, unknown> };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to rollback import batch.";
    return { success: false, error: msg };
  }
}

/**
 * 8. Retrieve saved mapping templates.
 */
export async function getMappingTemplatesAction(): Promise<ActionResult<Record<string, unknown>[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.IMPORTS_VIEW);
    const templates = await ImporterService.getMappingTemplates(user.businessId);
    return { success: true, data: templates };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load templates.";
    return { success: false, error: msg };
  }
}

/**
 * 9. Save mapping template.
 */
export async function saveMappingTemplateAction(input: {
  name: string;
  targetType: TargetRecordType;
  columnMappings: Record<string, string>;
}): Promise<ActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.IMPORTS_MANAGE_TEMPLATES);

    await ImporterService.saveMappingTemplate(
      input,
      {
        userId: user.id,
        businessId: user.businessId,
        userRoles: user.roles,
        permissions: user.permissions,
      }
    );

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save mapping template.";
    return { success: false, error: msg };
  }
}

/**
 * 10. Fetch import history for this business.
 */
export async function getImportHistoryAction(options?: {
  status?: ImportStatus;
  limit?: number;
}): Promise<ActionResult<Record<string, unknown>[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.IMPORTS_VIEW);

    const batches = await prisma.importBatch.findMany({
      where: {
        businessId: user.businessId,
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit || 50,
      include: {
        _count: {
          select: { rows: true, transactions: true },
        },
      },
    });

    return { success: true, data: batches as unknown as Record<string, unknown>[] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load import history.";
    return { success: false, error: msg };
  }
}
