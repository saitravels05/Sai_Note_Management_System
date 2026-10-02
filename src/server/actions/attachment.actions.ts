"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { AttachmentService } from "@/server/services/attachment.service";
import { AttachmentEntityType } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

export interface AttachmentActionResult {
  success: boolean;
  attachmentId?: string;
  error?: string;
  message?: string;
}

const STORAGE_ROOT = process.env.STORAGE_PATH
  ? path.join(process.env.STORAGE_PATH, "attachments")
  : process.env.VERCEL
  ? path.join("/tmp", "storage", "attachments")
  : path.join(process.cwd(), "storage", "attachments");

/**
 * Securely upload an attachment for an entity (Transaction, Note, Customer, etc.)
 */
export async function uploadAttachmentAction(
  formData: FormData
): Promise<AttachmentActionResult> {
  try {
    const user = await requireCurrentUser();

    const entityTypeStr = formData.get("entityType")?.toString();
    const entityId = formData.get("entityId")?.toString().trim();
    const file = formData.get("file") as File | null;

    if (!entityTypeStr || !entityId) {
      return { success: false, error: "Entity information is required" };
    }

    if (!file || file.size === 0) {
      return { success: false, error: "No file was uploaded" };
    }

    const entityType = entityTypeStr as AttachmentEntityType;

    // 1. Record metadata via AttachmentService
    const attachment = await AttachmentService.createAttachment(
      {
        entityType,
        entityId,
        fileName: file.name,
        originalFileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      },
      {
        businessId: user.businessId,
        userId: user.id,
      }
    );

    // 2. Persist file contents in isolated local storage path
    const targetFilePath = path.join(STORAGE_ROOT, attachment.storageKey);
    await fs.mkdir(path.dirname(targetFilePath), { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(targetFilePath, buffer);

    if (entityType === "TRANSACTION") {
      revalidatePath(`/records/${entityId}`);
      revalidatePath("/records");
    } else if (entityType === "NOTE") {
      revalidatePath("/notes");
    }

    return {
      success: true,
      attachmentId: attachment.id,
      message: `File "${file.name}" uploaded successfully`,
    };
  } catch (error) {
    console.error("Upload attachment error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload file",
    };
  }
}

/**
 * Remove an attachment
 */
export async function deleteAttachmentAction(id: string): Promise<AttachmentActionResult> {
  try {
    const user = await requireCurrentUser();

    const existing = await AttachmentService.getAttachment(id, user.businessId);
    await AttachmentService.deleteAttachment(id, {
      businessId: user.businessId,
      userId: user.id,
    });

    // Remove file from disk
    const targetFilePath = path.join(STORAGE_ROOT, existing.storageKey);
    try {
      await fs.unlink(targetFilePath);
    } catch {
      // File may have already been cleaned up or not present
    }

    if (existing.entityType === "TRANSACTION") {
      revalidatePath(`/records/${existing.entityId}`);
      revalidatePath("/records");
    } else if (existing.entityType === "NOTE") {
      revalidatePath("/notes");
    }

    return {
      success: true,
      message: "Attachment removed",
    };
  } catch (error) {
    console.error("Delete attachment error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove attachment",
    };
  }
}
