"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser, requirePermission } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { NotesService } from "@/server/services/notes.service";

export interface NoteActionResult {
  success: boolean;
  noteId?: string;
  error?: string;
  message?: string;
}

/**
 * Server Action: Save or Update a Note
 */
export async function saveNoteAction(
  _prevState: NoteActionResult | null,
  formData: FormData
): Promise<NoteActionResult> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.NOTES_MANAGE);

    const id = formData.get("id")?.toString().trim();
    const title = formData.get("title")?.toString().trim() || "";
    const content = formData.get("content")?.toString().trim() || "";
    const noteType = formData.get("noteType")?.toString().trim() || "GENERAL";
    const customerId = formData.get("customerId")?.toString().trim() || null;
    const supplierId = formData.get("supplierId")?.toString().trim() || null;
    const transactionId = formData.get("transactionId")?.toString().trim() || null;
    const isPinned = formData.get("isPinned") === "true" || formData.get("isPinned") === "on";

    const rawTags = formData.get("tags")?.toString() || "";
    const tags = rawTags
      ? rawTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const noteCtx = {
      userId: user.id,
      businessId: user.businessId,
    };

    let note;
    if (id) {
      note = await NotesService.updateNote(
        id,
        {
          title,
          content,
          noteType,
          customerId,
          supplierId,
          transactionId,
          isPinned,
          tags,
        },
        noteCtx
      );
    } else {
      note = await NotesService.createNote(
        {
          title,
          content,
          noteType,
          customerId,
          supplierId,
          transactionId,
          isPinned,
          tags,
        },
        noteCtx
      );
    }

    revalidatePath("/notes");
    revalidatePath("/records");

    return {
      success: true,
      noteId: note.id,
      message: id ? "Note updated successfully" : "Note created successfully",
    };
  } catch (error) {
    console.error("Save note error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save note",
    };
  }
}

/**
 * Server Action: Toggle Pin Status
 */
export async function togglePinNoteAction(id: string): Promise<NoteActionResult> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.NOTES_MANAGE);

    const noteCtx = {
      userId: user.id,
      businessId: user.businessId,
    };

    const note = await NotesService.togglePinNote(id, noteCtx);

    revalidatePath("/notes");

    return {
      success: true,
      noteId: note.id,
      message: note.isPinned ? "Note pinned" : "Note unpinned",
    };
  } catch (error) {
    console.error("Toggle pin error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to toggle pin",
    };
  }
}

/**
 * Server Action: Delete a Note
 */
export async function deleteNoteAction(
  _prevState: NoteActionResult | null,
  formData: FormData
): Promise<NoteActionResult> {
  try {
    const user = await requireCurrentUser();
    await requirePermission(PERMISSIONS.NOTES_MANAGE);

    const id = formData.get("id")?.toString().trim();
    if (!id) return { success: false, error: "Note ID is required" };

    const noteCtx = {
      userId: user.id,
      businessId: user.businessId,
    };

    await NotesService.deleteNote(id, noteCtx);

    revalidatePath("/notes");

    return {
      success: true,
      message: "Note deleted successfully",
    };
  } catch (error) {
    console.error("Delete note error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete note",
    };
  }
}
