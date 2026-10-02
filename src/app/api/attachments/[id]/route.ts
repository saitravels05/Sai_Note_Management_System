import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AttachmentService } from "@/server/services/attachment.service";
import fs from "fs/promises";
import path from "path";

const STORAGE_ROOT = process.env.STORAGE_PATH
  ? path.join(process.env.STORAGE_PATH, "attachments")
  : process.env.VERCEL
  ? path.join("/tmp", "storage", "attachments")
  : path.join(process.cwd(), "storage", "attachments");

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Attachment ID is required" }, { status: 400 });
    }

    // AttachmentService.getAttachment enforces multi-tenant isolation
    const attachment = await AttachmentService.getAttachment(id, user.businessId);

    const filePath = path.join(STORAGE_ROOT, attachment.storageKey);
    try {
      const fileBuffer = await fs.readFile(filePath);

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": attachment.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.originalFileName)}"`,
          "Content-Length": attachment.fileSize.toString(),
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Stored file was not found on server storage." },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Attachment retrieval error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 404 }
    );
  }
}
