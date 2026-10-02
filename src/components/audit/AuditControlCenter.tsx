"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Download,
  RefreshCw,
  Eye,
  Calendar,
  User,
  Database,
  FileSpreadsheet,
} from "lucide-react";
import {
  searchAuditLogsAction,
  verifyAuditIntegrityAction,
  getSecurityEventsAction,
  type IntegrityActionResult,
} from "@/server/actions/audit.actions";

interface AuditLogItem {
  id: string;
  action: string;
  category: string;
  severity: "INFO" | "WARNING" | "CRITICAL" | "SECURITY";
  entityType: string;
  entityId: string;
  actorNameSnapshot: string;
  actorRoleSnapshot: string;
  reason?: string;
  source?: string;
  changedFields: string[];
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  correlationId?: string;
  requestId?: string;
  previousHash?: string;
  eventHash?: string;
  createdAt: string;
}

export function AuditControlCenter() {
  const [activeTab, setActiveTab] = useState<"all" | "financial" | "security" | "month_end" | "documents" | "crm" | "backups">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<"all" | "today" | "yesterday" | "this_week" | "this_month">("all");
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [integrityState, setIntegrityState] = useState<IntegrityActionResult["result"] | null>(null);
  const [isVerifyingIntegrity, startIntegrityTransition] = useTransition();
  const [isLoadingLogs, startLoadingTransition] = useTransition();
  const [isSecurityView, setIsSecurityView] = useState(false);

  const fetchLogs = useCallback(() => {
    startLoadingTransition(async () => {
      if (isSecurityView) {
        const res = await getSecurityEventsAction(100, 0);
        if (res.success && res.events) {
          setLogs(res.events as unknown as AuditLogItem[]);
          setTotalCount(res.total);
        }
        return;
      }

      let categoryParam: string | undefined = undefined;
      if (activeTab === "financial") categoryParam = "FINANCIAL";
      else if (activeTab === "security") categoryParam = "SECURITY";
      else if (activeTab === "month_end") categoryParam = "MONTH_END";
      else if (activeTab === "documents") categoryParam = "DOCUMENT";
      else if (activeTab === "crm") categoryParam = "CRM";
      else if (activeTab === "backups") categoryParam = "BACKUP";

      const res = await searchAuditLogsAction({
        query: searchQuery || undefined,
        category: categoryParam,
        dateRangePreset: datePreset !== "all" ? datePreset : undefined,
        limit: 50,
      });

      if (res.success && res.data) {
        setLogs(res.data.items as AuditLogItem[]);
        setTotalCount(res.data.totalCount);
      }
    });
  }, [activeTab, searchQuery, datePreset, isSecurityView]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleVerifyIntegrity = () => {
    startIntegrityTransition(async () => {
      const res = await verifyAuditIntegrityAction();
      if (res.success && res.result) {
        setIntegrityState(res.result);
      }
    });
  };

  const handleExport = (format: "csv" | "excel") => {
    const params = new URLSearchParams();
    params.set("format", format);
    if (searchQuery) params.set("query", searchQuery);
    if (activeTab === "financial") params.set("category", "FINANCIAL");
    if (activeTab === "security") params.set("category", "SECURITY");
    if (activeTab === "month_end") params.set("category", "MONTH_END");
    if (activeTab === "documents") params.set("category", "DOCUMENT");
    if (activeTab === "crm") params.set("category", "CRM");
    if (activeTab === "backups") params.set("category", "BACKUP");

    window.open(`/api/audit/export?${params.toString()}`, "_blank");
  };

  const getSeverityBadge = (severity: AuditLogItem["severity"]) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case "SECURITY":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "WARNING":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Administrative Accountability & Investigation
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1.5">Audit Control Center</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Tamper-evident, append-only log of every financial, CRM, document, and security action with SHA-256 integrity chaining.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleVerifyIntegrity}
            disabled={isVerifyingIntegrity}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingIntegrity ? "animate-spin" : ""}`} />
            {isVerifyingIntegrity ? "Verifying..." : "Verify Audit Integrity"}
          </button>

          <button
            onClick={() => handleExport("csv")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            CSV
          </button>

          <button
            onClick={() => handleExport("excel")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Excel
          </button>
        </div>
      </div>

      {/* Cryptographic Chain Integrity Banner */}
      {integrityState && (
        <div
          className={`p-4 rounded-2xl border transition-all ${
            integrityState.status === "VERIFIED"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : integrityState.status === "BROKEN"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
              : "bg-slate-900/60 border-slate-800 text-slate-300"
          }`}
        >
          <div className="flex items-start gap-3">
            {integrityState.status === "VERIFIED" ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">
                  {integrityState.status === "VERIFIED"
                    ? "Cryptographic Audit Chain: VERIFIED"
                    : integrityState.status === "BROKEN"
                    ? "CRITICAL: Audit Integrity Compromised (Tamper Detected)"
                    : "Audit Integrity: No Records"}
                </span>
                <span className="text-[11px] opacity-75">
                  Verified at: {new Date(integrityState.verifiedAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs mt-1 opacity-90">
                {integrityState.status === "VERIFIED"
                  ? `Successfully validated ${integrityState.verifiedCount} historical audit records. Zero modified payloads or broken previousHash pointers.`
                  : integrityState.reason || "Hash mismatch detected in audit trail."}
              </p>
              {integrityState.status === "BROKEN" && integrityState.brokenLogId && (
                <div className="mt-2 p-2 rounded-lg bg-black/40 text-[11px] font-mono text-rose-300 space-y-0.5">
                  <div>Culprit Record ID: {integrityState.brokenLogId}</div>
                  <div>Record Index: {integrityState.brokenIndex}</div>
                  <div>Expected Hash: {integrityState.expectedHash?.slice(0, 24)}...</div>
                  <div>Actual Hash: {integrityState.actualHash?.slice(0, 24)}...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls Bar: Tabs & Search */}
      <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
            <button
              onClick={() => {
                setIsSecurityView(false);
                setActiveTab("all");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !isSecurityView && activeTab === "all"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => {
                setIsSecurityView(false);
                setActiveTab("financial");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !isSecurityView && activeTab === "financial"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Financial
            </button>
            <button
              onClick={() => {
                setIsSecurityView(false);
                setActiveTab("month_end");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !isSecurityView && activeTab === "month_end"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Month-End
            </button>
            <button
              onClick={() => {
                setIsSecurityView(false);
                setActiveTab("documents");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !isSecurityView && activeTab === "documents"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => {
                setIsSecurityView(false);
                setActiveTab("crm");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !isSecurityView && activeTab === "crm"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              CRM
            </button>
            <button
              onClick={() => {
                setIsSecurityView(false);
                setActiveTab("backups");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !isSecurityView && activeTab === "backups"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Backups
            </button>
            <button
              onClick={() => setIsSecurityView(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isSecurityView
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-purple-400 hover:text-purple-300"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Security Events
            </button>
          </div>

          {/* Date Range Preset */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Date:
            </span>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as typeof datePreset)}
              className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-orange-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search audit trail by entity ID, actor name, correlation ID, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-900/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl glass-card border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">Event Log Stream</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              {totalCount} total events
            </span>
          </div>
          {isLoadingLogs && (
            <span className="text-xs text-orange-400 animate-pulse flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Refreshing...
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800/80">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event / Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No audit records found matching the active filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-white tracking-tight">
                          {log.action}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {log.category}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">{log.entityType}</span>
                        <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">
                          {log.entityId}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-slate-200 truncate">
                            {log.actorNameSnapshot}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {log.actorRoleSnapshot}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSeverityBadge(
                          log.severity
                        )}`}
                      >
                        {log.severity}
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-xs truncate text-slate-400">
                      {log.reason || "—"}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Detail Inspector Drawer / Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getSeverityBadge(
                    selectedLog.severity
                  )}`}
                >
                  {selectedLog.severity}
                </span>
                <span className="text-sm font-bold text-white">
                  {selectedLog.action}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Event Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Entity</span>
                  <div className="font-semibold text-white mt-0.5">{selectedLog.entityType}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{selectedLog.entityId}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Actor Snapshot</span>
                  <div className="font-semibold text-white mt-0.5">{selectedLog.actorNameSnapshot}</div>
                  <div className="text-[10px] text-slate-400">{selectedLog.actorRoleSnapshot}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Timestamp</span>
                  <div className="font-semibold text-white mt-0.5">
                    {new Date(selectedLog.createdAt).toLocaleTimeString()}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {new Date(selectedLog.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Reason / Notes */}
              {selectedLog.reason && (
                <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Reason / Audit Justification</span>
                  <p className="text-slate-300 mt-1">{selectedLog.reason}</p>
                </div>
              )}

              {/* Changed Fields Diff */}
              {selectedLog.changedFields && selectedLog.changedFields.length > 0 && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    Changed Fields ({selectedLog.changedFields.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selectedLog.changedFields.map((field) => (
                      <span
                        key={field}
                        className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[11px] font-mono"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Before / After State Values */}
              {(selectedLog.previousValues || selectedLog.newValues) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                    <span className="text-[10px] text-rose-400 uppercase font-bold flex items-center gap-1">
                      Previous Value (Before)
                    </span>
                    <pre className="mt-1.5 text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                      {selectedLog.previousValues
                        ? JSON.stringify(selectedLog.previousValues, null, 2)
                        : "null (Created)"}
                    </pre>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1">
                      New Value (After)
                    </span>
                    <pre className="mt-1.5 text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                      {selectedLog.newValues
                        ? JSON.stringify(selectedLog.newValues, null, 2)
                        : "null (Voided / Deleted)"}
                    </pre>
                  </div>
                </div>
              )}

              {/* Cryptographic Traceability Footer */}
              <div className="p-3 rounded-xl bg-black/40 border border-slate-800/80 space-y-1 font-mono text-[10px]">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Correlation ID:</span>
                  <span className="text-slate-400">{selectedLog.correlationId || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Request ID:</span>
                  <span className="text-slate-400">{selectedLog.requestId || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Previous Hash:</span>
                  <span className="text-slate-400">{selectedLog.previousHash?.slice(0, 24)}...</span>
                </div>
                <div className="flex items-center justify-between text-emerald-400">
                  <span>Event Hash (SHA-256):</span>
                  <span>{selectedLog.eventHash?.slice(0, 24)}...</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/60">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
