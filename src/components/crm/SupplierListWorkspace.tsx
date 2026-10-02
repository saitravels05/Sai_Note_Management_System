"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  PlusCircle,
  Phone,
  Mail,
  Calendar,
  Clock,
  AlertCircle,
  UserCheck,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { SupplierListItemDTO } from "@/types/crm";
import { createSupplierAction, createFollowUpAction, createCommitmentAction } from "@/server/actions/crm.actions";
import { FollowUpType, FollowUpPriority } from "@prisma/client";

type SupplierSortBy = "name" | "highestOutstanding" | "nextFollowUp" | "recentlyAdded";

interface SupplierListWorkspaceProps {
  initialSuppliers: SupplierListItemDTO[];
  totalCount: number;
  businessUsers: Array<{ id: string; displayName: string }>;
}

export function SupplierListWorkspace({
  initialSuppliers,
  totalCount,
  businessUsers,
}: SupplierListWorkspaceProps) {
  const [suppliers, setSuppliers] = useState<SupplierListItemDTO[]>(initialSuppliers);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"ALL" | "HAS_OUTSTANDING" | "NO_OUTSTANDING" | "OVERDUE">("ALL");
  const [sortBy, setSortBy] = useState<SupplierSortBy>("highestOutstanding");

  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isCommitmentModalOpen, setIsCommitmentModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>("");

  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // New supplier form
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAssignedUser, setNewAssignedUser] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newTags, setNewTags] = useState("");

  // Follow-up form
  const [fuTitle, setFuTitle] = useState("");
  const [fuDueDate, setFuDueDate] = useState("");
  const [fuPriority, setFuPriority] = useState<FollowUpPriority>(FollowUpPriority.NORMAL);

  // Commitment form
  const [commitAmount, setCommitAmount] = useState("");
  const [commitDate, setCommitDate] = useState("");
  const [commitNotes, setCommitNotes] = useState("");

  const filteredSuppliers = suppliers
    .filter((s) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.supplierCode.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (balanceFilter === "HAS_OUTSTANDING") return s.dueStatus !== "NO_BALANCE";
      if (balanceFilter === "NO_OUTSTANDING") return s.dueStatus === "NO_BALANCE";
      if (balanceFilter === "OVERDUE") return s.dueStatus === "OVERDUE";

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
      const numA = parseFloat(a.currentPayable.replace(/[^0-9.-]+/g, "")) || 0;
      const numB = parseFloat(b.currentPayable.replace(/[^0-9.-]+/g, "")) || 0;
      return numB - numA;
    });

  const handleCreateSupplier = () => {
    if (!newName.trim()) {
      setErrorMsg("Supplier name is required.");
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
      const res = await createSupplierAction({
        name: newName.trim(),
        companyName: newCompany.trim() || undefined,
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        notes: newNotes.trim() || undefined,
        assignedUserId: newAssignedUser || undefined,
        tags: tagsArray,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to create supplier.");
        return;
      }

      if (res.duplicateWarnings && res.duplicateWarnings.length > 0) {
        setDuplicateWarning(
          `Notice: Potential duplicate matched: ${res.duplicateWarnings[0].name} (${res.duplicateWarnings[0].matchReason})`
        );
      }

      const newDTO: SupplierListItemDTO = {
        id: res.supplierId!,
        supplierCode: "SUP-NEW",
        name: newName.trim(),
        companyName: newCompany.trim() || null,
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
        status: "ACTIVE",
        currentPayable: "₹0.00",
        overduePayable: "₹0.00",
        dueStatus: "NO_BALANCE",
        nextFollowUpDate: null,
        nextFollowUpTitle: null,
        assignedUser: businessUsers.find((u) => u.id === newAssignedUser) || null,
        tags: tagsArray,
        isPinnedNote: null,
        createdAt: new Date().toISOString(),
      };

      setSuppliers((prev) => [newDTO, ...prev]);
      setIsNewSupplierOpen(false);
      setNewName("");
      setNewCompany("");
      setNewPhone("");
      setNewEmail("");
      setNewNotes("");
      setNewTags("");
    });
  };

  const handleOpenFollowUp = (supplier: SupplierListItemDTO) => {
    setSelectedSupplierId(supplier.id);
    setSelectedSupplierName(supplier.name);
    setFuTitle(`Follow-up: Vendor payment plan for ${supplier.name}`);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFuDueDate(tomorrow.toISOString().split("T")[0]);
    setIsFollowUpModalOpen(true);
  };

  const handleSaveFollowUp = () => {
    if (!selectedSupplierId || !fuTitle.trim() || !fuDueDate) {
      setErrorMsg("Please fill in title and due date.");
      return;
    }

    startTransition(async () => {
      const res = await createFollowUpAction({
        type: FollowUpType.SUPPLIER,
        title: fuTitle.trim(),
        dueDate: fuDueDate,
        priority: fuPriority,
        supplierId: selectedSupplierId,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to save follow-up.");
        return;
      }

      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === selectedSupplierId
            ? { ...s, nextFollowUpDate: fuDueDate, nextFollowUpTitle: fuTitle.trim() }
            : s
        )
      );

      setIsFollowUpModalOpen(false);
    });
  };

  const handleOpenCommitment = (supplier: SupplierListItemDTO) => {
    setSelectedSupplierId(supplier.id);
    setSelectedSupplierName(supplier.name);
    setCommitAmount(supplier.currentPayable.replace(/[^0-9.-]+/g, "") || "");
    const inAWeek = new Date();
    inAWeek.setDate(inAWeek.getDate() + 7);
    setCommitDate(inAWeek.toISOString().split("T")[0]);
    setIsCommitmentModalOpen(true);
  };

  const handleSaveCommitment = () => {
    if (!selectedSupplierId || !commitAmount || !commitDate) {
      setErrorMsg("Please enter planned amount and date.");
      return;
    }

    startTransition(async () => {
      const res = await createCommitmentAction({
        supplierId: selectedSupplierId,
        plannedAmount: commitAmount,
        commitmentDate: commitDate,
        notes: commitNotes.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to record commitment.");
        return;
      }

      setIsCommitmentModalOpen(false);
      setCommitAmount("");
      setCommitNotes("");
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              Suppliers & Vendors
            </span>
            <span className="text-xs text-slate-500 font-mono">• {totalCount} Total Vendors</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Supplier CRM & Payables Directory</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Airlines, hotel wholesalers, and transport partners with live payables and payment commitments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/payables"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Accounts Payable</span>
          </Link>
          <button
            onClick={() => setIsNewSupplierOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-orange-500 to-amber-600 text-white hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/15 transition-all cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ New Supplier</span>
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

      {/* Search & Filter */}
      <div className="glass-card p-4 rounded-2xl border border-slate-800/80 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search suppliers, code, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {(
              [
                { label: "All Suppliers", val: "ALL" },
                { label: "Has Balance Due", val: "HAS_OUTSTANDING" },
                { label: "Overdue Only", val: "OVERDUE" },
                { label: "Settled / Paid", val: "NO_OUTSTANDING" },
              ] as const
            ).map((chip) => (
              <button
                key={chip.val}
                onClick={() => setBalanceFilter(chip.val)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  balanceFilter === chip.val
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SupplierSortBy)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700"
            >
              <option value="highestOutstanding">Highest Payable</option>
              <option value="nextFollowUp">Next Follow-Up</option>
              <option value="name">Supplier Name</option>
              <option value="recentlyAdded">Recently Added</option>
            </select>
          </div>
        </div>
      </div>

      {/* Supplier List */}
      {filteredSuppliers.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-2xl border border-slate-800/80 space-y-3">
          <Building2 className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No matching supplier accounts found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search filters or register a new vendor profile.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredSuppliers.map((sup) => (
            <div
              key={sup.id}
              className="glass-card p-4 rounded-2xl border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    {sup.supplierCode}
                  </span>
                  <Link
                    href={`/suppliers/${sup.id}`}
                    className="text-sm font-bold text-white hover:text-amber-400 transition-colors"
                  >
                    {sup.name}
                  </Link>
                  {sup.companyName && (
                    <span className="text-xs text-slate-400 font-medium">({sup.companyName})</span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                  {sup.phone && (
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-amber-400" />
                      {sup.phone}
                    </span>
                  )}
                  {sup.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-500" />
                      {sup.email}
                    </span>
                  )}
                  {sup.assignedUser && (
                    <span className="flex items-center gap-1 text-[11px] bg-slate-900 px-2 py-0.5 rounded text-slate-300 border border-slate-800">
                      <UserCheck className="w-3 h-3 text-cyan-400" />
                      {sup.assignedUser.displayName}
                    </span>
                  )}
                </div>

                {sup.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {sup.tags.map((t, idx) => (
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

              {/* Financial Truth */}
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Outstanding Payable
                  </span>
                  <span
                    className={`font-mono text-sm font-bold ${
                      sup.dueStatus === "OVERDUE"
                        ? "text-rose-400"
                        : sup.dueStatus === "UNPAID"
                        ? "text-amber-400"
                        : "text-slate-400"
                    }`}
                  >
                    {sup.currentPayable}
                  </span>
                  {sup.dueStatus === "OVERDUE" && (
                    <span className="text-[10px] text-rose-400 block font-semibold">Overdue</span>
                  )}
                </div>

                <div className="min-w-[140px]">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Next Follow-Up
                  </span>
                  {sup.nextFollowUpDate ? (
                    <span className="text-xs text-amber-300 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      {new Date(sup.nextFollowUpDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600 italic">None Scheduled</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleOpenFollowUp(sup)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>Follow Up</span>
                </button>

                <button
                  onClick={() => handleOpenCommitment(sup)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/30 transition-all cursor-pointer flex items-center gap-1"
                >
                  <DollarSign className="w-3 h-3 text-amber-400" />
                  <span>Commitment</span>
                </button>

                <Link
                  href={`/suppliers/${sup.id}`}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:text-white transition-all flex items-center gap-1"
                >
                  <span>360° Profile</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: New Supplier */}
      {isNewSupplierOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-amber-400" />
                New Supplier / Vendor Profile
              </h3>
              <button onClick={() => setIsNewSupplierOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Supplier / Vendor Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Air India Express or Hotel Grand"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Agency / Company</label>
                <input
                  type="text"
                  placeholder="e.g. Air India Express Ltd."
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 044-2345678"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="accounts@vendor.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Assigned Staff</label>
                <select
                  value={newAssignedUser}
                  onChange={(e) => setNewAssignedUser(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">-- Unassigned --</option>
                  {businessUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIsNewSupplierOpen(false)} className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleCreateSupplier}
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer shadow-md"
              >
                {isPending ? "Creating..." : "Save Supplier"}
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
                Schedule Follow-Up ({selectedSupplierName})
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

      {/* Modal: Add Commitment */}
      {isCommitmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-purple-400" />
                Record Payment Commitment ({selectedSupplierName})
              </h3>
              <button onClick={() => setIsCommitmentModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300">
              A payment commitment records your planned payment to this vendor. It does NOT reduce your accounts payable liability until an actual payment is posted.
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Planned Amount (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={commitAmount}
                  onChange={(e) => setCommitAmount(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Planned Payment Date *</label>
                <input
                  type="date"
                  value={commitDate}
                  onChange={(e) => setCommitDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Planned weekly settlement via NEFT"
                  value={commitNotes}
                  onChange={(e) => setCommitNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500/50 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIsCommitmentModalOpen(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleSaveCommitment}
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-500 cursor-pointer shadow-md"
              >
                {isPending ? "Recording..." : "Save Commitment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
