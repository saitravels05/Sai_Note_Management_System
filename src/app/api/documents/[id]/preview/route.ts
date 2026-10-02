import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { StorageService } from "@/server/services/document/storage.service";
import { DocumentService, DocumentUserContext } from "@/server/services/document/document.service";
import { DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const ctx: DocumentUserContext = {
      userId: user.id,
      businessId: user.businessId,
      userRoles: user.roleTypes,
      userPermissions: user.permissions,
    };

    const doc = await prisma.attachment.findFirst({
      where: { id, businessId: user.businessId },
      include: { documentLinks: true },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.status === DocumentStatus.QUARANTINED) {
      return NextResponse.json(
        { error: "Access denied: Quarantined files cannot be previewed." },
        { status: 403 }
      );
    }

    DocumentService.verifyDocumentViewAccess(doc, ctx);

    const fileBuffer = await StorageService.getObject(doc.storageKey);

    const encodedFileName = encodeURIComponent(doc.originalFileName).replace(/['()]/g, escape);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Length": String(fileBuffer.length),
        "Content-Disposition": `inline; filename="${doc.safeFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Preview failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
