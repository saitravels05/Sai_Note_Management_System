"use client";

import { useState, useEffect, useRef } from "react";
import { quickCreateCategoryAction } from "@/server/actions/category.actions";
import { Tag, Plus, Check, X, Loader2, Search } from "lucide-react";
import { CategoryType, TransactionType } from "@prisma/client";

interface CategoryOption {
  id: string;
  name: string;
  type: CategoryType;
}

interface CategorySelectorProps {
  transactionType: TransactionType;
  selectedId?: string;
  categories: CategoryOption[];
  onSelect: (category: CategoryOption | null) => void;
  required?: boolean;
}

export function CategorySelector({
  transactionType,
  selectedId,
  categories,
  onSelect,
  required = true,
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createdCategories, setCreatedCategories] = useState<CategoryOption[]>([]);

  // Quick Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const allCategories = [...categories, ...createdCategories];
  const selectedCategory = allCategories.find((c) => c.id === selectedId) || null;

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

  // Filter categories based on transaction type
  const isIncome =
    transactionType === TransactionType.INCOME ||
    transactionType === TransactionType.RECEIVABLE ||
    transactionType === TransactionType.PAYMENT_IN;

  const filteredCategories = allCategories.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (isIncome) {
      return c.type === CategoryType.INCOME || c.type === CategoryType.BOTH;
    } else {
      return c.type === CategoryType.EXPENSE || c.type === CategoryType.BOTH;
    }
  });

  const handleSelect = (category: CategoryOption | null) => {
    onSelect(category);
    setIsOpen(false);
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      setCreateError("Category name is required");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    const formData = new FormData();
    formData.append("name", createName.trim());
    formData.append("type", isIncome ? CategoryType.INCOME : CategoryType.EXPENSE);

    try {
      const res = await quickCreateCategoryAction(null, formData);
      if (res.success && res.categoryId) {
        const newCat: CategoryOption = {
          id: res.categoryId,
          name: createName.trim(),
          type: isIncome ? CategoryType.INCOME : CategoryType.EXPENSE,
        };
        setCreatedCategories((prev) => [...prev, newCat]);
        handleSelect(newCat);
        setIsCreateOpen(false);
        setCreateName("");
      } else {
        setCreateError(res.error || "Failed to create category");
      }
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger / Selected Button */}
      {selectedCategory ? (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-700/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1 rounded bg-orange-500/10 text-orange-400">
              <Tag className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-semibold text-white truncate">
              {selectedCategory.name}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              ({selectedCategory.type})
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="p-1 text-slate-400 hover:text-white"
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
            <Tag className="w-4 h-4 text-slate-500" />
            <span>Select Category...</span>
          </span>
          <span className="text-[11px] font-semibold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
            + New
          </span>
        </button>
      )}

      {/* Hidden input for form submission */}
      <input
        type="hidden"
        name="categoryId"
        value={selectedCategory?.id || ""}
        required={required && !selectedCategory}
      />

      {/* Dropdown Menu */}
      {isOpen && !selectedCategory && (
        <div className="absolute left-0 right-0 mt-1.5 z-40 rounded-xl bg-[#0e1422] border border-slate-800 shadow-2xl p-2 animate-in fade-in duration-100 max-h-60 overflow-y-auto">
          {/* Search Box */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search categories..."
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
              setIsCreateOpen(true);
              setIsOpen(false);
            }}
            className="w-full mb-1.5 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 font-semibold text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Category {searchQuery ? `"${searchQuery}"` : ""}</span>
          </button>

          {/* List */}
          <div className="space-y-0.5">
            {filteredCategories.length > 0 ? (
              filteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelect(cat)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/80 text-left transition-colors group"
                >
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {cat.type}
                  </span>
                </button>
              ))
            ) : (
              <div className="p-3 text-center text-xs text-slate-500">
                No matching category found. Click above to create it.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Tag className="w-4 h-4 text-orange-400" />
                <span>New Accounting Category</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200">
                {createError}
              </div>
            )}

            <form onSubmit={handleQuickCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category Name <span className="text-orange-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Flight Bookings, Hotel Payments"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Create & Select</span>
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
