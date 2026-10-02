import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { Prisma, ImportStatus } from "@prisma/client";
import {
  FileSpreadsheet,
  History,
  ArrowLeft,
  UploadCloud,
  ExternalLink,
} from "lucide-react";
import { formatBusinessDateTime } from "@/lib/date";

export default async function ImportHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { status } = await searchParams;

  const whereClause: Prisma.ImportBatchWhereInput = {
    businessId: user.businessId,
  };
  if (status && status !== "ALL") {
    whereClause.status = status as ImportStatus;
  }

  const batches = await prisma.importBatch.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { transactions: true, rows: true },
      },
    },
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/imports"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Imports
            </Link>
            <span className="text-xs text-slate-600">/</span>
            <span className="text-xs text-orange-400 font-semibold">Audit History</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
            <History className="w-6 h-6 text-orange-400" />
            Import History & Provenance Logs
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Full chronological archive of all spreadsheet uploads, validations, and committed batches.
          </p>
        </div>

        <Link
          href="/imports/new"
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4" /> New Import
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {["ALL", "COMMITTED", "VALIDATED", "VALIDATING", "FAILED"].map((s) => {
          const isActive = (!status && s === "ALL") || status === s;
          return (
            <Link
              key={s}
              href={s === "ALL" ? "/imports/history" : `/imports/history?status=${s}`}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {s}
            </Link>
          );
        })}
      </div>

      {/* Batches Table */}
      <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
        {batches.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">No import history found</div>
              <p className="text-xs text-slate-500 mt-1">No batches match the selected filter criteria.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Spreadsheet File</th>
                  <th className="p-3">Upload Timestamp</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-center">Total Rows</th>
                  <th className="p-3 text-center">Valid</th>
                  <th className="p-3 text-center">Errors</th>
                  <th className="p-3 text-center">Duplicates</th>
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
                        <span className="truncate max-w-[220px]">{b.originalFileName}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">
                      {formatBusinessDateTime(b.createdAt)}
                    </td>
                    <td className="p-3 uppercase font-mono text-[11px] text-slate-400">
                      {b.fileType}
                    </td>
                    <td className="p-3 text-center font-mono font-medium">{b.totalRows}</td>
                    <td className="p-3 text-center text-emerald-400 font-mono font-semibold">
                      {b.validRows}
                    </td>
                    <td className="p-3 text-center text-rose-400 font-mono">
                      {b.errorRows > 0 ? b.errorRows : "-"}
                    </td>
                    <td className="p-3 text-center text-purple-400 font-mono">
                      {b.duplicateRows > 0 ? b.duplicateRows : "-"}
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
    </div>
  );
}
