"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Bookmark,
  Trash2,
  X,
  LayoutGrid,
  List,
  Clock,
  Table as TableIcon,
  FileText,
  RotateCcw,
} from "lucide-react";
import { TransactionType, PaymentStatus, TransactionStatus } from "@prisma/client";
import { RecordCard, type SerializedRecord } from "./RecordCard";
import { RecordListRow } from "./RecordListRow";
import { RecordTimeline } from "./RecordTimeline";
import { RecordTable } from "./RecordTable";
import { saveFilterAction, deleteFilterAction } from "@/server/actions/filter.actions";
import { QuickExportModal } from "@/components/exports/QuickExportModal";

export interface SavedFilterDefinition {
  type?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  categoryId?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  minAmount?: string | null;
  maxAmount?: string | null;
  search?: string | null;
}

interface SavedFilterItem {
  id: string;
  name: string;
  filterDefinition: SavedFilterDefinition;
}

interface RecordsWorkspaceProps {
  records: SerializedRecord[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  categories: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  savedFilters: SavedFilterItem[];
}

export function RecordsWorkspace({
  records,
  pagination,
  categories,
  customers,
  suppliers,
  savedFilters,
}: RecordsWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // View mode
  const [viewMode, setViewMode] = useState<"cards" | "list" | "timeline" | "table">("cards");

  // Filter drawer
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [savedFilterModalOpen, setSavedFilterModalOpen] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [saveFilterError, setSaveFilterError] = useState<string | null>(null);

  // Active query parameters
  const currentSearch = searchParams.get("search") || "";
  const currentType = searchParams.get("type") || "";
  const currentStatus = searchParams.get("status") || "";
  const currentPaymentStatus = searchParams.get("paymentStatus") || "";
  const currentCategoryId = searchParams.get("categoryId") || "";
  const currentCustomerId = searchParams.get("customerId") || "";
  const currentSupplierId = searchParams.get("supplierId") || "";
  const currentStartDate = searchParams.get("startDate") || "";
  const currentEndDate = searchParams.get("endDate") || "";
  const currentMinAmount = searchParams.get("minAmount") || "";
  const currentMaxAmount = searchParams.get("maxAmount") || "";
  const currentSort = searchParams.get("sortBy") || "newest";
  const currentPageSize = searchParams.get("pageSize") || "20";

  // Local draft state for drawer
  const [draftType, setDraftType] = useState(currentType);
  const [draftStatus, setDraftStatus] = useState(currentStatus);
  const [draftPaymentStatus, setDraftPaymentStatus] = useState(currentPaymentStatus);
  const [draftCategoryId, setDraftCategoryId] = useState(currentCategoryId);
  const [draftCustomerId, setDraftCustomerId] = useState(currentCustomerId);
  const [draftSupplierId, setDraftSupplierId] = useState(currentSupplierId);
  const [draftStartDate, setDraftStartDate] = useState(currentStartDate);
  const [draftEndDate, setDraftEndDate] = useState(currentEndDate);
  const [draftMinAmount, setDraftMinAmount] = useState(currentMinAmount);
  const [draftMaxAmount, setDraftMaxAmount] = useState(currentMaxAmount);
  const [localSearch, setLocalSearch] = useState(currentSearch);

  // Helper to push updated query parameters
  const updateQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === "" || val === undefined) {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });

    // Reset page to 1 whenever filters change unless explicitly paging
    if (!updates.page && params.get("page")) {
      params.set("page", "1");
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery({ search: localSearch.trim() });
  };

  // Drawer apply
  const handleApplyFilters = () => {
    updateQuery({
      type: draftType || null,
      status: draftStatus || null,
      paymentStatus: draftPaymentStatus || null,
      categoryId: draftCategoryId || null,
      customerId: draftCustomerId || null,
      supplierId: draftSupplierId || null,
      startDate: draftStartDate || null,
      endDate: draftEndDate || null,
      minAmount: draftMinAmount || null,
      maxAmount: draftMaxAmount || null,
    });
    setFilterDrawerOpen(false);
  };

  // Reset all filters
  const handleClearAllFilters = () => {
    setLocalSearch("");
    setDraftType("");
    setDraftStatus("");
    setDraftPaymentStatus("");
    setDraftCategoryId("");
    setDraftCustomerId("");
    setDraftSupplierId("");
    setDraftStartDate("");
    setDraftEndDate("");
    setDraftMinAmount("");
    setDraftMaxAmount("");

    startTransition(() => {
      router.push(pathname);
    });
  };

  // Save current filter definition
  const handleSaveFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filterName.trim()) return;

    setSaveFilterError(null);
    const filterDefinition = {
      type: currentType,
      status: currentStatus,
      paymentStatus: currentPaymentStatus,
      categoryId: currentCategoryId,
      customerId: currentCustomerId,
      supplierId: currentSupplierId,
      startDate: currentStartDate,
      endDate: currentEndDate,
      minAmount: currentMinAmount,
      maxAmount: currentMaxAmount,
      search: currentSearch,
    };

    const formData = new FormData();
    formData.append("name", filterName.trim());
    formData.append("module", "RECORDS");
    formData.append("filterDefinition", JSON.stringify(filterDefinition));

    const res = await saveFilterAction(null, formData);
    if (res.success) {
      setSavedFilterModalOpen(false);
      setFilterName("");
      router.refresh();
    } else {
      setSaveFilterError(res.error || "Failed to save filter");
    }
  };

  const handleApplySavedFilter = (filterDef: SavedFilterDefinition) => {
    updateQuery({
      type: filterDef.type || null,
      status: filterDef.status || null,
      paymentStatus: filterDef.paymentStatus || null,
      categoryId: filterDef.categoryId || null,
      customerId: filterDef.customerId || null,
      supplierId: filterDef.supplierId || null,
      startDate: filterDef.startDate || null,
      endDate: filterDef.endDate || null,
      minAmount: filterDef.minAmount || null,
      maxAmount: filterDef.maxAmount || null,
      search: filterDef.search || null,
    });
  };

  // Delete saved filter
  const handleDeleteSavedFilter = async (id: string) => {
    await deleteFilterAction(id);
    router.refresh();
  };

  // Count active filters
  const activeFilterCount = [
    currentSearch,
    currentType,
    currentStatus,
    currentPaymentStatus,
    currentCategoryId,
    currentCustomerId,
    currentSupplierId,
    currentStartDate,
    currentEndDate,
    currentMinAmount,
    currentMaxAmount,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Daily Ledger & Diary
            </span>
            <span className="text-xs text-slate-500">
              {pagination.totalCount} {pagination.totalCount === 1 ? "record" : "records"} found
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Business Records & Diary</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Card-based transactions, notes, vouchers, receivables, and payables.
          </p>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === "cards"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Card View (Default)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cards
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === "list"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Compact List View"
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === "timeline"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Chronological Timeline"
            >
              <Clock className="w-3.5 h-3.5" />
              Timeline
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === "table"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Ledger Table (Secondary View)"
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table
            </button>
          </div>

          {/* Quick Export Trigger */}
          <QuickExportModal
            buttonText="Export View"
            defaultExportType={
              currentType === "INCOME"
                ? "INCOME"
                : currentType === "EXPENSE"
                ? "EXPENSES"
                : currentType === "RECEIVABLE"
                ? "RECEIVABLES"
                : currentType === "PAYABLE"
                ? "PAYABLES"
                : "TRANSACTIONS"
            }
            filters={{
              transactionType: (currentType as TransactionType) || undefined,
              status: (currentStatus as TransactionStatus) || undefined,
              paymentStatus: (currentPaymentStatus as PaymentStatus) || undefined,
              categoryId: currentCategoryId || undefined,
              customerId: currentCustomerId || undefined,
              supplierId: currentSupplierId || undefined,
              startDate: currentStartDate ? new Date(currentStartDate) : undefined,
              endDate: currentEndDate ? new Date(currentEndDate) : undefined,
              minAmount: currentMinAmount || undefined,
              maxAmount: currentMaxAmount || undefined,
              search: localSearch || undefined,
            }}
            buttonClassName="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-all"
          />

          {/* Quick Entry Link */}
          <Link
            href="/quick-entry"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-orange-700 transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            + Add Record
          </Link>
        </div>
      </div>

      {/* Control Bar: Search + Filter Drawer Trigger + Sort */}
      <div className="p-3.5 rounded-xl glass-card border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search party, title, PNR, reference, tags, notes..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none transition-colors"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch("");
                updateQuery({ search: null });
              }}
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Filter Trigger, Saved Filters, and Sort */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Drawer Toggle */}
          <button
            onClick={() => setFilterDrawerOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
              activeFilterCount > 0
                ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Saved Filters Dropdown */}
          {savedFilters.length > 0 && (
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700"
              >
                <Bookmark className="w-3.5 h-3.5 text-orange-400" />
                <span>Saved ({savedFilters.length})</span>
              </button>
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-xl py-1 z-30 hidden group-hover:block hover:block">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                  Preset Filters
                </div>
                {savedFilters.map((sf) => (
                  <div
                    key={sf.id}
                    className="flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-800/80 transition-colors"
                  >
                    <button
                      onClick={() => handleApplySavedFilter(sf.filterDefinition)}
                      className="text-left flex-1 truncate font-medium text-slate-200 hover:text-orange-400"
                    >
                      {sf.name}
                    </button>
                    <button
                      onClick={() => handleDeleteSavedFilter(sf.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded"
                      title="Delete saved filter"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save Filter Button */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => setSavedFilterModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400 hover:text-orange-400"
              title="Save current filters"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={currentSort}
              onChange={(e) => updateQuery({ sortBy: e.target.value })}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer pr-1"
            >
              <option value="newest" className="bg-slate-900">Newest Date</option>
              <option value="oldest" className="bg-slate-900">Oldest Date</option>
              <option value="highest_amount" className="bg-slate-900">Highest Amount</option>
              <option value="lowest_amount" className="bg-slate-900">Lowest Amount</option>
              <option value="recently_updated" className="bg-slate-900">Recently Updated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[11px] text-slate-500 font-medium">Active:</span>

          {currentSearch && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-200 border border-slate-700">
              Query: &quot;{currentSearch}&quot;
              <button onClick={() => { setLocalSearch(""); updateQuery({ search: null }); }} className="text-slate-400 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {currentType && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Type: {currentType}
              <button onClick={() => updateQuery({ type: null })} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {currentStatus && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-300 border border-slate-700">
              Status: {currentStatus}
              <button onClick={() => updateQuery({ status: null })} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {currentPaymentStatus && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-300 border border-slate-700">
              Payment: {currentPaymentStatus}
              <button onClick={() => updateQuery({ paymentStatus: null })} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {currentCategoryId && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-300 border border-slate-700">
              Category: {categories.find((c) => c.id === currentCategoryId)?.name || "Selected"}
              <button onClick={() => updateQuery({ categoryId: null })} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {currentCustomerId && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-300 border border-slate-700">
              Customer: {customers.find((c) => c.id === currentCustomerId)?.name || "Selected"}
              <button onClick={() => updateQuery({ customerId: null })} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {currentSupplierId && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-300 border border-slate-700">
              Supplier: {suppliers.find((s) => s.id === currentSupplierId)?.name || "Selected"}
              <button onClick={() => updateQuery({ supplierId: null })} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {(currentStartDate || currentEndDate) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-300 border border-slate-700">
              Date: {currentStartDate || "start"} → {currentEndDate || "end"}
              <button onClick={() => updateQuery({ startDate: null, endDate: null })} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {(currentMinAmount || currentMaxAmount) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-300 border border-slate-700">
              Amount: ₹{currentMinAmount || "0"} - ₹{currentMaxAmount || "∞"}
              <button onClick={() => updateQuery({ minAmount: null, maxAmount: null })} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            onClick={handleClearAllFilters}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 underline ml-2"
          >
            <RotateCcw className="w-3 h-3" />
            Clear All
          </button>
        </div>
      )}

      {/* Main View Area */}
      {isPending && (
        <div className="py-2 text-center text-xs text-orange-400 animate-pulse">
          Refreshing records...
        </div>
      )}

      {records.length === 0 ? (
        <div className="p-12 rounded-2xl glass-card border border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {activeFilterCount > 0 ? "No Matching Records Found" : "No Records Recorded Yet"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              {activeFilterCount > 0
                ? "No entries match the currently selected search or filters. Try adjusting your query or resetting filters."
                : "Your workspace is ready. Click below to add an Income, Expense, Receivable, Payable, or General Note."}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            {activeFilterCount > 0 ? (
              <button
                onClick={handleClearAllFilters}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
              >
                Reset All Filters
              </button>
            ) : (
              <>
                <Link
                  href="/quick-entry"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-md shadow-orange-500/20"
                >
                  + Add First Record
                </Link>
                <Link
                  href="/imports"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                >
                  Import Excel / CSV
                </Link>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {viewMode === "cards" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {records.map((record) => (
                <RecordCard key={record.id} record={record} />
              ))}
            </div>
          )}

          {viewMode === "list" && (
            <div className="space-y-2">
              {records.map((record) => (
                <RecordListRow key={record.id} record={record} />
              ))}
            </div>
          )}

          {viewMode === "timeline" && <RecordTimeline records={records} />}

          {viewMode === "table" && <RecordTable records={records} />}
        </>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl glass-card border border-slate-800 text-xs">
          <div className="flex items-center gap-4 text-slate-400">
            <div>
              Showing Page <span className="font-semibold text-white">{pagination.currentPage}</span> of{" "}
              <span className="font-semibold text-white">{pagination.totalPages}</span> ({pagination.totalCount} total)
            </div>
            <div className="flex items-center gap-1.5 pl-4 border-l border-slate-800">
              <span>Per page:</span>
              <select
                value={currentPageSize}
                onChange={(e) => updateQuery({ pageSize: e.target.value, page: "1" })}
                className="bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => updateQuery({ page: String(pagination.currentPage - 1) })}
              disabled={!pagination.hasPrevPage}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>

            {/* Page number indicators */}
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => updateQuery({ page: String(pageNum) })}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                      pagination.currentPage === pageNum
                        ? "bg-orange-500 text-white font-bold"
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => updateQuery({ page: String(pagination.currentPage + 1) })}
              disabled={!pagination.hasNextPage}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Button for Mobile */}
      <div className="md:hidden fixed bottom-6 right-6 z-40">
        <Link
          href="/quick-entry"
          className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-xl shadow-orange-500/40 hover:scale-105 active:scale-95 transition-all"
          title="Quick Add Record"
        >
          <PlusCircle className="w-7 h-7" />
        </Link>
      </div>

      {/* Filter Drawer / Modal */}
      {filterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-orange-400" />
                <h3 className="font-semibold text-white text-sm">Advanced Record Filters</h3>
              </div>
              <button
                onClick={() => setFilterDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Record Type */}
              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">Record Type</label>
                <select
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="">All Types</option>
                  <option value={TransactionType.INCOME}>Income</option>
                  <option value={TransactionType.EXPENSE}>Expense</option>
                  <option value={TransactionType.PAYMENT_IN}>Payment In</option>
                  <option value={TransactionType.PAYMENT_OUT}>Payment Out</option>
                  <option value={TransactionType.RECEIVABLE}>Receivable</option>
                  <option value={TransactionType.PAYABLE}>Payable</option>
                  <option value={TransactionType.ADJUSTMENT}>Adjustment</option>
                </select>
              </div>

              {/* Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium">Status</label>
                  <select
                    value={draftStatus}
                    onChange={(e) => setDraftStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">All Statuses</option>
                    <option value={TransactionStatus.POSTED}>Posted</option>
                    <option value={TransactionStatus.DRAFT}>Draft</option>
                    <option value={TransactionStatus.VOID}>Voided</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium">Payment Status</label>
                  <select
                    value={draftPaymentStatus}
                    onChange={(e) => setDraftPaymentStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">All States</option>
                    <option value={PaymentStatus.PAID}>Paid / Received</option>
                    <option value={PaymentStatus.UNPAID}>Unpaid</option>
                    <option value={PaymentStatus.PARTIALLY_PAID}>Partially Paid</option>
                    <option value={PaymentStatus.OVERPAID}>Overpaid</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">Category</label>
                <select
                  value={draftCategoryId}
                  onChange={(e) => setDraftCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer */}
              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">Customer</label>
                <select
                  value={draftCustomerId}
                  onChange={(e) => setDraftCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="">All Customers</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier */}
              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">Supplier / Vendor</label>
                <select
                  value={draftSupplierId}
                  onChange={(e) => setDraftSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={draftStartDate}
                    onChange={(e) => setDraftStartDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-orange-500"
                  />
                  <input
                    type="date"
                    value={draftEndDate}
                    onChange={(e) => setDraftEndDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Amount Range */}
              <div className="space-y-1.5">
                <label className="text-slate-400 font-medium">Amount Range (₹)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Min ₹"
                    value={draftMinAmount}
                    onChange={(e) => setDraftMinAmount(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-orange-500"
                  />
                  <input
                    type="number"
                    placeholder="Max ₹"
                    value={draftMaxAmount}
                    onChange={(e) => setDraftMaxAmount(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-900/90">
              <button
                type="button"
                onClick={() => {
                  setDraftType("");
                  setDraftStatus("");
                  setDraftPaymentStatus("");
                  setDraftCategoryId("");
                  setDraftCustomerId("");
                  setDraftSupplierId("");
                  setDraftStartDate("");
                  setDraftEndDate("");
                  setDraftMinAmount("");
                  setDraftMaxAmount("");
                }}
                className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Filter Modal */}
      {savedFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Save Current Filter</h3>
              <p className="text-xs text-slate-400 mt-1">
                Save your active search & filter conditions for one-click access later.
              </p>
            </div>

            <form onSubmit={handleSaveFilter} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Filter Name</label>
                <input
                  type="text"
                  placeholder="e.g. September Flight Expenses"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>

              {saveFilterError && (
                <p className="text-xs text-rose-400">{saveFilterError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSavedFilterModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!filterName.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
