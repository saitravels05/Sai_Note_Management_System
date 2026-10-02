import { requireCurrentUser } from "@/lib/auth/current-user";
import { DocumentService, DocumentUserContext } from "@/server/services/document/document.service";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  ArrowLeft,
  Download,
  Shield,
  Link2,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  History,
  Info,
} from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Document Details | Business Vault",
};

interface DocumentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { id } = await params;
  const user = await requireCurrentUser();

  const ctx: DocumentUserContext = {
    userId: user.id,
    businessId: user.businessId,
    userRoles: user.roleTypes,
    userPermissions: user.permissions,
  };

  let document;
  try {
    document = await DocumentService.getDocument(id, ctx);
  } catch {
    notFound();
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getFileIcon = (ext: string) => {
    const e = ext.toLowerCase();
    if (e === "pdf") return <FileText className="w-8 h-8 text-rose-400" />;
    if (e === "xlsx" || e === "xls" || e === "csv")
      return <FileSpreadsheet className="w-8 h-8 text-emerald-400" />;
    if (e === "png" || e === "jpg" || e === "jpeg" || e === "webp")
      return <ImageIcon className="w-8 h-8 text-purple-400" />;
    return <File className="w-8 h-8 text-cyan-400" />;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Back navigation */}
      <Link
        href="/documents"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Documents Vault
      </Link>

      {/* Main Dossier Header */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shrink-0">
              {getFileIcon(document.extension)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {document.category.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  Version {document.versionNumber}
                </span>
                {document.sensitivity !== "NORMAL" && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {document.sensitivity}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight mt-1">{document.displayName}</h1>
              <p className="text-xs text-slate-500 font-mono">{document.originalFileName}</p>
            </div>
          </div>

          <a
            href={`/api/documents/${document.id}/download`}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-2 transition-colors shadow-lg shadow-cyan-600/20"
          >
            <Download className="w-4 h-4" />
            Download File
          </a>
        </div>

        {document.description && (
          <p className="text-xs text-slate-300 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
            {document.description}
          </p>
        )}
      </div>

      {/* Grid: Preview & Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inline Preview */}
        <div className="lg:col-span-2 glass-card p-4 rounded-3xl border border-slate-800 flex flex-col min-h-[450px]">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-cyan-400" />
            Document Preview
          </h2>

          <div className="flex-1 bg-slate-950/80 rounded-2xl border border-slate-800/60 overflow-hidden flex items-center justify-center p-2">
            {document.extension.toLowerCase() === "pdf" ? (
              <iframe
                src={`/api/documents/${document.id}/preview`}
                className="w-full h-[500px] rounded-xl"
                title="PDF Document Preview"
              />
            ) : ["png", "jpg", "jpeg", "webp"].includes(document.extension.toLowerCase()) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/documents/${document.id}/preview`}
                alt={document.displayName}
                className="max-w-full max-h-[500px] object-contain rounded-xl"
              />
            ) : (
              <div className="text-center p-8 space-y-2">
                <File className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Preview is not available for this file type ({document.extension.toUpperCase()}).
                </p>
                <a
                  href={`/api/documents/${document.id}/download`}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-400 inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download to View
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Metadata & Security */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-3 text-xs">
            <h2 className="font-bold text-slate-200">Metadata & Audit</h2>

            <div className="space-y-2 text-slate-400">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>File Size:</span>
                <span className="font-mono text-white font-semibold">{formatBytes(document.fileSize)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>MIME Type:</span>
                <span className="font-mono text-slate-300">{document.mimeType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Status:</span>
                <span className="font-mono text-emerald-400 font-semibold">{document.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Expiry Date:</span>
                <span className="font-mono text-slate-300">
                  {document.expiryDate ? new Date(document.expiryDate).toLocaleDateString("en-IN") : "No Expiry"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Uploaded On:</span>
                <span className="font-mono text-slate-300">
                  {new Date(document.createdAt).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>Last Updated:</span>
                <span className="font-mono text-slate-300">
                  {new Date(document.updatedAt).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {document.checksum && (
              <div className="pt-2 border-t border-slate-800">
                <span className="text-slate-500 block text-[10px]">SHA-256 Checksum:</span>
                <span className="font-mono text-[10px] text-slate-400 break-all select-all block bg-slate-900 p-2 rounded-lg mt-1">
                  {document.checksum}
                </span>
              </div>
            )}
          </div>

          {/* Linked Entities */}
          {document.documentLinks && document.documentLinks.length > 0 && (
            <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-3 text-xs">
              <h2 className="font-bold text-slate-200 flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-cyan-400" />
                Linked Records
              </h2>
              <div className="space-y-1.5">
                {document.documentLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                  >
                    <span className="text-cyan-400 font-semibold">{link.entityType}</span>
                    <span className="text-slate-400 font-mono text-[11px]">{link.entityId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Version History Chain */}
          {document.versions && document.versions.length > 0 && (
            <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-3 text-xs">
              <h2 className="font-bold text-slate-200 flex items-center gap-1.5">
                <History className="w-4 h-4 text-purple-400" />
                Version Chain History
              </h2>
              <div className="space-y-2">
                {document.versions.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-white">v{v.versionNumber}</span>
                      <span className="text-slate-500 font-mono text-[10px] ml-2">
                        {formatBytes(v.fileSize)} • {new Date(v.createdAt).toLocaleDateString()}
                      </span>
                      {v.changeNote && <p className="text-[11px] text-slate-400 italic mt-0.5">{v.changeNote}</p>}
                    </div>
                    <a
                      href={`/api/documents/${v.id}/download`}
                      className="p-1.5 text-slate-400 hover:text-emerald-400"
                      title="Download this version"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
