"use client";

import { useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Eye,
  Layers,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { deleteExportAction } from "@/server/actions/export.actions";
import { regeneratePdfReportAction } from "@/server/actions/pdf-report.actions";

export interface SerializedHistoryRecord {
  id: string;
  reportType: string;
  format: string;
  periodStart: string;
  periodEnd: string;
  fileName: string;
  fileSize: number;
  status: string;
  generatedAt: string;
  generatedBy: string;
  downloadUrl: string;
}

interface ReportHistoryViewProps {
  businessName: string;
  initialHistory: SerializedHistoryRecord[];
}

export function ReportHistoryView({
  businessName,
  initialHistory,
}: ReportHistoryViewProps) {
  const [history, setHistory] = useState<SerializedHistoryRecord[]>(initialHistory);
  const [formatFilter, setFormatFilter] = useState<"ALL" | "PDF" | "XLSX" | "CSV">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this generated report file from secure storage?")) {
      return;
    }
    setIsDeleting(id);
    setActionMessage(null);
    try {
      const res = await deleteExportAction(id);
      if (res.success) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        setActionMessage("Report file deleted from storage.");
      } else {
        alert(res.error || "Failed to delete file.");
      }
    } catch {
      alert("Error deleting file.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRegenerate = async (id: string) => {
    setIsRegenerating(id);
    setActionMessage(null);
    try {
      const res = await regeneratePdfReportAction(id);
      if (res.success && res.data) {
        setActionMessage(`Report regenerated successfully: ${res.data.fileName}`);
        // Add new item to history
        const newItem: SerializedHistoryRecord = {
          id: res.data.historyId,
          reportType: history.find((h) => h.id === id)?.reportType || "REPORT",
          format: "PDF",
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
          fileName: res.data.fileName,
          fileSize: res.data.fileSize,
          status: "COMPLETED",
          generatedAt: new Date().toISOString(),
          generatedBy: "You",
          downloadUrl: res.data.downloadUrl,
        };
        setHistory((prev) => [newItem, ...prev]);
      } else {
        alert(res.error || "Failed to regenerate report.");
      }
    } catch {
      alert("Error regenerating report.");
    } finally {
      setIsRegenerating(null);
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesFormat =
      formatFilter === "ALL"
        ? true
        : item.format.toUpperCase() === formatFilter;

    const matchesSearch =
      searchQuery.trim() === ""
        ? true
        : item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.reportType.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.generatedBy.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFormat && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
              {businessName}
            </span>
            <span className="text-xs text-slate-400">• Audit History</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Generated Reports & Statements
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit history of generated PDF statements, Excel workbooks, and CSV files in private storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/reports/generate"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/40 transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>Generate New Report</span>
          </Link>
          <Link
            href="/reports"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all"
          >
            <span>Report Center</span>
          </Link>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        {/* Format Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(["ALL", "PDF", "XLSX", "CSV"] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setFormatFilter(fmt)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                formatFilter === fmt
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {fmt === "ALL" ? `All Formats (${history.length})` : fmt}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search report, file name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* History Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Layers className="w-10 h-10 mx-auto text-slate-600" />
            <div className="text-sm font-semibold text-slate-300">No generated reports found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || formatFilter !== "ALL"
                ? "No reports match your active filter criteria."
                : "No reports have been generated yet. Use the Report Generator to create your first PDF or Excel report."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Document / File</th>
                  <th className="py-3.5 px-3">Report Type</th>
                  <th className="py-3.5 px-3">Format</th>
                  <th className="py-3.5 px-3">Period Scope</th>
                  <th className="py-3.5 px-3">Generated By</th>
                  <th className="py-3.5 px-3">Date</th>
                  <th className="py-3.5 px-3 text-right">Size</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredHistory.map((item) => {
                  const isPdf = item.format.toUpperCase() === "PDF";
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isPdf
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : item.format.toUpperCase() === "XLSX"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {isPdf ? (
                              <FileText className="w-4 h-4" />
                            ) : (
                              <FileSpreadsheet className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate max-w-[240px]">
                              {item.fileName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              ID: {item.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-300">
                          {item.reportType.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            isPdf
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : item.format.toUpperCase() === "XLSX"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {item.format}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-[11px] text-slate-400">
                        {new Date(item.periodStart).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}{" "}
                        –{" "}
                        {new Date(item.periodEnd).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-3 px-3 text-slate-400">
                        {item.generatedBy}
                      </td>

                      <td className="py-3 px-3 text-slate-400">
                        {new Date(item.generatedAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {(item.fileSize / 1024).toFixed(1)} KB
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Direct Download */}
                          <a
                            href={item.downloadUrl}
                            download
                            title="Download file"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                          >
                            <Download className="w-4 h-4" />
                          </a>

                          {/* View in Browser (PDF) */}
                          {isPdf && (
                            <button
                              onClick={() => window.open(item.downloadUrl, "_blank")}
                              title="View in browser"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-all"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}

                          {/* Regenerate (PDF) */}
                          {isPdf && (
                            <button
                              onClick={() => handleRegenerate(item.id)}
                              disabled={isRegenerating === item.id}
                              title="Regenerate Report"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all disabled:opacity-50"
                            >
                              {isRegenerating === item.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Delete File */}
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={isDeleting === item.id}
                            title="Delete generated file from storage"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all disabled:opacity-50"
                          >
                            {isDeleting === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
