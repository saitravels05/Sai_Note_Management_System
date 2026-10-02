import Link from "next/link";
import { Database, ShieldCheck, ShieldAlert, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { BackupService, type BackupHealthSummary } from "@/server/services/backup/backup.service";
import { AuditService, type IntegrityVerificationResult } from "@/server/services/audit.service";

interface BackupAuditHealthAdminWidgetProps {
  businessId: string;
}

export async function BackupAuditHealthAdminWidget({ businessId }: BackupAuditHealthAdminWidgetProps) {
  let backupHealth: BackupHealthSummary | null = null;
  let auditIntegrity: IntegrityVerificationResult | null = null;

  try {
    const [bH, aI] = await Promise.all([
      BackupService.getBackupHealth(businessId),
      AuditService.verifyIntegrity(businessId),
    ]);
    backupHealth = bH;
    auditIntegrity = aI;
  } catch {
    return null;
  }

  if (!backupHealth || !auditIntegrity) {
    return null;
  }

  return (
    <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Database className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Disaster Recovery & Audit Assurance
            </h3>
            <p className="text-[11px] text-slate-400">
              Automated backup verification & cryptographic SHA-256 audit chaining.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/audit"
            className="text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 transition-colors flex items-center gap-1 text-[11px]"
          >
            <span>Audit Center</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
          <Link
            href="/settings/backups"
            className="text-orange-400 hover:text-orange-300 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 transition-colors flex items-center gap-1 text-[11px] font-semibold"
          >
            <span>Manage Backups</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Card 1: Backup Health */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Backup Health</span>
          <div className="flex items-center gap-1.5">
            {backupHealth.health === "HEALTHY" && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                HEALTHY
              </span>
            )}
            {backupHealth.health === "WARNING" && (
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                WARNING
              </span>
            )}
            {backupHealth.health === "CRITICAL" && (
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                CRITICAL
              </span>
            )}
            {backupHealth.health === "UNKNOWN" && (
              <span className="text-xs font-bold text-slate-400">UNKNOWN</span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 truncate">{backupHealth.reasons[0]}</p>
        </div>

        {/* Card 2: Last Verified Backup */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Last Verified Backup</span>
          <div className="text-xs font-bold text-white">
            {backupHealth.lastVerifiedBackupAt
              ? new Date(backupHealth.lastVerifiedBackupAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                })
              : "Not Verified"}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            {backupHealth.lastVerifiedBackupAt
              ? new Date(backupHealth.lastVerifiedBackupAt).toLocaleTimeString()
              : "Awaiting isolated test"}
          </p>
        </div>

        {/* Card 3: Last Restore Test */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Last Restore Test</span>
          <div className="text-xs font-bold text-slate-200">
            {backupHealth.lastRestoreTestAt
              ? new Date(backupHealth.lastRestoreTestAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                })
              : "None Executed"}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            {backupHealth.lastRestoreTestAt
              ? new Date(backupHealth.lastRestoreTestAt).toLocaleTimeString()
              : "Sandbox test required"}
          </p>
        </div>

        {/* Card 4: Audit Integrity */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Audit Chain Integrity</span>
          <div className="flex items-center gap-1.5">
            {auditIntegrity.status === "VERIFIED" ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                VERIFIED ({auditIntegrity.verifiedCount})
              </span>
            ) : auditIntegrity.status === "BROKEN" ? (
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                TAMPER DETECTED
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-400">NOT CONFIGURED</span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            {auditIntegrity.status === "VERIFIED" ? "SHA-256 chain intact" : "Check audit center"}
          </p>
        </div>
      </div>
    </div>
  );
}
