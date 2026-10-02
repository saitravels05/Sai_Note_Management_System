"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Database,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  FileCheck,
  RotateCcw,
  Lock,
  CheckCircle2,
  XCircle,
  AlertOctagon,
} from "lucide-react";
import {
  getBackupsAction,
  getBackupHealthAction,
  createBackupAction,
  runTestRestoreAction,
  executeProductionRestoreAction,
  getMaintenanceModeAction,
  setMaintenanceModeAction,
} from "@/server/actions/backup.actions";
import type { RestoreVerificationReport } from "@/server/services/backup/restore-verification.service";

interface BackupItem {
  id: string;
  backupType: string;
  scope: string;
  environment: string;
  status: "REQUESTED" | "RUNNING" | "COMPLETED" | "FAILED" | "EXPIRED" | "DELETED";
  verificationStatus: "NOT_VERIFIED" | "VERIFYING" | "VERIFIED" | "VERIFICATION_FAILED";
  storageLocation: string;
  sizeBytes: string;
  checksum?: string | null;
  providerReference?: string | null;
  startedAt: string;
  completedAt?: string | null;
  verifiedAt?: string | null;
  retentionUntil?: string | null;
  isProtected: boolean;
  error?: string | null;
  restoreTests: Array<{
    id: string;
    environment: string;
    status: string;
    safetyModeActive: boolean;
    startedAt: string;
    completedAt?: string | null;
  }>;
  createdAt: string;
}

interface BackupHealth {
  health: "HEALTHY" | "WARNING" | "CRITICAL" | "UNKNOWN";
  lastBackupAt: string | null;
  lastSuccessfulBackupAt: string | null;
  lastVerifiedBackupAt: string | null;
  lastRestoreTestAt: string | null;
  totalBackups: number;
  verifiedBackupsCount: number;
  reasons: string[];
}

