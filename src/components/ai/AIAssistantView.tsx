"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles,
  Send,
  Trash2,
  Filter,
  CheckCircle2,
  Database,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { AIChatMessage, AISafeFilters } from "@/types/ai";
import { submitAIQueryAction, clearAIHistoryAction } from "@/server/actions/ai.actions";
import {
  AIFinancialSummaryCard,
  AIRecordsCard,
  AIReceivablePayableCard,
  AILedgerCard,
  AIComparisonCard,
  AIMonthEndStatusCard,
  AIDuplicateCard,
  AINotesCard,
  AIExportCard,
  AIClarificationCard,
  AIPermissionDeniedCard,
} from "./ResultCards";

interface AIAssistantViewProps {
  businessName: string;
}

export function AIAssistantView({ businessName }: AIAssistantViewProps) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<AISafeFilters>({});
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const samplePrompts = [
    "Show this month's expenses",
    "Who has pending payments?",
    "Compare this month and last month",
    "Show UPI payments",
    "Why can't this month be closed?",
    "இந்த மாத செலவு எவ்வளவு?",
    "Find possible duplicate records",
    "Show expenses above ₹10,000",
  ];

  const messageIdCounterRef = useRef(0);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  const handleSend = (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || isPending) return;

    setErrorBanner(null);

    messageIdCounterRef.current += 1;
    const currentId = `user_${messageIdCounterRef.current}`;

    // 1. Append user message
    const userMsg: AIChatMessage = {
      id: currentId,
      role: "user",
      content: text,
      timestamp: "",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");

    // 2. Dispatch Server Action
    startTransition(async () => {
      const result = await submitAIQueryAction(text, activeFilters);

      if (!result.success || !result.message) {
        setErrorBanner(result.error || "Failed to process query.");
        messageIdCounterRef.current += 1;
        const errId = `err_${messageIdCounterRef.current}`;
        const errMsg: AIChatMessage = {
          id: errId,
          role: "assistant",
          content: result.error || "An error occurred while consulting accounting records.",
          timestamp: "",
          structuredData: {
            type: "ERROR",
            errorDetails: { message: result.error || "Service unavailable." },
          },
        };
        setMessages((prev) => [...prev, errMsg]);
        return;
      }

      // Update active filters if returned
      if (result.message.activeFilters) {
        setActiveFilters(result.message.activeFilters);
      }

      setMessages((prev) => [...prev, result.message!]);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = async () => {
    setMessages([]);
    setActiveFilters({});
    setErrorBanner(null);
    await clearAIHistoryAction();
  };

  const removeFilterField = (field: keyof AISafeFilters) => {
    setActiveFilters((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto flex flex-col h-[calc(100vh-8.5rem)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Verified Accounting Assistant
            </span>
            <span className="text-xs text-slate-500 font-mono">
              • {businessName}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
            AI Accounting Assistant
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Chips Banner */}
      {Object.keys(activeFilters).length > 0 && (
        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 flex items-center gap-1 font-semibold text-[11px] mr-1">
              <Filter className="w-3 h-3 text-orange-400" />
              Active Filters:
            </span>

            {activeFilters.year && activeFilters.month && (
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono text-[11px] flex items-center gap-1">
                {activeFilters.month}/{activeFilters.year}
                <button onClick={() => { removeFilterField("year"); removeFilterField("month"); }} className="text-slate-400 hover:text-white ml-0.5">✕</button>
              </span>
            )}

            {activeFilters.transactionType && (
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono text-[11px] flex items-center gap-1">
                {activeFilters.transactionType}
                <button onClick={() => removeFilterField("transactionType")} className="text-slate-400 hover:text-white ml-0.5">✕</button>
              </span>
            )}

            {activeFilters.paymentMethodName && (
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 font-mono text-[11px] flex items-center gap-1">
                {activeFilters.paymentMethodName}
                <button onClick={() => removeFilterField("paymentMethodName")} className="text-slate-400 hover:text-white ml-0.5">✕</button>
              </span>
            )}

            {activeFilters.minAmount && (
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-mono text-[11px] flex items-center gap-1">
                ≥ ₹{activeFilters.minAmount}
                <button onClick={() => removeFilterField("minAmount")} className="text-slate-400 hover:text-white ml-0.5">✕</button>
              </span>
            )}

            {activeFilters.maxAmount && (
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-mono text-[11px] flex items-center gap-1">
                ≤ ₹{activeFilters.maxAmount}
                <button onClick={() => removeFilterField("maxAmount")} className="text-slate-400 hover:text-white ml-0.5">✕</button>
              </span>
            )}

            {activeFilters.customerName && (
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-emerald-300 text-[11px] flex items-center gap-1">
                Customer: {activeFilters.customerName}
                <button onClick={() => removeFilterField("customerName")} className="text-slate-400 hover:text-white ml-0.5">✕</button>
              </span>
            )}
          </div>

          <button
            onClick={() => setActiveFilters({})}
            className="text-[11px] text-slate-500 hover:text-slate-300 underline cursor-pointer shrink-0 ml-2"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorBanner && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between shrink-0">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 p-2">
        {messages.length === 0 ? (
          // Empty State & Suggested Prompts
          <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500/20 to-cyan-500/20 border border-orange-500/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-orange-400" />
            </div>

            <div className="space-y-1 max-w-md">
              <h3 className="text-base font-bold text-white">Ask your accounts anything</h3>
              <p className="text-xs text-slate-400">
                Natural-language financial questions are translated strictly into verified database queries. Numerical calculations are never hallucinated.
              </p>
            </div>

            <div className="w-full max-w-lg space-y-2 pt-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Suggested Prompts
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(p)}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:border-orange-500/50 hover:text-white transition-all text-left flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate mr-2">&quot;{p}&quot;</span>
                    <Sparkles className="w-3 h-3 text-orange-400/60 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Message stream
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-tr-none shadow-md shadow-orange-500/10"
                    : "glass-card border border-slate-800 text-slate-200 rounded-tl-none space-y-2"
                }`}
              >
                {/* Text Content */}
                <div className="whitespace-pre-wrap leading-relaxed font-sans">
                  {msg.content}
                </div>

                {/* Structured Result Cards */}
                {msg.structuredData && (
                  <div>
                    {msg.structuredData.type === "FINANCIAL_SUMMARY" && msg.structuredData.financialSummary && (
                      <AIFinancialSummaryCard data={msg.structuredData.financialSummary} />
                    )}

                    {msg.structuredData.type === "RECORDS_LIST" && msg.structuredData.recordsData && (
                      <AIRecordsCard data={msg.structuredData.recordsData} />
                    )}

                    {msg.structuredData.type === "RECEIVABLE_LIST" && msg.structuredData.receivableData && (
                      <AIReceivablePayableCard data={msg.structuredData.receivableData} />
                    )}

                    {msg.structuredData.type === "PAYABLE_LIST" && msg.structuredData.payableData && (
                      <AIReceivablePayableCard data={msg.structuredData.payableData} />
                    )}

                    {msg.structuredData.type === "LEDGER_SUMMARY" && msg.structuredData.ledgerData && (
                      <AILedgerCard data={msg.structuredData.ledgerData} />
                    )}

                    {msg.structuredData.type === "COMPARISON" && msg.structuredData.comparisonData && (
                      <AIComparisonCard data={msg.structuredData.comparisonData} />
                    )}

                    {msg.structuredData.type === "MONTH_END_STATUS" && msg.structuredData.monthEndData && (
                      <AIMonthEndStatusCard data={msg.structuredData.monthEndData} />
                    )}

                    {msg.structuredData.type === "DUPLICATE_LIST" && msg.structuredData.duplicateData && (
                      <AIDuplicateCard data={msg.structuredData.duplicateData} />
                    )}

                    {msg.structuredData.type === "NOTES_LIST" && msg.structuredData.notesData && (
                      <AINotesCard notes={msg.structuredData.notesData.notes} />
                    )}

                    {msg.structuredData.type === "EXPORT_PREPARATION" && msg.structuredData.exportPreparation && (
                      <AIExportCard data={msg.structuredData.exportPreparation} />
                    )}

                    {msg.structuredData.type === "CLARIFICATION" && msg.structuredData.clarification && (
                      <AIClarificationCard
                        prompt={msg.structuredData.clarification.prompt}
                        options={msg.structuredData.clarification.options}
                        onSelectOption={(val) => handleSend(val)}
                      />
                    )}

                    {msg.structuredData.type === "PERMISSION_DENIED" && msg.structuredData.permissionDenied && (
                      <AIPermissionDeniedCard
                        missingPermission={msg.structuredData.permissionDenied.missingPermission}
                        explanation={msg.structuredData.permissionDenied.explanation}
                      />
                    )}
                  </div>
                )}

                {/* Handoff Action Button */}
                {msg.handoffAction && (
                  <div className="pt-1.5 flex justify-end">
                    <Link
                      href={msg.handoffAction.url}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      <span>{msg.handoffAction.label}</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {/* Source Attribution Badge */}
                {msg.sourceAttribution && msg.sourceAttribution !== "NONE" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                    <Database className="w-3 h-3 text-cyan-400" />
                    <span>Source: {msg.sourceLabel || "Accounting Records"}</span>
                    {msg.dataFreshnessTimestamp && (
                      <span>• Updated {new Date(msg.dataFreshnessTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading Spinner */}
        {isPending && (
          <div className="flex items-start">
            <div className="glass-card border border-slate-800 rounded-2xl rounded-tl-none p-3.5 flex items-center gap-2.5 text-xs text-slate-300">
              <RefreshCw className="w-4 h-4 text-orange-400 animate-spin" />
              <span>Consulting verified accounting records...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Box */}
      <div className="p-3 rounded-2xl glass-card border border-slate-800 shrink-0 space-y-2">
        <div className="relative flex items-center">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isPending}
            placeholder="Ask your accounts: 'Show September expenses paid via UPI', 'Who has pending payments?', 'இந்த மாத செலவு எவ்வளவு?'..."
            className="w-full pr-12 p-2.5 text-xs sm:text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:border-orange-500 focus:outline-none resize-none"
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputQuery.trim() || isPending}
            className="absolute right-2.5 bottom-2.5 p-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md disabled:opacity-40 hover:from-orange-600 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <div className="flex items-center gap-1 text-emerald-400/90">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>AI translates queries into verified filters. Totals are computed by the accounting engine.</span>
          </div>
          <span className="hidden sm:inline">Press Enter to send (Shift+Enter for newline)</span>
        </div>
      </div>
    </div>
  );
}
