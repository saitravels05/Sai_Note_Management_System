"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  PlusCircle,
  Phone,
  Mail,
  Calendar,
  Clock,
  AlertCircle,
  UserCheck,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { CustomerListItemDTO } from "@/types/crm";
import { createCustomerAction, createFollowUpAction, createPromiseAction } from "@/server/actions/crm.actions";
import { FollowUpType, FollowUpPriority } from "@prisma/client";

type CustomerSortBy = "name" | "highestOutstanding" | "nextFollowUp" | "recentlyAdded";

interface CustomerListWorkspaceProps {
  initialCustomers: CustomerListItemDTO[];
  totalCount: number;
  businessUsers: Array<{ id: string; displayName: string }>;
}

export function CustomerListWorkspace({
  initialCustomers,
  totalCount,
  businessUsers,
}: CustomerListWorkspaceProps) {
  const [customers, setCustomers] = useState<CustomerListItemDTO[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"ALL" | "HAS_OUTSTANDING" | "NO_OUTSTANDING" | "OVERDUE">("ALL");
  const [sortBy, setSortBy] = useState<CustomerSortBy>("highestOutstanding");

  // Modals state
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isPromiseModalOpen, setIsPromiseModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");

  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // New customer form state
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAssignedUser, setNewAssignedUser] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newTags, setNewTags] = useState("");

  // Follow-up form state
  const [fuTitle, setFuTitle] = useState("");
  const [fuDueDate, setFuDueDate] = useState("");
  const [fuPriority, setFuPriority] = useState<FollowUpPriority>(FollowUpPriority.NORMAL);

  // Promise form state
  const [promAmount, setPromAmount] = useState("");
  const [promDate, setPromDate] = useState("");
  const [promNotes, setPromNotes] = useState("");

  // Filter & sort in memory for rapid responsive interaction
  const filteredCustomers = customers
    .filter((c) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (balanceFilter === "HAS_OUTSTANDING") return c.paymentStatus !== "NO_BALANCE";
      if (balanceFilter === "NO_OUTSTANDING") return c.paymentStatus === "NO_BALANCE";
      if (balanceFilter === "OVERDUE") return c.paymentStatus === "OVERDUE";

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "nextFollowUp") {
        if (!a.nextFollowUpDate && !b.nextFollowUpDate) return 0;
        if (!a.nextFollowUpDate) return 1;
        if (!b.nextFollowUpDate) return -1;
        return new Date(a.nextFollowUpDate).getTime() - new Date(b.nextFollowUpDate).getTime();
      }
      if (sortBy === "recentlyAdded") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // default highestOutstanding
      const numA = parseFloat(a.currentReceivable.replace(/[^0-9.-]+/g, "")) || 0;
      const numB = parseFloat(b.currentReceivable.replace(/[^0-9.-]+/g, "")) || 0;
      return numB - numA;
    });

  const handleCreateCustomer = () => {
    if (!newName.trim()) {
      setErrorMsg("Customer name is required.");
      return;
    }
    setErrorMsg(null);
    setDuplicateWarning(null);

    const tagsArray = newTags
      ? newTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    startTransition(async () => {
      const res = await createCustomerAction({
        name: newName.trim(),
        companyName: newCompany.trim() || undefined,
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        notes: newNotes.trim() || undefined,
        assignedUserId: newAssignedUser || undefined,
        tags: tagsArray,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to create customer.");
        return;
      }

      if (res.duplicateWarnings && res.duplicateWarnings.length > 0) {
        setDuplicateWarning(
          `Notice: Potential duplicate matched: ${res.duplicateWarnings[0].name} (${res.duplicateWarnings[0].matchReason})`
        );
      }

      // Add to list optimistically
      const newDTO: CustomerListItemDTO = {
        id: res.customerId!,
        customerCode: "CUS-NEW",
        name: newName.trim(),
        companyName: newCompany.trim() || null,
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
        status: "ACTIVE",
        currentReceivable: "₹0.00",
        overdueReceivable: "₹0.00",
        paymentStatus: "NO_BALANCE",
        nextFollowUpDate: null,
        nextFollowUpTitle: null,
        assignedUser: businessUsers.find((u) => u.id === newAssignedUser) || null,
        tags: tagsArray,
        isPinnedNote: null,
        createdAt: new Date().toISOString(),
      };

      setCustomers((prev) => [newDTO, ...prev]);
      setIsNewCustomerOpen(false);
      setNewName("");
      setNewCompany("");
      setNewPhone("");
      setNewEmail("");
      setNewNotes("");
      setNewTags("");
    });
  };

  const handleOpenFollowUp = (customer: CustomerListItemDTO) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(customer.name);
    setFuTitle(`Follow-up: Payment / Booking discussion with ${customer.name}`);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFuDueDate(tomorrow.toISOString().split("T")[0]);
    setIsFollowUpModalOpen(true);
  };

  const handleSaveFollowUp = () => {
    if (!selectedCustomerId || !fuTitle.trim() || !fuDueDate) {
      setErrorMsg("Please fill in title and due date.");
      return;
    }

    startTransition(async () => {
      const res = await createFollowUpAction({
        type: FollowUpType.CUSTOMER,
        title: fuTitle.trim(),
        dueDate: fuDueDate,
        priority: fuPriority,
        customerId: selectedCustomerId,
        assignedUserId: undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to save follow-up.");
        return;
      }

      // Update customer next follow-up in list
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === selectedCustomerId
            ? { ...c, nextFollowUpDate: fuDueDate, nextFollowUpTitle: fuTitle.trim() }
            : c
        )
      );

      setIsFollowUpModalOpen(false);
    });
  };

  const handleOpenPromise = (customer: CustomerListItemDTO) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(customer.name);
    setPromAmount(customer.currentReceivable.replace(/[^0-9.-]+/g, "") || "");
    const inAWeek = new Date();
    inAWeek.setDate(inAWeek.getDate() + 7);
    setPromDate(inAWeek.toISOString().split("T")[0]);
    setIsPromiseModalOpen(true);
  };

  const handleSavePromise = () => {
    if (!selectedCustomerId || !promAmount || !promDate) {
      setErrorMsg("Please enter promised amount and date.");
      return;
    }

    startTransition(async () => {
      const res = await createPromiseAction({
        customerId: selectedCustomerId,
        promisedAmount: promAmount,
        promiseDate: promDate,
        notes: promNotes.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to record promise.");
        return;
      }

      setIsPromiseModalOpen(false);
      setPromAmount("");
      setPromNotes("");
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
              <Users className="w-3 h-3" />
              Customer Accounts & CRM
            </span>
            <span className="text-xs text-slate-500 font-mono">• {totalCount} Total Accounts</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Customer CRM Directory</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational 360° profiles, real-time verified receivables, follow-up queues, and promises-to-pay.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/follow-ups"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Follow-Up Work Queue</span>
          </Link>
          <button
            onClick={() => setIsNewCustomerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/15 transition-all cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ New Customer</span>
          </button>
        </div>
      </div>

      {duplicateWarning && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            {duplicateWarning}
          </span>
          <button onClick={() => setDuplicateWarning(null)} className="text-amber-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800/80 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer, code, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
            />
          </div>

          {/* Balance Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {(
              [
                { label: "All Customers", val: "ALL" },
                { label: "Has Outstanding", val: "HAS_OUTSTANDING" },
                { label: "Overdue Only", val: "OVERDUE" },
                { label: "Settled / No Balance", val: "NO_OUTSTANDING" },
              ] as const
            ).map((chip) => (
              <button
                key={chip.val}
                onClick={() => setBalanceFilter(chip.val)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  balanceFilter === chip.val
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                    : "bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as CustomerSortBy)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700"
            >
              <option value="highestOutstanding">Highest Outstanding</option>
              <option value="nextFollowUp">Next Follow-Up</option>
              <option value="name">Customer Name</option>
              <option value="recentlyAdded">Recently Added</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer List */}
      {filteredCustomers.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-2xl border border-slate-800/80 space-y-3">
          <Users className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No matching customer accounts found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search criteria or register a new customer profile.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredCustomers.map((cust) => (
            <div
              key={cust.id}
              className="glass-card p-4 rounded-2xl border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left Identity & Contact */}
              <div className="space-y-1.5 max-w-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    {cust.customerCode}
                  </span>
                  <Link
                    href={`/customers/${cust.id}`}
                    className="text-sm font-bold text-white hover:text-orange-400 transition-colors"
                  >
                    {cust.name}
                  </Link>
                  {cust.companyName && (
                    <span className="text-xs text-slate-400 font-medium">({cust.companyName})</span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                  {cust.phone && (
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-cyan-400" />
                      {cust.phone}
                    </span>
                  )}
                  {cust.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-500" />
                      {cust.email}
                    </span>
                  )}
                  {cust.assignedUser && (
                    <span className="flex items-center gap-1 text-[11px] bg-slate-900 px-2 py-0.5 rounded text-slate-300 border border-slate-800">
                      <UserCheck className="w-3 h-3 text-orange-400" />
                      {cust.assignedUser.displayName}
                    </span>
                  )}
                </div>

                {cust.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {cust.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Middle Financial Truth (Phase 5 derived) */}
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Outstanding
                  </span>
                  <span
                    className={`font-mono text-sm font-bold ${
                      cust.paymentStatus === "OVERDUE"
                        ? "text-rose-400"
                        : cust.paymentStatus === "UNPAID"
                        ? "text-amber-400"
                        : "text-slate-400"
                    }`}
                  >
                    {cust.currentReceivable}
                  </span>
                  {cust.paymentStatus === "OVERDUE" && (
                    <span className="text-[10px] text-rose-400 block font-semibold">Overdue</span>
                  )}
                </div>

                {/* Follow-Up Status */}
                <div className="min-w-[140px]">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Next Follow-Up
                  </span>
                  {cust.nextFollowUpDate ? (
                    <span className="text-xs text-cyan-300 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-cyan-400" />
                      {new Date(cust.nextFollowUpDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600 italic">None Scheduled</span>
                  )}
                </div>
              </div>

              {/* Right Quick Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleOpenFollowUp(cust)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>Follow Up</span>
                </button>

                <button
                  onClick={() => handleOpenPromise(cust)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/30 transition-all cursor-pointer flex items-center gap-1"
                >
                  <DollarSign className="w-3 h-3 text-amber-400" />
                  <span>Promise</span>
                </button>

                <Link
                  href={`/customers/${cust.id}`}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 hover:text-white transition-all flex items-center gap-1"
                >
                  <span>360° Profile</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: New Customer */}
      {isNewCustomerOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-orange-400" />
                New Customer Profile
              </h3>
              <button
                onClick={() => setIsNewCustomerOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Full Customer Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mohamed Ibrahim"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Company / Agency Name</label>
                <input
                  type="text"
                  placeholder="e.g. Al-Ameen Travels"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9840012345"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Assigned Staff</label>
                <select
                  value={newAssignedUser}
                  onChange={(e) => setNewAssignedUser(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50"
                >
                  <option value="">-- Unassigned --</option>
                  {businessUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. VIP, Corporate, Umrah"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsNewCustomerOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomer}
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 cursor-pointer shadow-md"
              >
                {isPending ? "Creating..." : "Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Follow-Up */}
      {isFollowUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                Schedule Follow-Up ({selectedCustomerName})
              </h3>
              <button onClick={() => setIsFollowUpModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Subject / Objective *</label>
                <input
                  type="text"
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
              <button onClick={() => setIsFollowUpModalOpen(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleSaveFollowUp}
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 text-white hover:bg-cyan-500 cursor-pointer shadow-md"
              >
                {isPending ? "Scheduling..." : "Save Follow-Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Promise */}
      {isPromiseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-400" />
                Record Promise-to-Pay ({selectedCustomerName})
              </h3>
              <button onClick={() => setIsPromiseModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
              A promise is an operational commitment. It does NOT reduce the customer&apos;s accounting receivable until a verified payment is posted.
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
                <label className="text-xs font-semibold text-slate-300 block mb-1">Promised Payment Date *</label>
                <input
                  type="date"
                  value={promDate}
                  onChange={(e) => setPromDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes / Call Summary</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Customer promised NEFT transfer on Friday"
                  value={promNotes}
                  onChange={(e) => setPromNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIsPromiseModalOpen(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleSavePromise}
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-500 cursor-pointer shadow-md"
              >
                {isPending ? "Recording..." : "Save Promise"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
