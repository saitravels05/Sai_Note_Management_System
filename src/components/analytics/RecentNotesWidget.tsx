"use client";

import Link from "next/link";
import { FileText, Pin, ArrowRight } from "lucide-react";
import { formatBusinessDate } from "@/lib/date";

export interface SerializedNoteItem {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  noteType: string;
  updatedAt: string;
}

interface RecentNotesWidgetProps {
  notes: SerializedNoteItem[];
}

export function RecentNotesWidget({ notes }: RecentNotesWidgetProps) {
  return (
    <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Smart Notes & Reminders</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Operational business diary & pinned memos
            </p>
          </div>
        </div>

        <Link
          href="/notes"
          className="flex items-center gap-1 text-xs font-semibold text-orange-400 hover:text-orange-300"
        >
          <span>All Notes</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {notes.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">
          No notes created yet. Use the Quick Entry or Notes section to record memos.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notes.map((n) => (
            <Link
              key={n.id}
              href="/notes"
              className="p-3.5 rounded-xl bg-slate-900/50 hover:bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2 block"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {n.isPinned && <Pin className="w-3 h-3 text-orange-400 fill-orange-400" />}
                  <span className="font-bold text-white text-xs truncate max-w-[150px]">
                    {n.title}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {formatBusinessDate(n.updatedAt)}
                </span>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {n.content}
              </p>

              {n.noteType && (
                <div className="text-[10px] text-orange-400/80 font-mono">
                  #{n.noteType}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
