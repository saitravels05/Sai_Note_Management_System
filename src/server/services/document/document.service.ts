import { prisma } from "@/lib/db";
import { AppError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { AuditService } from "../audit.service";
import {
  AuditAction,
  DocumentCategory,
  DocumentStatus,
  DocumentSensitivity,
  DocumentEntityType,
  AttachmentEntityType,
  FinancialPeriodStatus,
  RoleType,
} from "@prisma/client";
import { FileSecurityService } from "./file-security.service";
import { StorageService } from "./storage.service";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import * as XLSX from "xlsx";

export interface DocumentUserContext {
  userId: string;
  businessId: string;
  userRoles: RoleType[] | string[];
  userPermissions: string[];
}

export interface UploadDocumentInput {
  fileName: string;
  buffer: Buffer;
  declaredMimeType?: string;
  displayName?: string;
  category?: DocumentCategory;
  sensitivity?: DocumentSensitivity;
  description?: string;
  tags?: string[];
  expiryDate?: Date | string | null;
  links?: Array<{ entityType: DocumentEntityType; entityId: string }>;
  allowDuplicate?: boolean;
}

export interface CreateVersionInput {
  parentDocumentId: string;
  fileName: string;
  buffer: Buffer;
  declaredMimeType?: string;
  changeNote?: string;
}

export interface DocumentFilterOptions {
  category?: DocumentCategory;
  extension?: string;
  status?: DocumentStatus;
  sensitivity?: DocumentSensitivity;
  entityType?: DocumentEntityType;
  entityId?: string;
  search?: string;
  isArchived?: boolean;
  expiringWithinDays?: number;
  hasExpiry?: boolean;
  sortBy?: "newest" | "oldest" | "name" | "largest" | "expiry_soon" | "updated";
  page?: number;
  pageSize?: number;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingDocument?: {
    id: string;
    displayName: string;
    originalFileName: string;
    category: DocumentCategory;
    status: DocumentStatus;
    fileSize: number;
    createdAt: Date;
    versionNumber: number;
  };
}

export interface SafeSpreadsheetPreview {
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: Record<string, string | number | null>[];
  totalRows: number;
  totalColumns: number;
  isTruncated: boolean;
}

export class DocumentService {
  /**
   * Check if user is authorized to view a specific document based on:
   * 1. Tenant boundary (businessId)
   * 2. General document view permission
   * 3. Sensitivity flag (SENSITIVE / RESTRICTED requires documents.view_sensitive)
   * 4. Entity Permission Intersection (user must have permissions for all linked entities)
   */
  public static verifyDocumentViewAccess(
    document: {
      businessId: string;
      sensitivity: DocumentSensitivity;
      status: DocumentStatus;
      documentLinks?: Array<{ entityType: DocumentEntityType; entityId: string }>;
      entityType?: AttachmentEntityType;
    },
    ctx: DocumentUserContext
  ): void {
    const { businessId, userRoles, userPermissions } = ctx;

    // 1. Business boundary
    if (document.businessId !== businessId) {
      throw new UnauthorizedError("Cross-tenant document access denied.");
    }

    // 2. Base Document View permission
    if (!hasPermission(userPermissions, userRoles, PERMISSIONS.DOCUMENTS_VIEW)) {
      throw new UnauthorizedError("You lack permission to view documents.");
    }

    // 3. Sensitivity check
    if (
      document.sensitivity === DocumentSensitivity.SENSITIVE ||
      document.sensitivity === DocumentSensitivity.RESTRICTED
    ) {
      if (!hasPermission(userPermissions, userRoles, PERMISSIONS.DOCUMENTS_VIEW_SENSITIVE)) {
        throw new UnauthorizedError("Access denied: You lack permission to view sensitive documents.");
      }
    }

    // 4. Entity Permission Intersection
    const links = document.documentLinks || [];
    for (const link of links) {
      this.verifyEntityPermission(link.entityType, userRoles, userPermissions);
    }

    if (document.entityType && document.entityType !== AttachmentEntityType.GENERAL) {
      this.verifyAttachmentEntityPermission(document.entityType, userRoles, userPermissions);
    }
  }

  private static verifyEntityPermission(
    entityType: DocumentEntityType,
    userRoles: RoleType[] | string[],
    userPermissions: string[]
  ): void {
    switch (entityType) {
      case DocumentEntityType.CUSTOMER:
        if (!hasPermission(userPermissions, userRoles, PERMISSIONS.CUSTOMERS_VIEW)) {
          throw new UnauthorizedError("Access denied: You lack permission to view customer documents.");
        }
        break;
      case DocumentEntityType.SUPPLIER:
        if (!hasPermission(userPermissions, userRoles, PERMISSIONS.SUPPLIERS_VIEW)) {
          throw new UnauthorizedError("Access denied: You lack permission to view supplier documents.");
        }
        break;
      case DocumentEntityType.TRANSACTION:
        if (!hasPermission(userPermissions, userRoles, PERMISSIONS.RECORDS_VIEW)) {
          throw new UnauthorizedError("Access denied: You lack permission to view transaction documents.");
        }
        break;
      case DocumentEntityType.PAYMENT:
        if (!hasPermission(userPermissions, userRoles, PERMISSIONS.PAYMENTS_VIEW)) {
          throw new UnauthorizedError("Access denied: You lack permission to view payment documents.");
        }
        break;
      case DocumentEntityType.RECEIVABLE:
        if (!hasPermission(userPermissions, userRoles, PERMISSIONS.RECEIVABLES_VIEW)) {
          throw new UnauthorizedError("Access denied: You lack permission to view receivable documents.");
        }
        break;
      case DocumentEntityType.PAYABLE:
        if (!hasPermission(userPermissions, userRoles, PERMISSIONS.PAYABLES_VIEW)) {
          throw new UnauthorizedError("Access denied: You lack permission to view payable documents.");
        }
        break;
      case DocumentEntityType.FOLLOWUP:
        if (!hasPermission(userPermissions, userRoles, PERMISSIONS.FOLLOWUPS_VIEW)) {
          throw new UnauthorizedError("Access denied: You lack permission to view follow-up documents.");
        }
        break;
      case DocumentEntityType.NOTE:
        if (!hasPermission(userPermissions, userRoles, PERMISSIONS.NOTES_VIEW)) {
          throw new UnauthorizedError("Access denied: You lack permission to view note documents.");
        }
        break;
      case DocumentEntityType.IMPORT:
        if (!hasPermission(userPermissions, userRoles, PERMISSIONS.IMPORTS_VIEW)) {
          throw new UnauthorizedError("Access denied: You lack permission to view import documents.");
        }
        break;
      case DocumentEntityType.REPORT:
        if (!hasPermission(userPermissions, userRoles, PERMISSIONS.REPORTS_VIEW)) {
          throw new UnauthorizedError("Access denied: You lack permission to view report documents.");
        }
        break;
      case DocumentEntityType.MONTH_END_CLOSING:
        if (!hasPermission(userPermissions, userRoles, PERMISSIONS.MONTH_END_VIEW)) {
          throw new UnauthorizedError("Access denied: You lack permission to view month-end closing documents.");
        }
        break;
      default:
        break;
    }
  }

  private static verifyAttachmentEntityPermission(
    entityType: AttachmentEntityType,
    userRoles: RoleType[] | string[],
    userPermissions: string[]
  ): void {
    if (entityType === AttachmentEntityType.CUSTOMER) {
      if (!hasPermission(userPermissions, userRoles, PERMISSIONS.CUSTOMERS_VIEW)) {
        throw new UnauthorizedError("Access denied to customer document.");
      }
    } else if (entityType === AttachmentEntityType.SUPPLIER) {
      if (!hasPermission(userPermissions, userRoles, PERMISSIONS.SUPPLIERS_VIEW)) {
        throw new UnauthorizedError("Access denied to supplier document.");
      }
    } else if (entityType === AttachmentEntityType.TRANSACTION) {
      if (!hasPermission(userPermissions, userRoles, PERMISSIONS.RECORDS_VIEW)) {
        throw new UnauthorizedError("Access denied to transaction document.");
      }
    }
  }

  /**
   * Check for duplicate file within current business vault using cryptographic SHA-256 checksum.
   * Strictly scopes query to ctx.businessId to prevent cross-tenant information leaks.
   */
  public static async checkForDuplicate(
    checksum: string,
    businessId: string
  ): Promise<DuplicateCheckResult> {
    const existing = await prisma.attachment.findFirst({
      where: {
        businessId,
        checksum,
        status: { notIn: [DocumentStatus.REJECTED] },
      },
      select: {
        id: true,
        displayName: true,
        originalFileName: true,
        category: true,
        status: true,
        fileSize: true,
        createdAt: true,
        versionNumber: true,
      },
    });

    if (existing) {
      return {
        isDuplicate: true,
        existingDocument: existing,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Upload and process a new business document.
   */
  public static async uploadDocument(
    input: UploadDocumentInput,
    ctx: DocumentUserContext
  ) {
    const { businessId, userId, userRoles, userPermissions } = ctx;

    // 1. Authorization check
    if (!hasPermission(userPermissions, userRoles, PERMISSIONS.DOCUMENTS_UPLOAD)) {
      throw new UnauthorizedError("You lack permission to upload documents.");
    }

    // 2. Multi-layer validation (extension, magic bytes, ZIP bomb/macro sentry, size)
    const validation = await FileSecurityService.validateUploadedFile(
      input.fileName,
      input.buffer,
      input.declaredMimeType
    );

    // 3. Business-scoped duplicate detection
    const duplicateCheck = await this.checkForDuplicate(validation.checksum, businessId);
    if (duplicateCheck.isDuplicate && !input.allowDuplicate) {
      throw new AppError(
        `This file appears to already exist in your business vault: "${duplicateCheck.existingDocument?.displayName || duplicateCheck.existingDocument?.originalFileName}" (Uploaded ${duplicateCheck.existingDocument?.createdAt.toLocaleDateString()}). Set allowDuplicate to proceed or link the existing document.`,
        409
      );
    }

    // 4. Validate that all linked entities exist and belong to the same business
    if (input.links && input.links.length > 0) {
      for (const link of input.links) {
        await this.validateLinkedEntity(link.entityType, link.entityId, businessId);
      }
    }

    // 5. Generate secure conceptual storage key
    const storageKey = StorageService.generateStorageKey(businessId, validation.extension);

    // 6. Save physical file to private vault
    let storageSaved = false;
    try {
      await StorageService.saveObject(storageKey, input.buffer);
      storageSaved = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Storage engine failure: Unable to write file to private vault (${msg})`, 500);
    }

    // 7. Persist metadata to database
    try {
      const displayName = input.displayName?.trim() || validation.safeFileName;
      const initialStatus = validation.isQuarantined
        ? DocumentStatus.QUARANTINED
        : DocumentStatus.AVAILABLE;

      const expiry = input.expiryDate ? new Date(input.expiryDate) : null;

      const doc = await prisma.attachment.create({
        data: {
          businessId,
          fileName: validation.safeFileName,
          originalFileName: input.fileName,
          safeFileName: validation.safeFileName,
          displayName,
          storageProvider: "LOCAL_VAULT",
          storageKey,
          extension: validation.extension,
          mimeType: validation.detectedMimeType,
          declaredMimeType: validation.declaredMimeType,
          detectedMimeType: validation.detectedMimeType,
          fileSize: validation.fileSize,
          checksum: validation.checksum,
          category: input.category || DocumentCategory.GENERAL,
          sensitivity: input.sensitivity || DocumentSensitivity.NORMAL,
          status: initialStatus,
          description: input.description,
          expiryDate: expiry,
          versionNumber: 1,
          tags: input.tags || [],
          uploadedById: userId,
          metadata: {
            securityNotes: validation.securityNotes,
            quarantineReason: validation.quarantineReason,
          },
        },
      });

      // 8. Create relational links
      if (input.links && input.links.length > 0) {
        for (const link of input.links) {
          await prisma.documentLink.create({
            data: {
              documentId: doc.id,
              businessId,
              entityType: link.entityType,
              entityId: link.entityId,
              createdBy: userId,
            },
          });
        }
      }

      // 9. Audit event
      await AuditService.log({
        businessId,
        userId,
        action: AuditAction.DOCUMENT_UPLOADED,
        entityType: "DOCUMENT",
        entityId: doc.id,
        newValues: {
          displayName: doc.displayName,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          category: doc.category,
          status: doc.status,
          checksum: doc.checksum,
        },
        reason: "Document uploaded to business vault",
      });

      return doc;
    } catch (dbError) {
      // Clean up orphan file if database persistence fails
      if (storageSaved) {
        await StorageService.deleteObject(storageKey);
      }
      throw dbError;
    }
  }

  /**
   * Upload a new version of an existing document.
   * Preserves previous versions as immutable records linked to parent family.
   */
  public static async createVersion(
    input: CreateVersionInput,
    ctx: DocumentUserContext
  ) {
    const { businessId, userId, userRoles, userPermissions } = ctx;

    if (!hasPermission(userPermissions, userRoles, PERMISSIONS.DOCUMENTS_UPLOAD)) {
      throw new UnauthorizedError("You lack permission to upload document versions.");
    }

    const existing = await prisma.attachment.findFirst({
      where: { id: input.parentDocumentId, businessId },
      include: { documentLinks: true },
    });

    if (!existing) {
      throw new NotFoundError("Original document not found.");
    }

    this.verifyDocumentViewAccess(existing, ctx);

    // Validate new file
    const validation = await FileSecurityService.validateUploadedFile(
      input.fileName,
      input.buffer,
      input.declaredMimeType
    );

    const rootParentId = existing.parentId || existing.id;

    // Get max version number in family atomically
    const latestInFamily = await prisma.attachment.findFirst({
      where: {
        businessId,
        OR: [{ id: rootParentId }, { parentId: rootParentId }],
      },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const nextVersionNumber = (latestInFamily?.versionNumber || 1) + 1;

    // Store new file
    const storageKey = StorageService.generateStorageKey(businessId, validation.extension);
    await StorageService.saveObject(storageKey, input.buffer);

    try {
      const newVersion = await prisma.attachment.create({
        data: {
          businessId,
          fileName: validation.safeFileName,
          originalFileName: input.fileName,
          safeFileName: validation.safeFileName,
          displayName: existing.displayName,
          storageProvider: "LOCAL_VAULT",
          storageKey,
          extension: validation.extension,
          mimeType: validation.detectedMimeType,
          declaredMimeType: validation.declaredMimeType,
          detectedMimeType: validation.detectedMimeType,
          fileSize: validation.fileSize,
          checksum: validation.checksum,
          category: existing.category,
          sensitivity: existing.sensitivity,
          status: DocumentStatus.AVAILABLE,
          description: existing.description,
          expiryDate: existing.expiryDate,
          versionNumber: nextVersionNumber,
          parentId: rootParentId,
          changeNote: input.changeNote,
          tags: existing.tags,
          uploadedById: userId,
        },
      });

      // Copy relational links to new version
      if (existing.documentLinks.length > 0) {
        for (const link of existing.documentLinks) {
          await prisma.documentLink.create({
            data: {
              documentId: newVersion.id,
              businessId,
              entityType: link.entityType,
              entityId: link.entityId,
              createdBy: userId,
            },
          });
        }
      }

      await AuditService.log({
        businessId,
        userId,
        action: AuditAction.DOCUMENT_VERSION_CREATED,
        entityType: "DOCUMENT",
        entityId: newVersion.id,
        newValues: {
          displayName: newVersion.displayName,
          versionNumber: nextVersionNumber,
          parentId: rootParentId,
          changeNote: input.changeNote,
        },
        reason: `New document version ${nextVersionNumber} uploaded`,
      });

      return newVersion;
    } catch (err) {
      await StorageService.deleteObject(storageKey);
      throw err;
    }
  }

  /**
   * Retrieve a single document with full metadata, version history, and links.
   */
  public static async getDocument(id: string, ctx: DocumentUserContext) {
    const { businessId } = ctx;

    const document = await prisma.attachment.findFirst({
      where: { id, businessId },
      include: {
        documentLinks: true,
        parent: {
          select: {
            id: true,
            displayName: true,
            versionNumber: true,
            createdAt: true,
          },
        },
        versions: {
          select: {
            id: true,
            displayName: true,
            versionNumber: true,
            fileSize: true,
            createdAt: true,
            changeNote: true,
            status: true,
          },
          orderBy: { versionNumber: "desc" },
        },
      },
    });

    if (!document) {
      throw new NotFoundError("Document not found in business vault.");
    }

    this.verifyDocumentViewAccess(document, ctx);

    // Compute derived expiry status
    const expiryStatus = this.computeExpiryStatus(document.expiryDate);

    return {
      ...document,
      expiryStatus,
    };
  }

  /**
   * Search and filter documents with multi-tenant isolation and permission intersection.
   */
  public static async searchDocuments(
    filters: DocumentFilterOptions,
    ctx: DocumentUserContext
  ) {
    const { businessId, userRoles, userPermissions } = ctx;

    if (!hasPermission(userPermissions, userRoles, PERMISSIONS.DOCUMENTS_VIEW)) {
      throw new UnauthorizedError("You lack permission to view documents.");
    }

    const where: Record<string, unknown> = {
      businessId,
    };

    // Archived status
    if (filters.isArchived !== undefined) {
      where.status = filters.isArchived ? DocumentStatus.ARCHIVED : { not: DocumentStatus.ARCHIVED };
    } else {
      where.status = { not: DocumentStatus.ARCHIVED };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.extension) {
      where.extension = filters.extension.toLowerCase();
    }

    if (filters.sensitivity) {
      where.sensitivity = filters.sensitivity;
    }

    // Hide SENSITIVE documents if user lacks documents.view_sensitive
    if (!hasPermission(userPermissions, userRoles, PERMISSIONS.DOCUMENTS_VIEW_SENSITIVE)) {
      where.sensitivity = DocumentSensitivity.NORMAL;
    }

    // Expiry filters
    if (filters.hasExpiry !== undefined) {
      where.expiryDate = filters.hasExpiry ? { not: null } : null;
    }

    if (filters.expiringWithinDays !== undefined) {
      const now = new Date();
      const future = new Date(now.getTime() + filters.expiringWithinDays * 24 * 60 * 60 * 1000);
      where.expiryDate = {
        gte: now,
        lte: future,
      };
    }

    // Entity link filter
    if (filters.entityType || filters.entityId) {
      where.documentLinks = {
        some: {
          ...(filters.entityType ? { entityType: filters.entityType } : {}),
          ...(filters.entityId ? { entityId: filters.entityId } : {}),
        },
      };
    }

    // Search query across safe metadata (display name, original name, description, tags)
    if (filters.search && filters.search.trim().length > 0) {
      const q = filters.search.trim();
      where.OR = [
        { displayName: { contains: q, mode: "insensitive" } },
        { originalFileName: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { tags: { has: q } },
      ];
    }

    // Sort order
    let orderBy: Record<string, string> = { createdAt: "desc" };
    if (filters.sortBy === "oldest") orderBy = { createdAt: "asc" };
    if (filters.sortBy === "name") orderBy = { displayName: "asc" };
    if (filters.sortBy === "largest") orderBy = { fileSize: "desc" };
    if (filters.sortBy === "updated") orderBy = { updatedAt: "desc" };
    if (filters.sortBy === "expiry_soon") orderBy = { expiryDate: "asc" };

    const page = Math.max(filters.page || 1, 1);
    const pageSize = Math.min(Math.max(filters.pageSize || 20, 1), 100);
    const skip = (page - 1) * pageSize;

    const [total, documents] = await Promise.all([
      prisma.attachment.count({ where }),
      prisma.attachment.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          documentLinks: true,
        },
      }),
    ]);

    // Apply entity permission intersection filtering
    const authorizedDocs = documents.filter((doc) => {
      try {
        this.verifyDocumentViewAccess(doc, ctx);
        return true;
      } catch {
        return false;
      }
    });

    const enriched = authorizedDocs.map((doc) => ({
      ...doc,
      expiryStatus: this.computeExpiryStatus(doc.expiryDate),
    }));

    return {
      items: enriched,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update document metadata (DisplayName, Category, Description, Tags, Expiry, Sensitivity).
   * Does NOT alter file bytes.
   */
  public static async updateMetadata(
    id: string,
    updates: {
      displayName?: string;
      category?: DocumentCategory;
      description?: string;
      tags?: string[];
      expiryDate?: Date | string | null;
      sensitivity?: DocumentSensitivity;
    },
    ctx: DocumentUserContext
  ) {
    const { businessId, userId, userRoles, userPermissions } = ctx;

    if (!hasPermission(userPermissions, userRoles, PERMISSIONS.DOCUMENTS_EDIT)) {
      throw new UnauthorizedError("You lack permission to edit document metadata.");
    }

    const existing = await prisma.attachment.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundError("Document not found.");
    }

    this.verifyDocumentViewAccess(existing, ctx);

    const data: Record<string, unknown> = {};
    if (updates.displayName !== undefined) data.displayName = updates.displayName.trim();
    if (updates.category !== undefined) data.category = updates.category;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.tags !== undefined) data.tags = updates.tags;
    if (updates.expiryDate !== undefined) {
      data.expiryDate = updates.expiryDate ? new Date(updates.expiryDate) : null;
    }
    if (updates.sensitivity !== undefined) data.sensitivity = updates.sensitivity;

    const updated = await prisma.attachment.update({
      where: { id },
      data,
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.DOCUMENT_METADATA_UPDATED,
      entityType: "DOCUMENT",
      entityId: id,
      previousValues: {
        displayName: existing.displayName,
        category: existing.category,
        sensitivity: existing.sensitivity,
      },
      newValues: data,
      reason: "Document metadata updated",
    });

    return updated;
  }

  /**
   * Link document to an entity (Customer, Supplier, Transaction, Payment, etc.).
   */
  public static async linkDocument(
    documentId: string,
    entityType: DocumentEntityType,
    entityId: string,
    ctx: DocumentUserContext
  ) {
    const { businessId, userId } = ctx;

    const doc = await prisma.attachment.findFirst({
      where: { id: documentId, businessId },
    });
    if (!doc) throw new NotFoundError("Document not found.");

    await this.validateLinkedEntity(entityType, entityId, businessId);

    const link = await prisma.documentLink.upsert({
      where: {
        documentId_entityType_entityId: {
          documentId,
          entityType,
          entityId,
        },
      },
      create: {
        documentId,
        businessId,
        entityType,
        entityId,
        createdBy: userId,
      },
      update: {},
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.DOCUMENT_LINKED,
      entityType: "DOCUMENT",
      entityId: documentId,
      newValues: { entityType, entityId },
      reason: `Document linked to ${entityType}`,
    });

    return link;
  }

  /**
   * Unlink document from an entity.
   */
  public static async unlinkDocument(
    documentId: string,
    entityType: DocumentEntityType,
    entityId: string,
    ctx: DocumentUserContext
  ) {
    const { businessId, userId } = ctx;

    const link = await prisma.documentLink.findFirst({
      where: { documentId, businessId, entityType, entityId },
    });

    if (!link) {
      throw new NotFoundError("Document link not found.");
    }

    await prisma.documentLink.delete({
      where: { id: link.id },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.DOCUMENT_UNLINKED,
      entityType: "DOCUMENT",
      entityId: documentId,
      previousValues: { entityType, entityId },
      reason: `Document unlinked from ${entityType}`,
    });

    return { success: true };
  }

  /**
   * Soft archive document. Removes from default active views while preserving audit history.
   */
  public static async archiveDocument(id: string, ctx: DocumentUserContext) {
    const { businessId, userId, userRoles, userPermissions } = ctx;

    if (!hasPermission(userPermissions, userRoles, PERMISSIONS.DOCUMENTS_ARCHIVE)) {
      throw new UnauthorizedError("You lack permission to archive documents.");
    }

    const doc = await prisma.attachment.findFirst({
      where: { id, businessId },
    });
    if (!doc) throw new NotFoundError("Document not found.");

    this.verifyDocumentViewAccess(doc, ctx);

    const updated = await prisma.attachment.update({
      where: { id },
      data: {
        status: DocumentStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.DOCUMENT_ARCHIVED,
      entityType: "DOCUMENT",
      entityId: id,
      reason: "Document archived",
    });

    return updated;
  }

  /**
   * Restore an archived document back to AVAILABLE status.
   */
  public static async restoreDocument(id: string, ctx: DocumentUserContext) {
    const { businessId, userId, userRoles, userPermissions } = ctx;

    if (!hasPermission(userPermissions, userRoles, PERMISSIONS.DOCUMENTS_RESTORE)) {
      throw new UnauthorizedError("You lack permission to restore documents.");
    }

    const doc = await prisma.attachment.findFirst({
      where: { id, businessId },
    });
    if (!doc) throw new NotFoundError("Document not found.");

    const updated = await prisma.attachment.update({
      where: { id },
      data: {
        status: DocumentStatus.AVAILABLE,
        archivedAt: null,
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.DOCUMENT_RESTORED,
      entityType: "DOCUMENT",
      entityId: id,
      reason: "Document restored from archive",
    });

    return updated;
  }

  /**
   * Request an authorized, time-limited signed download token for a document.
   */
  public static async requestDownloadToken(id: string, ctx: DocumentUserContext) {
    const { businessId, userId } = ctx;

    const doc = await prisma.attachment.findFirst({
      where: { id, businessId },
      include: { documentLinks: true },
    });

    if (!doc) throw new NotFoundError("Document not found.");

    if (doc.status === DocumentStatus.QUARANTINED) {
      throw new AppError("Access denied: Quarantined files cannot be downloaded.", 403);
    }

    this.verifyDocumentViewAccess(doc, ctx);

    // Generate 15-minute signed token
    const token = StorageService.generateSignedDownloadToken(doc.id, businessId, userId, 15);

    // Audit download request
    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.DOCUMENT_DOWNLOADED,
      entityType: "DOCUMENT",
      entityId: doc.id,
      newValues: { fileName: doc.originalFileName, fileSize: doc.fileSize },
      reason: "Authorized download URL generated",
    });

    return {
      downloadUrl: `/api/documents/${doc.id}/download?token=${encodeURIComponent(token)}`,
      expiresInSeconds: 900,
      fileName: doc.originalFileName,
    };
  }

  /**
   * Retrieve document buffer for authorized download or preview.
   */
  public static async getDocumentContent(id: string, ctx: DocumentUserContext): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }> {
    const { businessId } = ctx;

    const doc = await prisma.attachment.findFirst({
      where: { id, businessId },
      include: { documentLinks: true },
    });

    if (!doc) throw new NotFoundError("Document not found.");

    if (doc.status === DocumentStatus.QUARANTINED) {
      throw new AppError("Access denied: Quarantined files cannot be accessed.", 403);
    }

    this.verifyDocumentViewAccess(doc, ctx);

    const buffer = await StorageService.getObject(doc.storageKey);

    return {
      buffer,
      fileName: doc.originalFileName,
      mimeType: doc.mimeType,
    };
  }

  /**
   * Safe preview generator for spreadsheets (XLSX, CSV) and text documents.
   * Strips macros, executes zero formula code, and returns inert structured data.
   */
  public static async getSpreadsheetPreview(
    id: string,
    ctx: DocumentUserContext,
    sheetIndex = 0
  ): Promise<SafeSpreadsheetPreview> {
    const { buffer } = await this.getDocumentContent(id, ctx);

    try {
      const workbook = XLSX.read(buffer, {
        type: "buffer",
        cellFormula: false, // Never evaluate formulas
        cellHTML: false,
        sheetRows: 100, // Safe preview limit: 100 rows
      });

      const sheetNames = workbook.SheetNames;
      if (sheetNames.length === 0) {
        throw new AppError("Workbook contains no sheets.", 400);
      }

      const targetSheetName = sheetNames[sheetIndex] || sheetNames[0];
      const sheet = workbook.Sheets[targetSheetName];

      const rawJson = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
      });

      if (!rawJson || rawJson.length === 0) {
        return {
          sheetNames,
          activeSheet: targetSheetName,
          headers: [],
          rows: [],
          totalRows: 0,
          totalColumns: 0,
          isTruncated: false,
        };
      }

      // First row as headers
      const firstRow = rawJson[0] as unknown[];
      const headers = firstRow.map((cell, idx) =>
        cell !== null && cell !== undefined ? String(cell).trim() : `Column ${idx + 1}`
      );

      const rows: Record<string, string | number | null>[] = [];
      for (let i = 1; i < Math.min(rawJson.length, 101); i++) {
        const rowData = rawJson[i] as unknown[];
        const obj: Record<string, string | number | null> = {};
        for (let j = 0; j < headers.length; j++) {
          const val = rowData[j];
          if (val === null || val === undefined) {
            obj[headers[j]] = null;
          } else if (typeof val === "number") {
            obj[headers[j]] = val;
          } else {
            obj[headers[j]] = String(val);
          }
        }
        rows.push(obj);
      }

      return {
        sheetNames,
        activeSheet: targetSheetName,
        headers,
        rows,
        totalRows: rawJson.length - 1,
        totalColumns: headers.length,
        isTruncated: rawJson.length > 100,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new AppError(`Failed to parse spreadsheet preview safely: ${msg}`, 400);
    }
  }

  /**
   * Delete a document.
   * Protects documents attached to CLOSED financial periods or official snapshots.
   */
  public static async deleteDocument(id: string, ctx: DocumentUserContext) {
    const { businessId, userId, userRoles, userPermissions } = ctx;

    if (!hasPermission(userPermissions, userRoles, PERMISSIONS.DOCUMENTS_DELETE)) {
      throw new UnauthorizedError("You lack permission to delete documents.");
    }

    const doc = await prisma.attachment.findFirst({
      where: { id, businessId },
      include: { documentLinks: true },
    });

    if (!doc) throw new NotFoundError("Document not found.");

    // Protected check: Verify if linked to a closed financial period
    for (const link of doc.documentLinks) {
      if (link.entityType === DocumentEntityType.TRANSACTION) {
        const tx = await prisma.transaction.findFirst({
          where: { id: link.entityId, businessId },
          include: { financialPeriod: true },
        });
        if (
          tx?.financialPeriod &&
          (tx.financialPeriod.status === FinancialPeriodStatus.CLOSED ||
            tx.financialPeriod.status === FinancialPeriodStatus.LOCKED)
        ) {
          throw new AppError(
            `Security block: Document is linked to transaction ${tx.transactionNumber} in a ${tx.financialPeriod.status} period. Permanent deletion is forbidden to protect financial audit integrity.`,
            400
          );
        }
      }

      if (link.entityType === DocumentEntityType.MONTH_END_CLOSING) {
        throw new AppError(
          "Security block: Documents linked to Month-End Closing snapshots cannot be deleted.",
          400
        );
      }
    }

    // Delete DB record
    await prisma.attachment.delete({
      where: { id },
    });

    // Delete physical file
    await StorageService.deleteObject(doc.storageKey);

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.DOCUMENT_DELETED,
      entityType: "DOCUMENT",
      entityId: id,
      previousValues: {
        fileName: doc.originalFileName,
        fileSize: doc.fileSize,
        category: doc.category,
      },
      reason: "Document permanently deleted",
    });

    return { success: true };
  }

  /**
   * Validate that an entity being linked exists and belongs to the same business.
   * Strictly prevents cross-tenant linking.
   */
  private static async validateLinkedEntity(
    entityType: DocumentEntityType,
    entityId: string,
    businessId: string
  ): Promise<void> {
    switch (entityType) {
      case DocumentEntityType.CUSTOMER: {
        const cust = await prisma.customer.findFirst({ where: { id: entityId, businessId } });
        if (!cust) throw new NotFoundError("Customer not found in this business.");
        break;
      }
      case DocumentEntityType.SUPPLIER: {
        const supp = await prisma.supplier.findFirst({ where: { id: entityId, businessId } });
        if (!supp) throw new NotFoundError("Supplier not found in this business.");
        break;
      }
      case DocumentEntityType.TRANSACTION: {
        const tx = await prisma.transaction.findFirst({ where: { id: entityId, businessId } });
        if (!tx) throw new NotFoundError("Transaction not found in this business.");
        break;
      }
      case DocumentEntityType.PAYMENT: {
        const pmt = await prisma.payment.findFirst({ where: { id: entityId, businessId } });
        if (!pmt) throw new NotFoundError("Payment not found in this business.");
        break;
      }
      case DocumentEntityType.FOLLOWUP: {
        const fu = await prisma.followUp.findFirst({ where: { id: entityId, businessId } });
        if (!fu) throw new NotFoundError("Follow-up not found in this business.");
        break;
      }
      case DocumentEntityType.NOTE: {
        const note = await prisma.note.findFirst({ where: { id: entityId, businessId } });
        if (!note) throw new NotFoundError("Note not found in this business.");
        break;
      }
      default:
        break;
    }
  }

  /**
   * Helper to compute dynamic expiry status.
   */
  public static computeExpiryStatus(expiryDate?: Date | null): "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NO_EXPIRY" {
    if (!expiryDate) return "NO_EXPIRY";

    const now = new Date();
    const expiry = new Date(expiryDate);

    if (expiry < now) return "EXPIRED";

    // Expiring within 30 days
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (expiry.getTime() - now.getTime() <= thirtyDaysMs) {
      return "EXPIRING_SOON";
    }

    return "VALID";
  }
}
