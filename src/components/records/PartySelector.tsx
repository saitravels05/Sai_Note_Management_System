"use client";

import { useState, useEffect, useRef } from "react";
import {
  searchCustomersAction,
  searchSuppliersAction,
  quickCreateCustomerAction,
  quickCreateSupplierAction,
} from "@/server/actions/party.actions";
import {
  User,
  Building,
  Plus,
  Search,
  Check,
  X,
  Loader2,
} from "lucide-react";

interface PartyOption {
  id: string;
  name: string;
  companyName?: string | null;
  phone?: string | null;
  code?: string;
}

interface PartySelectorProps {
  partyType: "customer" | "supplier";
  selectedId?: string | null;
  onSelect: (party: PartyOption | null) => void;
  required?: boolean;
}

export function PartySelector({
  partyType,
  selectedId,
  onSelect,
  required = false,
}: PartySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<PartyOption[]>([]);
  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Quick Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCompany, setCreateCompany] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initial load of parties
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setIsSearching(true);

      const searchFn = partyType === "customer" ? searchCustomersAction : searchSuppliersAction;
      searchFn(searchQuery)
        .then((data) => {
          if (!active) return;
          const mapped: PartyOption[] = data.map((d: { id: string; name: string; companyName?: string | null; phone?: string | null; customerCode?: string; supplierCode?: string }) => ({
            id: d.id,
            name: d.name,
            companyName: d.companyName || null,
            phone: d.phone || null,
            code: d.customerCode || d.supplierCode,
          }));
          setResults(mapped);

          if (selectedId) {
            const match = mapped.find((p: PartyOption) => p.id === selectedId);
            if (match) setSelectedParty(match);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setIsSearching(false);
        });
    }, 50);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [partyType, searchQuery, selectedId]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (party: PartyOption | null) => {
    setSelectedParty(party);
    onSelect(party);
    setIsOpen(false);
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      setCreateError("Name is required");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    const formData = new FormData();
    formData.append("name", createName.trim());
    if (createCompany) formData.append("companyName", createCompany.trim());
    if (createPhone) formData.append("phone", createPhone.trim());
    if (createEmail) formData.append("email", createEmail.trim());

    try {
      const res =
        partyType === "customer"
          ? await quickCreateCustomerAction(null, formData)
          : await quickCreateSupplierAction(null, formData);

      if (res.success && res.partyId) {
        const newParty: PartyOption = {
          id: res.partyId,
          name: createName.trim(),
          companyName: createCompany.trim() || null,
          phone: createPhone.trim() || null,
        };
        handleSelect(newParty);
        setIsCreateModalOpen(false);
        setCreateName("");
        setCreateCompany("");
        setCreatePhone("");
        setCreateEmail("");
      } else {
        setCreateError(res.error || "Failed to create");
      }
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const label = partyType === "customer" ? "Customer" : "Supplier / Vendor";

  return (
    <div className="relative" ref={containerRef}>
      {/* Selected Chip or Trigger Button */}
      {selectedParty ? (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-700/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
              {partyType === "customer" ? <User className="w-4 h-4" /> : <Building className="w-4 h-4" />}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">{selectedParty.name}</div>
              <div className="text-[11px] text-slate-400 truncate">
                {selectedParty.companyName || selectedParty.phone || label}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-slate-400 hover:border-slate-600 focus:outline-none focus:border-orange-500 transition-all text-left"
        >
          <span className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500" />
            <span>Select or search {label}...</span>
          </span>
          <span className="text-[11px] font-semibold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
            + Quick Add
          </span>
        </button>
      )}

      {/* Hidden input for form submission */}
      <input
        type="hidden"
        name={partyType === "customer" ? "customerId" : "supplierId"}
        value={selectedParty?.id || ""}
        required={required && !selectedParty}
      />

      {/* Dropdown Search List */}
      {isOpen && !selectedParty && (
        <div className="absolute left-0 right-0 mt-1.5 z-40 rounded-xl bg-[#0e1422] border border-slate-800 shadow-2xl p-2 animate-in fade-in duration-100 max-h-72 overflow-y-auto">
          {/* Search Box */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder={`Search ${label} by name, phone...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 rounded-lg border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Quick Create Trigger */}
          <button
            type="button"
            onClick={() => {
              setCreateName(searchQuery);
              setIsCreateModalOpen(true);
              setIsOpen(false);
            }}
            className="w-full mb-1.5 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 font-semibold text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create new {label} {searchQuery ? `"${searchQuery}"` : ""}</span>
          </button>

          {/* Results */}
          <div className="space-y-0.5">
            {isSearching ? (
              <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Searching...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((party) => (
                <button
                  key={party.id}
                  type="button"
                  onClick={() => handleSelect(party)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/80 text-left transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                      {party.name}
                    </div>
                    {party.companyName && (
                      <div className="text-[11px] text-slate-400 truncate">{party.companyName}</div>
                    )}
                  </div>
                  {party.phone && (
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                      {party.phone}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="p-3 text-center text-xs text-slate-500">
                No matching {label.toLowerCase()} found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Plus className="w-4 h-4 text-orange-400" />
                <span>Add New {label}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
                {createError}
              </div>
            )}

            <form onSubmit={handleQuickCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Name <span className="text-orange-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Company / Organization (Optional)
                </label>
                <input
                  type="text"
                  value={createCompany}
                  onChange={(e) => setCreateCompany(e.target.value)}
                  placeholder="e.g. Sharma Holidays Pvt Ltd"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="ramesh@gmail.com"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-60"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save & Select</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
