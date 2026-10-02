"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  Phone,
  Mail,
  MapPin,
  Clock,
  DollarSign,
  Pin,
  FileText,
  ShieldCheck,
  CreditCard,
  History,
  Activity,
  UserCheck,
} from "lucide-react";
import {
  CustomerProfile360DTO,
  FollowUpItemDTO,
  PromiseToPayItemDTO,
  CRMActivityItemDTO,
} from "@/types/crm";
import { LedgerEntry } from "@/server/services/ledger.service";
import {
  updateCustomerCRMAction,
  createFollowUpAction,
  createPromiseAction,
  logCommunicationAction,
} from "@/server/actions/crm.actions";
import { FollowUpType, FollowUpPriority, CommunicationChannel } from "@prisma/client";

import { EntityDocumentsTab, EntityDocumentItem } from "@/components/documents/EntityDocumentsTab";

interface Customer360WorkspaceProps {
  data: CustomerProfile360DTO;
  ledgerEntries: LedgerEntry[];
  receivables: Array<{
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
  promises: PromiseToPayItemDTO[];
  activities: CRMActivityItemDTO[];
  businessUsers: Array<{ id: string; displayName: string }>;
  documents?: EntityDocumentItem[];
}

type CustomerTab =
  | "overview"
  | "financial"
  | "receivables"
  | "payments"
  | "ledger"
  | "followups"
  | "promises"
  | "documents"
  | "notes"
  | "activity";

export function Customer360Workspace({
  data,
  ledgerEntries,
  receivables,
  payments,
  followUps: initialFollowUps,
  promises: initialPromises,
  activities,
  businessUsers,
  documents = [],
}: Customer360WorkspaceProps) {
  const { customer, financialSummary, historicalSnapshot } = data;
  const [activeTab, setActiveTab] = useState<CustomerTab>("overview");

  // CRM State
  const [pinnedNote, setPinnedNote] = useState(customer.isPinnedNote || "");
  const [isEditingPinned, setIsEditingPinned] = useState(false);
  const [assignedUser, setAssignedUser] = useState(customer.assignedUser?.id || "");
  const followUps = initialFollowUps;
  const promises = initialPromises;

  // Modals
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isPromiseModalOpen, setIsPromiseModalOpen] = useState(false);
  const [isCommModalOpen, setIsCommModalOpen] = useState(false);

  // Form states
  const [fuTitle, setFuTitle] = useState("");
  const [fuDueDate, setFuDueDate] = useState("");
  const [fuPriority, setFuPriority] = useState<FollowUpPriority>(FollowUpPriority.NORMAL);

  const [promAmount, setPromAmount] = useState("");
  const [promDate, setPromDate] = useState("");
  const [promNotes, setPromNotes] = useState("");

  const [commChannel, setCommChannel] = useState<CommunicationChannel>(CommunicationChannel.PHONE_CALL);
  const [commSummary, setCommSummary] = useState("");

  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleSavePinnedNote = () => {
    startTransition(async () => {
      const res = await updateCustomerCRMAction({
        customerId: customer.id,
        isPinnedNote: pinnedNote.trim() || null,
      });
      if (res.success) {
        setIsEditingPinned(false);
        setMessage("Pinned note updated.");
      }
    });
  };

  const handleUpdateAssignedUser = (userId: string) => {
    setAssignedUser(userId);
    startTransition(async () => {
      await updateCustomerCRMAction({
        customerId: customer.id,
        assignedUserId: userId || null,
      });
      setMessage("Staff assignment updated.");
    });
  };

  const handleCreateFollowUp = () => {
    if (!fuTitle.trim() || !fuDueDate) return;
    startTransition(async () => {
      const res = await createFollowUpAction({
        type: FollowUpType.CUSTOMER,
        title: fuTitle.trim(),
        dueDate: fuDueDate,
        priority: fuPriority,
        customerId: customer.id,
        assignedUserId: assignedUser || undefined,
      });
      if (res.success) {
        setIsFollowUpModalOpen(false);
        setFuTitle("");
        setMessage("Follow-up scheduled.");
      }
    });
  };

