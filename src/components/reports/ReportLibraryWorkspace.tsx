"use client";

import { useState } from "react";
import {
  Download,
  Clock,
  Plus,
  Copy,
  Trash2,
  ChevronRight,
  Sliders,
  Search,
} from "lucide-react";
import Link from "next/link";
import { QuickExportModal } from "@/components/exports/QuickExportModal";
import { QuickPdfModal } from "@/components/reports/QuickPdfModal";
import { type ExportType } from "@/server/services/export.service";
import { type PdfReportType } from "@/server/services/pdf-report.service";
import {
  duplicateCustomReportAction,
  deleteCustomReportAction,
} from "@/server/actions/custom-report.actions";

export interface SerializedExportHistoryItem {
  id: string;
  reportType: string;
  format: string;
  periodStart: string;
  periodEnd: string;
  fileName: string;
  fileSize: number;
  generatedAt: string;
  downloadUrl: string;
}

export interface SerializedSavedReportItem {
  id: string;
  name: string;
  description: string | null;
  datasetId: string;
  visibility: string;
  versionNumber: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReportLibraryWorkspaceProps {
  businessName: string;
  initialHistory: SerializedExportHistoryItem[];
  savedReports: SerializedSavedReportItem[];
  templates: { id: string; name: string; description: string; definition: { datasetId?: string } }[];
  userPermissions?: string[];
  userRoles?: string[];
}

type TabKey = "STANDARD" | "CUSTOM" | "SAVED" | "RECENT" | "MANAGEMENT" | "GENERATED" | "TEMPLATES";

export function ReportLibraryWorkspace({
  businessName,
  initialHistory,
  savedReports: initialSavedReports,
  templates,
}: ReportLibraryWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("STANDARD");
  const [savedReports, setSavedReports] = useState(initialSavedReports);
  const [history] = useState(initialHistory);
  const [searchQuery, setSearchQuery] = useState("");

  // Handle Saved Report duplication
  const handleDuplicate = async (id: string) => {
    const res = await duplicateCustomReportAction(id);
    if (res.success && res.data) {
      setSavedReports([
        {
          id: res.data.id,
          name: res.data.name,
          description: res.data.description,
          datasetId: res.data.datasetId,
          visibility: res.data.visibility,
          versionNumber: res.data.versionNumber,
          isFavorite: res.data.isFavorite,
          createdAt: res.data.createdAt.toISOString(),
          updatedAt: res.data.updatedAt.toISOString(),
        },
        ...savedReports,
      ]);
    }
  };

  // Handle Saved Report delete
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this custom report definition?")) return;
    const res = await deleteCustomReportAction(id);
    if (res.success) {
      setSavedReports(savedReports.filter((r) => r.id !== id));
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "STANDARD", label: "Standard Reports" },
    { key: "CUSTOM", label: "Custom Reports" },
    { key: "SAVED", label: `Saved Reports (${savedReports.length})` },
    { key: "RECENT", label: "Recent Reports" },
    { key: "MANAGEMENT", label: "Management Reports" },
    { key: "GENERATED", label: `Generated Artifacts (${history.length})` },
    { key: "TEMPLATES", label: `Templates (${templates.length})` },
  ];

