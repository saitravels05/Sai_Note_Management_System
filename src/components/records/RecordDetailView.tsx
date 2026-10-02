"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatINR } from "@/lib/formatters";
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  FileCheck,
  FileText,
  Sliders,
  Calendar,
  User,
  Building,
  Tag,
  Hash,
  ArrowLeft,
  Edit3,
  Copy,
  Trash2,
  Ban,
  CheckCircle2,
  Clock,
  Paperclip,
  Upload,
  Download,
  History,
  ShieldAlert,
} from "lucide-react";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { voidRecordAction, deleteDraftAction, saveRecordAction } from "@/server/actions/record.actions";
import { uploadAttachmentAction, deleteAttachmentAction } from "@/server/actions/attachment.actions";

export interface RecordDetailAuditLog {
  id: string;
  action: string;
  createdAt: Date | string;
  reason?: string | null;
}

export interface RecordDetailCustomField {
  id: string;
  definition?: {
    fieldLabel?: string;
    fieldName?: string;
    name?: string;
  } | null;
  value: unknown;
}

export interface RecordDetailAttachment {
  id: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
}

export interface RecordDetailTagRel {
  tag: { id: string; name: string };
}

export interface RecordDetailData {
  id: string;
  transactionNumber: string;
  title: string;
  description?: string | null;
  totalAmount: { toString(): string } | string | number;
  transactionDate: Date | string;
  transactionType: TransactionType;
  categoryId: string;
  category?: { name: string } | null;
  customerId?: string | null;
  customer?: { name: string; phone?: string | null; email?: string | null; code?: string | null } | null;
  supplierId?: string | null;
  supplier?: { name: string; phone?: string | null; email?: string | null; code?: string | null } | null;
  referenceNumber?: string | null;
  notes?: string | null;
  paymentStatus: string;
  status: TransactionStatus;
  voidReason?: string | null;
  voidedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  postedAt?: Date | string | null;
  dueDate?: Date | string | null;
  tags?: RecordDetailTagRel[];
}

interface RecordDetailViewProps {
  record: RecordDetailData;
  auditLogs: RecordDetailAuditLog[];
  customFieldValues: RecordDetailCustomField[];
  attachments: RecordDetailAttachment[];
  userPermissions: string[];
}

