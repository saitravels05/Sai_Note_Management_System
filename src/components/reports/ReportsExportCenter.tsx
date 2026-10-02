"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Download,
  History,
  Trash2,
  Clock,
  Sparkles,
  Building2,
  Users,
  Wallet,
  TrendingUp,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart,
  BarChart3,
  Calendar,
  FileCheck,
  Eye,
  Search,
} from "lucide-react";
import Link from "next/link";
import { QuickExportModal } from "@/components/exports/QuickExportModal";
import { QuickPdfModal } from "@/components/reports/QuickPdfModal";
import { deleteExportAction } from "@/server/actions/export.actions";
import { type ExportType } from "@/server/services/export.service";
import { type PdfReportType } from "@/server/services/pdf-report.service";

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

interface ReportsExportCenterProps {
  businessName: string;
  initialHistory: SerializedExportHistoryItem[];
  userPermissions: string[];
  userRoles: string[];
}

interface ReportDefinition {
  pdfType: PdfReportType;
  exportType?: ExportType;
  title: string;
  description: string;
  section: "FINANCIAL" | "OUTSTANDING" | "CUSTOMER" | "SUPPLIER" | "ANALYSIS";
  icon: React.ElementType;
  iconColor: string;
  hasExcel: boolean;
}

const REPORT_DEFINITIONS: ReportDefinition[] = [
  // 1. FINANCIAL REPORTS
  {
    pdfType: "MONTHLY_ACCOUNTING",
    exportType: "MONTHLY_WORKBOOK",
    title: "Monthly Accounting Report (Flagship)",
    description: "Executive P&L, Money In vs Out, Balance Sheet Receivables & Payables, and Category breakdowns.",
    section: "FINANCIAL",
    icon: Sparkles,
    iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    hasExcel: true,
  },
  {
    pdfType: "FINANCIAL_SUMMARY",
    exportType: "FINANCIAL_SUMMARY",
    title: "Executive Financial Summary",
    description: "Compact 1-page summary clearly distinguishing recognized operating margins from physical cash movements.",
    section: "FINANCIAL",
    icon: TrendingUp,
    iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    hasExcel: true,
  },
  {
    pdfType: "INCOME",
    exportType: "INCOME",
    title: "Income & Revenue Statement",
    description: "Recognized sales from flight tickets, holiday packages, visa processing commissions, and other revenue.",
    section: "FINANCIAL",
    icon: ArrowDownLeft,
    iconColor: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    hasExcel: true,
  },
  {
    pdfType: "EXPENSES",
    exportType: "EXPENSES",
    title: "Operational Expense Statement",
    description: "Direct airline settlements, hotel supplier disbursements, visa charges, rent, salaries, and operating overheads.",
    section: "FINANCIAL",
    icon: ArrowUpRight,
    iconColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    hasExcel: true,
  },
  {
    pdfType: "TRANSACTIONS",
    exportType: "TRANSACTIONS",
    title: "Transactions Journal",
    description: "Authorized financial transactions with dates, party names, categories, amounts, and reference numbers.",
    section: "FINANCIAL",
    icon: Receipt,
    iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    hasExcel: true,
  },
  {
    pdfType: "PAYMENTS",
    exportType: "PAYMENTS",
    title: "Payment Movements Report",
    description: "Physical liquidity movements: Bank transfers, UPI receipts, cash collections and vendor payouts.",
    section: "FINANCIAL",
    icon: Wallet,
    iconColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    hasExcel: true,
  },
  {
    pdfType: "CASH_MOVEMENT",
    title: "Cash Movement & Liquidity Report",
    description: "Opening cash, cash inflows, operational outflows, adjustments, and closing liquidity position.",
    section: "FINANCIAL",
    icon: Wallet,
    iconColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    hasExcel: false,
  },

  // 2. OUTSTANDING REPORTS
  {
    pdfType: "RECEIVABLES",
    exportType: "RECEIVABLES",
    title: "Accounts Receivable (Customer Dues)",
    description: "Pending customer invoices, partial payments received, outstanding balances, and days overdue.",
    section: "OUTSTANDING",
    icon: Users,
    iconColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    hasExcel: true,
  },
  {
    pdfType: "PAYABLES",
    exportType: "PAYABLES",
    title: "Accounts Payable (Supplier Liabilities)",
    description: "Pending liabilities to airlines, aggregators, transport operators, and hotels.",
    section: "OUTSTANDING",
    icon: Building2,
    iconColor: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    hasExcel: true,
  },
  {
    pdfType: "RECEIVABLE_AGING",
    exportType: "RECEIVABLE_AGING",
    title: "Receivable Aging Schedule",
    description: "Outstanding customer debt categorized into 5 aging buckets (Current, 1-30, 31-60, 61-90, 90+ days).",
    section: "OUTSTANDING",
    icon: Clock,
    iconColor: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    hasExcel: true,
  },
  {
    pdfType: "PAYABLE_AGING",
    exportType: "PAYABLE_AGING",
    title: "Payable Aging Schedule",
    description: "Vendor liabilities distributed into 5 maturity buckets to protect cash liquidity and supplier goodwill.",
    section: "OUTSTANDING",
    icon: Clock,
    iconColor: "text-pink-400 bg-pink-500/10 border-pink-500/20",
    hasExcel: true,
  },

  // 3. CUSTOMER REPORTS
  {
    pdfType: "CUSTOMER_STATEMENT",
    title: "Customer Statement of Account",
    description: "Professional client statement with business branding, bookings, payments, and closing balance (internal notes omitted).",
    section: "CUSTOMER",
    icon: Users,
    iconColor: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    hasExcel: false,
  },
  {
    pdfType: "CUSTOMER_LEDGER",
    exportType: "CUSTOMER_LEDGER",
    title: "Customer Ledger Account",
    description: "Formal accounting ledger with debits, credits, and chronological running balances.",
    section: "CUSTOMER",
    icon: Users,
    iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    hasExcel: true,
  },

  // 4. SUPPLIER REPORTS
  {
    pdfType: "SUPPLIER_STATEMENT",
    title: "Supplier Statement of Account",
    description: "Supplier statement with vendor profile, billings, payments made, and net outstanding liability.",
    section: "SUPPLIER",
    icon: Building2,
    iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    hasExcel: false,
  },
  {
    pdfType: "SUPPLIER_LEDGER",
    exportType: "SUPPLIER_LEDGER",
    title: "Supplier Ledger Account",
    description: "Reconciled ledger for airlines, hotel partners, and transport suppliers.",
    section: "SUPPLIER",
    icon: Building2,
    iconColor: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    hasExcel: true,
  },

  // 5. ANALYSIS REPORTS
  {
    pdfType: "CATEGORY_SUMMARY",
    title: "Category Breakdown Analysis",
    description: "Revenue and expenses grouped by categories with transaction volume and percentage distribution.",
    section: "ANALYSIS",
    icon: PieChart,
    iconColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    hasExcel: false,
  },
  {
    pdfType: "PAYMENT_METHOD_SUMMARY",
    title: "Payment Method Breakdown",
    description: "Inflows and outflows by payment mode (Bank Transfer, UPI, Cash, Cards).",
    section: "ANALYSIS",
    icon: BarChart3,
    iconColor: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
    hasExcel: false,
  },
  {
    pdfType: "DAILY_SUMMARY",
    title: "Daily Financial Movements",
    description: "Day-by-day revenue, expenses, cash in, cash out, and transaction counts.",
    section: "ANALYSIS",
    icon: Calendar,
    iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    hasExcel: false,
  },
  {
    pdfType: "MONTHLY_SUMMARY",
    title: "Monthly Multi-Period Trends",
    description: "Month-over-month trajectory of recognized revenue and operating expenses.",
    section: "ANALYSIS",
    icon: TrendingUp,
    iconColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    hasExcel: false,
  },
  {
    pdfType: "MANAGEMENT_SUMMARY",
    title: "Executive Management Briefing",
    description: "Strategic executive brief with financial KPIs, liquidity ratios, and deterministic insights.",
    section: "ANALYSIS",
    icon: FileCheck,
    iconColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    hasExcel: false,
  },
];

