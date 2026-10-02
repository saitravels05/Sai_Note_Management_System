"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  Truck,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  TrendingDown,
  Tag as TagIcon,
  Pin,
  FileText,
  AlertCircle,
  CheckCircle,
  PlusCircle,
  ChevronRight,
  ShieldCheck,
  Archive,
  CreditCard,
  History,
  Activity,
  UserCheck,
  Building,
} from "lucide-react";
import {
  SupplierProfile360DTO,
  FollowUpItemDTO,
  PaymentCommitmentItemDTO,
  CRMActivityItemDTO,
} from "@/types/crm";
import { LedgerEntry } from "@/server/services/ledger.service";
import {
  updateSupplierCRMAction,
  archiveSupplierAction,
  createFollowUpAction,
  createCommitmentAction,
  logCommunicationAction,
} from "@/server/actions/crm.actions";
import { FollowUpType, FollowUpPriority, CommunicationChannel } from "@prisma/client";
import { EntityDocumentsTab, EntityDocumentItem } from "@/components/documents/EntityDocumentsTab";

type SupplierTab =
  | "overview"
  | "financial"
  | "payables"
  | "payments"
  | "ledger"
  | "followups"
  | "commitments"
  | "documents"
  | "notes"
  | "activity";

interface Supplier360WorkspaceProps {
  data: SupplierProfile360DTO;
  ledgerEntries: LedgerEntry[];
  payables: Array<{
    id: string;
    transactionNumber: string;
    transactionDate: string;
    title: string;
    totalAmount: string;
    paidAmount: string;
    outstandingAmount: string;
    dueDate: string | null;
    daysOverdue: number;
    paymentStatus: string;
  }>;
  payments: Array<{
    id: string;
    paymentNumber: string;
    paymentDate: string;
    method: string;
    amount: string;
    allocatedAmount: string;
    unallocatedAmount: string;
    status: string;
  }>;
  followUps: FollowUpItemDTO[];
  commitments: PaymentCommitmentItemDTO[];
  activities: CRMActivityItemDTO[];
  businessUsers: Array<{ id: string; displayName: string }>;
  documents?: EntityDocumentItem[];
}

