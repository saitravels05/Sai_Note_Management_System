"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format, isToday, isYesterday } from "date-fns";
import {
  FileText,
  Pin,
  Search,
  PlusCircle,
  User,
  Building,
  Hash,
  Trash2,
  Edit3,
  X,
  Clock,
} from "lucide-react";
import { saveNoteAction, togglePinNoteAction, deleteNoteAction } from "@/server/actions/note.actions";

export interface SerializedNote {
  id: string;
  title: string;
  content: string;
  noteType: string;
  isPinned: boolean;
  createdAt: string;
  customerName: string | null;
  customerId: string | null;
  supplierName: string | null;
  supplierId: string | null;
  transactionNumber: string | null;
  transactionId: string | null;
  tags: string[];
}

interface NotesWorkspaceProps {
  notes: SerializedNote[];
  customers: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}

export function NotesWorkspace({ notes, customers, suppliers }: NotesWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentView = searchParams.get("view") || "all";
  const [search, setSearch] = useState("");

  // Note Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCustomerId, setNoteCustomerId] = useState<string>("");
  const [noteSupplierId, setNoteSupplierId] = useState<string>("");
  const [noteIsPinned, setNoteIsPinned] = useState(false);
  const [noteTags, setNoteTags] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Switch view tab
  const handleViewChange = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "all") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Open creation modal
  const handleOpenCreateModal = () => {
    setEditingNoteId(null);
    setNoteTitle("");
    setNoteContent("");
    setNoteCustomerId("");
    setNoteSupplierId("");
    setNoteIsPinned(false);
    setNoteTags("");
    setFormError(null);
    setModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (note: SerializedNote) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteCustomerId(note.customerId || "");
    setNoteSupplierId(note.supplierId || "");
    setNoteIsPinned(note.isPinned);
    setNoteTags(note.tags.join(", "));
    setFormError(null);
    setModalOpen(true);
  };

  // Save or update note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) {
      setFormError("Note title is required");
      return;
    }
    if (!noteContent.trim()) {
      setFormError("Note content cannot be empty");
      return;
    }

    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      if (editingNoteId) formData.append("id", editingNoteId);
      formData.append("title", noteTitle.trim());
      formData.append("content", noteContent.trim());
      if (noteCustomerId) formData.append("customerId", noteCustomerId);
      if (noteSupplierId) formData.append("supplierId", noteSupplierId);
      if (noteIsPinned) formData.append("isPinned", "true");
      if (noteTags.trim()) formData.append("tags", noteTags.trim());

      const res = await saveNoteAction(null, formData);
      if (res.success) {
        setModalOpen(false);
        router.refresh();
      } else {
        setFormError(res.error || "Failed to save note");
      }
    });
  };

  // Toggle Pin Action
  const handleTogglePin = async (id: string) => {
    startTransition(async () => {
      await togglePinNoteAction(id);
      router.refresh();
    });
  };

  // Delete Action
  const handleDeleteNote = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("id", id);
      await deleteNoteAction(null, formData);
      router.refresh();
    });
  };

  // Client-side search filtering
  const filteredNotes = notes.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q)) ||
      (n.customerName && n.customerName.toLowerCase().includes(q)) ||
      (n.supplierName && n.supplierName.toLowerCase().includes(q))
    );
  });

  const pinnedNotes = filteredNotes.filter((n) => n.isPinned);
  const unpinnedNotes = filteredNotes.filter((n) => !n.isPinned);

  const formatNoteDate = (isoStr: string) => {
    const d = new Date(isoStr);
    if (isToday(d)) return `Today, ${format(d, "hh:mm a")}`;
    if (isYesterday(d)) return `Yesterday, ${format(d, "hh:mm a")}`;
    return format(d, "dd MMM yyyy, hh:mm a");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Smart Diary & Notebook
            </span>
            <span className="text-xs text-slate-500">{notes.length} total notes</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Operational Notes & Memos</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Client requests, supplier quotations, flight checklists, reminders, and daily business memos.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-orange-700 transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          + Write Note
        </button>
      </div>

      {/* Control Bar: View Tabs + Live Search */}
      <div className="p-3.5 rounded-xl glass-card border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* View Switcher Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs overflow-x-auto">
          {[
            { id: "all", label: "All Notes" },
            { id: "pinned", label: "Pinned" },
            { id: "recent", label: "Recent" },
            { id: "customer", label: "Customer Notes" },
            { id: "supplier", label: "Supplier Notes" },
            { id: "transaction", label: "Transaction Notes" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleViewChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                currentView === tab.id
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search notes, parties, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredNotes.length === 0 ? (
        <div className="p-12 rounded-2xl glass-card border border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {search ? "No Notes Matched Your Search" : "No Operational Notes Recorded"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              {search
                ? `No notes match "${search}". Try searching another keyword or clearing search.`
                : "Create operational notes for customer requests, pending passport documents, or supplier quotes without touching ledger spreadsheets."}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            {search ? (
              <button
                onClick={() => setSearch("")}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
              >
                Clear Search
              </button>
            ) : (
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-md shadow-orange-500/20"
              >
                + Write First Note
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section: Pinned Notes (Shown prominently if any are pinned and view is not already pinned-only) */}
          {pinnedNotes.length > 0 && currentView !== "pinned" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-wider">
                <Pin className="w-3.5 h-3.5 fill-orange-400" />
                <span>Pinned Memos & Operational Alerts</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onTogglePin={handleTogglePin}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDeleteNote}
                    formatDate={formatNoteDate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section: Regular / All Notes */}
          <div className="space-y-3">
            {pinnedNotes.length > 0 && currentView !== "pinned" && (
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                All Memos ({unpinnedNotes.length})
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(currentView === "pinned" ? pinnedNotes : unpinnedNotes).map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onTogglePin={handleTogglePin}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDeleteNote}
                  formatDate={formatNoteDate}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Note Editor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-400" />
                <h3 className="font-bold text-white text-base">
                  {editingNoteId ? "Edit Business Note" : "Write Smart Note"}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4 text-xs">
              {/* Title */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Title / Subject <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Visa documents pending, Flight seat preference..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Note Details <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Write clear instructions, flight itinerary details, quotation breakdown, or reminders..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 leading-relaxed font-sans"
                />
              </div>

              {/* Linked Party (Optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Link Customer (Optional)</label>
                  <select
                    value={noteCustomerId}
                    onChange={(e) => setNoteCustomerId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">None</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">Link Supplier (Optional)</label>
                  <select
                    value={noteSupplierId}
                    onChange={(e) => setNoteSupplierId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">None</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags Input */}
              <div>
                <label className="text-slate-400 font-medium block mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Urgent, International, Visa, Quotation"
                  value={noteTags}
                  onChange={(e) => setNoteTags(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Pin Note Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinToggle"
                  checked={noteIsPinned}
                  onChange={(e) => setNoteIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-500 focus:ring-0 focus:outline-none bg-slate-800 border-slate-700 cursor-pointer"
                />
                <label htmlFor="pinToggle" className="text-slate-300 font-medium cursor-pointer">
                  Pin this note to the top of the workspace
                </label>
              </div>

              {formError && <p className="text-xs text-rose-400 font-medium">{formError}</p>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !noteTitle.trim()}
                  className="px-5 py-2 rounded-xl font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all"
                >
                  {isPending ? "Saving..." : editingNoteId ? "Update Note" : "Save Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component: NoteCard
function NoteCard({
  note,
  onTogglePin,
  onEdit,
  onDelete,
  formatDate,
}: {
  note: SerializedNote;
  onTogglePin: (id: string) => void;
  onEdit: (note: SerializedNote) => void;
  onDelete: (id: string) => void;
  formatDate: (iso: string) => string;
}) {
  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between group ${
        note.isPinned
          ? "bg-slate-900/90 border-orange-500/40 shadow-lg shadow-orange-500/5 hover:border-orange-500/60"
          : "glass-card border-slate-800/80 hover:border-slate-700"
      }`}
    >
      <div className="space-y-2.5">
        {/* Card Header: Pin + Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {note.isPinned && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <Pin className="w-2.5 h-2.5 fill-orange-400" />
                PINNED
              </span>
            )}
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(note.createdAt)}
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onTogglePin(note.id)}
              className={`p-1.5 rounded-lg transition-colors ${
                note.isPinned
                  ? "text-orange-400 bg-orange-500/10 hover:bg-orange-500/20"
                  : "text-slate-500 hover:text-orange-400 hover:bg-slate-800"
              }`}
              title={note.isPinned ? "Unpin Note" : "Pin Note"}
            >
              <Pin className={`w-3.5 h-3.5 ${note.isPinned ? "fill-orange-400" : ""}`} />
            </button>
            <button
              onClick={() => onEdit(note)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Edit Note"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Delete Note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Note Title */}
        <h4 className="font-bold text-white text-sm tracking-tight">{note.title}</h4>

        {/* Note Body */}
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
          {note.content}
        </p>

        {/* Linked Entity Badges */}
        {(note.customerName || note.supplierName || note.transactionNumber) && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {note.customerName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                <User className="w-2.5 h-2.5 text-orange-400" />
                Customer: {note.customerName}
              </span>
            )}
            {note.supplierName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                <Building className="w-2.5 h-2.5 text-orange-400" />
                Supplier: {note.supplierName}
              </span>
            )}
            {note.transactionNumber && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                <Hash className="w-2.5 h-2.5 text-orange-400" />
                Txn: #{note.transactionNumber}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tags Footer */}
      {note.tags.length > 0 && (
        <div className="pt-3 border-t border-slate-800/60 mt-3 flex items-center gap-1 flex-wrap">
          {note.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] bg-slate-800/60 text-slate-400"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