export function ReportsExportCenter({
  businessName,
  initialHistory,
}: ReportsExportCenterProps) {
  const [activeTab, setActiveTab] = useState<"ALL" | "FINANCIAL" | "OUTSTANDING" | "PARTIES" | "ANALYSIS" | "HISTORY">("ALL");
  const [history, setHistory] = useState<SerializedExportHistoryItem[]>(initialHistory);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this generated report file from storage?")) {
      return;
    }
    setIsDeleting(id);
    try {
      const res = await deleteExportAction(id);
      if (res.success) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert(res.error || "Failed to delete file.");
      }
    } catch {
      alert("Error deleting report file.");
    } finally {
      setIsDeleting(null);
    }
  };

  const SECTIONS = [
    { key: "FINANCIAL", title: "Financial Reports", desc: "Official P&L, Balance Sheet summaries, journals, and liquidity statements." },
    { key: "OUTSTANDING", title: "Outstanding Reports", desc: "Customer receivables, supplier payables, and 5-tier aging schedules." },
    { key: "CUSTOMER", title: "Customer Reports", desc: "Client-facing statements and chronological running-balance ledgers." },
    { key: "SUPPLIER", title: "Supplier Reports", desc: "Vendor statements, disbursements, and supplier liability ledgers." },
    { key: "ANALYSIS", title: "Analysis & Trends", desc: "Category breakdowns, payment method distributions, daily summaries, and executive briefing." },
  ] as const;

  const filteredDefinitions = REPORT_DEFINITIONS.filter((r) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "PARTIES") return r.section === "CUSTOMER" || r.section === "SUPPLIER";
    return r.section === activeTab;
  }).filter((r) => {
    if (!searchQuery.trim()) return true;
    return (
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
              {businessName}
            </span>
            <span className="text-xs text-slate-400">• Financial Reports & Statements</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Accounting Report Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate print-ready A4 PDF statements, ledgers, and multi-sheet Excel workbooks from verified accounting data.
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/reports/generate"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-950/40 transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>Launch Report Generator</span>
          </Link>

          <QuickExportModal
            buttonText="Export Monthly Workbook"
            defaultExportType="MONTHLY_WORKBOOK"
            buttonClassName="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all"
          />

          <Link
            href="/reports/history"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all"
          >
            <History className="w-4 h-4 text-orange-400" />
            <span>History ({history.length})</span>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: "ALL", label: "All Statements" },
            { id: "FINANCIAL", label: "Financial Reports" },
            { id: "OUTSTANDING", label: "Outstanding Dues" },
            { id: "PARTIES", label: "Party Ledgers" },
            { id: "ANALYSIS", label: "Analysis & Trends" },
            { id: "HISTORY", label: `Audit History (${history.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === tab.id
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== "HISTORY" && (
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search statements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        )}
      </div>

      {/* Tab Content: REPORT CARDS */}
      {activeTab !== "HISTORY" && (
        <div className="space-y-8">
          {SECTIONS.filter((sec) => {
            if (activeTab === "ALL") return true;
            if (activeTab === "PARTIES") return sec.key === "CUSTOMER" || sec.key === "SUPPLIER";
            return sec.key === activeTab;
          }).map((sec) => {
            const items = filteredDefinitions.filter((r) => r.section === sec.key);
            if (items.length === 0) return null;

            return (
              <div key={sec.key} className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>{sec.title}</span>
                    <span className="text-xs font-normal text-slate-500">
                      ({items.length} {items.length === 1 ? "report" : "reports"})
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">{sec.desc}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((report) => {
                    const Icon = report.icon;
                    return (
                      <div
                        key={report.pdfType}
                        className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm hover:shadow-lg hover:shadow-slate-950/30"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className={`p-2.5 rounded-xl border ${report.iconColor}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                PDF
                              </span>
                              {report.hasExcel && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  XLSX
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-rose-400 transition-colors">
                              {report.title}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                              {report.description}
                            </p>
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <QuickPdfModal
                              buttonText="Generate PDF"
                              defaultReportType={report.pdfType}
                              buttonClassName="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600/90 hover:bg-rose-500 text-white shadow-sm transition-all"
                            />
                            {report.hasExcel && report.exportType && (
                              <QuickExportModal
                                buttonText="Excel"
                                defaultExportType={report.exportType}
                                buttonClassName="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-all"
                              />
                            )}
                          </div>

                          <Link
                            href={`/reports/generate?type=${report.pdfType}`}
                            className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
                          >
                            Configure →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab Content: HISTORY */}
      {activeTab === "HISTORY" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Recent Generated Reports</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Download previously generated PDF statements and Excel workbooks from private storage.
              </p>
            </div>
            <Link
              href="/reports/history"
              className="text-xs font-semibold text-rose-400 hover:text-rose-300"
            >
              Open Full Audit History →
            </Link>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-lg">
            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-600" />
                <div className="text-xs font-semibold">No reports generated yet</div>
                <p className="text-[11px] text-slate-500">
                  Generate your first PDF report using the action buttons above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold uppercase text-[10px]">
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Format</th>
                      <th className="py-3 px-3">Generated Date</th>
                      <th className="py-3 px-3 text-right">Size</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {history.slice(0, 15).map((item) => {
                      const isPdf = item.format.toUpperCase() === "PDF";
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {isPdf ? (
                                <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                              ) : (
                                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                              <span className="font-semibold text-white truncate max-w-[200px]">
                                {item.fileName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {item.reportType.replace(/_/g, " ")}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                isPdf
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              }`}
                            >
                              {item.format}
                            </span>
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
                              <a
                                href={item.downloadUrl}
                                download
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
                                title="Download file"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              {isPdf && (
                                <button
                                  onClick={() => window.open(item.downloadUrl, "_blank")}
                                  className="p-1.5 text-slate-400 hover:text-sky-400 rounded-lg hover:bg-slate-800 transition-all"
                                  title="View in browser"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(item.id)}
                                disabled={isDeleting === item.id}
                                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-all"
                                title="Delete file"
                              >
                                <Trash2 className="w-4 h-4" />
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
      )}
    </div>
  );
}
