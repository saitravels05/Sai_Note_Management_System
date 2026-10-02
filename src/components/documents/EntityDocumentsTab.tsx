"use client";

import { useState, useTransition } from "react";
import {
  FileText,
  Download,
  Eye,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  X,
  Plus,
} from "lucide-react";
import {
  uploadDocumentAction,
  requestDocumentDownloadAction,
} from "@/server/actions/document.actions";
import { DocumentCategory, DocumentSensitivity, DocumentEntityType } from "@prisma/client";

export interface EntityDocumentItem {
  id: string;
  displayName: string;
  originalFileName: string;
  category: string;
  fileSize: number;
  extension: string;
  versionNumber: number;
  status: string;
  expiryDate: string | Date | null;
  createdAt: string | Date;
  uploadedById?: string | null;
}

interface EntityDocumentsTabProps {
  entityType: DocumentEntityType;
  entityId: string;
  entityName: string;
  documents: EntityDocumentItem[];
}

export function EntityDocumentsTab({
  entityType,
  entityId,
  entityName,
  documents: initialDocs,
}: EntityDocumentsTabProps) {
  const [docs, setDocs] = useState<EntityDocumentItem[]>(initialDocs);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>(
    entityType === DocumentEntityType.CUSTOMER
      ? DocumentCategory.CUSTOMER_DOCUMENT
      : DocumentCategory.SUPPLIER_DOCUMENT
  );
  const [sensitivity, setSensitivity] = useState<DocumentSensitivity>(DocumentSensitivity.NORMAL);
  const [description, setDescription] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [previewExt, setPreviewExt] = useState("");

  const [isPending, startTransition] = useTransition();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getFileIcon = (ext: string) => {
    const e = ext.toLowerCase();
    if (e === "pdf") return <FileText className="w-5 h-5 text-rose-400" />;
    if (e === "xlsx" || e === "xls" || e === "csv")
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    if (e === "png" || e === "jpg" || e === "jpeg" || e === "webp")
      return <ImageIcon className="w-5 h-5 text-purple-400" />;
    return <File className="w-5 h-5 text-cyan-400" />;
  };

  const handleDownload = async (docId: string, fileName: string) => {
    const res = await requestDocumentDownloadAction(docId);
    if (res.success && res.downloadUrl) {
      const a = document.createElement("a");
      a.href = res.downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      alert(res.error || "Download denied.");
    }
  };

  const handleUploadSubmit = () => {
    if (!file) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("displayName", displayName || file.name);
      formData.append("category", category);
      formData.append("sensitivity", sensitivity);
      formData.append("description", description);
      if (expiryDate) formData.append("expiryDate", expiryDate);
      formData.append("links", JSON.stringify([{ entityType, entityId }]));

      const res = await uploadDocumentAction(formData);
      if (res.success && res.document) {
        setDocs((prev) => [
          {
            id: res.document.id,
            displayName: res.document.displayName,
            originalFileName: res.document.originalFileName,
            category: res.document.category,
            fileSize: res.document.fileSize,
            extension: res.document.extension,
            versionNumber: res.document.versionNumber,
            status: res.document.status,
            expiryDate: res.document.expiryDate ? new Date(res.document.expiryDate) : null,
            createdAt: new Date(res.document.createdAt),
          },
          ...prev,
        ]);
        setIsUploadOpen(false);
        setFile(null);
        setDisplayName("");
        setDescription("");
        setExpiryDate("");
      } else {
        alert(res.error || "Upload failed.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            {entityName} — Document Records
          </h3>
          <p className="text-xs text-slate-400">
            Secure business files, contracts, permits, statements, and tax invoices attached to this party.
          </p>
        </div>

        <button
          onClick={() => setIsUploadOpen(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Attach Document
        </button>
      </div>

      {/* Documents Table */}
      {docs.length === 0 ? (
        <div className="glass-card p-8 text-center rounded-2xl border border-slate-800 text-xs text-slate-500">
          No documents attached to {entityName} yet.
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">Category</th>
                  <th className="p-3 font-semibold">Uploaded Date</th>
                  <th className="p-3 font-semibold">Size</th>
                  <th className="p-3 font-semibold">Expiry</th>
                  <th className="p-3 font-semibold">Version</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {docs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-900/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {getFileIcon(d.extension)}
                        <div>
                          <span className="font-bold text-white block">{d.displayName}</span>
                          <span className="text-[11px] text-slate-500 font-mono block">{d.originalFileName}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {d.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400">
                      {new Date(d.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="p-3 font-mono text-slate-400">{formatBytes(d.fileSize)}</td>
                    <td className="p-3">
                      {d.expiryDate ? (
                        <span className="text-amber-400 font-mono">
                          {new Date(d.expiryDate).toLocaleDateString("en-IN")}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-400">v{d.versionNumber}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setPreviewDocId(d.id);
                            setPreviewExt(d.extension);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-cyan-400"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(d.id, d.originalFileName)}
                          className="p-1 rounded text-slate-400 hover:text-emerald-400"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-3xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Attach Document to {entityName}</h3>
              <button onClick={() => setIsUploadOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Select File</label>
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const f = e.target.files[0];
                      setFile(f);
                      if (!displayName) {
                        const clean = f.name.substring(0, f.name.lastIndexOf(".")) || f.name;
                        setDisplayName(clean);
                      }
                    }
                  }}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.txt,.docx"
                  className="w-full text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Agreement or Invoice copy"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {Object.values(DocumentCategory).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Sensitivity</label>
                <select
                  value={sensitivity}
                  onChange={(e) => setSensitivity(e.target.value as DocumentSensitivity)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value={DocumentSensitivity.NORMAL}>Normal</option>
                  <option value={DocumentSensitivity.SENSITIVE}>Sensitive</option>
                  <option value={DocumentSensitivity.RESTRICTED}>Restricted</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button onClick={() => setIsUploadOpen(false)} className="px-4 py-2 rounded-xl text-xs text-slate-400">
                Cancel
              </button>
              <button
                disabled={!file || isPending}
                onClick={handleUploadSubmit}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Attaching..." : "Attach Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDocId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-4xl w-full h-[80vh] rounded-3xl border border-slate-800 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <span className="text-xs font-bold text-white">Document Preview</span>
              <button onClick={() => setPreviewDocId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-950 p-2 overflow-auto flex items-center justify-center">
              {previewExt.toLowerCase() === "pdf" ? (
                <iframe src={`/api/documents/${previewDocId}/preview`} className="w-full h-full rounded-xl" />
              ) : ["png", "jpg", "jpeg", "webp"].includes(previewExt.toLowerCase()) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/documents/${previewDocId}/preview`}
                  alt="Preview"
                  className="max-w-full max-h-full object-contain rounded-xl"
                />
              ) : (
                <p className="text-xs text-slate-400">Preview not supported for this file format.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
