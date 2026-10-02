"use client";

import { useState, useTransition } from "react";
import { formatINR } from "@/lib/formatters";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { recordPaymentAction } from "@/server/actions/payment.actions";
import { X, CheckCircle2, AlertCircle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PaymentDirection } from "@prisma/client";

interface ReceivePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  direction: PaymentDirection;
  transaction: {
    id: string;
    transactionNumber: string;
    title: string;
    totalAmount: string;
    paidAmount: string;
    outstandingAmount: string;
    partyId: string | null;
    partyName: string | null;
  };
  paymentMethods: { id: string; name: string; type: string }[];
  onSuccess?: () => void;
}

export function ReceivePaymentModal({
  isOpen,
  onClose,
  direction,
  transaction,
  paymentMethods,
  onSuccess,
}: ReceivePaymentModalProps) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(transaction.outstandingAmount);
  const [paymentMethodId, setPaymentMethodId] = useState(
    paymentMethods.length > 0 ? paymentMethods[0].id : ""
  );
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isIncoming = direction === PaymentDirection.IN;
  const numAmount = parseFloat(amount) || 0;
  const numOutstanding = parseFloat(transaction.outstandingAmount) || 0;
  const isOverpaying = numAmount > numOutstanding;
  const unappliedCredit = isOverpaying ? numAmount - numOutstanding : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numAmount <= 0) {
      setError("Payment amount must be greater than zero");
      return;
    }

    if (!paymentMethodId) {
      setError("Please select a payment method");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("direction", direction);
      formData.set("amount", String(numAmount));
      formData.set("paymentDate", paymentDate);
      formData.set("paymentMethodId", paymentMethodId);
      if (isIncoming && transaction.partyId) formData.set("customerId", transaction.partyId);
      if (!isIncoming && transaction.partyId) formData.set("supplierId", transaction.partyId);
      if (referenceNumber) formData.set("referenceNumber", referenceNumber);
      if (notes) formData.set("notes", notes);

      // Allocation to this transaction
      const allocAmount = isOverpaying ? numOutstanding : numAmount;
      const allocations = [{ transactionId: transaction.id, amount: allocAmount }];
      formData.set("allocations", JSON.stringify(allocations));

      const res = await recordPaymentAction(null, formData);
      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError(res.error || "Failed to record payment");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#0e1422] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                isIncoming
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"
              }`}
            >
              {isIncoming ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isIncoming ? "Receive Payment" : "Make Payment"}
              </h3>
              <p className="text-[11px] text-slate-400">
                {transaction.partyName} • {transaction.transactionNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Balance card */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total</div>
              <div className="text-xs font-semibold text-slate-300 mt-0.5">
                {formatINR(transaction.totalAmount)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Paid</div>
              <div className="text-xs font-semibold text-slate-300 mt-0.5">
                {formatINR(transaction.paidAmount)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-orange-400 uppercase tracking-wider font-bold">Due</div>
              <div className="text-xs font-bold text-orange-400 mt-0.5">
                {formatINR(transaction.outstandingAmount)}
              </div>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Payment Amount</span>
              <button
                type="button"
                onClick={() => setAmount(transaction.outstandingAmount)}
                className="text-[11px] text-orange-400 hover:underline"
              >
                Full Balance
              </button>
            </label>
            <CurrencyInput
              name="paymentAmount"
              value={amount}
              onChange={(v) => setAmount(v)}
              placeholder="0.00"
              required
            />
            {isOverpaying && (
              <p className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                Payment exceeds remaining balance. ₹{formatINR(unappliedCredit)} will be credited as an advance.
              </p>
            )}
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Payment Method</label>
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors"
              >
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.type.replace("_", " ")})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
          </div>

          {/* Reference Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Reference / Transaction ID
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. UPI Ref, Bank UTR, Cheque No..."
              className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Notes / Remarks</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Internal operational notes..."
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all ${
                isIncoming
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
                  : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30"
              } disabled:opacity-50`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isPending ? "Recording..." : isIncoming ? "Record Payment" : "Make Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
