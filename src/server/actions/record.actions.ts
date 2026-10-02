"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser, requirePermission } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { RecordService } from "@/server/services/record.service";
import { SystemMaintenanceService } from "@/server/services/system-maintenance.service";
import {
  TransactionType,
  TransactionStatus,
  PaymentStatus,
} from "@prisma/client";

export interface RecordActionResult {
  success: boolean;
  recordId?: string;
  error?: string;
  message?: string;
  actionType?: "save" | "save_and_add_another" | "save_draft";
}

/**
 * Server Action: Save, Post, or Draft a Financial Record
 */
export async function saveRecordAction(
  _prevState: RecordActionResult | null,
  formData: FormData
): Promise<RecordActionResult> {
  try {
    const user = await requireCurrentUser();
    await SystemMaintenanceService.assertCanWrite(user.businessId);

    const id = formData.get("id")?.toString().trim();
    const isEdit = Boolean(id);

    // Permission checks
    if (isEdit) {
      await requirePermission(PERMISSIONS.RECORDS_EDIT);
    } else {
      await requirePermission(PERMISSIONS.RECORDS_CREATE);
    }

    const typeStr = formData.get("transactionType")?.toString() || TransactionType.EXPENSE;
    const transactionType = typeStr as TransactionType;

    const actionType = (formData.get("actionType")?.toString() as "save" | "save_and_add_another" | "save_draft") || "save";
    const status = actionType === "save_draft" ? TransactionStatus.DRAFT : TransactionStatus.POSTED;

    const transactionDateStr = formData.get("transactionDate")?.toString();
    const transactionDate = transactionDateStr ? new Date(transactionDateStr) : new Date();

    const dueDateStr = formData.get("dueDate")?.toString();
    const dueDate = dueDateStr ? new Date(dueDateStr) : null;

    const rawTags = formData.get("tags")?.toString() || "";
    const tags = rawTags
      ? rawTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const inputData = {
      transactionType,
      transactionDate,
      title: formData.get("title")?.toString().trim() || "Untitled Record",
      categoryId: formData.get("categoryId")?.toString() || "",
      amount: formData.get("amount")?.toString() || "0",
      customerId: formData.get("customerId")?.toString().trim() || null,
      supplierId: formData.get("supplierId")?.toString().trim() || null,
      paymentStatus: (formData.get("paymentStatus")?.toString() as PaymentStatus) || PaymentStatus.UNPAID,
      status,
      referenceNumber: formData.get("referenceNumber")?.toString().trim() || null,
      description: formData.get("description")?.toString().trim() || null,
      dueDate,
      notes: formData.get("notes")?.toString().trim() || null,
      tags,
    };

    const recordCtx = {
      userId: user.id,
      businessId: user.businessId,
      userRoles: user.roles,
      permissions: user.permissions,
    };

    let record;
    if (isEdit && id) {
      record = await RecordService.updateRecord(
        id,
        {
          ...inputData,
          editReason: formData.get("editReason")?.toString() || "Record edited",
        },
        recordCtx
      );
    } else {
      record = await RecordService.createRecord(inputData, recordCtx);
    }

    revalidatePath("/records");
    revalidatePath("/dashboard");
    revalidatePath("/");

    return {
      success: true,
      recordId: record.id,
      actionType,
      message: status === TransactionStatus.DRAFT ? "Draft saved successfully" : "Record posted to ledger",
    };
  } catch (error) {
    console.error("Save record error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save record",
    };
  }
}

/**
 * Server Action: Void a Posted Transaction with Mandatory Reason
 */
export async function voidRecordAction(
  _prevState: RecordActionResult | null,
  formData: FormData
): Promise<RecordActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.RECORDS_VOID);
    await SystemMaintenanceService.assertCanWrite(user.businessId);

    const id = formData.get("id")?.toString().trim();
    const reason = formData.get("reason")?.toString().trim();

    if (!id) {
      return { success: false, error: "Record ID is required" };
    }
    if (!reason || reason.length < 3) {
      return { success: false, error: "A valid reason (minimum 3 characters) is required to void this record" };
    }

    const recordCtx = {
      userId: user.id,
      businessId: user.businessId,
      userRoles: user.roles,
      permissions: user.permissions,
    };

    await RecordService.voidRecord(id, reason, recordCtx);

    revalidatePath("/records");
    revalidatePath(`/records/${id}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Transaction successfully voided. Audit log recorded.",
    };
  } catch (error) {
    console.error("Void record error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to void record",
    };
  }
}

/**
 * Server Action: Delete a DRAFT record
 */
export async function deleteDraftAction(
  _prevState: RecordActionResult | null,
  formData: FormData
): Promise<RecordActionResult> {
  try {
    const user = await requirePermission(PERMISSIONS.RECORDS_EDIT);
    await SystemMaintenanceService.assertCanWrite(user.businessId);
    const id = formData.get("id")?.toString().trim();

    if (!id) {
      return { success: false, error: "Record ID is required" };
    }

    const recordCtx = {
      userId: user.id,
      businessId: user.businessId,
      userRoles: user.roles,
      permissions: user.permissions,
    };

    await RecordService.deleteDraft(id, recordCtx);

    revalidatePath("/records");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Draft record deleted",
    };
  } catch (error) {
    console.error("Delete draft error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete draft",
    };
  }
}

/**
 * Server Action: Pre-flight Duplicate Check
 */
export async function checkDuplicateAction(params: {
  amount: number | string;
  transactionDate: string;
  referenceNumber?: string;
  customerId?: string;
  supplierId?: string;
  excludeId?: string;
}) {
  try {
    const user = await requireCurrentUser();
    const date = new Date(params.transactionDate);

    return await RecordService.checkDuplicate(user.businessId, {
      amount: params.amount,
      transactionDate: date,
      referenceNumber: params.referenceNumber,
      customerId: params.customerId,
      supplierId: params.supplierId,
      excludeId: params.excludeId,
    });
  } catch (error) {
    console.error("Duplicate check error:", error);
    return { isPossibleDuplicate: false, matches: [] };
  }
}
