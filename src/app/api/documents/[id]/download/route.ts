import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { StorageService } from "@/server/services/document/storage.service";
import { DocumentService, DocumentUserContext } from "@/server/services/document/document.service";
import { AuditService } from "@/server/services/audit.service";
import { AuditAction, DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    let businessId: string;
    let userId: string;

    // 1. If signed token provided, verify cryptographically
    if (token) {
      const payload = StorageService.verifySignedDownloadToken(token);
      if (payload.documentId !== id) {
        return NextResponse.json({ error: "Token mismatch for requested document" }, { status: 403 });
      }
      businessId = payload.businessId;
      userId = payload.userId;
    } else {
      // 2. Otherwise verify active authenticated session
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
      }
      businessId = user.businessId;
      userId = user.id;

      const ctx: DocumentUserContext = {
        userId: user.id,
        businessId: user.businessId,
        userRoles: user.roleTypes,
        userPermissions: user.permissions,
      };

      const doc = await prisma.attachment.findFirst({
        where: { id, businessId },
        include: { documentLinks: true },
      });

      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      DocumentService.verifyDocumentViewAccess(doc, ctx);
    }

    // Retrieve document metadata
    const doc = await prisma.attachment.findFirst({
      where: { id, businessId },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found in business vault" }, { status: 404 });
    }

    if (doc.status === DocumentStatus.QUARANTINED) {
      return NextResponse.json(
        { error: "Document is quarantined and cannot be downloaded" },
        { status: 403 }
      );
    }

    // Read physical file from private vault
    const fileBuffer = await StorageService.getObject(doc.storageKey);

    // Audit download
    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.DOCUMENT_DOWNLOADED,
      entityType: "DOCUMENT",
      entityId: doc.id,
      newValues: { fileName: doc.originalFileName, fileSize: doc.fileSize },
      reason: "Document downloaded via secure stream",
    });

    // Encode filename safely for Content-Disposition header (RFC 5987 for Tamil/Unicode filenames)
    const encodedFileName = encodeURIComponent(doc.originalFileName).replace(/['()]/g, escape);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Length": String(fileBuffer.length),
        "Content-Disposition": `attachment; filename="${doc.safeFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Download failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
