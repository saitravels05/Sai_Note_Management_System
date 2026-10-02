"use client";

import { useState, useTransition, useMemo } from "react";
import {
  FileText,
  Upload,
  Search,
  Eye,
  Download,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Link2,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  X,
  Info,
  History,
  Grid,
  List,
} from "lucide-react";
import {
  uploadDocumentAction,
  createDocumentVersionAction,
  updateDocumentMetadataAction,
  archiveDocumentAction,
  restoreDocumentAction,
  deleteDocumentAction,
  requestDocumentDownloadAction,
  getSpreadsheetPreviewAction,
  checkDuplicateDocumentAction,
} from "@/server/actions/document.actions";
import {
  DocumentCategory,
  DocumentStatus,
  DocumentSensitivity,
  DocumentEntityType,
} from "@prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions";

export interface DocumentItemDTO {
  id: string;
  fileName: string;
  originalFileName: string;
  safeFileName: string;
  displayName: string;
  storageProvider: string;
  storageKey: string;
  extension: string;
  mimeType: string;
  fileSize: number;
  checksum: string | null;
  category: DocumentCategory;
  sensitivity: DocumentSensitivity;
  status: DocumentStatus;
  description: string | null;
  expiryDate: string | Date | null;
  versionNumber: number;
  parentId: string | null;
  changeNote: string | null;
  tags: string[];
  uploadedById: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  archivedAt: string | Date | null;
  expiryStatus: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NO_EXPIRY";
  documentLinks?: Array<{
    id: string;
    entityType: DocumentEntityType;
    entityId: string;
    createdAt: string | Date;
  }>;
  versions?: Array<{
    id: string;
    displayName: string;
    versionNumber: number;
    fileSize: number;
    createdAt: string | Date;
    changeNote: string | null;
    status: DocumentStatus;
  }>;
}

interface DocumentCenterWorkspaceProps {
  initialDocuments: DocumentItemDTO[];
  totalDocuments: number;
  customers: Array<{ id: string; name: string; customerCode: string }>;
  suppliers: Array<{ id: string; name: string; supplierCode: string }>;
  transactions: Array<{ id: string; transactionNumber: string; title: string }>;
  currentUserId: string;
  userPermissions: string[];
  userRoles: string[];
}

type TabType =
  | "ALL"
  | "RECENT"
  | "CUSTOMERS"
  | "SUPPLIERS"
  | "TRANSACTIONS"
  | "PAYMENTS"
  | "RECEIVABLES"
  | "PAYABLES"
  | "FOLLOWUPS"
  | "REPORTS"
  | "IMPORTS"
  | "GENERAL"
  | "EXPIRING_SOON"
  | "ARCHIVED";

