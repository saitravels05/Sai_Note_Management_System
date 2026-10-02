"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Eye,
  Shield,
  Calendar,
  Sparkles,
  TrendingUp,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Users,
  Building2,
  Clock,
  BarChart3,
  PieChart,
  FileCheck,
} from "lucide-react";
import Link from "next/link";
import {
  generatePdfReportAction,
  getPdfReportPreviewAction,
  getReportCustomersAction,
  getReportSuppliersAction,
  type PdfReportPreviewDTO,
} from "@/server/actions/pdf-report.actions";
import { type PdfReportType } from "@/server/services/pdf-report.service";
import { type PeriodType } from "@/server/services/analytics.service";

interface ReportGeneratorWizardProps {
  businessName: string;
  currency: string;
  initialReportType?: PdfReportType;
  initialPeriod?: PeriodType;
}

interface ReportOptionItem {
  type: PdfReportType;
  title: string;
  description: string;
  category: "FINANCIAL" | "OUTSTANDING" | "PARTIES" | "ANALYSIS";
  icon: React.ElementType;
  color: string;
}

const ALL_REPORT_OPTIONS: ReportOptionItem[] = [
  // Financial
  {
    type: "MONTHLY_ACCOUNTING",
    title: "Monthly Accounting Report",
    description: "Flagship multi-section accounting dossier with Executive P&L, Money Movements, Receivables, Payables, and Category breakdowns.",
    category: "FINANCIAL",
    icon: Sparkles,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    type: "FINANCIAL_SUMMARY",
    title: "Executive Financial Summary",
    description: "Compact 1-page executive summary clearly distinguishing operating net results from liquid cash movement.",
    category: "FINANCIAL",
    icon: TrendingUp,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    type: "INCOME",
    title: "Income & Revenue Report",
    description: "Recognized sales from flight tickets, holiday packages, visa processing commissions, and other revenue.",
    category: "FINANCIAL",
    icon: ArrowDownLeft,
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },
  {
    type: "EXPENSES",
    title: "Operational Expense Report",
    description: "Direct airline settlements, hotel supplier disbursements, visa charges, rent, salaries, and operating overheads.",
    category: "FINANCIAL",
    icon: ArrowUpRight,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  {
    type: "TRANSACTIONS",
    title: "Transactions Journal",
    description: "Landscape multi-page journal of authorized financial transactions with party names, categories, and references.",
    category: "FINANCIAL",
    icon: Receipt,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  {
    type: "PAYMENTS",
    title: "Payment Movements Report",
    description: "Physical liquidity movements: Bank transfers, UPI receipts, cash collections and vendor payouts.",
    category: "FINANCIAL",
    icon: Wallet,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  {
    type: "CASH_MOVEMENT",
    title: "Cash Movement & Liquidity",
    description: "Opening cash, verified cash receipts, operational outflows, adjustments, and closing cash balance.",
    category: "FINANCIAL",
    icon: Wallet,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },

  // Outstanding
  {
    type: "RECEIVABLES",
    title: "Accounts Receivable Ledger",
    description: "Customer invoice balances, paid amounts, overdue days, and outstanding customer debt.",
    category: "OUTSTANDING",
    icon: Users,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    type: "PAYABLES",
    title: "Accounts Payable Ledger",
    description: "Vendor bills, settled amounts, due dates, and pending liabilities to travel partners.",
    category: "OUTSTANDING",
    icon: Building2,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },
  {
    type: "RECEIVABLE_AGING",
    title: "Receivable Aging Schedule",
    description: "Customer balances bucketed into Current, 1-30, 31-60, 61-90, and 90+ days overdue.",
    category: "OUTSTANDING",
    icon: Clock,
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  },
  {
    type: "PAYABLE_AGING",
    title: "Payable Aging Schedule",
    description: "Vendor debts bucketed into Current, 1-30, 31-60, 61-90, and 90+ days to manage liquidity.",
    category: "OUTSTANDING",
    icon: Clock,
    color: "text-red-400 bg-red-500/10 border-red-500/20",
  },

  // Parties
  {
    type: "CUSTOMER_STATEMENT",
    title: "Customer Statement of Account",
    description: "Client-facing statement with business branding, opening balance, bookings, payments, and closing dues (internal notes omitted).",
    category: "PARTIES",
    icon: Users,
    color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  },
  {
    type: "CUSTOMER_LEDGER",
    title: "Customer Ledger Account",
    description: "Accountant-ready formal ledger with Debits, Credits, and chronological running balances.",
    category: "PARTIES",
    icon: Users,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  {
    type: "SUPPLIER_STATEMENT",
    title: "Supplier Statement of Account",
    description: "Vendor statement with supplier details, period billing, payments made, and net liability.",
    category: "PARTIES",
    icon: Building2,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    type: "SUPPLIER_LEDGER",
    title: "Supplier Ledger Account",
    description: "Reconciled ledger for airlines, hotel partners, and transport suppliers.",
    category: "PARTIES",
    icon: Building2,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },

  // Analysis
  {
    type: "CATEGORY_SUMMARY",
    title: "Category Breakdown Analysis",
    description: "Income by category, expenses by category, transaction volume, and percentage distribution.",
    category: "ANALYSIS",
    icon: PieChart,
    color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  {
    type: "PAYMENT_METHOD_SUMMARY",
    title: "Payment Methods Analysis",
    description: "Inflows and outflows grouped by payment mode (Bank Transfer, UPI, Cash, Card).",
    category: "ANALYSIS",
    icon: BarChart3,
    color: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
  },
  {
    type: "DAILY_SUMMARY",
    title: "Daily Financial Movements",
    description: "Day-by-day revenue, expenses, money in, money out, and transaction counts.",
    category: "ANALYSIS",
    icon: Calendar,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    type: "MONTHLY_SUMMARY",
    title: "Monthly Multi-Period Trends",
    description: "High-level month-over-month trajectory of recognized revenue and expenses.",
    category: "ANALYSIS",
    icon: TrendingUp,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    type: "MANAGEMENT_SUMMARY",
    title: "Executive Management Briefing",
    description: "Strategic executive brief with financial KPIs, liquidity ratios, top revenue drivers, and deterministic insights.",
    category: "ANALYSIS",
    icon: FileCheck,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
];

const PERIOD_LIST: { value: PeriodType; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this-week", label: "This Week" },
  { value: "last-week", label: "Last Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "last-quarter", label: "Last Quarter" },
  { value: "this-year", label: "This Year" },
  { value: "last-year", label: "Last Year" },
  { value: "custom", label: "Custom Date Range" },
];

export function ReportGeneratorWizard({
  businessName,
  currency = "INR",
  initialReportType = "MONTHLY_ACCOUNTING",
  initialPeriod = "this-month",
}: ReportGeneratorWizardProps) {
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | "FINANCIAL" | "OUTSTANDING" | "PARTIES" | "ANALYSIS">("ALL");
  const [reportType, setReportType] = useState<PdfReportType>(initialReportType);
  const [period, setPeriod] = useState<PeriodType>(initialPeriod);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Parties
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [customers, setCustomers] = useState<{ id: string; name: string; customerCode: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; supplierCode: string }[]>([]);

  // Options
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [isConfidential, setIsConfidential] = useState(false);
  const [isDraft, setIsDraft] = useState(false);

  // Preview State
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<PdfReportPreviewDTO | null>(null);

  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{
    historyId: string;
    fileName: string;
    fileSize: number;
    downloadUrl: string;
    reportReference: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load parties when party report selected
  useEffect(() => {
    if (reportType.startsWith("CUSTOMER")) {
      getReportCustomersAction().then((res) => {
        if (res.success && res.data) {
          setCustomers(res.data);
          if (!customerId && res.data.length > 0) {
            setCustomerId(res.data[0].id);
          }
        }
      });
    } else if (reportType.startsWith("SUPPLIER")) {
      getReportSuppliersAction().then((res) => {
        if (res.success && res.data) {
          setSuppliers(res.data);
          if (!supplierId && res.data.length > 0) {
            setSupplierId(res.data[0].id);
          }
        }
      });
    }
  }, [reportType, customerId, supplierId]);

  // Load authoritative preview
  useEffect(() => {
    if (reportType.startsWith("CUSTOMER") && !customerId) return;
    if (reportType.startsWith("SUPPLIER") && !supplierId) return;

    let isMounted = true;

    const runFetch = async () => {
      setIsLoadingPreview(true);
      setErrorMsg(null);
      try {
        const res = await getPdfReportPreviewAction({
          reportType,
          period,
          startDate: period === "custom" ? customStart : undefined,
          endDate: period === "custom" ? customEnd : undefined,
          customerId: reportType.startsWith("CUSTOMER") ? customerId : undefined,
          supplierId: reportType.startsWith("SUPPLIER") ? supplierId : undefined,
        });
        if (isMounted) {
          if (res.success && res.data) {
            setPreview(res.data);
          } else {
            setPreview(null);
            if (res.error) setErrorMsg(res.error);
          }
        }
      } catch (err) {
        if (isMounted) {
          setPreview(null);
          setErrorMsg(err instanceof Error ? err.message : "Failed to calculate preview.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingPreview(false);
        }
      }
    };

    runFetch();

    return () => {
      isMounted = false;
    };
  }, [reportType, period, customStart, customEnd, customerId, supplierId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setGeneratedResult(null);

    try {
      const res = await generatePdfReportAction({
        reportType,
        period,
        startDate: period === "custom" ? customStart : undefined,
        endDate: period === "custom" ? customEnd : undefined,
        customerId: reportType.startsWith("CUSTOMER") ? customerId : undefined,
        supplierId: reportType.startsWith("SUPPLIER") ? supplierId : undefined,
        isConfidential,
        isDraft,
        includeCharts,
        includeNotes,
      });

      if (res.success && res.data) {
        setGeneratedResult({
          historyId: res.data.historyId,
          fileName: res.data.fileName,
          fileSize: res.data.fileSize,
          downloadUrl: res.data.downloadUrl,
          reportReference: res.data.reportReference,
        });
      } else {
        setErrorMsg(res.error || "Failed to generate report.");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error generating report.");
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredReports = ALL_REPORT_OPTIONS.filter((r) =>
    selectedCategory === "ALL" ? true : r.category === selectedCategory
  );

  const selectedReportDef = ALL_REPORT_OPTIONS.find((r) => r.type === reportType) || ALL_REPORT_OPTIONS[0];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
              {businessName}
            </span>
            <span className="text-xs text-slate-400">• PDF Report Generator ({currency})</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Accounting PDF Generator
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure, preview, and generate print-ready A4 financial statements and ledgers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all"
          >
            <span>Back to Report Center</span>
          </Link>
          <Link
            href="/reports/history"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all"
          >
            <span>View Report History</span>
          </Link>
        </div>
      </div>

      {/* Main Generator Grid: Left Config, Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Steps (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Choose Report Category & Type */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center text-xs font-black">
                  1
                </div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Select Report Statement Type
                </h3>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {(["ALL", "FINANCIAL", "OUTSTANDING", "PARTIES", "ANALYSIS"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      selectedCategory === cat
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Report Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
              {filteredReports.map((opt) => {
                const isSelected = reportType === opt.type;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    onClick={() => setReportType(opt.type)}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl text-left border transition-all ${
                      isSelected
                        ? "bg-slate-850 border-rose-500/50 shadow-md shadow-rose-950/20 ring-1 ring-rose-500/30"
                        : "bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className={`p-2 rounded-xl border shrink-0 ${opt.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {opt.title}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Accounting Period & Dates */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center text-xs font-black">
                2
              </div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Accounting Period & Scope
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PERIOD_LIST.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`p-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                    period === p.value
                      ? "bg-rose-500/10 border-rose-500/40 text-rose-300 font-bold"
                      : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {period === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Party Target (if Customer or Supplier) */}
          {(reportType.startsWith("CUSTOMER") || reportType.startsWith("SUPPLIER")) && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center text-xs font-black">
                  3
                </div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Target Account Selection
                </h3>
              </div>

              {reportType.startsWith("CUSTOMER") && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Select Customer Account <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.customerCode})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Customer statements automatically exclude internal operational memos to preserve privacy.
                  </p>
                </div>
              )}

              {reportType.startsWith("SUPPLIER") && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Select Supplier Account <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.supplierCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Formatting & Layout Options */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center text-xs font-black">
                {reportType.startsWith("CUSTOMER") || reportType.startsWith("SUPPLIER") ? 4 : 3}
              </div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Presentation & Security Options
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 text-xs">
                <input
                  type="checkbox"
                  checked={includeCharts}
                  onChange={(e) => setIncludeCharts(e.target.checked)}
                  className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                />
                <span className="font-semibold text-slate-300">Visual Charts</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 text-xs">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                />
                <span className="font-semibold text-slate-300">Notes & Disclosures</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 text-xs">
                <input
                  type="checkbox"
                  checked={isConfidential}
                  onChange={(e) => setIsConfidential(e.target.checked)}
                  className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                />
                <span className="font-semibold text-slate-300">Confidential</span>
              </label>

              <label className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 text-xs">
                <input
                  type="checkbox"
                  checked={isDraft}
                  onChange={(e) => setIsDraft(e.target.checked)}
                  className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                />
                <span className="font-semibold text-slate-300">Watermark Draft</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Side: Live Authoritative Preview & Action (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  Step 5 • Live Accounting Preview
                </span>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {selectedReportDef.title}
                </h3>
              </div>
              {isLoadingPreview && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Syncing...</span>
                </div>
              )}
            </div>

            {/* Generated Success Screen */}
            {generatedResult ? (
              <div className="space-y-5 text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Report Generated Successfully</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Saved to private tenant storage and logged to audit trail.
                  </p>
                  <div className="mt-2.5 inline-block px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 font-semibold">
                    Ref: {generatedResult.reportReference}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">File Name:</span>
                    <span className="font-mono text-white truncate max-w-[200px]">
                      {generatedResult.fileName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">File Size:</span>
                    <span className="text-white font-mono">
                      {(generatedResult.fileSize / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <a
                    href={generatedResult.downloadUrl}
                    download
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/40 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF File</span>
                  </a>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => window.open(generatedResult.downloadUrl, "_blank")}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all"
                    >
                      <Eye className="w-4 h-4 text-sky-400" />
                      <span>View in Browser</span>
                    </button>
                    <button
                      onClick={() => window.open(generatedResult.downloadUrl, "_blank")}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                    >
                      <Printer className="w-4 h-4 text-slate-400" />
                      <span>Print Document</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setGeneratedResult(null)}
                  className="text-xs text-slate-400 hover:text-white transition-all pt-2"
                >
                  Generate another report
                </button>
              </div>
            ) : (
              /* Preview & Generate Action */
              <div className="space-y-5">
                {preview ? (
                  <div className="space-y-4">
                    {/* Header info */}
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-bold text-white">{preview.businessName}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{preview.periodLabel}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-slate-200">
                            ~{preview.estimatedPages} {preview.estimatedPages === 1 ? "page" : "pages"}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {preview.estimatedRows} record items
                          </div>
                        </div>
                      </div>

                      {preview.warning && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                          <span>{preview.warning}</span>
                        </div>
                      )}

                      {/* Summary Cards */}
                      {preview.summaryCards.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                          {preview.summaryCards.map((sc, i) => (
                            <div key={i} className="bg-slate-900/80 border border-slate-800/60 rounded-xl p-2.5">
                              <div className="text-[10px] text-slate-400 truncate">{sc.label}</div>
                              <div
                                className="text-xs font-bold mt-0.5"
                                style={{ color: sc.color || "#F8FAFC" }}
                              >
                                {sc.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Report Specs */}
                    <div className="space-y-2 text-xs text-slate-400 bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4">
                      <div className="flex justify-between">
                        <span>Format:</span>
                        <span className="font-semibold text-slate-200">A4 PDF Print-Ready</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Orientation:</span>
                        <span className="font-semibold text-slate-200">
                          {["TRANSACTIONS", "RECEIVABLE_AGING", "PAYABLE_AGING"].includes(reportType)
                            ? "Landscape (Wide Table)"
                            : "Portrait"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Multi-language:</span>
                        <span className="font-semibold text-slate-200">Tamil Unicode & INR (₹)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Header Branding:</span>
                        <span className="font-semibold text-slate-200">Official Business Profile</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic py-6 text-center">
                    {reportType.startsWith("CUSTOMER") && !customerId
                      ? "Select a customer to view statement preview."
                      : reportType.startsWith("SUPPLIER") && !supplierId
                      ? "Select a supplier to view statement preview."
                      : "Calculating live preview..."}
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={
                    isGenerating ||
                    (reportType.startsWith("CUSTOMER") && !customerId) ||
                    (reportType.startsWith("SUPPLIER") && !supplierId)
                  }
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-xl shadow-rose-950/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Rendering High-Resolution PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Generate & Store PDF Report</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Immutable accounting truth verified by PostgreSQL</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