export function RecordDetailView({
  record,
  auditLogs,
  customFieldValues,
  attachments,
  userPermissions,
}: RecordDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Modal states
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const canEdit = userPermissions.includes("records.edit");
  const canVoid = userPermissions.includes("records.void");

  // Post Draft Record directly
  const handlePostRecord = async () => {
    setActionMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("id", record.id);
      formData.append("title", record.title);
      formData.append("amount", record.totalAmount.toString());
      formData.append("transactionDate", new Date(record.transactionDate).toISOString().split("T")[0]);
      formData.append("transactionType", record.transactionType);
      formData.append("categoryId", record.categoryId);
      formData.append("status", TransactionStatus.POSTED);
      formData.append("paymentStatus", record.paymentStatus);
      if (record.customerId) formData.append("customerId", record.customerId);
      if (record.supplierId) formData.append("supplierId", record.supplierId);
      if (record.referenceNumber) formData.append("referenceNumber", record.referenceNumber);
      if (record.description) formData.append("description", record.description);
      if (record.notes) formData.append("notes", record.notes);

      const res = await saveRecordAction(null, formData);
      if (res.success) {
        setActionMessage("Record successfully posted to ledger.");
        router.refresh();
      } else {
        setActionMessage(res.error || "Failed to post record");
      }
    });
  };

  // Void Handler
  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason.trim() || voidReason.trim().length < 3) {
      setVoidError("A mandatory explanation is required to void this record.");
      return;
    }

    setVoidError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("id", record.id);
      formData.append("reason", voidReason.trim());

      const res = await voidRecordAction(null, formData);
      if (res.success) {
        setVoidModalOpen(false);
        setVoidReason("");
        router.refresh();
      } else {
        setVoidError(res.error || "Failed to void record");
      }
    });
  };

  // Delete Draft Handler
  const handleDeleteDraft = async () => {
    setDeleteError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("id", record.id);

      const res = await deleteDraftAction(null, formData);
      if (res.success) {
        router.push("/records");
      } else {
        setDeleteError(res.error || "Failed to delete draft");
      }
    });
  };

  // Attachment Upload Handler
  const handleUploadAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    setUploadError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("entityType", "TRANSACTION");
      formData.append("entityId", record.id);
      formData.append("file", uploadFile);

      const res = await uploadAttachmentAction(formData);
      if (res.success) {
        setUploadModalOpen(false);
        setUploadFile(null);
        router.refresh();
      } else {
        setUploadError(res.error || "Failed to upload file");
      }
    });
  };

  // Attachment Delete Handler
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm("Are you sure you want to remove this attachment?")) return;

    startTransition(async () => {
      await deleteAttachmentAction(attachmentId);
      router.refresh();
    });
  };

  // Type metadata styling
  const getTypeMeta = () => {
    switch (record.transactionType) {
      case TransactionType.INCOME:
        return {
          label: "Income",
          icon: TrendingUp,
          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          amountColor: "text-emerald-400",
          prefix: "+",
        };
      case TransactionType.EXPENSE:
        return {
          label: "Expense",
          icon: TrendingDown,
          badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          amountColor: "text-rose-400",
          prefix: "-",
        };
      case TransactionType.PAYMENT_IN:
        return {
          label: "Payment In",
          icon: ArrowDownLeft,
          badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          amountColor: "text-blue-400",
          prefix: "+",
        };
      case TransactionType.PAYMENT_OUT:
        return {
          label: "Payment Out",
          icon: ArrowUpRight,
          badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          amountColor: "text-amber-400",
          prefix: "-",
        };
      case TransactionType.RECEIVABLE:
        return {
          label: "Receivable",
          icon: FileCheck,
          badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/20",
          amountColor: "text-teal-400",
          prefix: "",
        };
      case TransactionType.PAYABLE:
        return {
          label: "Payable",
          icon: FileText,
          badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
          amountColor: "text-orange-400",
          prefix: "",
        };
      case TransactionType.ADJUSTMENT:
        return {
          label: "Adjustment",
          icon: Sliders,
          badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
          amountColor: "text-purple-400",
          prefix: "",
        };
      default:
        return {
          label: record.transactionType,
          icon: FileText,
          badgeColor: "bg-slate-500/10 text-slate-400 border-slate-500/20",
          amountColor: "text-white",
          prefix: "",
        };
    }
  };

  const meta = getTypeMeta();
  const IconComponent = meta.icon;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Navigation & Status Notification */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/records"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Records Workspace
        </Link>

        {actionMessage && (
          <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
            {actionMessage}
          </span>
        )}
      </div>

      {/* Hero Record Header Card */}
      <div className="p-6 rounded-2xl glass-card border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border ${meta.badgeColor}`}
              >
                <IconComponent className="w-3.5 h-3.5" />
                {meta.label}
              </span>

              {/* Status Badge */}
              {record.status === TransactionStatus.POSTED && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  POSTED
                </span>
              )}
              {record.status === TransactionStatus.DRAFT && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock className="w-3 h-3" />
                  DRAFT
                </span>
              )}
              {record.status === TransactionStatus.VOID && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Ban className="w-3 h-3" />
                  VOIDED
                </span>
              )}

              {/* Payment Status Badge */}
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                Payment: {record.paymentStatus}
              </span>

              <span className="text-xs text-slate-500 font-mono">
                #{record.transactionNumber}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight">{record.title}</h1>
            {record.description && (
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">{record.description}</p>
            )}
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {record.status === TransactionStatus.DRAFT && (
              <>
                <button
                  onClick={handlePostRecord}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Post Record
                </button>
                {canEdit && (
                  <Link
                    href={`/records/${record.id}/edit`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Draft
                  </Link>
                )}
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Draft
                </button>
              </>
            )}

            {record.status === TransactionStatus.POSTED && (
              <>
                {canEdit && (
                  <Link
                    href={`/records/${record.id}/edit`}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Record
                  </Link>
                )}
                {canVoid && (
                  <button
                    onClick={() => setVoidModalOpen(true)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Void Record
                  </button>
                )}
              </>
            )}

            {/* Safe Duplicate */}
            <Link
              href={`/quick-entry?duplicateId=${record.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all"
              title="Duplicate into a new unposted record"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate
            </Link>
          </div>
        </div>

        {/* Void Warning banner if voided */}
        {record.status === TransactionStatus.VOID && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-semibold text-rose-300">This transaction has been VOIDED</div>
              <p className="text-rose-400/90 leading-relaxed">
                Reason: &quot;{record.voidReason || "Voided by authorized user"}&quot;
              </p>
              {record.voidedAt && (
                <div className="text-[11px] text-rose-400/70">
                  Voided on {format(new Date(record.voidedAt), "dd MMMM yyyy, hh:mm a")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Amount & Key Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Total Amount
            </span>
            <span className={`text-2xl font-black mt-1 block tracking-tight ${meta.amountColor}`}>
              {meta.prefix}₹{formatINR(record.totalAmount.toString())}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Record Date
            </span>
            <div className="flex items-center gap-1.5 text-slate-100 font-semibold text-sm mt-1">
              <Calendar className="w-4 h-4 text-orange-400" />
              {format(new Date(record.transactionDate), "dd MMMM yyyy")}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Category
            </span>
            <div className="flex items-center gap-1.5 text-slate-100 font-semibold text-sm mt-1">
              <Tag className="w-4 h-4 text-orange-400" />
              {record.category?.name || "General"}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Reference Number
            </span>
            <div className="flex items-center gap-1.5 text-slate-100 font-mono font-semibold text-sm mt-1">
              <Hash className="w-4 h-4 text-slate-500" />
              {record.referenceNumber || "None"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Notes, Custom Fields, Attachments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notes / Diary Content */}
          <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <FileText className="w-4 h-4 text-orange-400" />
              <h3>Record Notes & Diary</h3>
            </div>
            {record.notes ? (
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                {record.notes}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No notes added to this record.</p>
            )}

            {/* Tags */}
            {record.tags && record.tags.length > 0 && (
              <div className="pt-2">
                <span className="text-[11px] text-slate-400 font-medium block mb-1.5">Tags:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {record.tags.map((t: RecordDetailTagRel) => (
                    <span
                      key={t.tag.id}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] bg-slate-800 text-slate-300 border border-slate-700 font-medium"
                    >
                      <Tag className="w-3 h-3 text-orange-400" />
                      {t.tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Custom Fields (If Any) */}
          {customFieldValues && customFieldValues.length > 0 && (
            <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Sliders className="w-4 h-4 text-orange-400" />
                <h3>Custom Information</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {customFieldValues.map((cf: RecordDetailCustomField) => (
                  <div
                    key={cf.id}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1"
                  >
                    <span className="text-[11px] text-slate-400 font-medium block">
                      {cf.definition?.name || "Field"}
                    </span>
                    <span className="text-slate-100 font-semibold block">
                      {typeof cf.value === "object" ? JSON.stringify(cf.value) : String(cf.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments Section */}
          <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Paperclip className="w-4 h-4 text-orange-400" />
                <h3>Document Attachments ({attachments.length})</h3>
              </div>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                + Add File
              </button>
            </div>

            {attachments.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No attachments uploaded for this record yet. PDFs, receipts, and images can be stored securely here.
              </p>
            ) : (
              <div className="space-y-2">
                {attachments.map((att: RecordDetailAttachment) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 pr-3">
                      <Paperclip className="w-4 h-4 text-orange-400 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-slate-200 block truncate">
                          {att.originalFileName}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {(att.fileSize / 1024).toFixed(1)} KB • {att.mimeType}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`/api/attachments/${att.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors font-medium text-[11px]"
                      >
                        <Download className="w-3 h-3" />
                        View / Download
                      </a>
                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Party Info, Lifecycle Metadata, Audit History */}
        <div className="space-y-6">
          {/* Party Information (Customer / Supplier) */}
          {(record.customer || record.supplier) && (
            <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                {record.customer ? (
                  <User className="w-4 h-4 text-orange-400" />
                ) : (
                  <Building className="w-4 h-4 text-orange-400" />
                )}
                <h3>{record.customer ? "Customer Details" : "Supplier Details"}</h3>
              </div>

              {record.customer && (
                <div className="space-y-2 text-xs">
                  <div className="text-base font-bold text-white">{record.customer.name}</div>
                  {record.customer.phone && (
                    <div className="text-slate-300">Phone: {record.customer.phone}</div>
                  )}
                  {record.customer.email && (
                    <div className="text-slate-400">Email: {record.customer.email}</div>
                  )}
                  {record.customer.code && (
                    <div className="text-slate-500 font-mono text-[11px]">Code: {record.customer.code}</div>
                  )}
                </div>
              )}

              {record.supplier && (
                <div className="space-y-2 text-xs">
                  <div className="text-base font-bold text-white">{record.supplier.name}</div>
                  {record.supplier.phone && (
                    <div className="text-slate-300">Phone: {record.supplier.phone}</div>
                  )}
                  {record.supplier.email && (
                    <div className="text-slate-400">Email: {record.supplier.email}</div>
                  )}
                  {record.supplier.code && (
                    <div className="text-slate-500 font-mono text-[11px]">Code: {record.supplier.code}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Lifecycle & Record Metadata */}
          <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-3 text-xs">
            <h3 className="font-semibold text-white text-sm">Record Metadata</h3>
            <div className="space-y-2 text-slate-400">
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span>Created At:</span>
                <span className="text-slate-200 font-medium">
                  {format(new Date(record.createdAt), "dd MMM yyyy, hh:mm a")}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span>Last Updated:</span>
                <span className="text-slate-200 font-medium">
                  {format(new Date(record.updatedAt), "dd MMM yyyy, hh:mm a")}
                </span>
              </div>
              {record.postedAt && (
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span>Posted At:</span>
                  <span className="text-emerald-400 font-medium">
                    {format(new Date(record.postedAt), "dd MMM yyyy, hh:mm a")}
                  </span>
                </div>
              )}
              {record.dueDate && (
                <div className="flex justify-between">
                  <span>Due Date:</span>
                  <span className="text-amber-400 font-medium">
                    {format(new Date(record.dueDate), "dd MMM yyyy")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Audit History Timeline */}
          <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <History className="w-4 h-4 text-orange-400" />
              <h3>Audit History</h3>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No audit history entries found.</p>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 text-xs">
                {auditLogs.map((log: RecordDetailAuditLog) => (
                  <div key={log.id} className="relative pl-6 space-y-1">
                    <span className="absolute left-1 top-1.5 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-slate-900" />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{log.action}</span>
                      <span className="text-[10px] text-slate-500">
                        {format(new Date(log.createdAt), "dd MMM, hh:mm a")}
                      </span>
                    </div>
                    {log.reason && (
                      <p className="text-slate-400 text-[11px] italic leading-tight">
                        &quot;{log.reason}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Void Modal */}
      {voidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-white text-base">Void Financial Record</h3>
                <p className="text-xs text-slate-400">
                  This transaction will be marked as VOID. Financial history will be preserved and audited.
                </p>
              </div>
            </div>

            <form onSubmit={handleVoid} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Reason for Voiding <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Duplicate booking entered by mistake, customer cancelled ticket..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  autoFocus
                />
              </div>

              {voidError && <p className="text-xs text-rose-400">{voidError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || voidReason.trim().length < 3}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
                >
                  {isPending ? "Voiding..." : "Confirm Void"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Draft Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <Trash2 className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-white text-base">Delete Draft</h3>
                <p className="text-xs text-slate-400">
                  Are you sure you want to permanently delete this unposted draft?
                </p>
              </div>
            </div>

            {deleteError && <p className="text-xs text-rose-400">{deleteError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDraft}
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Delete Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Attachment Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="font-bold text-white text-base">Upload Document</h3>
              <p className="text-xs text-slate-400 mt-1">
                Attach PDF, receipt image, or spreadsheet (max 10MB).
              </p>
            </div>

            <form onSubmit={handleUploadAttachment} className="space-y-4">
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv"
                className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-500/10 file:text-orange-400 hover:file:bg-orange-500/20"
              />

              {uploadError && <p className="text-xs text-rose-400">{uploadError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !uploadFile}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                >
                  {isPending ? "Uploading..." : "Upload File"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
