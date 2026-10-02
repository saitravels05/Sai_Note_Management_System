"use server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { revalidatePath } from "next/cache";
import { DocumentService, DocumentFilterOptions, DocumentUserContext } from "../services/document/document.service";
import { FileSecurityService } from "../services/document/file-security.service";
import { DocumentCategory, DocumentSensitivity, DocumentEntityType } from "@prisma/client";

function buildContext(user: Awaited<ReturnType<typeof requireCurrentUser>>): DocumentUserContext {
  return {
    userId: user.id,
    businessId: user.businessId,
    userRoles: user.roleTypes,
    userPermissions: user.permissions,
  };
}

export async function uploadDocumentAction(formData: FormData) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false as const, error: "No file provided for upload." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = file.name || "unnamed_document.bin";
    const declaredMimeType = file.type || undefined;
    const displayName = (formData.get("displayName") as string) || undefined;
    const categoryStr = formData.get("category") as string;
    const sensitivityStr = formData.get("sensitivity") as string;
    const description = (formData.get("description") as string) || undefined;
    const tagsJson = formData.get("tags") as string;
    const expiryDateStr = formData.get("expiryDate") as string;
    const linksJson = formData.get("links") as string;
    const allowDuplicate = formData.get("allowDuplicate") === "true";

    const category = categoryStr ? (categoryStr as DocumentCategory) : DocumentCategory.GENERAL;
    const sensitivity = sensitivityStr ? (sensitivityStr as DocumentSensitivity) : DocumentSensitivity.NORMAL;

    let tags: string[] = [];
    if (tagsJson) {
      try {
        tags = JSON.parse(tagsJson);
      } catch {
        tags = tagsJson.split(",").map((t) => t.trim()).filter(Boolean);
      }
    }

    let links: Array<{ entityType: DocumentEntityType; entityId: string }> | undefined;
    if (linksJson) {
      try {
        links = JSON.parse(linksJson);
      } catch {
        links = undefined;
      }
    }

    const doc = await DocumentService.uploadDocument(
      {
        fileName,
        buffer,
        declaredMimeType,
        displayName,
        category,
        sensitivity,
        description,
        tags,
        expiryDate: expiryDateStr ? new Date(expiryDateStr) : null,
        links,
        allowDuplicate,
      },
      ctx
    );

    revalidatePath("/documents");
    if (links) {
      for (const l of links) {
        if (l.entityType === DocumentEntityType.CUSTOMER) revalidatePath(`/customers/${l.entityId}`);
        if (l.entityType === DocumentEntityType.SUPPLIER) revalidatePath(`/suppliers/${l.entityId}`);
        if (l.entityType === DocumentEntityType.TRANSACTION) revalidatePath(`/records`);
      }
    }

    return { success: true as const, document: doc };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Document upload failed.";
    return { success: false as const, error: msg };
  }
}

export async function createDocumentVersionAction(formData: FormData) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    const file = formData.get("file") as File | null;
    const parentDocumentId = formData.get("parentDocumentId") as string;
    const changeNote = (formData.get("changeNote") as string) || undefined;

    if (!file || !parentDocumentId) {
      return { success: false as const, error: "Missing required file or parent document ID." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const newVersion = await DocumentService.createVersion(
      {
        parentDocumentId,
        fileName: file.name,
        buffer,
        declaredMimeType: file.type || undefined,
        changeNote,
      },
      ctx
    );

    revalidatePath("/documents");
    revalidatePath(`/documents/${parentDocumentId}`);
    return { success: true as const, document: newVersion };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Version creation failed.";
    return { success: false as const, error: msg };
  }
}

export async function updateDocumentMetadataAction(
  id: string,
  updates: {
    displayName?: string;
    category?: DocumentCategory;
    description?: string;
    tags?: string[];
    expiryDate?: string | null;
    sensitivity?: DocumentSensitivity;
  }
) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    const updated = await DocumentService.updateMetadata(id, updates, ctx);
    revalidatePath("/documents");
    revalidatePath(`/documents/${id}`);
    return { success: true as const, document: updated };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update metadata failed.";
    return { success: false as const, error: msg };
  }
}

export async function linkDocumentAction(
  documentId: string,
  entityType: DocumentEntityType,
  entityId: string
) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    const link = await DocumentService.linkDocument(documentId, entityType, entityId, ctx);
    revalidatePath("/documents");
    revalidatePath(`/documents/${documentId}`);
    return { success: true as const, link };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to link document.";
    return { success: false as const, error: msg };
  }
}

export async function unlinkDocumentAction(
  documentId: string,
  entityType: DocumentEntityType,
  entityId: string
) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    await DocumentService.unlinkDocument(documentId, entityType, entityId, ctx);
    revalidatePath("/documents");
    revalidatePath(`/documents/${documentId}`);
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to unlink document.";
    return { success: false as const, error: msg };
  }
}

export async function archiveDocumentAction(id: string) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    const archived = await DocumentService.archiveDocument(id, ctx);
    revalidatePath("/documents");
    return { success: true as const, document: archived };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Archive failed.";
    return { success: false as const, error: msg };
  }
}

export async function restoreDocumentAction(id: string) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    const restored = await DocumentService.restoreDocument(id, ctx);
    revalidatePath("/documents");
    return { success: true as const, document: restored };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Restore failed.";
    return { success: false as const, error: msg };
  }
}

export async function deleteDocumentAction(id: string) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    await DocumentService.deleteDocument(id, ctx);
    revalidatePath("/documents");
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Delete failed.";
    return { success: false as const, error: msg };
  }
}

export async function requestDocumentDownloadAction(id: string) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    const result = await DocumentService.requestDownloadToken(id, ctx);
    return { success: true as const, ...result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Download request failed.";
    return { success: false as const, error: msg };
  }
}

export async function checkDuplicateDocumentAction(checksum: string) {
  try {
    const user = await requireCurrentUser();
    const result = await DocumentService.checkForDuplicate(checksum, user.businessId);
    return { success: true as const, ...result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Duplicate check failed.";
    return { success: false as const, error: msg };
  }
}

export async function getSpreadsheetPreviewAction(id: string, sheetIndex = 0) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    const preview = await DocumentService.getSpreadsheetPreview(id, ctx, sheetIndex);
    return { success: true as const, preview };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Spreadsheet preview failed.";
    return { success: false as const, error: msg };
  }
}

export async function getScannerStatusAction() {
  try {
    await requireCurrentUser();
    const status = FileSecurityService.getScannerCapability();
    return { success: true as const, status };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to get scanner status.";
    return { success: false as const, error: msg };
  }
}

export async function getDocumentsAction(filters: DocumentFilterOptions) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    const result = await DocumentService.searchDocuments(filters, ctx);
    return { success: true as const, ...result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load documents.";
    return { success: false as const, error: msg };
  }
}

export async function getDocumentDetailAction(id: string) {
  try {
    const user = await requireCurrentUser();
    const ctx = buildContext(user);

    const doc = await DocumentService.getDocument(id, ctx);
    return { success: true as const, document: doc };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load document details.";
    return { success: false as const, error: msg };
  }
}