  const handleCreatePromise = () => {
    if (!promAmount || !promDate) return;
    startTransition(async () => {
      const res = await createPromiseAction({
        customerId: customer.id,
        promisedAmount: promAmount,
        promiseDate: promDate,
        notes: promNotes.trim() || undefined,
      });
      if (res.success) {
        setIsPromiseModalOpen(false);
        setPromAmount("");
        setPromNotes("");
        setMessage("Promise-to-pay recorded.");
      }
    });
  };

  const handleLogCommunication = () => {
    if (!commSummary.trim()) return;
    startTransition(async () => {
      const res = await logCommunicationAction({
        customerId: customer.id,
        channel: commChannel,
        summary: commSummary.trim(),
      });
      if (res.success) {
        setIsCommModalOpen(false);
        setCommSummary("");
        setMessage("Communication logged.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 360 Header */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {customer.customerCode}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                  customer.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                }`}
              >
                {customer.status}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Customer since {new Date(customer.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {customer.name}
              {customer.companyName && (
                <span className="text-sm font-normal text-slate-400">({customer.companyName})</span>
              )}
            </h1>
            <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap pt-0.5">
              {customer.phone && (
                <span className="flex items-center gap-1 font-mono text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-cyan-400" />
                  {customer.phone}
                </span>
              )}
              {customer.email && (
                <span className="flex items-center gap-1 text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {customer.email}
                </span>
              )}
              {customer.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {customer.city}, {customer.state || "Tamil Nadu"}
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => setIsFollowUpModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>+ Follow-Up</span>
            </button>

            <button
              onClick={() => setIsPromiseModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>+ Promise</span>
            </button>

            <button
              onClick={() => setIsCommModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1"
            >
              <Phone className="w-3.5 h-3.5 text-blue-400" />
              <span>Log Call</span>
            </button>

            <Link
              href={`/reports/generate?customerId=${customer.id}&reportType=CUSTOMER_STATEMENT`}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" />
              <span>Statement</span>
            </Link>

            <Link
              href={`/quick-entry?customerId=${customer.id}&type=PAYMENT`}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/15 transition-all flex items-center gap-1"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </Link>
          </div>
        </div>

        {/* Pinned Note Banner */}
        {(customer.isPinnedNote || isEditingPinned) && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 text-xs text-amber-300">
            <div className="flex items-start gap-2 flex-1">
              <Pin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              {isEditingPinned ? (
                <div className="w-full space-y-2">
                  <textarea
                    rows={2}
                    value={pinnedNote}
                    onChange={(e) => setPinnedNote(e.target.value)}
                    placeholder="Important operational note (e.g. Call travel coordinator before booking tickets)"
                    className="w-full p-2 rounded-lg bg-slate-950/80 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsEditingPinned(false)} className="text-slate-400 hover:text-white">Cancel</button>
                    <button onClick={handleSavePinnedNote} className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg">Save</button>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="font-semibold block text-[11px] text-amber-400">PINNED OPERATIONAL NOTE:</span>
                  <span>{customer.isPinnedNote}</span>
                </div>
              )}
            </div>
            {!isEditingPinned && (
              <button
                onClick={() => setIsEditingPinned(true)}
                className="text-[11px] text-amber-400 hover:underline shrink-0"
              >
                Edit
              </button>
            )}
          </div>
        )}

        {message && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Current Outstanding
            </span>
            <span className="text-lg font-bold font-mono text-rose-400 mt-0.5 block">
              {financialSummary.currentReceivables}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Overdue Receivables
            </span>
            <span className="text-lg font-bold font-mono text-amber-400 mt-0.5 block">
              {financialSummary.overdueReceivables}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Business Done
            </span>
            <span className="text-lg font-bold font-mono text-cyan-400 mt-0.5 block">
              {financialSummary.totalBusinessVolume}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Money Received
            </span>
            <span className="text-lg font-bold font-mono text-emerald-400 mt-0.5 block">
              {financialSummary.moneyReceived}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto pb-1 text-xs">
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "financial", label: "Financial & Aging" },
            { id: "receivables", label: `Invoices (${receivables.length})` },
            { id: "payments", label: `Payments (${payments.length})` },
            { id: "ledger", label: "Running Ledger" },
            { id: "followups", label: `Follow-Ups (${followUps.length})` },
            { id: "promises", label: `Promises (${promises.length})` },
            { id: "documents", label: `Documents (${documents.length})` },
            { id: "activity", label: "Timeline" },
          ] as Array<{ id: CustomerTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 font-semibold transition-all whitespace-nowrap border-b-2 cursor-pointer ${
              activeTab === tab.id
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-cyan-400" />
              Contact & Business Profile
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Account Code</span>
                <span className="text-white font-mono">{customer.customerCode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">GSTIN</span>
                <span className="text-white font-mono">{customer.gstin || "Unregistered"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Phone</span>
                <span className="text-white font-mono">{customer.phone || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Email</span>
                <span className="text-white">{customer.email || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Billing Address</span>
                <span className="text-white text-right max-w-xs">{customer.address || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Credit Limit</span>
                <span className="text-white font-mono">{customer.creditLimit}</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-orange-400" />
              CRM Preferences & Assignment
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Assigned Account Manager / Staff</label>
                <select
                  value={assignedUser}
                  onChange={(e) => handleUpdateAssignedUser(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500/50"
                >
                  <option value="">-- Unassigned --</option>
                  {businessUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Preferred Contact Method</span>
                <span className="text-white capitalize">{customer.preferredContactMethod || "Phone"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Preferred Contact Time</span>
                <span className="text-white">{customer.preferredContactTime || "Business Hours (10 AM - 6 PM)"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Language Preference</span>
                <span className="text-white">{customer.languagePreference === "ta" ? "Tamil (தமிழ்)" : "English"}</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Tags</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {customer.tags.length > 0 ? (
                    customer.tags.map((t, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-900 text-cyan-300 font-mono text-[11px] border border-slate-800">
                        #{t}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-600 italic">No tags assigned</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Financial & Aging */}
      {activeTab === "financial" && (
        <div className="space-y-6">
          {/* As-Closed Historical Snapshot Comparison (Requirements 11, 110) */}
          {historicalSnapshot && (
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <History className="w-4 h-4" />
                  Historical Snapshot Comparison ({historicalSnapshot.periodLabel})
                </span>
                <span className="text-slate-400 font-mono">Closed on {new Date(historicalSnapshot.closedAt).toLocaleDateString("en-IN")}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-slate-400 block text-[11px]">As Closed:</span>
                  <span className="font-bold text-white font-mono">{historicalSnapshot.asClosedOutstanding}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Current Live:</span>
                  <span className="font-bold text-white font-mono">{historicalSnapshot.currentOutstanding}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Subsequent Settlements:</span>
                  <span className="font-bold text-emerald-400 font-mono">{historicalSnapshot.variance}</span>
                </div>
              </div>
            </div>
          )}

          {/* Aging Schedule (Phase 5 verified formula) */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-orange-400" />
              Verified Accounts Receivable Aging Schedule
            </h3>
            <p className="text-xs text-slate-400">
              Categorized deterministically by invoice due dates without arbitrary adjustments.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Current / Not Due</span>
                <span className="text-base font-bold font-mono text-emerald-400 mt-1 block">{financialSummary.aging.current}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">1 - 30 Days</span>
                <span className="text-base font-bold font-mono text-cyan-400 mt-1 block">{financialSummary.aging.days1_30}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">31 - 60 Days</span>
                <span className="text-base font-bold font-mono text-amber-400 mt-1 block">{financialSummary.aging.days31_60}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">61 - 90 Days</span>
                <span className="text-base font-bold font-mono text-orange-400 mt-1 block">{financialSummary.aging.days61_90}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">90+ Days (Severe)</span>
                <span className="text-base font-bold font-mono text-rose-400 mt-1 block">{financialSummary.aging.days90Plus}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Receivables */}
      {activeTab === "receivables" && (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Customer Invoices & Receivables</h3>
            <span className="text-xs text-slate-400 font-mono">Total {receivables.length} Transactions</span>
          </div>

          {receivables.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No receivable records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-semibold">Invoice #</th>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Title / Trip</th>
                    <th className="p-3 font-semibold text-right">Total</th>
                    <th className="p-3 font-semibold text-right">Paid</th>
                    <th className="p-3 font-semibold text-right">Outstanding</th>
                    <th className="p-3 font-semibold">Due Date</th>
                    <th className="p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {receivables.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/50">
                      <td className="p-3 font-mono font-medium text-white">{r.transactionNumber}</td>
                      <td className="p-3 font-mono">{new Date(r.transactionDate).toLocaleDateString("en-IN")}</td>
                      <td className="p-3 text-white max-w-xs truncate">{r.title}</td>
                      <td className="p-3 text-right font-mono">{r.totalAmount}</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{r.paidAmount}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-400">{r.outstandingAmount}</td>
                      <td className="p-3 font-mono">
                        {r.dueDate ? new Date(r.dueDate).toLocaleDateString("en-IN") : "—"}
                        {r.daysOverdue > 0 && (
                          <span className="text-[10px] text-rose-400 block font-semibold">
                            {r.daysOverdue}d overdue
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                          {r.paymentStatus}
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

      {/* Tab: Payments */}
      {activeTab === "payments" && (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Payment Collections & Receipts</h3>
            <span className="text-xs text-slate-400 font-mono">Total {payments.length} Payments</span>
          </div>

          {payments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No payment receipts recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-semibold">Payment #</th>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Method</th>
                    <th className="p-3 font-semibold text-right">Received Amount</th>
                    <th className="p-3 font-semibold text-right">Allocated</th>
                    <th className="p-3 font-semibold text-right">Unapplied Credit</th>
                    <th className="p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/50">
                      <td className="p-3 font-mono font-medium text-white">{p.paymentNumber}</td>
                      <td className="p-3 font-mono">{new Date(p.paymentDate).toLocaleDateString("en-IN")}</td>
                      <td className="p-3 capitalize">{p.method}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">{p.amount}</td>
                      <td className="p-3 text-right font-mono">{p.allocatedAmount}</td>
                      <td className="p-3 text-right font-mono text-cyan-400">{p.unallocatedAmount}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {p.status}
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

      {/* Tab: Running Ledger (Reused from Phase 5 LedgerService) */}
      {activeTab === "ledger" && (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Verified Phase 5 Double-Entry Customer Ledger
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Debit (+) represents invoices; Credit (-) represents payment receipts.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-rose-400">
              Outstanding: {financialSummary.currentReceivables}
            </span>
          </div>

          {ledgerEntries.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No ledger transactions posted.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Reference</th>
                    <th className="p-3 font-semibold">Description</th>
                    <th className="p-3 font-semibold text-right">Debit (₹)</th>
                    <th className="p-3 font-semibold text-right">Credit (₹)</th>
                    <th className="p-3 font-semibold text-right">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ledgerEntries.map((e) => {
                    return (
                      <tr key={e.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-mono">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                        <td className="p-3 font-mono font-medium text-white">{e.entityNumber}</td>
                        <td className="p-3 text-white max-w-sm truncate">{e.description}</td>
                        <td className="p-3 text-right font-mono text-amber-300">
                          {e.debit.isZero() ? "—" : e.debit.format()}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-400">
                          {e.credit.isZero() ? "—" : e.credit.format()}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-white">
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

      {/* Tab: Follow-Ups */}
      {activeTab === "followups" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Scheduled Follow-Ups & Work Queue</h3>
            <button
              onClick={() => setIsFollowUpModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 text-white hover:bg-cyan-500 cursor-pointer"
            >
              + Schedule Follow-Up
            </button>
          </div>

          {followUps.length === 0 ? (
            <div className="glass-card p-8 text-center rounded-2xl border border-slate-800 text-xs text-slate-500">
              No follow-ups scheduled for this customer.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {followUps.map((f) => (
                <div
                  key={f.id}
                  className="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          f.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : f.isOverdue
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                        }`}
                      >
                        {f.status} {f.isOverdue && "(OVERDUE)"}
                      </span>
                      <span className="font-semibold text-white text-xs">{f.title}</span>
                    </div>
                    {f.description && <p className="text-xs text-slate-400">{f.description}</p>}
                    {f.outcomeNotes && (
                      <p className="text-xs text-cyan-300 italic">Outcome: {f.outcomeNotes}</p>
                    )}
                  </div>

                  <div className="text-right text-xs font-mono shrink-0">
                    <span className="text-slate-400 block">Due Date:</span>
                    <span className="text-white font-bold">
                      {new Date(f.dueDate).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Promises-to-Pay */}
      {activeTab === "promises" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white">Promise-to-Pay Commitments</h3>
              <p className="text-xs text-slate-400">
                Operational promises do not reduce accounting receivable balances.
              </p>
            </div>
            <button
              onClick={() => setIsPromiseModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-500 cursor-pointer"
            >
              + Record Promise
            </button>
          </div>

          {promises.length === 0 ? (
            <div className="glass-card p-8 text-center rounded-2xl border border-slate-800 text-xs text-slate-500">
              No promises recorded for this customer.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {promises.map((p) => (
                <div
                  key={p.id}
                  className="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          p.status === "FULFILLED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : p.isOverdue
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {p.status} {p.isOverdue && "(OVERDUE)"}
                      </span>
                      <span className="font-bold text-white text-xs font-mono">
                        Promised: {p.promisedAmount}
                      </span>
                    </div>
                    {p.notes && <p className="text-xs text-slate-400">{p.notes}</p>}
                  </div>

                  <div className="text-right text-xs font-mono shrink-0">
                    <span className="text-slate-400 block">Promise Date:</span>
                    <span className="text-amber-400 font-bold">
                      {new Date(p.promiseDate).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Documents */}
      {activeTab === "documents" && (
        <EntityDocumentsTab
          entityType="CUSTOMER"
          entityId={customer.id}
          entityName={customer.name}
          documents={documents}
        />
      )}

      {/* Tab: Activity Timeline */}
      {activeTab === "activity" && (
        <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-orange-400" />
            Complete Chronological Activity Timeline
          </h3>

          {activities.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No recorded activity yet.</div>
          ) : (
            <div className="space-y-3 relative border-l-2 border-slate-800 ml-3 pl-4">
              {activities.map((a) => (
                <div key={a.id} className="relative space-y-0.5">
                  <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-orange-400" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(a.date).toLocaleDateString("en-IN")} {new Date(a.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {a.badge && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${a.badgeColor || "bg-slate-800 text-slate-300"}`}>
                        {a.badge}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-semibold text-white">{a.title}</h4>
                  <p className="text-xs text-slate-400">{a.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Follow-Up */}
      {isFollowUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                Schedule Customer Follow-Up
              </h3>
              <button onClick={() => setIsFollowUpModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Title / Objective *</label>
                <input
                  type="text"
                  placeholder="e.g. Call for October ticket payment"
                  value={fuTitle}
                  onChange={(e) => setFuTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Due Date *</label>
                  <input
                    type="date"
                    value={fuDueDate}
                    onChange={(e) => setFuDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Priority</label>
                  <select
                    value={fuPriority}
                    onChange={(e) => setFuPriority(e.target.value as FollowUpPriority)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIsFollowUpModalOpen(false)} className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white">Cancel</button>
              <button
                onClick={handleCreateFollowUp}
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 text-white hover:bg-cyan-500 cursor-pointer shadow-md"
              >
                Save Follow-Up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Promise */}
      {isPromiseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-400" />
                Record Promise-to-Pay
              </h3>
              <button onClick={() => setIsPromiseModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Promised Amount (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 20000"
                  value={promAmount}
                  onChange={(e) => setPromAmount(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Promise Date *</label>
                <input
                  type="date"
                  value={promDate}
                  onChange={(e) => setPromDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={promNotes}
                  onChange={(e) => setPromNotes(e.target.value)}
                  placeholder="Summary of discussion with client"
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIsPromiseModalOpen(false)} className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white">Cancel</button>
              <button
                onClick={handleCreatePromise}
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-500 cursor-pointer shadow-md"
              >
                Save Promise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Log Communication */}
      {isCommModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-blue-400" />
                Log Customer Interaction
              </h3>
              <button onClick={() => setIsCommModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Communication Channel</label>
                <select
                  value={commChannel}
                  onChange={(e) => setCommChannel(e.target.value as CommunicationChannel)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500/50"
                >
                  <option value="PHONE_CALL">Phone Call</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="MEETING">In-Person Meeting</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Summary / Discussion Points *</label>
                <textarea
                  rows={3}
                  value={commSummary}
                  onChange={(e) => setCommSummary(e.target.value)}
                  placeholder="e.g. Spoke with customer regarding Dubai tour payment schedule..."
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500/50 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIsCommModalOpen(false)} className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white">Cancel</button>
              <button
                onClick={handleLogCommunication}
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 cursor-pointer shadow-md"
              >
                Log Interaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
