"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Users,
  Truck,
  Search,
  PlusCircle,
  ChevronRight,
  UserCheck,
  AlertCircle,
  ArrowDownLeft,
  XCircle,
} from "lucide-react";
import {
  FollowUpItemDTO,
  FollowUpSummaryMetricsDTO,
} from "@/types/crm";
import {
  createFollowUpAction,
  completeFollowUpAction,
  cancelFollowUpAction,
} from "@/server/actions/crm.actions";
import {
  FollowUpType,
  FollowUpPriority,
  FollowUpStatus,
  FollowUpOutcome,
} from "@prisma/client";

type FollowUpTab = "all" | "my" | "today" | "overdue" | "upcoming" | "completed";

interface FollowUpWorkspaceProps {
  initialFollowUps: FollowUpItemDTO[];
  summary: FollowUpSummaryMetricsDTO;
  businessUsers: Array<{ id: string; displayName: string }>;
  currentUserId: string;
  customers: Array<{ id: string; name: string; customerCode: string }>;
  suppliers: Array<{ id: string; name: string; supplierCode: string }>;
}

export function FollowUpWorkspace({
  initialFollowUps,
  summary,
  businessUsers,
  currentUserId,
  customers,
  suppliers,
}: FollowUpWorkspaceProps) {
  const [followUps, setFollowUps] = useState<FollowUpItemDTO[]>(initialFollowUps);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FollowUpTab>("all");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Completion Modal State
  const [completingFollowUp, setCompletingFollowUp] = useState<FollowUpItemDTO | null>(null);
  const [outcome, setOutcome] = useState<FollowUpOutcome>(FollowUpOutcome.CUSTOMER_CONTACTED);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [scheduleNextDate, setScheduleNextDate] = useState("");
  const [scheduleNextTime, setScheduleNextTime] = useState("");

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<FollowUpType>(FollowUpType.CUSTOMER);
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [newPriority, setNewPriority] = useState<FollowUpPriority>(FollowUpPriority.NORMAL);
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newSupplierId, setNewSupplierId] = useState("");
  const [newAssignedUser, setNewAssignedUser] = useState(currentUserId);
  const [newDescription, setNewDescription] = useState("");

  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filtered Items
  const filtered = followUps.filter((f) => {
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        f.title.toLowerCase().includes(q) ||
        (f.customerName && f.customerName.toLowerCase().includes(q)) ||
        (f.supplierName && f.supplierName.toLowerCase().includes(q)) ||
        (f.description && f.description.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Type filter
    if (typeFilter !== "ALL" && f.type !== typeFilter) return false;

    // Priority filter
    if (priorityFilter !== "ALL" && f.priority !== priorityFilter) return false;

    // Tab filter
    if (activeTab === "my") {
      return f.assignedUser?.id === currentUserId;
    }
    if (activeTab === "today") {
      const todayStr = new Date().toISOString().split("T")[0];
      return f.dueDate.startsWith(todayStr) && f.status !== FollowUpStatus.COMPLETED;
    }
    if (activeTab === "overdue") {
      return f.isOverdue && f.status !== FollowUpStatus.COMPLETED;
    }
    if (activeTab === "upcoming") {
      const todayStr = new Date().toISOString().split("T")[0];
      return f.dueDate > todayStr && f.status !== FollowUpStatus.COMPLETED;
    }
    if (activeTab === "completed") {
      return f.status === FollowUpStatus.COMPLETED;
    }

    return true;
  });

  // Handlers
  const handleOpenComplete = (f: FollowUpItemDTO) => {
    setCompletingFollowUp(f);
    // default outcome based on type
    if (f.type === FollowUpType.SUPPLIER || f.type === FollowUpType.PAYABLE) {
      setOutcome(FollowUpOutcome.SUPPLIER_CONTACTED);
    } else {
      setOutcome(FollowUpOutcome.CUSTOMER_CONTACTED);
    }
    setOutcomeNotes("");
    setScheduleNextDate("");
    setScheduleNextTime("");
  };

  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingFollowUp) return;

    startTransition(async () => {
      const res = await completeFollowUpAction({
        followUpId: completingFollowUp.id,
        outcome,
        outcomeNotes,
        scheduleNextDate: scheduleNextDate || undefined,
        scheduleNextTime: scheduleNextTime || undefined,
      });

      if (res.success && res.followUp) {
        setFollowUps(
          followUps.map((item) => (item.id === res.followUp!.id ? res.followUp! : item))
        );
        setCompletingFollowUp(null);
        setActionMessage({
          type: "success",
          text: `Follow-up marked completed. Outcome: ${outcome}.`,
        });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to complete follow-up." });
      }
    });
  };

  const handleCancel = (f: FollowUpItemDTO) => {
    if (!confirm(`Cancel follow-up "${f.title}"?`)) return;

    startTransition(async () => {
      const res = await cancelFollowUpAction(f.id);
      if (res.success && res.followUp) {
        setFollowUps(
          followUps.map((item) => (item.id === res.followUp!.id ? res.followUp! : item))
        );
        setActionMessage({ type: "success", text: "Follow-up cancelled." });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to cancel follow-up." });
      }
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDueDate) return;

    startTransition(async () => {
      const res = await createFollowUpAction({
        type: newType,
        title: newTitle,
        description: newDescription,
        dueDate: newDueDate,
        dueTime: newDueTime || undefined,
        priority: newPriority,
        customerId: newCustomerId || undefined,
        supplierId: newSupplierId || undefined,
        assignedUserId: newAssignedUser || undefined,
      });

      if (res.success) {
        setIsCreateModalOpen(false);
        setNewTitle("");
        setNewDescription("");
        setNewDueDate("");
        setNewDueTime("");
        setNewCustomerId("");
        setNewSupplierId("");
        setActionMessage({ type: "success", text: "New follow-up added to the operational queue." });
        window.location.reload();
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to create follow-up." });
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Operational Work Queue
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400">Strict Separation from Accounting Ledgers</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            Follow-Up Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational pipeline for receivables collections, supplier payments, callbacks, and promises-to-pay.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-md shadow-amber-600/20 transition-all flex items-center gap-1.5 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          + New Follow-Up
        </button>
      </div>

      {/* Operational Dashboard KPI Cards (Requirement 31) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => setActiveTab("today")}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            activeTab === "today"
              ? "bg-amber-500/10 border-amber-500 text-amber-200"
              : "bg-[#0f172a] border-slate-800 hover:border-slate-700"
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Due Today
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
            {summary.dueToday}
          </div>
          <span className="text-[10px] text-slate-500">Requires contact</span>
        </div>

        <div
          onClick={() => setActiveTab("overdue")}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            activeTab === "overdue"
              ? "bg-rose-500/10 border-rose-500 text-rose-200"
              : "bg-[#0f172a] border-slate-800 hover:border-slate-700"
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Overdue
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-400 mt-1">
            {summary.overdue}
          </div>
          <span className="text-[10px] text-slate-500">Past target date</span>
        </div>

        <div
          onClick={() => setActiveTab("upcoming")}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            activeTab === "upcoming"
              ? "bg-blue-500/10 border-blue-500 text-blue-200"
              : "bg-[#0f172a] border-slate-800 hover:border-slate-700"
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            This Week
          </span>
          <div className="text-xl sm:text-2xl font-black text-blue-400 mt-1">
            {summary.upcomingThisWeek}
          </div>
          <span className="text-[10px] text-slate-500">Scheduled next</span>
        </div>

        <div
          onClick={() => setActiveTab("my")}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            activeTab === "my"
              ? "bg-purple-500/10 border-purple-500 text-purple-200"
              : "bg-[#0f172a] border-slate-800 hover:border-slate-700"
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            My Queue
          </span>
          <div className="text-xl sm:text-2xl font-black text-purple-400 mt-1">
            {summary.assignedToMeCount}
          </div>
          <span className="text-[10px] text-slate-500">Assigned to you</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0f172a] border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Promises Due
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
            {summary.promisesDueCount}
          </div>
          <span className="text-[10px] text-slate-500">
            {summary.promisesOverdueCount > 0 ? `${summary.promisesOverdueCount} broken/overdue` : "All on track"}
          </span>
        </div>

        <div
          onClick={() => setActiveTab("completed")}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            activeTab === "completed"
              ? "bg-emerald-500/10 border-emerald-500 text-emerald-200"
              : "bg-[#0f172a] border-slate-800 hover:border-slate-700"
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Done Today
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
            {summary.completedToday}
          </div>
          <span className="text-[10px] text-slate-500">Resolved tasks</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search follow-ups by subject, customer name, supplier, or note..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Types</option>
            <option value={FollowUpType.CUSTOMER}>Customer Follow-Up</option>
            <option value={FollowUpType.RECEIVABLE}>Receivable Collection</option>
            <option value={FollowUpType.SUPPLIER}>Supplier Follow-Up</option>
            <option value={FollowUpType.PAYABLE}>Payable Settlement</option>
            <option value={FollowUpType.RELATIONSHIP}>General Relationship</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Priorities</option>
            <option value={FollowUpPriority.URGENT}>URGENT</option>
            <option value={FollowUpPriority.HIGH}>HIGH</option>
            <option value={FollowUpPriority.NORMAL}>NORMAL</option>
            <option value={FollowUpPriority.LOW}>LOW</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-slate-800 gap-1 text-xs">
        {(
          [
            { id: "all", label: `All Queue (${followUps.length})` },
            { id: "my", label: `My Follow-Ups (${summary.assignedToMeCount})` },
            { id: "today", label: `Due Today (${summary.dueToday})` },
            { id: "overdue", label: `Overdue (${summary.overdue})` },
            { id: "upcoming", label: `Upcoming (${summary.upcomingThisWeek})` },
            { id: "completed", label: `Completed (${followUps.filter((f) => f.status === "COMPLETED").length})` },
          ] as Array<{ id: FollowUpTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "text-amber-400 border-amber-500 bg-amber-500/5"
                : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Follow-Up List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-[#0f172a] border border-slate-800 rounded-2xl">
          <Clock className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <h3 className="text-sm font-bold text-white">No Follow-Ups Found</h3>
          <p className="text-xs text-slate-400 mt-1">
            No operational follow-ups match your selected queue and filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isCompleted = item.status === FollowUpStatus.COMPLETED;
            const isCancelled = item.status === FollowUpStatus.CANCELLED;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  item.isOverdue && !isCompleted
                    ? "bg-rose-950/10 border-rose-500/30 hover:border-rose-500/50"
                    : isCompleted
                    ? "bg-slate-900/40 border-slate-800/60 opacity-80"
                    : "bg-[#0f172a] border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Left Info */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status badge */}
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        item.isOverdue && !isCompleted
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : isCompleted
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : isCancelled
                          ? "bg-slate-800 text-slate-400 border-slate-700"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {item.isOverdue && !isCompleted ? "OVERDUE" : item.status}
                    </span>

                    {/* Type badge */}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {item.type.replace(/_/g, " ")}
                    </span>

                    {/* Priority badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.priority === "URGENT"
                          ? "bg-rose-600/20 text-rose-300"
                          : item.priority === "HIGH"
                          ? "bg-orange-600/20 text-orange-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {item.title}
                  </h3>

                  {item.description && (
                    <p className="text-xs text-slate-400 line-clamp-1">{item.description}</p>
                  )}

                  {/* Related Party & Timestamps */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                    {item.customerName && (
                      <Link
                        href={`/customers/${item.customerId}`}
                        className="flex items-center gap-1 text-cyan-400 hover:underline font-medium"
                      >
                        <Users className="w-3.5 h-3.5 text-cyan-500" />
                        {item.customerName}
                      </Link>
                    )}

                    {item.supplierName && (
                      <Link
                        href={`/suppliers/${item.supplierId}`}
                        className="flex items-center gap-1 text-purple-400 hover:underline font-medium"
                      >
                        <Truck className="w-3.5 h-3.5 text-purple-500" />
                        {item.supplierName}
                      </Link>
                    )}

                    <span>•</span>

                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Due: {new Date(item.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      {item.dueTime && ` at ${item.dueTime}`}
                    </span>

                    {item.assignedUser && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-300">
                          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                          {item.assignedUser.displayName}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Outcome display if completed */}
                  {item.outcome && (
                    <div className="pt-2 text-xs text-slate-300">
                      <span className="text-slate-500">Outcome:</span>{" "}
                      <span className="font-bold text-emerald-400">{item.outcome.replace(/_/g, " ")}</span>
                      {item.outcomeNotes && <span className="text-slate-400"> — {item.outcomeNotes}</span>}
                    </div>
                  )}
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80 shrink-0">
                  {!isCompleted && !isCancelled && (
                    <>
                      <button
                        onClick={() => handleOpenComplete(item)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Complete
                      </button>

                      <button
                        onClick={() => handleCancel(item)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
                        title="Cancel Follow-Up"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {item.customerId && (
                    <Link
                      href={`/customers/${item.customerId}`}
                      className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
                      title="View Customer Profile"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}

                  {item.supplierId && (
                    <Link
                      href={`/suppliers/${item.supplierId}`}
                      className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
                      title="View Supplier Profile"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: COMPLETE FOLLOW-UP (With Requirement 36 Critical Payment Rule) */}
      {completingFollowUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Complete Follow-Up</h3>
            <p className="text-xs text-slate-400">
              Follow-Up: <span className="text-white font-medium">{completingFollowUp.title}</span>
            </p>

            {/* Requirement 36 CRITICAL PAYMENT RULE NOTICE */}
            {outcome === FollowUpOutcome.PAYMENT_RECEIVED && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  Critical Accounting Protection Rule
                </div>
                <p>
                  Marking a follow-up outcome as <strong>&quot;Payment Received&quot;</strong> is purely an operational notation.
                  It will <strong>NOT</strong> post a payment or alter customer receivable balances!
                </p>
                <div className="pt-1">
                  <Link
                    href={`/receivables`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    Open Phase 5 Record Payment Workflow
                  </Link>
                </div>
              </div>
            )}

            <form onSubmit={handleCompleteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Select Workflow Outcome</label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as FollowUpOutcome)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                >
                  <option value={FollowUpOutcome.CUSTOMER_CONTACTED}>Customer Contacted</option>
                  <option value={FollowUpOutcome.NO_ANSWER}>No Answer / Ringing</option>
                  <option value={FollowUpOutcome.REQUESTED_CALLBACK}>Requested Callback</option>
                  <option value={FollowUpOutcome.PAYMENT_PROMISED}>Payment Promised</option>
                  <option value={FollowUpOutcome.PAYMENT_RECEIVED}>Payment Received (Operational Note)</option>
                  <option value={FollowUpOutcome.DISPUTE_RAISED}>Dispute Raised / Query</option>
                  <option value={FollowUpOutcome.SUPPLIER_CONTACTED}>Supplier Contacted</option>
                  <option value={FollowUpOutcome.PAYMENT_SCHEDULED}>Payment Scheduled</option>
                  <option value={FollowUpOutcome.OTHER}>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Outcome Notes / Remarks</label>
                <textarea
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="Notes from the phone call or meeting..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                  rows={2}
                />
              </div>

              {/* Requirement 37: Schedule Next Follow-Up */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-300">
                  Optional: Schedule Next Follow-Up
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Next Date</label>
                    <input
                      type="date"
                      value={scheduleNextDate}
                      onChange={(e) => setScheduleNextDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Next Time (Optional)</label>
                    <input
                      type="time"
                      value={scheduleNextTime}
                      onChange={(e) => setScheduleNextTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletingFollowUp(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                >
                  Mark Completed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE NEW FOLLOW-UP */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Schedule New Operational Follow-Up</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Subject / Task Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Call for October ticket payment, follow up flight refund..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as FollowUpType)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value={FollowUpType.CUSTOMER}>Customer Follow-Up</option>
                    <option value={FollowUpType.RECEIVABLE}>Receivable Collection</option>
                    <option value={FollowUpType.SUPPLIER}>Supplier Follow-Up</option>
                    <option value={FollowUpType.PAYABLE}>Payable Settlement</option>
                    <option value={FollowUpType.RELATIONSHIP}>General Relationship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as FollowUpPriority)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value={FollowUpPriority.LOW}>LOW</option>
                    <option value={FollowUpPriority.NORMAL}>NORMAL</option>
                    <option value={FollowUpPriority.HIGH}>HIGH</option>
                    <option value={FollowUpPriority.URGENT}>URGENT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Due Time (Optional)</label>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              {/* Related Customer / Supplier */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Related Customer (Optional)</label>
                  <select
                    value={newCustomerId}
                    onChange={(e) => {
                      setNewCustomerId(e.target.value);
                      if (e.target.value) setNewSupplierId("");
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="">None</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (#{c.customerCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Related Supplier (Optional)</label>
                  <select
                    value={newSupplierId}
                    onChange={(e) => {
                      setNewSupplierId(e.target.value);
                      if (e.target.value) setNewCustomerId("");
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="">None</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (#{s.supplierCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Assign Staff</label>
                <select
                  value={newAssignedUser}
                  onChange={(e) => setNewAssignedUser(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="">Unassigned</option>
                  {businessUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Operational Description / Notes</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Additional context for staff executing this task..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl"
                >
                  Schedule Follow-Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