export function DocumentCenterWorkspace({
  initialDocuments,
  totalDocuments,
  customers,
  suppliers,
  transactions,
  userPermissions,
  userRoles,
}: DocumentCenterWorkspaceProps) {
  const canUpload =
    userPermissions.includes(PERMISSIONS.DOCUMENTS_UPLOAD) ||
    userRoles.includes("OWNER") ||
    userRoles.includes("ADMIN");

  const [documents, setDocuments] = useState<DocumentItemDTO[]>(initialDocuments);
  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedExtension, setSelectedExtension] = useState<string>("ALL");
  const [selectedSensitivity, setSelectedSensitivity] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "largest" | "expiry_soon">("newest");

  // Modals & Drawers
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<DocumentItemDTO | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentItemDTO | null>(null);
  const [spreadsheetPreviewData, setSpreadsheetPreviewData] = useState<{
    sheetNames: string[];
    activeSheet: string;
    headers: string[];
    rows: Record<string, string | number | null>[];
    totalRows: number;
    isTruncated: boolean;
  } | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  // Version Upload State
  const [versionModalDoc, setVersionModalDoc] = useState<DocumentItemDTO | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionChangeNote, setVersionChangeNote] = useState("");

  // Edit Metadata State
  const [editMetaDoc, setEditMetaDoc] = useState<DocumentItemDTO | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCategory, setEditCategory] = useState<DocumentCategory>(DocumentCategory.GENERAL);
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editSensitivity, setEditSensitivity] = useState<DocumentSensitivity>(DocumentSensitivity.NORMAL);

  // Upload Modal State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>(DocumentCategory.GENERAL);
  const [uploadSensitivity, setUploadSensitivity] = useState<DocumentSensitivity>(DocumentSensitivity.NORMAL);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadExpiryDate, setUploadExpiryDate] = useState("");
  const [uploadLinkedEntityType, setUploadLinkedEntityType] = useState<DocumentEntityType | "NONE">("NONE");
  const [uploadLinkedEntityId, setUploadLinkedEntityId] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  // Scanner status
  const [scannerInfoOpen, setScannerInfoOpen] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [mountTime] = useState(() => Date.now());

  // Helper: Format bytes to human readable (e.g. 245 KB, 2.4 MB)
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Helper: Get icon and color based on extension
  const getFileIcon = (ext: string) => {
    const e = ext.toLowerCase();
    if (e === "pdf") return <FileText className="w-6 h-6 text-rose-400" />;
    if (e === "xlsx" || e === "xls" || e === "csv")
      return <FileSpreadsheet className="w-6 h-6 text-emerald-400" />;
    if (e === "png" || e === "jpg" || e === "jpeg" || e === "webp")
      return <ImageIcon className="w-6 h-6 text-purple-400" />;
    return <File className="w-6 h-6 text-cyan-400" />;
  };

  // Filtered & Sorted documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // 1. Tab filter
      if (activeTab === "ARCHIVED") {
        if (doc.status !== DocumentStatus.ARCHIVED) return false;
      } else {
        if (doc.status === DocumentStatus.ARCHIVED) return false;

        if (activeTab === "RECENT") {
          const sevenDaysAgo = new Date(mountTime - 7 * 24 * 60 * 60 * 1000);
          if (new Date(doc.createdAt) < sevenDaysAgo) return false;
        } else if (activeTab === "CUSTOMERS") {
          const hasCust = doc.documentLinks?.some((l) => l.entityType === DocumentEntityType.CUSTOMER);
          if (!hasCust) return false;
        } else if (activeTab === "SUPPLIERS") {
          const hasSupp = doc.documentLinks?.some((l) => l.entityType === DocumentEntityType.SUPPLIER);
          if (!hasSupp) return false;
        } else if (activeTab === "TRANSACTIONS") {
          const hasTx = doc.documentLinks?.some((l) => l.entityType === DocumentEntityType.TRANSACTION);
          if (!hasTx) return false;
        } else if (activeTab === "PAYMENTS") {
          const hasPmt = doc.documentLinks?.some((l) => l.entityType === DocumentEntityType.PAYMENT);
          if (!hasPmt) return false;
        } else if (activeTab === "RECEIVABLES") {
          const hasRec = doc.documentLinks?.some((l) => l.entityType === DocumentEntityType.RECEIVABLE);
          if (!hasRec) return false;
        } else if (activeTab === "PAYABLES") {
          const hasPay = doc.documentLinks?.some((l) => l.entityType === DocumentEntityType.PAYABLE);
          if (!hasPay) return false;
        } else if (activeTab === "FOLLOWUPS") {
          const hasFu = doc.documentLinks?.some((l) => l.entityType === DocumentEntityType.FOLLOWUP);
          if (!hasFu) return false;
        } else if (activeTab === "REPORTS") {
          if (doc.category !== DocumentCategory.REPORT) return false;
        } else if (activeTab === "IMPORTS") {
          const hasImp = doc.documentLinks?.some((l) => l.entityType === DocumentEntityType.IMPORT);
          if (!hasImp) return false;
        } else if (activeTab === "GENERAL") {
          if (doc.documentLinks && doc.documentLinks.length > 0) return false;
        } else if (activeTab === "EXPIRING_SOON") {
          if (doc.expiryStatus !== "EXPIRING_SOON" && doc.expiryStatus !== "EXPIRED") return false;
        }
      }

      // 2. Category filter
      if (selectedCategory !== "ALL" && doc.category !== selectedCategory) {
        return false;
      }

      // 3. Extension filter
      if (selectedExtension !== "ALL" && doc.extension.toLowerCase() !== selectedExtension.toLowerCase()) {
        return false;
      }

      // 4. Sensitivity filter
      if (selectedSensitivity !== "ALL" && doc.sensitivity !== selectedSensitivity) {
        return false;
      }

      // 5. Search query (Display name, original filename, description, tags)
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = doc.displayName.toLowerCase().includes(q);
        const matchesOriginal = doc.originalFileName.toLowerCase().includes(q);
        const matchesDesc = doc.description?.toLowerCase().includes(q) || false;
        const matchesTags = doc.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesOriginal && !matchesDesc && !matchesTags) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "name") return a.displayName.localeCompare(b.displayName);
      if (sortBy === "largest") return b.fileSize - a.fileSize;
      if (sortBy === "expiry_soon") {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      }
      return 0;
    });
  }, [
    documents,
    activeTab,
    selectedCategory,
    selectedExtension,
    selectedSensitivity,
    searchQuery,
    sortBy,
    mountTime,
  ]);

  // Handle File Selection in Upload Modal
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      if (!uploadDisplayName) {
        // Default display name to file name without extension
        const cleanName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
        setUploadDisplayName(cleanName);
      }

      // Pre-flight duplicate check using standard Web Crypto API
      const arrayBuffer = await file.arrayBuffer();
      let checksum = "";
      if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        checksum = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      }

      if (checksum) {
        const dupRes = await checkDuplicateDocumentAction(checksum);
        if (dupRes.success && dupRes.isDuplicate && dupRes.existingDocument) {
          setDuplicateWarning(
            `Exact duplicate detected in vault: "${dupRes.existingDocument.displayName}" (${formatBytes(
              dupRes.existingDocument.fileSize
            )}, uploaded on ${new Date(dupRes.existingDocument.createdAt).toLocaleDateString()}).`
          );
        } else {
          setDuplicateWarning(null);
        }
      }
    }
  };

  // Submit Upload
  const handleUploadSubmit = () => {
    if (!uploadFile) return;

    startTransition(async () => {
      setUploadStatusMsg("Uploading file to private vault...");
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("displayName", uploadDisplayName);
      formData.append("category", uploadCategory);
      formData.append("sensitivity", uploadSensitivity);
      formData.append("description", uploadDescription);
      formData.append("tags", uploadTags);
      if (uploadExpiryDate) formData.append("expiryDate", uploadExpiryDate);
      if (allowDuplicateOverride) formData.append("allowDuplicate", "true");

      if (uploadLinkedEntityType !== "NONE" && uploadLinkedEntityId) {
        formData.append(
          "links",
          JSON.stringify([{ entityType: uploadLinkedEntityType, entityId: uploadLinkedEntityId }])
        );
      }

      setUploadStatusMsg("Validating magic bytes & inspecting security boundaries...");
      const res = await uploadDocumentAction(formData);

      if (res.success && res.document) {
        setUploadStatusMsg("Upload verified and available!");
        // Add to local state
        setDocuments((prev) => [
          {
            ...res.document,
            createdAt: new Date(res.document.createdAt),
            updatedAt: new Date(res.document.updatedAt),
            expiryDate: res.document.expiryDate ? new Date(res.document.expiryDate) : null,
            archivedAt: null,
            expiryStatus: res.document.expiryDate
              ? new Date(res.document.expiryDate) < new Date()
                ? "EXPIRED"
                : "VALID"
              : "NO_EXPIRY",
            documentLinks:
              uploadLinkedEntityType !== "NONE" && uploadLinkedEntityId
                ? [
                    {
                      id: "link_new",
                      entityType: uploadLinkedEntityType as DocumentEntityType,
                      entityId: uploadLinkedEntityId,
                      createdAt: new Date(),
                    },
                  ]
                : [],
          } as DocumentItemDTO,
          ...prev,
        ]);
        setTimeout(() => {
          setIsUploadModalOpen(false);
          resetUploadForm();
        }, 500);
      } else {
        alert(res.error || "Upload failed");
        setUploadStatusMsg(null);
      }
    });
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadDisplayName("");
    setUploadCategory(DocumentCategory.GENERAL);
    setUploadSensitivity(DocumentSensitivity.NORMAL);
    setUploadDescription("");
    setUploadTags("");
    setUploadExpiryDate("");
    setUploadLinkedEntityType("NONE");
    setUploadLinkedEntityId("");
    setDuplicateWarning(null);
    setAllowDuplicateOverride(false);
    setUploadStatusMsg(null);
  };

  // Handle Download Request
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
      alert(res.error || "Download denied or failed.");
    }
  };

  // Handle Preview Open
  const handleOpenPreview = async (doc: DocumentItemDTO) => {
    setPreviewDoc(doc);
    const ext = doc.extension.toLowerCase();
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      const res = await getSpreadsheetPreviewAction(doc.id, 0);
      if (res.success && res.preview) {
        setSpreadsheetPreviewData(res.preview);
        setActiveSheetIndex(0);
      }
    } else {
      setSpreadsheetPreviewData(null);
    }
  };

  // Handle Sheet Change in Spreadsheet Preview
  const handleSheetChange = async (index: number) => {
    if (!previewDoc) return;
    setActiveSheetIndex(index);
    const res = await getSpreadsheetPreviewAction(previewDoc.id, index);
    if (res.success && res.preview) {
      setSpreadsheetPreviewData(res.preview);
    }
  };

  // Handle Archive / Restore
  const handleArchiveToggle = async (doc: DocumentItemDTO) => {
    if (doc.status === DocumentStatus.ARCHIVED) {
      const res = await restoreDocumentAction(doc.id);
      if (res.success) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, status: DocumentStatus.AVAILABLE, archivedAt: null } : d))
        );
      } else {
        alert(res.error || "Failed to restore document.");
      }
    } else {
      if (!confirm(`Are you sure you want to archive "${doc.displayName}"?`)) return;
      const res = await archiveDocumentAction(doc.id);
      if (res.success) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, status: DocumentStatus.ARCHIVED, archivedAt: new Date() } : d))
        );
      } else {
        alert(res.error || "Failed to archive document.");
      }
    }
  };

  // Handle Delete
  const handleDelete = async (doc: DocumentItemDTO) => {
    if (!confirm(`Are you sure you want to permanently delete "${doc.displayName}"? This action cannot be undone.`))
      return;
    const res = await deleteDocumentAction(doc.id);
    if (res.success) {
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (selectedDocForDetail?.id === doc.id) setSelectedDocForDetail(null);
    } else {
      alert(res.error || "Delete failed. Protected records cannot be removed.");
    }
  };

  // Submit Version
  const handleVersionSubmit = () => {
    if (!versionModalDoc || !versionFile) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("parentDocumentId", versionModalDoc.id);
      formData.append("file", versionFile);
      if (versionChangeNote) formData.append("changeNote", versionChangeNote);

      const res = await createDocumentVersionAction(formData);
      if (res.success && res.document) {
        alert(`New version ${res.document.versionNumber} uploaded successfully!`);
        setVersionModalDoc(null);
        setVersionFile(null);
        setVersionChangeNote("");
        // Reload page to refresh full family chain
        window.location.reload();
      } else {
        alert(res.error || "Version upload failed.");
      }
    });
  };

  // Submit Metadata Update
  const handleEditMetadataSubmit = () => {
    if (!editMetaDoc) return;

    startTransition(async () => {
      const res = await updateDocumentMetadataAction(editMetaDoc.id, {
        displayName: editDisplayName,
        category: editCategory,
        description: editDescription,
        tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
        expiryDate: editExpiryDate || null,
        sensitivity: editSensitivity,
      });

      if (res.success && res.document) {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === editMetaDoc.id
              ? {
                  ...d,
                  displayName: res.document.displayName,
                  category: res.document.category,
                  description: res.document.description,
                  tags: res.document.tags,
                  expiryDate: res.document.expiryDate ? new Date(res.document.expiryDate) : null,
                  sensitivity: res.document.sensitivity,
                }
              : d
          )
        );
        setEditMetaDoc(null);
      } else {
        alert(res.error || "Failed to update metadata.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Business Document Management Vault
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {totalDocuments} Files
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Secure multi-tenant file vault with magic byte verification, versioning & relational entity links.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => setScannerInfoOpen(!scannerInfoOpen)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Inspect File Security & Scanner Capability"
          >
            <ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Security Engine</span>
          </button>

          {canUpload && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          )}
        </div>
      </div>

      {/* Security Engine Capability Banner */}
      {scannerInfoOpen && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 text-xs text-slate-300 space-y-2 relative">
          <button
            onClick={() => setScannerInfoOpen(false)}
            className="absolute top-3 right-3 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle className="w-4 h-4" />
            File Security Engine Active
          </div>
          <p className="text-slate-400">
            Every upload undergoes strict server-side validation: Magic byte file signature detection, MIME compatibility
            verification, ZIP bomb decompression safeguards, VBA macro detection in Office files, and business-scoped
            SHA-256 duplicate detection.
          </p>
          <div className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
            <strong>Engine Transparency:</strong> Local heuristic & file signature engine is operational. External
            Antivirus Daemon (e.g. ClamAV) is not connected in this local environment.
          </div>
        </div>
      )}

      {/* Vault Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
        {[
          { id: "ALL", label: "All Documents" },
          { id: "RECENT", label: "Recent" },
          { id: "CUSTOMERS", label: "Customers" },
          { id: "SUPPLIERS", label: "Suppliers" },
          { id: "TRANSACTIONS", label: "Transactions" },
          { id: "PAYMENTS", label: "Payments" },
          { id: "RECEIVABLES", label: "Receivables" },
          { id: "PAYABLES", label: "Payables" },
          { id: "FOLLOWUPS", label: "Follow-Ups" },
          { id: "REPORTS", label: "Reports" },
          { id: "IMPORTS", label: "Imports" },
          { id: "GENERAL", label: "General" },
          { id: "EXPIRING_SOON", label: "Expiring Soon" },
          { id: "ARCHIVED", label: "Archived" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className="md:col-span-3 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Category Dropdown */}
        <div className="md:col-span-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {Object.values(DocumentCategory).map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Extension / File Type Dropdown */}
        <div className="md:col-span-2">
          <select
            value={selectedExtension}
            onChange={(e) => setSelectedExtension(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Formats</option>
            <option value="pdf">PDF Documents</option>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV Spreadsheets</option>
            <option value="png">PNG Images</option>
            <option value="jpg">JPEG Images</option>
            <option value="webp">WebP Images</option>
            <option value="txt">Plain Text (.txt)</option>
            <option value="docx">Word (.docx)</option>
          </select>
        </div>

        {/* Sensitivity Dropdown */}
        <div className="md:col-span-2">
          <select
            value={selectedSensitivity}
            onChange={(e) => setSelectedSensitivity(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Sensitivity</option>
            <option value={DocumentSensitivity.NORMAL}>Normal</option>
            <option value={DocumentSensitivity.SENSITIVE}>Sensitive</option>
            <option value={DocumentSensitivity.RESTRICTED}>Restricted</option>
          </select>
        </div>

        {/* Sort Dropdown */}
        <div className="md:col-span-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as unknown as typeof sortBy)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="name">Sort: Name</option>
            <option value="largest">Sort: Largest</option>
            <option value="expiry_soon">Sort: Expiry Soon</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="md:col-span-1 flex justify-end gap-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              viewMode === "grid"
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
            title="Card View"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              viewMode === "table"
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
            title="Table View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Documents Grid / Table View */}
      {filteredDocuments.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl border border-slate-800 space-y-3">
          <FileText className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No documents found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? "No documents matched your search criteria. Try adjusting your query or filters."
              : "No documents have been uploaded to this view yet."}
          </p>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white inline-flex items-center gap-1.5 cursor-pointer mt-2"
          >
            <Upload className="w-4 h-4" />
            Upload First Document
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                      {getFileIcon(doc.extension)}
                    </div>
                    <div className="min-w-0">
                      <h4
                        className="text-xs font-bold text-white truncate cursor-pointer hover:text-cyan-400 transition-colors"
                        onClick={() => setSelectedDocForDetail(doc)}
                        title={doc.displayName}
                      >
                        {doc.displayName}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono truncate" title={doc.originalFileName}>
                        {doc.originalFileName}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 shrink-0">
                    v{doc.versionNumber}
                  </span>
                </div>

                {/* Badges: Category, Sensitivity, Expiry */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {doc.category.replace(/_/g, " ")}
                  </span>

                  {doc.sensitivity !== DocumentSensitivity.NORMAL && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {doc.sensitivity}
                    </span>
                  )}

                  {doc.expiryDate && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${
                        doc.expiryStatus === "EXPIRED"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : doc.expiryStatus === "EXPIRING_SOON"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      Exp: {new Date(doc.expiryDate).toLocaleDateString("en-IN")}
                    </span>
                  )}
                </div>

                {doc.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 pt-1">{doc.description}</p>
                )}

                {/* Tags */}
                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {doc.tags.map((t) => (
                      <span key={t} className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer info & action buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 font-mono text-[11px]">{formatBytes(doc.fileSize)}</span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenPreview(doc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Quick Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDownload(doc.id, doc.originalFileName)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Authorized Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setSelectedDocForDetail(doc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Details & Versions"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">Name & File</th>
                  <th className="p-3 font-semibold">Category</th>
                  <th className="p-3 font-semibold">Size</th>
                  <th className="p-3 font-semibold">Version</th>
                  <th className="p-3 font-semibold">Expiry</th>
                  <th className="p-3 font-semibold">Uploaded</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        {getFileIcon(doc.extension)}
                        <div>
                          <span
                            className="font-bold text-white hover:text-cyan-400 cursor-pointer block"
                            onClick={() => setSelectedDocForDetail(doc)}
                          >
                            {doc.displayName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono block">{doc.originalFileName}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {doc.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400">{formatBytes(doc.fileSize)}</td>
                    <td className="p-3 font-mono text-slate-400">v{doc.versionNumber}</td>
                    <td className="p-3">
                      {doc.expiryDate ? (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            doc.expiryStatus === "EXPIRED"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : doc.expiryStatus === "EXPIRING_SOON"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {new Date(doc.expiryDate).toLocaleDateString("en-IN")}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-400">
                      {new Date(doc.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenPreview(doc)}
                          className="p-1 rounded text-slate-400 hover:text-cyan-400"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(doc.id, doc.originalFileName)}
                          className="p-1 rounded text-slate-400 hover:text-emerald-400"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedDocForDetail(doc)}
                          className="p-1 rounded text-slate-400 hover:text-white"
                          title="Detail"
                        >
                          <Info className="w-4 h-4" />
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

      {/* =================================================================== */}
      {/* UPLOAD DOCUMENT MODAL                                               */}
      {/* =================================================================== */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card max-w-lg w-full rounded-3xl border border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                Upload New Business Document
              </h3>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  resetUploadForm();
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* File Drag & Drop / Input Zone */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Select File (Max 20MB)</label>
              <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-2xl p-6 text-center cursor-pointer transition-colors relative bg-slate-950/40">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.txt,.docx"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="space-y-1">
                  <Upload className="w-8 h-8 text-cyan-400 mx-auto" />
                  <p className="text-xs font-medium text-slate-200">
                    {uploadFile ? uploadFile.name : "Choose file or drag & drop"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Allowed: PDF, Excel, CSV, PNG, JPG, WebP, Word, Plain Text
                  </p>
                </div>
              </div>
            </div>

            {/* Duplicate warning alert */}
            {duplicateWarning && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Duplicate Check Alert
                </div>
                <p className="text-[11px]">{duplicateWarning}</p>
                <label className="flex items-center gap-2 pt-1 text-[11px] cursor-pointer text-amber-200">
                  <input
                    type="checkbox"
                    checked={allowDuplicateOverride}
                    onChange={(e) => setAllowDuplicateOverride(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500"
                  />
                  I understand this is a duplicate. Upload as separate document anyway.
                </label>
              </div>
            )}

            {/* Document Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. October Vehicle Rental Agreement"
                  value={uploadDisplayName}
                  onChange={(e) => setUploadDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {Object.values(DocumentCategory).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Sensitivity Level</label>
                <select
                  value={uploadSensitivity}
                  onChange={(e) => setUploadSensitivity(e.target.value as DocumentSensitivity)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value={DocumentSensitivity.NORMAL}>Normal (All staff)</option>
                  <option value={DocumentSensitivity.SENSITIVE}>Sensitive (Accountants & Admins)</option>
                  <option value={DocumentSensitivity.RESTRICTED}>Restricted (Owners only)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={uploadExpiryDate}
                  onChange={(e) => setUploadExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Entity Linking */}
            <div className="space-y-1 text-xs">
              <label className="text-slate-300 font-semibold block">Link to Record (Optional)</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={uploadLinkedEntityType}
                  onChange={(e) => {
                    setUploadLinkedEntityType(e.target.value as DocumentEntityType | "NONE");
                    setUploadLinkedEntityId("");
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="NONE">No link (General Document)</option>
                  <option value={DocumentEntityType.CUSTOMER}>Customer</option>
                  <option value={DocumentEntityType.SUPPLIER}>Supplier</option>
                  <option value={DocumentEntityType.TRANSACTION}>Transaction / Trip</option>
                </select>

                {uploadLinkedEntityType === DocumentEntityType.CUSTOMER && (
                  <select
                    value={uploadLinkedEntityId}
                    onChange={(e) => setUploadLinkedEntityId(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Select Customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.customerCode})
                      </option>
                    ))}
                  </select>
                )}

                {uploadLinkedEntityType === DocumentEntityType.SUPPLIER && (
                  <select
                    value={uploadLinkedEntityId}
                    onChange={(e) => setUploadLinkedEntityId(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.supplierCode})
                      </option>
                    ))}
                  </select>
                )}

                {uploadLinkedEntityType === DocumentEntityType.TRANSACTION && (
                  <select
                    value={uploadLinkedEntityId}
                    onChange={(e) => setUploadLinkedEntityId(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Select Transaction...</option>
                    {transactions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.transactionNumber} - {t.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Description & Tags */}
            <div className="space-y-1 text-xs">
              <label className="text-slate-300 font-semibold block">Description & Notes</label>
              <textarea
                rows={2}
                placeholder="Brief summary of document contents..."
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1 text-xs">
              <label className="text-slate-300 font-semibold block">Tags (comma separated)</label>
              <input
                type="text"
                placeholder="e.g. 2026, September, Diesel, Permit"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {uploadStatusMsg && (
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 font-mono flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {uploadStatusMsg}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  resetUploadForm();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!uploadFile || isPending || (!!duplicateWarning && !allowDuplicateOverride)}
                onClick={handleUploadSubmit}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-600/20"
              >
                {isPending ? "Validating & Storing..." : "Verify & Save to Vault"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* QUICK PREVIEW DRAWER                                                */}
      {/* =================================================================== */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-4xl w-full h-[85vh] rounded-3xl border border-slate-800 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5 min-w-0">
                {getFileIcon(previewDoc.extension)}
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{previewDoc.displayName}</h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {previewDoc.originalFileName} ({formatBytes(previewDoc.fileSize)})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewDoc.id, previewDoc.originalFileName)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button
                  onClick={() => {
                    setPreviewDoc(null);
                    setSpreadsheetPreviewData(null);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Body */}
            <div className="flex-1 bg-slate-950/80 overflow-auto p-4 flex items-center justify-center">
              {previewDoc.extension.toLowerCase() === "pdf" ? (
                <iframe
                  src={`/api/documents/${previewDoc.id}/preview`}
                  className="w-full h-full rounded-xl border border-slate-800"
                  title="PDF Preview"
                />
              ) : ["png", "jpg", "jpeg", "webp"].includes(previewDoc.extension.toLowerCase()) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/documents/${previewDoc.id}/preview`}
                  alt={previewDoc.displayName}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                />
              ) : ["xlsx", "xls", "csv"].includes(previewDoc.extension.toLowerCase()) ? (
                spreadsheetPreviewData ? (
                  <div className="w-full h-full flex flex-col space-y-2">
                    {/* Sheet Tabs */}
                    {spreadsheetPreviewData.sheetNames.length > 1 && (
                      <div className="flex items-center gap-1 overflow-x-auto pb-1">
                        {spreadsheetPreviewData.sheetNames.map((sheet, idx) => (
                          <button
                            key={sheet}
                            onClick={() => handleSheetChange(idx)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                              activeSheetIndex === idx
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            }`}
                          >
                            {sheet}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Table Grid */}
                    <div className="flex-1 overflow-auto rounded-xl border border-slate-800">
                      <table className="w-full text-xs text-left text-slate-300">
                        <thead className="bg-slate-900 text-slate-300 sticky top-0 border-b border-slate-800">
                          <tr>
                            {spreadsheetPreviewData.headers.map((h, i) => (
                              <th key={i} className="p-2.5 font-bold whitespace-nowrap border-r border-slate-800">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {spreadsheetPreviewData.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-900/40">
                              {spreadsheetPreviewData.headers.map((h, cIdx) => (
                                <td key={cIdx} className="p-2 border-r border-slate-800/50 font-mono text-[11px]">
                                  {row[h] !== null ? String(row[h]) : "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-[11px] text-slate-500 font-mono">
                      Showing first {spreadsheetPreviewData.rows.length} rows (safe tabular mode, zero formula
                      execution).
                    </p>
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    Parsing safe spreadsheet preview...
                  </div>
                )
              ) : (
                <div className="text-center space-y-3 p-8">
                  <File className="w-12 h-12 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Preview Not Available</h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Inline preview is not available for this file format ({previewDoc.extension.toUpperCase()}). You can
                    download the file securely to view it.
                  </p>
                  <button
                    onClick={() => handleDownload(previewDoc.id, previewDoc.originalFileName)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download to View
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DOCUMENT DETAIL DRAWER                                              */}
      {/* =================================================================== */}
      {selectedDocForDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="glass-card max-w-lg w-full h-full border-l border-slate-800 p-6 space-y-5 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Document Vault Details</h3>
              </div>
              <button onClick={() => setSelectedDocForDetail(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Title & Category */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {selectedDocForDetail.category.replace(/_/g, " ")}
                </span>
                <span className="text-xs font-mono text-slate-400">Version {selectedDocForDetail.versionNumber}</span>
              </div>
              <h2 className="text-base font-bold text-white pt-1">{selectedDocForDetail.displayName}</h2>
              <p className="text-xs font-mono text-slate-500">{selectedDocForDetail.originalFileName}</p>
            </div>

            {/* Quick Action Toolbar */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleOpenPreview(selectedDocForDetail)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 border border-cyan-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview File
              </button>

              <button
                onClick={() => handleDownload(selectedDocForDetail.id, selectedDocForDetail.originalFileName)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download (Signed)
              </button>

              <button
                onClick={() => {
                  setVersionModalDoc(selectedDocForDetail);
                  setSelectedDocForDetail(null);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload New Version
              </button>

              <button
                onClick={() => {
                  setEditMetaDoc(selectedDocForDetail);
                  setEditDisplayName(selectedDocForDetail.displayName);
                  setEditCategory(selectedDocForDetail.category);
                  setEditDescription(selectedDocForDetail.description || "");
                  setEditTags(selectedDocForDetail.tags.join(", "));
                  setEditExpiryDate(
                    selectedDocForDetail.expiryDate
                      ? new Date(selectedDocForDetail.expiryDate).toISOString().split("T")[0]
                      : ""
                  );
                  setEditSensitivity(selectedDocForDetail.sensitivity);
                  setSelectedDocForDetail(null);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Edit Metadata
              </button>
            </div>

            {/* Metadata Dossier */}
            <div className="space-y-3 pt-2 text-xs">
              <h4 className="font-bold text-slate-300 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-cyan-400" />
                Vault Metadata & Integrity
              </h4>

              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">File Size:</span>
                  <span className="font-mono text-white">{formatBytes(selectedDocForDetail.fileSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">MIME Type:</span>
                  <span className="font-mono text-slate-300">{selectedDocForDetail.mimeType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Storage Provider:</span>
                  <span className="font-mono text-slate-300">{selectedDocForDetail.storageProvider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sensitivity:</span>
                  <span className="font-mono text-cyan-400">{selectedDocForDetail.sensitivity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-mono text-emerald-400">{selectedDocForDetail.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Uploaded On:</span>
                  <span className="font-mono text-slate-300">
                    {new Date(selectedDocForDetail.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
                {selectedDocForDetail.checksum && (
                  <div className="pt-1 border-t border-slate-800">
                    <span className="text-slate-500 block text-[10px]">SHA-256 Checksum:</span>
                    <span className="font-mono text-[10px] text-slate-400 break-all select-all">
                      {selectedDocForDetail.checksum}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Relational Entity Links */}
            {selectedDocForDetail.documentLinks && selectedDocForDetail.documentLinks.length > 0 && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-cyan-400" />
                  Linked Business Entities
                </h4>
                <div className="space-y-1">
                  {selectedDocForDetail.documentLinks.map((link) => (
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

            {/* Version History */}
            {selectedDocForDetail.versions && selectedDocForDetail.versions.length > 0 && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-300 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-purple-400" />
                  Version Chain History
                </h4>
                <div className="space-y-1.5">
                  {selectedDocForDetail.versions.map((v) => (
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
                      <button
                        onClick={() => handleDownload(v.id, `${v.displayName}_v${v.versionNumber}`)}
                        className="p-1 text-slate-400 hover:text-emerald-400"
                        title="Download this version"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Archive / Delete Danger Zone */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => handleArchiveToggle(selectedDocForDetail)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                {selectedDocForDetail.status === DocumentStatus.ARCHIVED ? "Restore Document" : "Archive Document"}
              </button>

              <button
                onClick={() => handleDelete(selectedDocForDetail)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 cursor-pointer"
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VERSION REPLACEMENT MODAL                                           */}
      {/* =================================================================== */}
      {versionModalDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-3xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" />
                Upload New Version
              </h3>
              <button onClick={() => setVersionModalDoc(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Uploading a new version preserves existing version (v{versionModalDoc.versionNumber}) immutably. The new
              file becomes the current active version.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Select New File</label>
              <input
                type="file"
                onChange={(e) => e.target.files && setVersionFile(e.target.files[0])}
                className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1 text-xs">
              <label className="text-slate-300 font-semibold block">Change Note (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Added October amendment signature"
                value={versionChangeNote}
                onChange={(e) => setVersionChangeNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button
                onClick={() => setVersionModalDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400"
              >
                Cancel
              </button>
              <button
                disabled={!versionFile || isPending}
                onClick={handleVersionSubmit}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Creating Version..." : "Confirm New Version"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* EDIT METADATA MODAL                                                 */}
      {/* =================================================================== */}
      {editMetaDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-3xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Edit Document Metadata</h3>
              <button onClick={() => setEditMetaDoc(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as DocumentCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {Object.values(DocumentCategory).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Expiry Date</label>
                <input
                  type="date"
                  value={editExpiryDate}
                  onChange={(e) => setEditExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Tags (comma separated)</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button
                onClick={() => setEditMetaDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400"
              >
                Cancel
              </button>
              <button
                disabled={isPending}
                onClick={handleEditMetadataSubmit}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}