export function BackupControlCenter() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [health, setHealth] = useState<BackupHealth | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState<"NORMAL" | "READ_ONLY" | "MAINTENANCE">("NORMAL");
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [isLoading, startLoadingTransition] = useTransition();
  const [isCreatingBackup, startCreateTransition] = useTransition();
  const [isRestoringTest, startTestRestoreTransition] = useTransition();
  const [isRestoringProd, startProdRestoreTransition] = useTransition();

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createScope, setCreateScope] = useState<"FULL_SYSTEM" | "DATABASE" | "DOCUMENTS" | "CONFIGURATION">("FULL_SYSTEM");
  const [createType, setCreateType] = useState<"MANUAL" | "PRE_MIGRATION" | "MONTH_END_CLOSE">("MANUAL");

  const [activeReport, setActiveReport] = useState<RestoreVerificationReport | null>(null);

  const [prodRestoreBackup, setProdRestoreBackup] = useState<BackupItem | null>(null);
  const [prodConfirmationText, setProdConfirmationText] = useState("");
  const [prodReason, setProdReason] = useState("");
  const [prodImpactAck, setProdImpactAck] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const loadData = useCallback(() => {
    startLoadingTransition(async () => {
      const [backupsRes, healthRes, modeRes] = await Promise.all([
        getBackupsAction({ limit: 50 }),
        getBackupHealthAction(),
        getMaintenanceModeAction(),
      ]);

      if (backupsRes.success && backupsRes.data) {
        setBackups(backupsRes.data.backups as BackupItem[]);
      }
      if (healthRes.success && healthRes.health) {
        setHealth(healthRes.health);
      }
      if (modeRes.success && modeRes.state) {
        setMaintenanceMode(modeRes.state.mode as "NORMAL" | "READ_ONLY" | "MAINTENANCE");
        setMaintenanceReason(modeRes.state.reason || "");
      }
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateBackup = () => {
    startCreateTransition(async () => {
      const res = await createBackupAction({
        scope: createScope,
        backupType: createType,
      });

      if (res.success) {
        setStatusMessage({ text: res.message || "Backup created successfully.", type: "success" });
        setShowCreateModal(false);
        loadData();
      } else {
        setStatusMessage({ text: res.error || "Failed to create backup", type: "error" });
      }
    });
  };

  const handleRunTestRestore = (backupId: string) => {
    startTestRestoreTransition(async () => {
      setStatusMessage(null);
      const res = await runTestRestoreAction(backupId);
      if (res.success && res.report) {
        setActiveReport(res.report);
        loadData();
      } else {
        setStatusMessage({ text: res.error || "Test restore failed", type: "error" });
      }
    });
  };

  const handleProductionRestore = () => {
    if (!prodRestoreBackup) return;

    startProdRestoreTransition(async () => {
      const res = await executeProductionRestoreAction({
        backupId: prodRestoreBackup.id,
        confirmationPhrase: prodConfirmationText,
        reason: prodReason,
        impactAcknowledged: prodImpactAck,
      });

      if (res.success) {
        setStatusMessage({
          text: res.result?.message || "Production restore completed. System in maintenance mode.",
          type: "success",
        });
        setProdRestoreBackup(null);
        setProdConfirmationText("");
        setProdReason("");
        setProdImpactAck(false);
        loadData();
      } else {
        setStatusMessage({ text: res.error || "Production restore refused", type: "error" });
      }
    });
  };

  const handleSetMode = (mode: "NORMAL" | "READ_ONLY" | "MAINTENANCE") => {
    const reasonPrompt = prompt(`Enter mandatory reason for transitioning system to ${mode}:`);
    if (reasonPrompt === null) return;

    startLoadingTransition(async () => {
      const res = await setMaintenanceModeAction(mode, reasonPrompt || undefined);
      if (res.success && res.state) {
        setMaintenanceMode(res.state.mode as "NORMAL" | "READ_ONLY" | "MAINTENANCE");
        setMaintenanceReason(res.state.reason || "");
        setStatusMessage({ text: res.message || `System mode set to ${mode}`, type: "success" });
        loadData();
      } else {
        setStatusMessage({ text: res.error || "Failed to update maintenance state", type: "error" });
      }
    });
  };

  const formatBytes = (bytesStr: string) => {
    const bytes = Number(bytesStr);
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Backup & Disaster Recovery Control Center
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1.5">Backup Management & Verification</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict separation between <strong className="text-white">Backup Created</strong> and <strong className="text-emerald-400">Backup Verified</strong>. Test-restores run in isolated safety environments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh Backups"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Create Backup
          </button>
        </div>
      </div>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between animate-in fade-in ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="opacity-75 hover:opacity-100 p-1">
            ✕
          </button>
        </div>
      )}

      {/* Critical Principle Warning Card */}
      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-amber-200/90 text-xs flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-amber-300">Phase 15 Verification Principle:</strong> A backup is never considered reliable simply because &ldquo;Backup completed successfully&rdquo;. To receive the <span className="font-semibold text-emerald-400">VERIFIED</span> status, a backup must undergo an automated test restore in an isolated sandbox, confirming schema presence, accounting reconciliation, closed snapshot integrity, and document storage link continuity.
        </div>
      </div>

      {/* Backup Health & System Mode Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Health Card */}
        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-2">
          <span className="text-[11px] text-slate-400 font-medium">Backup Health Status</span>
          <div className="flex items-center gap-2">
            {health?.health === "HEALTHY" && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                HEALTHY
              </span>
            )}
            {health?.health === "WARNING" && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-3.5 h-3.5" />
                WARNING
              </span>
            )}
            {health?.health === "CRITICAL" && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertOctagon className="w-3.5 h-3.5" />
                CRITICAL
              </span>
            )}
            {health?.health === "UNKNOWN" && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400">
                UNKNOWN
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            {health?.reasons[0] || "Monitoring backup schedule and verification state."}
          </p>
        </div>

        {/* Last Successful Backup */}
        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Last Successful Backup</span>
          <div className="text-base font-bold text-white">
            {health?.lastSuccessfulBackupAt
              ? new Date(health.lastSuccessfulBackupAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "None"}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {health?.lastSuccessfulBackupAt
              ? new Date(health.lastSuccessfulBackupAt).toLocaleTimeString()
              : "Pending creation"}
          </div>
        </div>

        {/* Last Verified Backup */}
        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Last Verified Backup</span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">
              {health?.verifiedBackupsCount || 0} verified
            </span>
          </span>
          <div className="text-base font-bold text-emerald-400">
            {health?.lastVerifiedBackupAt
              ? new Date(health.lastVerifiedBackupAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Unverified"}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {health?.lastVerifiedBackupAt
              ? new Date(health.lastVerifiedBackupAt).toLocaleTimeString()
              : "Awaiting test restore"}
          </div>
        </div>

        {/* System Mode Switcher */}
        <div className="p-4 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Disaster Mode</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                maintenanceMode === "NORMAL"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : maintenanceMode === "READ_ONLY"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}
            >
              {maintenanceMode}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={() => handleSetMode("NORMAL")}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-lg border transition-all ${
                maintenanceMode === "NORMAL"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Normal
            </button>
            <button
              onClick={() => handleSetMode("READ_ONLY")}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-lg border transition-all ${
                maintenanceMode === "READ_ONLY"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Read-Only
            </button>
            <button
              onClick={() => handleSetMode("MAINTENANCE")}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-lg border transition-all ${
                maintenanceMode === "MAINTENANCE"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Lock
            </button>
          </div>
          {maintenanceReason && maintenanceMode !== "NORMAL" && (
            <div className="text-[10px] text-slate-400 italic truncate pt-1" title={maintenanceReason}>
              Reason: {maintenanceReason}
            </div>
          )}
        </div>
      </div>

      {/* Backups Table */}
      <div className="rounded-2xl glass-card border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">Registered Backups</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              {backups.length} snapshots
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-800/80">
              <tr>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Scope & Type</th>
                <th className="py-3 px-4">Backup Status</th>
                <th className="py-3 px-4">Verification State</th>
                <th className="py-3 px-4">Size & Checksum</th>
                <th className="py-3 px-4">Protection</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No backups registered. Click &ldquo;Create Backup&rdquo; to initiate your first snapshot.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {new Date(b.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white tracking-tight">{b.scope}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {b.backupType} • {b.environment}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          b.status === "COMPLETED"
                            ? "bg-slate-800 text-slate-300 border-slate-700"
                            : b.status === "RUNNING"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 w-fit ${
                          b.verificationStatus === "VERIFIED"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : b.verificationStatus === "VERIFYING"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse"
                            : b.verificationStatus === "VERIFICATION_FAILED"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            : "bg-slate-900 text-slate-400 border-slate-800"
                        }`}
                      >
                        {b.verificationStatus === "VERIFIED" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        {b.verificationStatus === "VERIFICATION_FAILED" && <XCircle className="w-3 h-3 text-rose-400" />}
                        {b.verificationStatus}
                      </span>
                      {b.verifiedAt && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Verified: {new Date(b.verifiedAt).toLocaleTimeString()}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-slate-300">{formatBytes(b.sizeBytes)}</span>
                        <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]" title={b.checksum || ""}>
                          SHA: {b.checksum ? b.checksum.slice(0, 10) + "..." : "—"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {b.isProtected ? (
                        <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Protected
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">
                          Expires: {b.retentionUntil ? new Date(b.retentionUntil).toLocaleDateString() : "30d"}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRunTestRestore(b.id)}
                          disabled={isRestoringTest}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1 disabled:opacity-50"
                          title="Run isolated test restore and end-to-end reconciliation"
                        >
                          <FileCheck className="w-3 h-3 text-emerald-400" />
                          Test Restore
                        </button>

                        <button
                          onClick={() => setProdRestoreBackup(b)}
                          className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center gap-1"
                          title="HIGH-RISK: Production Database Restore"
                        >
                          <RotateCcw className="w-3 h-3 text-rose-400" />
                          Prod Restore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-orange-400" />
                Initiate Production Backup
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium">Backup Scope</label>
                <select
                  value={createScope}
                  onChange={(e) => setCreateScope(e.target.value as typeof createScope)}
                  className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                >
                  <option value="FULL_SYSTEM">FULL_SYSTEM (Database, Documents & Metadata)</option>
                  <option value="DATABASE">DATABASE (PostgreSQL Ledger & Accounts)</option>
                  <option value="DOCUMENTS">DOCUMENTS (Object Storage Vault)</option>
                  <option value="CONFIGURATION">CONFIGURATION (Settings & Business Sequences)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Backup Type</label>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value as typeof createType)}
                  className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                >
                  <option value="MANUAL">MANUAL (Standard on-demand)</option>
                  <option value="PRE_MIGRATION">PRE_MIGRATION (Protected from cleanup)</option>
                  <option value="MONTH_END_CLOSE">MONTH_END_CLOSE (Protected milestone snapshot)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                A cryptographic manifest will be gathered, encrypted via AES-256-GCM, and linked with a SHA-256 checksum. Initial verification state will be <span className="font-semibold text-slate-200">NOT_VERIFIED</span> until test-restored.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={isCreatingBackup}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
              >
                {isCreatingBackup ? "Generating Backup..." : "Create Backup Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Verification Report Modal */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    activeReport.overallResult === "PASSED"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : activeReport.overallResult === "PASSED_WITH_WARNINGS"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                  }`}
                >
                  {activeReport.overallResult}
                </span>
                <span className="text-sm font-bold text-white">
                  Isolated Test Restore Report
                </span>
              </div>
              <button onClick={() => setActiveReport(null)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Safety Mode Banner */}
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  Restore Safety Mode: ACTIVE
                </span>
                <span className="text-[11px] text-cyan-400/80">
                  External messaging, payments, webhooks, and live AI disabled.
                </span>
              </div>

              {/* Reconciliation Sections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Database Schema Status */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">1. Database Structure</span>
                    <span className="text-[10px] font-bold text-emerald-400">
                      {activeReport.databaseStatus.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{activeReport.databaseStatus.details}</p>
                </div>

                {/* Accounting Ledger Reconciliation */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">2. Accounting Ledger</span>
                    <span className="text-[10px] font-bold text-emerald-400">
                      {activeReport.accountingReconciliation.status}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-[11px] font-mono text-slate-300">
                    <div>Income: {activeReport.accountingReconciliation.totalIncome}</div>
                    <div>Expenses: {activeReport.accountingReconciliation.totalExpenses}</div>
                    <div>Net Result: {activeReport.accountingReconciliation.netResult}</div>
                    <div>Receivables: {activeReport.accountingReconciliation.receivables}</div>
                  </div>
                </div>

                {/* Month-End Closing Snapshots */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">3. Month-End Snapshots</span>
                    <span className="text-[10px] font-bold text-emerald-400">
                      {activeReport.monthEndVerification.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{activeReport.monthEndVerification.details}</p>
                </div>

                {/* Audit Integrity */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">4. Audit Trail Integrity</span>
                    <span className="text-[10px] font-bold text-emerald-400">
                      {activeReport.auditVerification.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{activeReport.auditVerification.details}</p>
                </div>
              </div>

              {/* Issues List if any */}
              {activeReport.issues.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
                  <span className="font-bold text-[11px]">Discrepancies / Warnings Detected:</span>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5">
                    {activeReport.issues.map((iss, i) => (
                      <li key={i}>{iss}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/60">
              <button
                onClick={() => setActiveReport(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Production Restore HIGH-RISK Modal */}
      {prodRestoreBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#180a0a] border border-rose-500/40 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 border-b border-rose-500/20 pb-3">
              <AlertOctagon className="w-5 h-5 text-rose-500" />
              <h3 className="text-sm font-bold text-white">
                HIGH-RISK: Production Database Restore
              </h3>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs leading-relaxed space-y-1">
              <strong>CRITICAL WARNING:</strong> This action will roll back the live production database to backup snapshot <span className="font-mono font-bold text-white">{prodRestoreBackup.id}</span>. The application will be automatically locked into <strong className="text-white">MAINTENANCE</strong> mode.
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium">Mandatory Audit Reason (min 10 characters)</label>
                <textarea
                  rows={2}
                  value={prodReason}
                  onChange={(e) => setProdReason(e.target.value)}
                  placeholder="Explain why a full production restore is required..."
                  className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-600"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium">
                  Type <span className="font-mono text-rose-400 select-all font-bold">RESTORE_PRODUCTION_{prodRestoreBackup.id}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={prodConfirmationText}
                  onChange={(e) => setProdConfirmationText(e.target.value)}
                  placeholder={`RESTORE_PRODUCTION_${prodRestoreBackup.id}`}
                  className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="impactAck"
                  checked={prodImpactAck}
                  onChange={(e) => setProdImpactAck(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="impactAck" className="text-slate-300 text-[11px] cursor-pointer">
                  I acknowledge this will overwrite current live database records.
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-rose-500/20">
              <button
                onClick={() => {
                  setProdRestoreBackup(null);
                  setProdConfirmationText("");
                  setProdReason("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleProductionRestore}
                disabled={
                  isRestoringProd ||
                  !prodImpactAck ||
                  prodConfirmationText !== `RESTORE_PRODUCTION_${prodRestoreBackup.id}` ||
                  prodReason.trim().length < 10
                }
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isRestoringProd ? "Restoring Database..." : "Execute Production Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
