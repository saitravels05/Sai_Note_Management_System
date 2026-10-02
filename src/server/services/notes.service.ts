import { prisma } from "@/lib/db";
import { NotFoundError, AppError } from "@/lib/errors";
import { AuditService } from "./audit.service";
import { AuditAction, Prisma } from "@prisma/client";

export interface NoteContext {
  userId: string;
  businessId: string;
}

export interface CreateNoteInput {
  title: string;
  content: string;
  noteType?: string;
  customerId?: string | null;
  supplierId?: string | null;
  transactionId?: string | null;
  isPinned?: boolean;
  tags?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  noteType?: string;
  customerId?: string | null;
  supplierId?: string | null;
  transactionId?: string | null;
  isPinned?: boolean;
  tags?: string[];
}

export interface NoteFilterOptions {
  view?: "all" | "pinned" | "recent" | "customer" | "supplier" | "transaction";
  search?: string;
  customerId?: string;
  supplierId?: string;
  transactionId?: string;
  tagId?: string;
  limit?: number;
}

export class NotesService {
  /**
   * Create a new General or Linked Note.
   */
  public static async createNote(input: CreateNoteInput, ctx: NoteContext) {
    const { businessId, userId } = ctx;

    if (!input.title || input.title.trim().length === 0) {
      throw new AppError("Note title is required.", 400);
    }
    if (!input.content || input.content.trim().length === 0) {
      throw new AppError("Note content cannot be empty.", 400);
    }

    // Verify Customer ownership if linked
    if (input.customerId) {
      const cust = await prisma.customer.findFirst({ where: { id: input.customerId, businessId } });
      if (!cust) throw new AppError("Customer not found in this business.", 400);
    }

    // Verify Supplier ownership if linked
    if (input.supplierId) {
      const supp = await prisma.supplier.findFirst({ where: { id: input.supplierId, businessId } });
      if (!supp) throw new AppError("Supplier not found in this business.", 400);
    }

    // Verify Transaction ownership if linked
    if (input.transactionId) {
      const txn = await prisma.transaction.findFirst({ where: { id: input.transactionId, businessId } });
      if (!txn) throw new AppError("Transaction not found in this business.", 400);
    }

    const note = await prisma.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          businessId,
          title: input.title.trim(),
          content: input.content.trim(),
          noteType: input.noteType || "GENERAL",
          customerId: input.customerId || null,
          supplierId: input.supplierId || null,
          transactionId: input.transactionId || null,
          isPinned: input.isPinned ?? false,
          createdById: userId,
        },
      });

      // Link tags if provided
      if (input.tags && input.tags.length > 0) {
        for (const tagName of input.tags) {
          const trimmedTag = tagName.trim();
          if (!trimmedTag) continue;

          const tag = await tx.tag.upsert({
            where: {
              businessId_name: {
                businessId,
                name: trimmedTag,
              },
            },
            update: {},
            create: {
              businessId,
              name: trimmedTag,
            },
          });

          await tx.noteTag.create({
            data: {
              noteId: created.id,
              tagId: tag.id,
            },
          });
        }
      }

      return created;
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.CREATE,
      entityType: "NOTE",
      entityId: note.id,
      newValues: { title: note.title, isPinned: note.isPinned },
      reason: "Note created",
    });

    return note;
  }

  /**
   * Update an existing Note.
   */
  public static async updateNote(id: string, input: UpdateNoteInput, ctx: NoteContext) {
    const { businessId, userId } = ctx;

    const existing = await prisma.note.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundError("Note not found or inaccessible.");
    }

    const updated = await prisma.note.update({
      where: { id: existing.id },
      data: {
        title: input.title !== undefined ? input.title.trim() : undefined,
        content: input.content !== undefined ? input.content.trim() : undefined,
        noteType: input.noteType !== undefined ? input.noteType : undefined,
        customerId: input.customerId !== undefined ? input.customerId : undefined,
        supplierId: input.supplierId !== undefined ? input.supplierId : undefined,
        transactionId: input.transactionId !== undefined ? input.transactionId : undefined,
        isPinned: input.isPinned !== undefined ? input.isPinned : undefined,
        updatedById: userId,
      },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.UPDATE,
      entityType: "NOTE",
      entityId: updated.id,
      previousValues: { title: existing.title, isPinned: existing.isPinned },
      newValues: { title: updated.title, isPinned: updated.isPinned },
      reason: "Note updated",
    });

    return updated;
  }

  /**
   * Toggle Pin status of a Note.
   */
  public static async togglePinNote(id: string, ctx: NoteContext) {
    const { businessId } = ctx;

    const existing = await prisma.note.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundError("Note not found.");
    }

    const updated = await prisma.note.update({
      where: { id: existing.id },
      data: { isPinned: !existing.isPinned },
    });

    return updated;
  }

  /**
   * Delete a note.
   */
  public static async deleteNote(id: string, ctx: NoteContext) {
    const { businessId, userId } = ctx;

    const existing = await prisma.note.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      throw new NotFoundError("Note not found.");
    }

    await prisma.note.delete({
      where: { id: existing.id },
    });

    await AuditService.log({
      businessId,
      userId,
      action: AuditAction.VOID,
      entityType: "NOTE",
      entityId: id,
      reason: "Note deleted",
    });

    return { success: true };
  }

  /**
   * Retrieve notes with filtering and search.
   */
  public static async getNotes(opts: NoteFilterOptions, ctx: NoteContext) {
    const { businessId } = ctx;

    const where: Prisma.NoteWhereInput = {
      businessId,
    };

    if (opts.view === "pinned") {
      where.isPinned = true;
    } else if (opts.view === "customer") {
      where.customerId = { not: null };
    } else if (opts.view === "supplier") {
      where.supplierId = { not: null };
    } else if (opts.view === "transaction") {
      where.transactionId = { not: null };
    }

    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.supplierId) where.supplierId = opts.supplierId;
    if (opts.transactionId) where.transactionId = opts.transactionId;

    if (opts.tagId) {
      where.tags = { some: { tagId: opts.tagId } };
    }

    if (opts.search && opts.search.trim().length > 0) {
      const q = opts.search.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ];
    }

    return prisma.note.findMany({
      where,
      include: {
        customer: true,
        supplier: true,
        transaction: true,
        tags: {
          include: { tag: true },
        },
      },
      orderBy: [
        { isPinned: "desc" },
        { createdAt: "desc" },
      ],
      take: opts.limit || 50,
    });
  }
}
