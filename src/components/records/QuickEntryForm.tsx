"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveRecordAction } from "@/server/actions/record.actions";
import { saveNoteAction } from "@/server/actions/note.actions";
import { checkDuplicateAction } from "@/server/actions/record.actions";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { PartySelector } from "./PartySelector";
import { CategorySelector } from "./CategorySelector";
import { TagsInput } from "./TagsInput";
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Sliders,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Pin,
  Loader2,
  X,
  FileCheck,
} from "lucide-react";
import { TransactionType, PaymentStatus, CategoryType, TransactionStatus } from "@prisma/client";

export type EntryType =
  | "INCOME"
  | "EXPENSE"
  | "PAYMENT_IN"
  | "PAYMENT_OUT"
  | "RECEIVABLE"
  | "PAYABLE"
  | "NOTE"
  | "ADJUSTMENT";

export interface InitialRecordData {
  id?: string;
  transactionType?: TransactionType;
  title?: string;
  amount?: string;
  transactionDate?: string;
  dueDate?: string | null;
  categoryId?: string;
  customerId?: string | null;
  supplierId?: string | null;
  referenceNumber?: string | null;
  description?: string | null;
  notes?: string | null;
  paymentStatus?: PaymentStatus;
  status?: TransactionStatus;
  isDuplicate?: boolean;
}

interface QuickEntryFormProps {
  categories: Array<{ id: string; name: string; type: CategoryType }>;
  onClose?: () => void;
  initialType?: EntryType;
  initialRecord?: InitialRecordData;
}

