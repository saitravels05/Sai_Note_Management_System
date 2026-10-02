"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Sliders,
} from "lucide-react";
import {
  getImportBatchAction,
  rollbackImportBatchAction,
} from "@/server/actions/import.actions";
import { formatBusinessDateTime } from "@/lib/date";

interface StagedRowDetail {
  id: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
  normalizedData: {
    transactionDateFormatted?: string;
    amount?: string;
    title?: string;
    transactionType?: string;
    [key: string]: unknown;
  } | null;
  validationStatus: "VALID" | "WARNING" | "ERROR" | "DUPLICATE" | "EXCLUDED";
  validationErrors: { field: string; message: string }[] | null;
  duplicateMatch: {
    isExact: boolean;
    existingNumber: string;
    reason: string;
  } | null;
}

interface BatchDetailData {
  batch: {
    id: string;
    originalFileName: string;
    fileType: string;
    status: string;
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
    duplicateRows: number;
    mappingConfiguration: {
      targetType?: string;
      sheetName?: string;
      headerRowIndex?: number;
      importMode?: string;
      columnMappings?: Record<string, string>;
    };
    createdAt: string;
    committedAt?: string | null;
  };
  rows: StagedRowDetail[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
}

export default function ImportBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const batchId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [batchData, setBatchData] = useState<BatchDetailData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rollback Modal State
  const [isRollbackOpen, setIsRollbackOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState("");
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const reloadBatch = async () => {
    setLoading(true);
    try {
      const res = await getImportBatchAction(batchId, { pageSize: 100 });
      if (res.success && res.data) {
        setBatchData(res.data as unknown as BatchDetailData);
      } else {
        setErrorMessage(res.error || "Failed to load import batch.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error loading batch.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await getImportBatchAction(batchId, { pageSize: 100 });
        if (!ignore) {
          if (res.success && res.data) {
            setBatchData(res.data as unknown as BatchDetailData);
          } else {
            setErrorMessage(res.error || "Failed to load import batch.");
          }
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Network error loading batch.";
          setErrorMessage(msg);
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      ignore = true;
    };
  }, [batchId]);

  const handleRollback = async () => {
    if (!rollbackReason.trim() || rollbackReason.trim().length < 5) {
      setErrorMessage("Please provide a detailed reason (at least 5 characters) for rollback.");
      return;
    }

    setRollbackLoading(true);
    setErrorMessage(null);

    try {
      const res = await rollbackImportBatchAction(batchId, rollbackReason);
      if (res.success) {
        setIsRollbackOpen(false);
        reloadBatch();
      } else {
        setErrorMessage(res.error || "Rollback failed.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rollback execution failed.";
      setErrorMessage(msg);
    } finally {
      setRollbackLoading(false);
    }
  };

  if (loading && !batchData) {
    return (
      <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-orange-400" />
        <span>Loading import batch details...</span>
      </div>
    );
  }

  if (!batchData?.batch) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="text-rose-400 font-semibold text-base">Import batch not found</div>
        <p className="text-xs text-slate-400">{errorMessage || "You may not have permission to view this batch."}</p>
        <Link
          href="/imports"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Imports
        </Link>
      </div>
    );
  }

  const { batch, rows } = batchData;
  const mappingConfig = batch.mappingConfiguration || {};

  const filteredRows = rows.filter((r) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "VALID") return r.validationStatus === "VALID";
    if (activeTab === "WARNING") return r.validationStatus === "WARNING";
    if (activeTab === "ERROR") return r.validationStatus === "ERROR";
    if (activeTab === "DUPLICATE") return r.validationStatus === "DUPLICATE";
    if (activeTab === "EXCLUDED") return r.validationStatus === "EXCLUDED";
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
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
            <span className="text-xs text-orange-400 font-mono">{batch.id.substring(0, 10)}...</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-orange-400" />
            {batch.originalFileName}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Uploaded {formatBusinessDateTime(batch.createdAt)} • Format: {batch.fileType?.toUpperCase()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {batch.status === "COMMITTED" && (
            <button
              onClick={() => setIsRollbackOpen(true)}
              className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Rollback Batch
            </button>
          )}

          {batch.status === "VALIDATED" && (
            <Link
              href="/imports/new"
              className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
            >
              Resume Import Wizard
            </Link>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-xs text-slate-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div className="text-xs text-slate-400 font-semibold">Total Rows</div>
          <div className="text-xl font-bold text-white mt-1">{batch.totalRows}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
          <div className="text-xs text-emerald-400 font-semibold">Valid Rows</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{batch.validRows}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
          <div className="text-xs text-amber-400 font-semibold">Warnings</div>
          <div className="text-xl font-bold text-amber-400 mt-1">{batch.warningRows}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
          <div className="text-xs text-rose-400 font-semibold">Errors</div>
          <div className="text-xl font-bold text-rose-400 mt-1">{batch.errorRows}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
          <div className="text-xs text-purple-400 font-semibold">Duplicates</div>
          <div className="text-xl font-bold text-purple-400 mt-1">{batch.duplicateRows}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
          <div className="text-xs text-slate-400 font-semibold">Status</div>
          <div className="mt-1">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                batch.status === "COMMITTED"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : batch.status === "FAILED"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/30"
              }`}
            >
              {batch.status}
            </span>
          </div>
        </div>
      </div>

      {/* Mapping Configuration Panel */}
      <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-orange-400" />
          Import Configuration & Mapping Applied
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Target Entity Type</span>
            <span className="font-semibold text-white mt-0.5 block">{mappingConfig.targetType || "TRANSACTION"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Sheet Processed</span>
            <span className="font-semibold text-white mt-0.5 block">{mappingConfig.sheetName || "Default"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Header Row Index</span>
            <span className="font-semibold text-white mt-0.5 block">Row {mappingConfig.headerRowIndex || 1}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Committed Mode</span>
            <span className="font-semibold text-white mt-0.5 block">{mappingConfig.importMode || "DRAFT"}</span>
          </div>
        </div>

        {mappingConfig.columnMappings && (
          <div className="pt-2">
            <span className="text-[11px] text-slate-400 block mb-1.5 font-semibold">Active Field Mappings:</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(mappingConfig.columnMappings)
                .filter(([, target]) => target !== "IGNORE")
                .map(([col, target]) => (
                  <span
                    key={col}
                    className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono"
                  >
                    <strong>{col}</strong> → <span className="text-orange-400">{String(target)}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Staged Rows Browser */}
      <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Staged Rows Audit Trail</h3>
            <p className="text-xs text-slate-400">
              Row-by-row staging data showing normalization and validation results.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {["ALL", "VALID", "WARNING", "ERROR", "DUPLICATE", "EXCLUDED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3 w-14 text-center">Row</th>
                <th className="p-3">Normalized Data</th>
                <th className="p-3">Raw Values</th>
                <th className="p-3">Status</th>
                <th className="p-3">Validation Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    No rows match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const norm = r.normalizedData || {};
                  const errors = r.validationErrors || [];

                  return (
                    <tr key={r.id} className="hover:bg-slate-900/30">
                      <td className="p-3 text-center font-mono text-slate-400">
                        {r.rowNumber}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <div>
                          <strong className="text-white">{(norm.title as string) || "Record"}</strong> •{" "}
                          <span className="text-orange-400 font-semibold">₹{(norm.amount as string) || "0"}</span>
                        </div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          Date: {(norm.transactionDateFormatted as string) || "-"} • Type: {(norm.transactionType as string)}
                        </div>
                      </td>
                      <td className="p-3 text-slate-400 font-mono text-[10px] max-w-[200px] truncate">
                        {JSON.stringify(r.rawData)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            r.validationStatus === "VALID"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : r.validationStatus === "ERROR"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : r.validationStatus === "DUPLICATE"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              : r.validationStatus === "WARNING"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          {r.validationStatus}
                        </span>
                      </td>
                      <td className="p-3 text-[11px]">
                        {errors.length > 0 ? (
                          <div className="space-y-0.5">
                            {errors.map((err, eIdx) => (
                              <div key={eIdx} className="text-rose-300">
                                • {err.message}
                              </div>
                            ))}
                          </div>
                        ) : r.duplicateMatch ? (
                          <span className="text-purple-300">{r.duplicateMatch.reason}</span>
                        ) : (
                          <span className="text-emerald-400">✓ Validated</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rollback Confirmation Modal */}
      {isRollbackOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              Confirm Import Rollback
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Rolling back this import will void or cleanly remove all transactions created by this batch. Records with subsequent payment allocations cannot be rolled back without reversing payments first.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Reason for Rollback * (Mandatory for audit trail):
              </label>
              <textarea
                rows={3}
                placeholder="Explain why this import batch is being reversed..."
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRollbackOpen(false)}
                disabled={rollbackLoading}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRollback}
                disabled={rollbackLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 disabled:opacity-50"
              >
                {rollbackLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Rolling back...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Execute Rollback
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