  const filteredSaved = savedReports.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.datasetId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
            <span>{businessName}</span>
            <span>•</span>
            <span>Reporting Hub</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Report Library & Custom Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">
            Standard accounting statements, custom report builder, and management insights.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/reports/builder"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-md shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            Build Custom Report
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-800 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === t.key
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: STANDARD REPORTS */}
      {activeTab === "STANDARD" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: "Monthly Accounting Pack (Flagship)",
              desc: "Complete multi-sheet P&L, Money In vs Out, Receivables, Payables, and Category summaries.",
              pdfType: "MONTHLY_ACCOUNTING" as PdfReportType,
              excelType: "MONTHLY_WORKBOOK" as ExportType,
              badge: "Executive",
            },
            {
              title: "Executive Financial Summary",
              desc: "1-page summary clearly separating recognized operating margins from physical cash movements.",
              pdfType: "FINANCIAL_SUMMARY" as PdfReportType,
              excelType: "FINANCIAL_SUMMARY" as ExportType,
              badge: "Core",
            },
            {
              title: "Income & Revenue Statement",
              desc: "Recognized sales from airline tickets, holiday packages, and visa services.",
              pdfType: "INCOME" as PdfReportType,
              excelType: "INCOME" as ExportType,
              badge: "P&L",
            },
            {
              title: "Operating Expense Statement",
              desc: "Direct supplier disbursements, hotel bookings, salaries, and office overheads.",
              pdfType: "EXPENSES" as PdfReportType,
              excelType: "EXPENSES" as ExportType,
              badge: "P&L",
            },
            {
              title: "Receivable Aging Schedule",
              desc: "Open customer balances aged into Current, 1-30, 31-60, 61-90, and 90+ days.",
              pdfType: "RECEIVABLE_AGING" as PdfReportType,
              excelType: "RECEIVABLES" as ExportType,
              badge: "Collections",
            },
            {
              title: "Payable Aging Schedule",
              desc: "Unsettled supplier bills and airline obligations aged by due date.",
              pdfType: "PAYABLE_AGING" as PdfReportType,
              excelType: "PAYABLES" as ExportType,
              badge: "Disbursements",
            },
          ].map((rep, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {rep.badge}
                  </span>
                  <span className="text-xs text-amber-400 font-medium">Standard</span>
                </div>
                <h3 className="text-sm font-bold text-white">{rep.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{rep.desc}</p>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
                <QuickPdfModal
                  defaultReportType={rep.pdfType}
                  buttonText="PDF"
                  buttonClassName="flex-1 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                />
                <QuickExportModal
                  defaultExportType={rep.excelType}
                  buttonText="Excel"
                  buttonClassName="flex-1 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: CUSTOM REPORTS */}
      {activeTab === "CUSTOM" && (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Sliders className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Create Safe Custom Reports</h2>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            Build bespoke management reports with custom filters, grouping, multi-level breakdowns, and interactive charts. All financial numbers come strictly from the verified accounting engine.
          </p>
          <div className="pt-2">
            <Link
              href="/reports/builder"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Launch Report Builder Wizard
            </Link>
          </div>
        </div>
      )}

      {/* TAB 3: SAVED REPORTS */}
      {activeTab === "SAVED" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search saved reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 w-full"
            />
          </div>

          {filteredSaved.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
              {searchQuery ? "No saved reports match your search." : "No saved custom reports yet. Build a report and save it to reuse and share."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSaved.map((rep) => (
                <div
                  key={rep.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        v{rep.versionNumber} • {rep.datasetId}
                      </span>
                      <span className="text-[10px] text-amber-400 font-semibold uppercase">{rep.visibility}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{rep.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{rep.description || "No description"}</p>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800 text-xs">
                    <Link
                      href={`/reports/builder?savedId=${rep.id}`}
                      className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                    >
                      Run & Edit <ChevronRight className="w-3.5 h-3.5" />
                    </Link>

                    <div className="flex items-center gap-2 text-slate-400">
                      <button
                        onClick={() => handleDuplicate(rep.id)}
                        className="hover:text-white p-1"
                        title="Duplicate Report"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rep.id)}
                        className="hover:text-rose-400 p-1"
                        title="Delete Report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RECENT REPORTS */}
      {activeTab === "RECENT" && (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
          <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <h3 className="text-sm font-bold text-white">Recently Accessed & Generated Reports</h3>
          <p className="text-xs text-slate-400">
            Audit-tracked report executions. Check the Generated Artifacts tab for historical files.
          </p>
        </div>
      )}

      {/* TAB 5: MANAGEMENT REPORTS */}
      {activeTab === "MANAGEMENT" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 uppercase">Executive Pack</span>
              <span className="text-xs text-slate-400">Monthly</span>
            </div>
            <h3 className="text-base font-bold text-white">Complete Management Financial Pack</h3>
            <p className="text-xs text-slate-400">
              Covers Revenue, Expenses, Net Result, Bank/Cash liquidity, Top 10 customer exposures, and Aging schedule.
            </p>
            <div className="pt-2">
              <QuickPdfModal
                defaultReportType="MANAGEMENT_SUMMARY"
                buttonText="Generate Management PDF"
                buttonClassName="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all inline-flex items-center gap-2"
              />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-400 uppercase">Audit & Health</span>
              <span className="text-xs text-slate-400">Real-time</span>
            </div>
            <h3 className="text-base font-bold text-white">Accounting Health & Discrepancies</h3>
            <p className="text-xs text-slate-400">
              Detect unallocated payments, draft journal entries, and month-end verification discrepancies.
            </p>
            <div className="pt-2">
              <Link
                href="/reports/builder"
                className="inline-block px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all"
              >
                Review Health in Builder
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: GENERATED ARTIFACTS */}
      {activeTab === "GENERATED" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {history.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">No historical export files found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">File Name</th>
                    <th className="p-3.5">Report Type</th>
                    <th className="p-3.5">Format</th>
                    <th className="p-3.5">Generated At</th>
                    <th className="p-3.5 text-right">Size</th>
                    <th className="p-3.5 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-850/50">
                      <td className="p-3.5 font-medium text-white">{h.fileName}</td>
                      <td className="p-3.5 text-slate-400">{h.reportType.replace(/_/g, " ")}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-slate-300">
                          {h.format}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {new Date(h.generatedAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-400">
                        {(h.fileSize / 1024).toFixed(1)} KB
                      </td>
                      <td className="p-3.5 text-right">
                        <a
                          href={h.downloadUrl}
                          download
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 inline-block"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: TEMPLATES */}
      {activeTab === "TEMPLATES" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold">
                    Template
                  </span>
                  <span className="text-xs text-slate-400">{tpl.definition.datasetId}</span>
                </div>
                <h3 className="text-sm font-bold text-white">{tpl.name}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{tpl.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800">
                <Link
                  href={`/reports/builder?templateId=${tpl.id}`}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  Customize in Builder
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