export function QuickEntryForm({
  categories,
  onClose,
  initialType = "EXPENSE",
  initialRecord,
}: QuickEntryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const getInitialEntryType = (): EntryType => {
    if (initialRecord?.transactionType) {
      return initialRecord.transactionType as EntryType;
    }
    return initialType;
  };

  const [entryType, setEntryType] = useState<EntryType>(getInitialEntryType);

  // Form states
  const [title, setTitle] = useState(initialRecord?.title || "");
  const [amount, setAmount] = useState(initialRecord?.amount || "");
  const [transactionDate, setTransactionDate] = useState(() => {
    if (initialRecord?.transactionDate && !initialRecord.isDuplicate) {
      return initialRecord.transactionDate;
    }
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [dueDate, setDueDate] = useState(() => {
    return !initialRecord?.isDuplicate && initialRecord?.dueDate ? initialRecord.dueDate : "";
  });
  const [referenceNumber, setReferenceNumber] = useState(() => {
    return !initialRecord?.isDuplicate && initialRecord?.referenceNumber ? initialRecord.referenceNumber : "";
  });
  const [description, setDescription] = useState(initialRecord?.description || "");
  const [notes, setNotes] = useState(initialRecord?.notes || "");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(() => {
    if (initialRecord?.isDuplicate) return PaymentStatus.UNPAID;
    return initialRecord?.paymentStatus || PaymentStatus.PAID;
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialRecord?.customerId || null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(initialRecord?.supplierId || null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialRecord?.categoryId || "");
  const [isPinned, setIsPinned] = useState(false);
  const [noteContent, setNoteContent] = useState("");

  // UI status
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Pre-flight duplicate detection check
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!amount || parseFloat(amount) <= 0 || !transactionDate) {
        setDuplicateWarning(null);
        return;
      }

      try {
        const res = await checkDuplicateAction({
          amount,
          transactionDate,
          referenceNumber: referenceNumber || undefined,
          customerId: selectedCustomerId || undefined,
          supplierId: selectedSupplierId || undefined,
        });

        if (res.isPossibleDuplicate && res.matches.length > 0) {
          const match = res.matches[0];
          setDuplicateWarning(
            `Possible duplicate detected: Record #${match.transactionNumber} on this date for ₹${match.totalAmount}.`
          );
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        setDuplicateWarning(null);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [amount, transactionDate, referenceNumber, selectedCustomerId, selectedSupplierId]);

  const resetFields = () => {
    setTitle("");
    setAmount("");
    setReferenceNumber("");
    setDescription("");
    setNotes("");
    setNoteContent("");
    setDuplicateWarning(null);
    setFormError(null);
  };

  const handleSubmit = (actionType: "save" | "save_and_add_another" | "save_draft") => {
    setFormError(null);
    setSuccessMessage(null);

    // Validation
    if (entryType === "NOTE") {
      if (!title.trim()) {
        setFormError("Note title is required");
        return;
      }
      if (!noteContent.trim()) {
        setFormError("Note content is required");
        return;
      }
    } else {
      if (!title.trim() && entryType !== "PAYMENT_IN" && entryType !== "PAYMENT_OUT") {
        setFormError("Title / Description is required");
        return;
      }
      if (actionType !== "save_draft" && (!amount || parseFloat(amount) <= 0)) {
        setFormError("Amount must be greater than zero");
        return;
      }
      if (!selectedCategoryId && entryType !== "PAYMENT_IN" && entryType !== "PAYMENT_OUT" && entryType !== "ADJUSTMENT") {
        setFormError("Category is required");
        return;
      }
    }

    startTransition(async () => {
      try {
        const formData = new FormData();

        if (entryType === "NOTE") {
          formData.append("title", title.trim());
          formData.append("content", noteContent.trim());
          if (selectedCustomerId) formData.append("customerId", selectedCustomerId);
          if (selectedSupplierId) formData.append("supplierId", selectedSupplierId);
          formData.append("isPinned", isPinned ? "true" : "false");

          const res = await saveNoteAction(null, formData);
          if (res.success) {
            setSuccessMessage("Note saved successfully!");
            if (actionType === "save_and_add_another") {
              resetFields();
            } else {
              setTimeout(() => {
                if (onClose) onClose();
                router.push("/notes");
              }, 600);
            }
          } else {
            setFormError(res.error || "Failed to save note");
          }
        } else {
          // Transaction types
          const txnType: TransactionType =
            entryType === "INCOME" ? TransactionType.INCOME :
            entryType === "EXPENSE" ? TransactionType.EXPENSE :
            entryType === "PAYMENT_IN" ? TransactionType.PAYMENT_IN :
            entryType === "PAYMENT_OUT" ? TransactionType.PAYMENT_OUT :
            entryType === "RECEIVABLE" ? TransactionType.RECEIVABLE :
            entryType === "PAYABLE" ? TransactionType.PAYABLE : TransactionType.ADJUSTMENT;

          formData.append("transactionType", txnType);
          formData.append("actionType", actionType);
          formData.append("title", title.trim() || `${entryType.replace("_", " ")} - ${transactionDate}`);
          formData.append("amount", amount || "0");
          formData.append("transactionDate", transactionDate);
          if (dueDate) formData.append("dueDate", dueDate);
          if (selectedCategoryId) formData.append("categoryId", selectedCategoryId);
          if (selectedCustomerId) formData.append("customerId", selectedCustomerId);
          if (selectedSupplierId) formData.append("supplierId", selectedSupplierId);
          if (referenceNumber) formData.append("referenceNumber", referenceNumber.trim());
          if (description) formData.append("description", description.trim());
          if (notes) formData.append("notes", notes.trim());

          // Payment Status
          const payStatus =
            entryType === "RECEIVABLE" || entryType === "PAYABLE"
              ? PaymentStatus.UNPAID
              : paymentStatus;
          formData.append("paymentStatus", payStatus);

          // If editing existing record
          if (initialRecord?.id && !initialRecord.isDuplicate) {
            formData.append("id", initialRecord.id);
            formData.append("editReason", "Updated record details via edit form");
          }

          const res = await saveRecordAction(null, formData);
          if (res.success) {
            setSuccessMessage(
              initialRecord?.id && !initialRecord.isDuplicate
                ? "Record updated successfully!"
                : actionType === "save_draft"
                ? "Draft saved successfully!"
                : "Record posted to ledger!"
            );

            if (actionType === "save_and_add_another") {
              resetFields();
            } else {
              setTimeout(() => {
                if (onClose) onClose();
                if (initialRecord?.id && !initialRecord.isDuplicate) {
                  router.push(`/records/${initialRecord.id}`);
                } else {
                  router.push("/records");
                }
              }, 600);
            }
          } else {
            setFormError(res.error || "Failed to save record");
          }
        }
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    });
  };

  // Types list with visual icon badges
  const typeTabs: Array<{ id: EntryType; label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [
    { id: "EXPENSE", label: "Expense", icon: TrendingDown, color: "text-red-400 bg-red-500/10 border-red-500/30" },
    { id: "INCOME", label: "Income", icon: TrendingUp, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
    { id: "PAYMENT_IN", label: "Payment In", icon: ArrowDownLeft, color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
    { id: "PAYMENT_OUT", label: "Payment Out", icon: ArrowUpRight, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
    { id: "RECEIVABLE", label: "Receivable", icon: FileCheck, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
    { id: "PAYABLE", label: "Payable", icon: FileText, color: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
    { id: "NOTE", label: "General Note", icon: Pin, color: "text-slate-300 bg-slate-800 border-slate-700" },
    { id: "ADJUSTMENT", label: "Adjustment", icon: Sliders, color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
  ];

  return (
    <div className="bg-[#0e1422] border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative max-w-3xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>+ Quick Entry Workspace</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Record business transactions and operational notes quickly without spreadsheet complexity.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Record Type Selector Grid */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Select Entry Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {typeTabs.map((t) => {
            const Icon = t.icon;
            const isSelected = entryType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setEntryType(t.id);
                  setFormError(null);
                }}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold transition-all text-left ${
                  isSelected
                    ? `${t.color} shadow-lg ring-1 ring-orange-500/50`
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duplicate Warning Banner */}
      {duplicateWarning && (
        <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-amber-300">Potential Duplicate:</span>
            <span className="ml-1">{duplicateWarning}</span>
          </div>
        </div>
      )}

      {/* Error & Success Messages */}
      {formError && (
        <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{formError}</span>
        </div>
      )}
      {successMessage && (
        <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Dynamic Form based on Type */}
      <div className="space-y-4">
        {/* Row 1: Date & Amount (if financial) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-orange-400" />
              <span>Record Date <span className="text-orange-400">*</span></span>
            </label>
            <input
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          {entryType !== "NOTE" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Amount (INR ₹) <span className="text-orange-400">*</span>
              </label>
              <CurrencyInput
                name="amount"
                value={amount}
                onChange={(val) => setAmount(val)}
                placeholder="0.00"
              />
            </div>
          )}
        </div>

        {/* Row 2: Title or Note Subject */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            {entryType === "NOTE" ? "Note Title" : "Title / Description"} <span className="text-orange-400">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              entryType === "EXPENSE" ? "e.g. Airline Ticket Booking, Office Internet, Fuel" :
              entryType === "INCOME" ? "e.g. Tour Package Advance, Visa Processing Fee" :
              entryType === "NOTE" ? "e.g. Flight Schedule update for Mr. Sharma" : "Record Title..."
            }
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Note Content (Only for NOTE) */}
        {entryType === "NOTE" && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Note Content / Diary Entry <span className="text-orange-400">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write observations, flight PNR details, customer follow-up notes..."
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        )}

        {/* Row 3: Category (For Income, Expense, Receivable, Payable) */}
        {entryType !== "NOTE" && entryType !== "ADJUSTMENT" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Accounting Category <span className="text-orange-400">*</span>
              </label>
              <CategorySelector
                transactionType={
                  entryType === "INCOME" || entryType === "RECEIVABLE" || entryType === "PAYMENT_IN"
                    ? TransactionType.INCOME
                    : TransactionType.EXPENSE
                }
                selectedId={selectedCategoryId}
                categories={categories}
                onSelect={(cat) => setSelectedCategoryId(cat?.id || "")}
              />
            </div>

            {/* Customer or Supplier Selector based on type */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {entryType === "INCOME" || entryType === "RECEIVABLE" || entryType === "PAYMENT_IN"
                  ? "Customer (Party)"
                  : "Supplier / Vendor (Party)"}
              </label>
              {entryType === "INCOME" || entryType === "RECEIVABLE" || entryType === "PAYMENT_IN" ? (
                <PartySelector
                  partyType="customer"
                  selectedId={selectedCustomerId}
                  onSelect={(p) => setSelectedCustomerId(p?.id || null)}
                />
              ) : (
                <PartySelector
                  partyType="supplier"
                  selectedId={selectedSupplierId}
                  onSelect={(p) => setSelectedSupplierId(p?.id || null)}
                />
              )}
            </div>
          </div>
        )}

        {/* Reference Number & Due Date (For Receivables/Payables) */}
        {(entryType === "RECEIVABLE" || entryType === "PAYABLE") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payment Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Invoice / Reference Number
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. INV-9821, PNR-XYZ"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        )}

        {/* Reference & Payment Status (For Income/Expense) */}
        {(entryType === "INCOME" || entryType === "EXPENSE") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Reference / Bill / PNR Number
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. UPI Ref / Ticket No"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value={PaymentStatus.PAID}>Paid</option>
                <option value={PaymentStatus.UNPAID}>Unpaid / Pending</option>
                <option value={PaymentStatus.PARTIALLY_PAID}>Partially Paid</option>
              </select>
            </div>
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Tags & Labels
          </label>
          <TagsInput />
        </div>

        {/* Operational Notes */}
        {entryType !== "NOTE" && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Internal Ledger Notes / Remarks
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional internal context or notes..."
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        )}

        {/* Pin note option */}
        {entryType === "NOTE" && (
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 pt-1">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-orange-500 focus:ring-orange-500"
            />
            <span className="flex items-center gap-1">
              <Pin className="w-3.5 h-3.5 text-orange-400" />
              <span>Pin this note to the top of the workspace</span>
            </span>
          </label>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-6 mt-6 border-t border-slate-800">
        <button
          type="button"
          onClick={onClose || (() => router.back())}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
        >
          Cancel
        </button>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          {entryType !== "NOTE" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSubmit("save_draft")}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all disabled:opacity-60"
            >
              Save Draft
            </button>
          )}

          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSubmit("save_and_add_another")}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-orange-400 border border-orange-500/30 text-xs font-semibold transition-all disabled:opacity-60"
          >
            Save & Add Another
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSubmit("save")}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs font-semibold shadow-lg shadow-orange-500/25 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{entryType === "NOTE" ? "Save Note" : "Post Record"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