export function Supplier360Workspace({
  data,
  ledgerEntries,
  payables,
  payments,
  followUps: initialFollowUps,
  commitments: initialCommitments,
  activities,
  businessUsers,
  documents = [],
}: Supplier360WorkspaceProps) {
  const { supplier, financialSummary } = data;
  const [activeTab, setActiveTab] = useState<SupplierTab>("overview");

  // CRM State
  const [pinnedNote, setPinnedNote] = useState(supplier.isPinnedNote || "");
  const [isEditingPinned, setIsEditingPinned] = useState(false);
  const [assignedUser, setAssignedUser] = useState(supplier.assignedUser?.id || "");
  const followUps = initialFollowUps;
  const commitments = initialCommitments;

  // Modals
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isCommitmentModalOpen, setIsCommitmentModalOpen] = useState(false);
  const [isCommModalOpen, setIsCommModalOpen] = useState(false);

  // Form states
  const [fuTitle, setFuTitle] = useState("");
  const [fuDueDate, setFuDueDate] = useState("");
  const [fuPriority, setFuPriority] = useState<FollowUpPriority>(FollowUpPriority.NORMAL);

  const [commAmount, setCommAmount] = useState("");
  const [commDate, setCommDate] = useState("");
  const [commNotes, setCommNotes] = useState("");

  const [commChannel, setCommChannel] = useState<CommunicationChannel>(CommunicationChannel.PHONE_CALL);
  const [commSummary, setCommSummary] = useState("");

  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const formatCurrency = (val: string | number) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? "₹0.00" : `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  // Handlers
  const handleSavePinnedNote = () => {
    startTransition(async () => {
      const res = await updateSupplierCRMAction({
        supplierId: supplier.id,
        isPinnedNote: pinnedNote,
      });
      if (res.success) {
        setIsEditingPinned(false);
        setActionMessage({ type: "success", text: "Important notice updated successfully." });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to update pinned note." });
      }
    });
  };

  const handleAssignUser = (userId: string) => {
    setAssignedUser(userId);
    startTransition(async () => {
      const res = await updateSupplierCRMAction({
        supplierId: supplier.id,
        assignedUserId: userId || null,
      });
      if (res.success) {
        setActionMessage({ type: "success", text: "Account manager assigned successfully." });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to assign staff." });
      }
    });
  };

  const handleCreateFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuTitle.trim() || !fuDueDate) return;

    startTransition(async () => {
      const res = await createFollowUpAction({
        type: FollowUpType.SUPPLIER,
        title: fuTitle,
        dueDate: fuDueDate,
        priority: fuPriority,
        supplierId: supplier.id,
        assignedUserId: assignedUser || undefined,
      });

      if (res.success) {
        setIsFollowUpModalOpen(false);
        setFuTitle("");
        setFuDueDate("");
        setActionMessage({ type: "success", text: "Follow-up scheduled in work queue." });
        window.location.reload();
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to schedule follow-up." });
      }
    });
  };

  const handleCreateCommitment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commAmount || !commDate) return;

    startTransition(async () => {
      const res = await createCommitmentAction({
        supplierId: supplier.id,
        plannedAmount: parseFloat(commAmount),
        commitmentDate: commDate,
        notes: commNotes,
      });

      if (res.success) {
        setIsCommitmentModalOpen(false);
        setCommAmount("");
        setCommDate("");
        setCommNotes("");
        setActionMessage({
          type: "success",
          text: "Payment commitment logged. Outstanding payables remain unchanged until posted.",
        });
        window.location.reload();
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to log payment commitment." });
      }
    });
  };

  const handleLogCommunication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commSummary.trim()) return;

    startTransition(async () => {
      const res = await logCommunicationAction({
        channel: commChannel,
        summary: commSummary,
        supplierId: supplier.id,
      });

      if (res.success) {
        setIsCommModalOpen(false);
        setCommSummary("");
        setActionMessage({ type: "success", text: "Communication history recorded." });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to record communication." });
      }
    });
  };

  const handleArchive = () => {
    if (!confirm(`Are you sure you want to archive supplier "${supplier.name}"? Historical ledger and payables will be preserved.`)) {
      return;
    }
    startTransition(async () => {
      const res = await archiveSupplierAction(supplier.id);
      if (res.success) {
        setActionMessage({ type: "success", text: "Supplier archived. Historical records preserved." });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to archive supplier." });
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast Alert */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            actionMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-xs hover:underline opacity-80">
            Dismiss
          </button>
        </div>
      )}

      {/* Pinned Operational Notice */}
      {(pinnedNote || isEditingPinned) && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Pin className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Important Operational Notice (Internal)
                </span>
                {isEditingPinned ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={pinnedNote}
                      onChange={(e) => setPinnedNote(e.target.value)}
                      placeholder="e.g. Confirm bill with accounts manager before releasing supplier payment..."
                      className="w-full text-sm bg-slate-900 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSavePinnedNote}
                        disabled={isPending}
                        className="px-3 py-1 bg-amber-500 text-slate-950 font-bold text-xs rounded hover:bg-amber-400"
                      >
                        Save Notice
                      </button>
                      <button
                        onClick={() => setIsEditingPinned(false)}
                        className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm mt-1 font-medium">{pinnedNote}</p>
                )}
              </div>
            </div>
            {!isEditingPinned && (
              <button
                onClick={() => setIsEditingPinned(true)}
                className="text-xs text-amber-400/80 hover:text-amber-300 underline shrink-0"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      )}

      {/* Supplier Header */}
      <div className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                #{supplier.supplierCode}
              </span>
              <span
                className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  supplier.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : supplier.status === "INACTIVE"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                {supplier.status}
              </span>
              {supplier.gstin && (
                <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  GSTIN: {supplier.gstin}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              {supplier.name}
              {supplier.companyName && (
                <span className="text-sm font-normal text-slate-400 flex items-center gap-1">
                  <Building className="w-4 h-4 text-slate-500" />
                  ({supplier.companyName})
                </span>
              )}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              {supplier.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {supplier.phone}
                </span>
              )}
              {supplier.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {supplier.email}
                </span>
              )}
              {supplier.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {supplier.city}, {supplier.state || supplier.country}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Partner since {new Date(supplier.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsFollowUpModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              Add Follow-Up
            </button>

            <button
              onClick={() => setIsCommitmentModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
            >
              <DollarSign className="w-4 h-4" />
              Plan Payment
            </button>

            <button
              onClick={() => setIsCommModalOpen(true)}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <History className="w-4 h-4" />
              Log Call / Note
            </button>

            <Link
              href={`/reports/supplier-statement?supplierId=${supplier.id}`}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              Statement
            </Link>

            <button
              onClick={handleArchive}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-all"
              title="Archive Supplier"
            >
              <Archive className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Staff Assignment & Tags row */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">Assigned Staff:</span>
              <select
                value={assignedUser}
                onChange={(e) => handleAssignUser(e.target.value)}
                disabled={isPending}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">Unassigned</option>
                {businessUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5 text-slate-500" />
              {supplier.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {supplier.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-medium"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-500 italic">No tags</span>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-400">
            Phase 5 Financial Truth • Real Double-Entry Accounting
          </div>
        </div>
      </div>

      {/* KPI Cards (Derived from Verified Phase 5 Accounting Engine) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Purchases
          </span>
          <div className="text-xl sm:text-2xl font-black text-white">
            {formatCurrency(financialSummary.totalPurchasesVolume)}
          </div>
          <span className="text-[10px] text-slate-500">
            {financialSummary.transactionCount} total records
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Paid Out
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400">
            {formatCurrency(financialSummary.moneyPaid)}
          </div>
          <span className="text-[10px] text-slate-500">Disbursed settlements</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Current Payables
          </span>
          <div
            className={`text-xl sm:text-2xl font-black ${
              parseFloat(financialSummary.currentPayables) > 0 ? "text-rose-400" : "text-slate-300"
            }`}
          >
            {formatCurrency(financialSummary.currentPayables)}
          </div>
          <span className="text-[10px] text-slate-500">Outstanding balance</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Overdue Payables
          </span>
          <div
            className={`text-xl sm:text-2xl font-black ${
              parseFloat(financialSummary.overduePayables) > 0 ? "text-rose-500" : "text-emerald-400"
            }`}
          >
            {formatCurrency(financialSummary.overduePayables)}
          </div>
          <span className="text-[10px] text-slate-500">
            {financialSummary.oldestDueDate
              ? `Oldest due: ${new Date(financialSummary.oldestDueDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                })}`
              : "No overdue bills"}
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-slate-800 gap-1">
        {(
          [
            { id: "overview", label: "Overview", icon: Users },
            { id: "financial", label: "Financial & Aging", icon: DollarSign },
            { id: "payables", label: `Payables (${payables.length})`, icon: TrendingDown },
            { id: "payments", label: `Payments (${payments.length})`, icon: CreditCard },
            { id: "ledger", label: "Running Ledger", icon: FileText },
            { id: "followups", label: `Follow-Ups (${followUps.length})`, icon: Clock },
            { id: "commitments", label: `Commitments (${commitments.length})`, icon: ShieldCheck },
            { id: "documents", label: `Documents (${documents.length})`, icon: FileText },
            { id: "notes", label: "Notes & Prefs", icon: Pin },
            { id: "activity", label: "Timeline", icon: Activity },
          ] as Array<{ id: SupplierTab; label: string; icon: React.ComponentType<{ className?: string }> }>
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${
                isActive
                  ? "text-purple-400 border-purple-500 bg-purple-500/5"
                  : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Summary Card */}
            <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-400" />
                Operational Status
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400">Open Follow-Ups</span>
                  <div className="text-lg font-bold text-white">
                    {followUps.filter((f) => f.status === "OPEN" || f.status === "IN_PROGRESS").length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400">Active Commitments</span>
                  <div className="text-lg font-bold text-white">
                    {commitments.filter((c) => c.status === "ACTIVE").length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400">Credit Limit</span>
                  <div className="text-lg font-bold text-white">
                    {formatCurrency(supplier.creditLimit)}
                  </div>
                </div>
              </div>

              {/* Next Scheduled Follow-Up */}
              {followUps.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400">Next Follow-Up Due:</span>
                  <div className="mt-1.5 flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs">
                    <div>
                      <span className="font-bold text-white">{followUps[0].title}</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Due: {new Date(followUps[0].dueDate).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        followUps[0].isOverdue
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-purple-500/20 text-purple-300"
                      }`}
                    >
                      {followUps[0].isOverdue ? "OVERDUE" : followUps[0].status}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Payables Preview */}
            <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Recent Invoices / Bills
                </h3>
                <button
                  onClick={() => setActiveTab("payables")}
                  className="text-xs text-purple-400 hover:underline flex items-center gap-1"
                >
                  View all ({payables.length}) <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {payables.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  No bills or payable transactions logged yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {payables.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-purple-400">
                            #{p.transactionNumber}
                          </span>
                          <span className="text-slate-300 font-medium truncate max-w-[200px]">
                            {p.title}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Date: {new Date(p.transactionDate).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-white">{formatCurrency(p.totalAmount)}</div>
                        <div className="text-[11px] text-rose-400">
                          Due: {formatCurrency(p.outstandingAmount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Contact & Business Details */}
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4 text-xs">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Supplier Contact Details
              </h3>
              <div className="space-y-3">
                <div>
                  <span className="text-slate-400 block text-[11px]">Primary Phone</span>
                  <span className="font-medium text-slate-200">{supplier.phone || "Not provided"}</span>
                </div>
                {supplier.alternatePhone && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Alternate Phone</span>
                    <span className="font-medium text-slate-200">{supplier.alternatePhone}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block text-[11px]">Email Address</span>
                  <span className="font-medium text-slate-200">{supplier.email || "Not provided"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Office Address</span>
                  <span className="font-medium text-slate-200">
                    {supplier.address
                      ? `${supplier.address}, ${supplier.city || ""}, ${supplier.state || ""} ${supplier.postalCode || ""}`
                      : "Not provided"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tax / GSTIN</span>
                  <span className="font-mono text-slate-200">{supplier.gstin || "Not registered"}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Communication Preferences
              </h3>
              <div>
                <span className="text-slate-400 block text-[11px]">Preferred Channel</span>
                <span className="font-medium text-slate-200">
                  {supplier.preferredContactMethod || "Phone Call"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Preferred Contact Time</span>
                <span className="font-medium text-slate-200">
                  {supplier.preferredContactTime || "Business Hours (10 AM - 6 PM)"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Language Preference</span>
                <span className="font-medium text-slate-200">
                  {supplier.languagePreference || "English / Tamil"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL & AGING */}
      {activeTab === "financial" && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Payables Aging Schedule (Phase 5 Verified)
              </h3>
              <span className="text-xs text-slate-400">Standard 5-Bucket Model</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Current (Not Due)", val: financialSummary.aging.current, color: "text-emerald-400" },
                { label: "1 - 30 Days", val: financialSummary.aging.days1_30, color: "text-amber-400" },
                { label: "31 - 60 Days", val: financialSummary.aging.days31_60, color: "text-orange-400" },
                { label: "61 - 90 Days", val: financialSummary.aging.days61_90, color: "text-rose-400" },
                { label: "90+ Days", val: financialSummary.aging.days90Plus, color: "text-rose-500 font-black" },
              ].map((b, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {b.label}
                  </span>
                  <div className={`text-base sm:text-lg font-bold ${b.color}`}>
                    {formatCurrency(b.val)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown summary */}
          <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Accounting Ledger Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Total Purchases Incurred</span>
                <span className="text-lg font-bold text-white">
                  {formatCurrency(financialSummary.totalPurchasesVolume)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Money Disbursed</span>
                <span className="text-lg font-bold text-emerald-400">
                  {formatCurrency(financialSummary.moneyPaid)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Unapplied Payments / Advances</span>
                <span className="text-lg font-bold text-blue-400">
                  {formatCurrency(financialSummary.unappliedPayments)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PAYABLES */}
      {activeTab === "payables" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Payables / Invoices ({payables.length})
            </h3>
            <span className="text-xs text-slate-400">Real Double-Entry Accounting Records</span>
          </div>

          {payables.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-[#0f172a] border border-slate-800 rounded-2xl">
              No bills or payables found for this supplier.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0f172a]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-semibold">Bill #</th>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Title</th>
                    <th className="p-3 font-semibold text-right">Total</th>
                    <th className="p-3 font-semibold text-right">Paid</th>
                    <th className="p-3 font-semibold text-right">Outstanding</th>
                    <th className="p-3 font-semibold">Due Date</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payables.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-purple-400">#{p.transactionNumber}</td>
                      <td className="p-3 text-slate-300">
                        {new Date(p.transactionDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="p-3 font-medium text-white max-w-[200px] truncate">{p.title}</td>
                      <td className="p-3 text-right text-slate-300">{formatCurrency(p.totalAmount)}</td>
                      <td className="p-3 text-right text-emerald-400">{formatCurrency(p.paidAmount)}</td>
                      <td className="p-3 text-right font-bold text-rose-400">
                        {formatCurrency(p.outstandingAmount)}
                      </td>
                      <td className="p-3">
                        {p.dueDate ? (
                          <div>
                            <span className="text-slate-300">
                              {new Date(p.dueDate).toLocaleDateString("en-IN")}
                            </span>
                            {p.daysOverdue > 0 && (
                              <span className="block text-[10px] text-rose-400 font-bold">
                                {p.daysOverdue}d overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            p.paymentStatus === "PAID"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : p.paymentStatus === "PARTIALLY_PAID"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {p.paymentStatus.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {parseFloat(p.outstandingAmount) > 0 && (
                          <Link
                            href={`/payables`}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold shadow"
                          >
                            Disburse
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PAYMENTS */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Disbursed Payments ({payments.length})
            </h3>
            <span className="text-xs text-slate-400">Phase 5 Accounting Engine</span>
          </div>

          {payments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-[#0f172a] border border-slate-800 rounded-2xl">
              No payments logged for this supplier yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0f172a]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-semibold">Payment #</th>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Method</th>
                    <th className="p-3 font-semibold text-right">Total Amount</th>
                    <th className="p-3 font-semibold text-right">Allocated</th>
                    <th className="p-3 font-semibold text-right">Unapplied / Advance</th>
                    <th className="p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payments.map((pmt) => (
                    <tr key={pmt.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-emerald-400">#{pmt.paymentNumber}</td>
                      <td className="p-3 text-slate-300">
                        {new Date(pmt.paymentDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="p-3 text-slate-300 font-medium">{pmt.method}</td>
                      <td className="p-3 text-right font-bold text-white">{formatCurrency(pmt.amount)}</td>
                      <td className="p-3 text-right text-emerald-400">
                        {formatCurrency(pmt.allocatedAmount)}
                      </td>
                      <td className="p-3 text-right text-blue-400">
                        {formatCurrency(pmt.unallocatedAmount)}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {pmt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RUNNING LEDGER */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Supplier Running Account Ledger
              </h3>
              <p className="text-xs text-slate-400">Reused directly from Phase 5 LedgerService</p>
            </div>
            <Link
              href={`/reports/supplier-statement?supplierId=${supplier.id}`}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
            >
              Print / Export Statement
            </Link>
          </div>

          {ledgerEntries.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-[#0f172a] border border-slate-800 rounded-2xl">
              No ledger entries recorded for this supplier.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0f172a]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Ref #</th>
                    <th className="p-3 font-semibold">Description</th>
                    <th className="p-3 font-semibold text-right">Debit (₹)</th>
                    <th className="p-3 font-semibold text-right">Credit (₹)</th>
                    <th className="p-3 font-semibold text-right">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ledgerEntries.map((e, idx) => {
                    return (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-3 text-slate-300">
                          {new Date(e.date).toLocaleDateString("en-IN")}
                        </td>
                        <td className="p-3 text-purple-400 font-bold">{e.referenceNumber || e.entityNumber || "—"}</td>
                        <td className="p-3 text-white max-w-[260px] truncate">{e.description}</td>
                        <td className="p-3 text-right text-emerald-400">
                          {e.debit.isZero() ? "—" : e.debit.format()}
                        </td>
                        <td className="p-3 text-right text-rose-400">
                          {e.credit.isZero() ? "—" : e.credit.format()}
                        </td>
                        <td className="p-3 text-right font-bold text-white">
                          {e.runningBalance.format()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: FOLLOW-UPS */}
      {activeTab === "followups" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Operational Follow-Ups ({followUps.length})
              </h3>
              <p className="text-xs text-slate-400">
                Track payment discussions, bill verifications, and reminders
              </p>
            </div>
            <button
              onClick={() => setIsFollowUpModalOpen(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              Add Follow-Up
            </button>
          </div>

          {followUps.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-[#0f172a] border border-slate-800 rounded-2xl">
              No follow-ups recorded yet. Schedule one to track payment milestones.
            </div>
          ) : (
            <div className="space-y-3">
              {followUps.map((f) => (
                <div
                  key={f.id}
                  className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          f.isOverdue
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : f.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        }`}
                      >
                        {f.isOverdue ? "OVERDUE" : f.status}
                      </span>
                      <span className="text-xs font-bold text-white">{f.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Due: {new Date(f.dueDate).toLocaleDateString("en-IN")}</span>
                      <span>•</span>
                      <span>Priority: {f.priority}</span>
                      {f.assignedUser && (
                        <>
                          <span>•</span>
                          <span>Assigned: {f.assignedUser.displayName}</span>
                        </>
                      )}
                    </div>
                    {f.outcome && (
                      <p className="text-xs text-slate-300 mt-1">
                        Outcome: <span className="font-semibold text-purple-300">{f.outcome}</span>{" "}
                        {f.outcomeNotes && `— ${f.outcomeNotes}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: COMMITMENTS (Requirement 45) */}
      {activeTab === "commitments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Payment Commitments ({commitments.length})
              </h3>
              <p className="text-xs text-slate-400">
                Operational commitments we planned to pay. Note: commitments do NOT alter accounting balances.
              </p>
            </div>
            <button
              onClick={() => setIsCommitmentModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              Plan Payment
            </button>
          </div>

          {commitments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-[#0f172a] border border-slate-800 rounded-2xl">
              No planned payment commitments logged yet.
            </div>
          ) : (
            <div className="space-y-3">
              {commitments.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-indigo-400">
                        {formatCurrency(c.plannedAmount)}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          c.status === "FULFILLED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : c.status === "OVERDUE"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Committed Date: {new Date(c.commitmentDate).toLocaleDateString("en-IN")}</span>
                      {c.notes && (
                        <>
                          <span>•</span>
                          <span>{c.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: NOTES & PREFERENCES */}
      {activeTab === "notes" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Pin className="w-4 h-4 text-purple-400" />
              Pinned Operational Notice
            </h3>
            <p className="text-xs text-slate-400">
              Visible on the top of this supplier profile for all staff. Useful for account warnings or billing instructions.
            </p>
            <textarea
              value={pinnedNote}
              onChange={(e) => setPinnedNote(e.target.value)}
              placeholder="e.g. Always check ticket numbers before disbursing payment..."
              className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              rows={4}
            />
            <button
              onClick={handleSavePinnedNote}
              disabled={isPending}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
            >
              Save Notice
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Supplier Contact & Billing Preferences
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Primary Contact Method</span>
                <span className="text-white font-medium">
                  {supplier.preferredContactMethod || "Phone Call"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Best Time to Call</span>
                <span className="text-white font-medium">
                  {supplier.preferredContactTime || "Business Hours (10:00 AM - 6:00 PM)"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Preferred Communication Language</span>
                <span className="text-white font-medium">
                  {supplier.languagePreference || "Tamil & English"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Opening Balance</span>
                <span className="text-white font-medium">
                  {formatCurrency(supplier.openingBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DOCUMENTS */}
      {activeTab === "documents" && (
        <EntityDocumentsTab
          entityType="SUPPLIER"
          entityId={supplier.id}
          entityName={supplier.name}
          documents={documents}
        />
      )}

      {/* TAB 9: ACTIVITY TIMELINE */}
      {activeTab === "activity" && (
        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Chronological Activity & Communication Timeline
            </h3>
            <span className="text-xs text-slate-400">Unified audit log</span>
          </div>

          {activities.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
              No recorded activity for this supplier yet.
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {activities.map((act) => (
                <div key={act.id} className="relative space-y-1">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-slate-900" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{act.title}</span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(act.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {act.description && (
                    <p className="text-xs text-slate-400">{act.description}</p>
                  )}
                  <span className="text-[10px] text-slate-500 block">By: {act.author || "System"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD FOLLOW-UP */}
      {isFollowUpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Schedule Supplier Follow-Up</h3>
            <form onSubmit={handleCreateFollowUp} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Subject / Objective</label>
                <input
                  type="text"
                  required
                  value={fuTitle}
                  onChange={(e) => setFuTitle(e.target.value)}
                  placeholder="e.g. Verify airline credit note, follow up bill..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={fuDueDate}
                    onChange={(e) => setFuDueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Priority</label>
                  <select
                    value={fuPriority}
                    onChange={(e) => setFuPriority(e.target.value as FollowUpPriority)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value={FollowUpPriority.LOW}>LOW</option>
                    <option value={FollowUpPriority.NORMAL}>NORMAL</option>
                    <option value={FollowUpPriority.HIGH}>HIGH</option>
                    <option value={FollowUpPriority.URGENT}>URGENT</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD PAYMENT COMMITMENT */}
      {isCommitmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Log Payment Commitment</h3>
            <p className="text-[11px] text-slate-400">
              Record a planned disbursement to this supplier.
              <span className="block text-amber-400 font-semibold mt-1">
                Note: This does NOT modify accounting balances until an actual payment is posted.
              </span>
            </p>
            <form onSubmit={handleCreateCommitment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Committed Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={commAmount}
                  onChange={(e) => setCommAmount(e.target.value)}
                  placeholder="e.g. 25000"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Planned Payment Date</label>
                <input
                  type="date"
                  required
                  value={commDate}
                  onChange={(e) => setCommDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Internal Notes</label>
                <textarea
                  value={commNotes}
                  onChange={(e) => setCommNotes(e.target.value)}
                  placeholder="e.g. Agreed to disburse post client settlement..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCommitmentModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                >
                  Log Commitment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LOG COMMUNICATION */}
      {isCommModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Log Supplier Communication</h3>
            <form onSubmit={handleLogCommunication} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Channel</label>
                <select
                  value={commChannel}
                  onChange={(e) => setCommChannel(e.target.value as CommunicationChannel)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value={CommunicationChannel.PHONE_CALL}>Phone Call</option>
                  <option value={CommunicationChannel.EMAIL}>Email</option>
                  <option value={CommunicationChannel.WHATSAPP}>WhatsApp Note</option>
                  <option value={CommunicationChannel.MEETING}>In-Person Meeting</option>
                  <option value={CommunicationChannel.OTHER}>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Summary / Discussion Details</label>
                <textarea
                  required
                  value={commSummary}
                  onChange={(e) => setCommSummary(e.target.value)}
                  placeholder="Summary of the call, discount discussed, or invoice clarification..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCommModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
