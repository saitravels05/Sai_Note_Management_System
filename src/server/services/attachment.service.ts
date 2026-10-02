import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { AuditService } from "./audit.service";
import { AttachmentEntityType, AuditAction } from "@prisma/client";
import crypto from "crypto";

export interface AttachmentContext {
  userId: string;
  businessId: string;
}

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export class AttachmentService {
  /**
   * Validate and record an attachment metadata.
   */
  public static async createAttachment(
    input: {
      entityType: AttachmentEntityType;
      entityId: string;
      fileName: string;
      originalFileName: string;
      mimeType: string;
      fileSize: number;
    },
    ctx: AttachmentContext
  ) {
    const { businessId, userId } = ctx;

    // 1. File size validation
    if (input.fileSize > MAX_FILE_SIZE) {
      throw new AppError("File size exceeds maximum allowed limit of 10MB.", 400);
    }

    if (input.fileSize <= 0) {
      throw new AppError("File cannot be empty.", 400);
    }

    // 2. MIME type validation
    if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
      throw new AppError(
        "File type not supported. Allowed formats: PDF, JPEG, PNG, Excel (.xlsx, .xls), and CSV.",
        400
      );
    }

    // 3. Generate secure unguessable storage key
    const ext = input.fileName.split(".").pop() || "bin";
    const storageKey = `${businessId}/${input.entityType.toLowerCase()}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

    const attachment = await prisma.attachment.create({
      data: {
        businessId,
        entityType: input.entityType,
        entityId: input.entityId,
        fileName: input.fileName,
        originalFileName: input.originalFileName,
        storageKey,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        uploadedById: userId,
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CREATE,
      entityType: "ATTACHMENT",
      entityId: attachment.id,
      newValues: {
        fileName: attachment.originalFileName,
        entityType: attachment.entityType,
        entityId: attachment.entityId,
        fileSize: attachment.fileSize,
      },
      reason: "Document attachment uploaded",
    });

    return attachment;
  }

  /**
   * Retrieve attachment metadata with multi-tenant boundary check.
   */
  public static async getAttachment(id: string, businessId: string) {
    const attachment = await prisma.attachment.findFirst({
      where: { id, businessId },
    });

    if (!attachment) {
      throw new NotFoundError("Attachment not found or you do not have permission to access it.");
    }

    return attachment;
  }

  /**
   * Delete an attachment.
   */
  public static async deleteAttachment(id: string, ctx: AttachmentContext) {
    const { businessId, userId } = ctx;

    const existing = await prisma.attachment.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundError("Attachment not found.");
    }

    await prisma.attachment.delete({
      where: { id: existing.id },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.VOID,
      entityType: "ATTACHMENT",
      entityId: id,
      previousValues: { fileName: existing.originalFileName },
      reason: "Document attachment removed",
    });

    return { success: true };
  }

  /**
   * Get all attachments for a specific entity.
   */
  public static async getEntityAttachments(
    entityType: AttachmentEntityType,
    entityId: string,
    businessId: string
  ) {
    return prisma.attachment.findMany({
      where: {
        businessId,
        entityType,
        entityId,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
