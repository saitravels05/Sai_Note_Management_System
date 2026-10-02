import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  Download,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { formatBusinessDateTime } from "@/lib/date";

export default async function ImportsHubPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch recent import batches and summary metrics
  const [batches, totalCount, completedCount, stagingCount, failedCount] = await Promise.all([
    prisma.importBatch.findMany({
      where: { businessId: user.businessId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        _count: {
          select: { transactions: true, rows: true },
        },
      },
    }),
    prisma.importBatch.count({ where: { businessId: user.businessId } }),
    prisma.importBatch.count({ where: { businessId: user.businessId, status: "COMMITTED" } }),
    prisma.importBatch.count({
      where: { businessId: user.businessId, status: { in: ["UPLOADED", "PARSED", "MAPPED", "VALIDATING", "VALIDATED"] } },
    }),
    prisma.importBatch.count({ where: { businessId: user.businessId, status: "FAILED" } }),
  ]);

  const templateCards = [
    {
      type: "income",
      title: "Income & Receipts",
      desc: "Client payments, booking revenues, and passenger receipts.",
    },
    {
      type: "expense",
      title: "Expenses & Bills",
      desc: "Vendor bills, hotel bookings, flight tickets, and diesel expenses.",
    },
    {
      type: "receivable",
      title: "Receivables (Invoices)",
      desc: "Outstanding credit invoices and corporate client billing.",
    },
    {
      type: "payable",
      title: "Payables (Vendor Dues)",
      desc: "Pending supplier payments and fleet operator balances.",
    },
    {
      type: "transactions",
      title: "General Mixed Ledger",
      desc: "Multi-type spreadsheets classified by a Transaction Type column.",
    },
    {
      type: "customers",
      title: "Customer Master",
      desc: "Customer names, phone numbers, emails, and opening balances.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Safe Staging Importer
            </span>
            <span className="text-xs text-slate-500">Excel (.xlsx, .xls) & CSV</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Spreadsheet Import & Migration Engine</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Safely convert your existing business spreadsheets into verified accounting records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/imports/templates"
            className="px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Templates
          </Link>
          <Link
            href="/imports/history"
            className="px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 transition-all flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5" /> Full History
          </Link>
          <Link
            href="/imports/new"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5"
          >
            <UploadCloud className="w-4 h-4" /> New Import Wizard
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl glass-card border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Imports</span>
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Files uploaded</div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-400">Committed to Ledger</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{completedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active ledger batches</div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-400">Staged / Validating</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">{stagingCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Awaiting user confirmation</div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Rolled Back / Failed</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-slate-300 mt-2">{failedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Safely isolated</div>
        </div>
      </div>

      {/* Recent Imports Table */}
      <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-orange-400" />
              Recent Imports
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review and manage your recent spreadsheet uploads and staged batches.
            </p>
          </div>

          <Link
            href="/imports/history"
            className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium"
          >
            View all ({totalCount}) <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {batches.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 text-slate-400 flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">No spreadsheets imported yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Upload your first Excel workbook or CSV file to safely stage and convert records.
              </p>
            </div>
            <Link
              href="/imports/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
            >
              <UploadCloud className="w-3.5 h-3.5" /> Start First Import
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">File Name</th>
                  <th className="p-3">Uploaded</th>
                  <th className="p-3">Format</th>
                  <th className="p-3 text-center">Total Rows</th>
                  <th className="p-3 text-center">Valid</th>
                  <th className="p-3 text-center">Errors</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-orange-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{b.originalFileName}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-400">
                      {formatBusinessDateTime(b.createdAt)}
                    </td>
                    <td className="p-3 uppercase font-mono text-[11px] text-slate-400">
                      {b.fileType}
                    </td>
                    <td className="p-3 text-center font-mono">{b.totalRows}</td>
                    <td className="p-3 text-center text-emerald-400 font-mono font-semibold">
                      {b.validRows}
                    </td>
                    <td className="p-3 text-center text-rose-400 font-mono">
                      {b.errorRows > 0 ? b.errorRows : "-"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          b.status === "COMMITTED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : b.status === "FAILED"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/imports/${b.id}`}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-1"
                      >
                        Details <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Downloadable Clean Templates Quick Section */}
      <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-orange-400" />
              Download Standard Clean Templates
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              You are never required to use an exact template, but these files provide clean pre-configured headers.
            </p>
          </div>

          <Link
            href="/imports/templates"
            className="text-xs text-orange-400 hover:text-orange-300 font-medium"
          >
            All Templates & Column Guides →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {templateCards.map((t) => (
            <div
              key={t.type}
              className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                <h3 className="text-xs font-bold text-white">{t.title}</h3>
                <p className="text-[11px] text-slate-400 mt-1">{t.desc}</p>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/60">
                <a
                  href={`/api/imports/templates/${t.type}?format=xlsx`}
                  download
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Excel (.xlsx)
                </a>
                <a
                  href={`/api/imports/templates/${t.type}?format=csv`}
                  download
                  className="px-2.5 py-1 rounded bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-medium flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> CSV
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety & Architecture Guarantees */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
        <div className="p-4 rounded-xl glass-card border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Zero Floating-Point Drift
          </div>
          <p className="text-[11px]">
            Every currency figure is parsed using arbitrary-precision decimal mathematics. Letters or malformed strings are flagged as errors, never turned to ₹0.
          </p>
        </div>

        <div className="p-4 rounded-xl glass-card border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Automatic Reconciliation
          </div>
          <p className="text-[11px]">
            Upon committing an import batch, the Phase 5 reconciliation engine verifies that no orphaned allocations or balance discrepancies were introduced.
          </p>
        </div>

        <div className="p-4 rounded-xl glass-card border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Strict Tenant Isolation
          </div>
          <p className="text-[11px]">
            Every batch, row, customer, and supplier is strictly partitioned by your business ID. Cross-tenant reads and writes are rejected at the database level.
          </p>
        </div>
      </div>
    </div>
  );
}
