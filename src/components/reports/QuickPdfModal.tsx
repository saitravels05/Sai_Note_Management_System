"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Shield,
  Eye,
} from "lucide-react";
import {
  generatePdfReportAction,
  getPdfReportPreviewAction,
  getReportCustomersAction,
  getReportSuppliersAction,
  type PdfReportPreviewDTO,
} from "@/server/actions/pdf-report.actions";
import { type PdfReportType } from "@/server/services/pdf-report.service";
import { type PeriodType } from "@/server/services/analytics.service";

interface QuickPdfModalProps {
  buttonText?: string;
  buttonClassName?: string;
  defaultReportType?: PdfReportType;
  customerId?: string;
  supplierId?: string;
  period?: PeriodType;
  startDate?: string;
  endDate?: string;
}

const REPORT_TYPE_OPTIONS: { value: PdfReportType; label: string; group: string }[] = [
  { value: "MONTHLY_ACCOUNTING", label: "Monthly Accounting Report (Flagship)", group: "Financial Reports" },
  { value: "FINANCIAL_SUMMARY", label: "Executive Financial Summary", group: "Financial Reports" },
  { value: "INCOME", label: "Income & Revenue Report", group: "Financial Reports" },
  { value: "EXPENSES", label: "Operational Expense Report", group: "Financial Reports" },
  { value: "TRANSACTIONS", label: "Financial Transactions Journal", group: "Financial Reports" },
  { value: "PAYMENTS", label: "Payment Movements Report", group: "Financial Reports" },
  { value: "CASH_MOVEMENT", label: "Cash Movement & Liquidity Report", group: "Financial Reports" },
  { value: "RECEIVABLES", label: "Accounts Receivable Ledger", group: "Outstanding Reports" },
  { value: "PAYABLES", label: "Accounts Payable Ledger", group: "Outstanding Reports" },
  { value: "RECEIVABLE_AGING", label: "Receivable Aging Schedule (5 Buckets)", group: "Outstanding Reports" },
  { value: "PAYABLE_AGING", label: "Payable Aging Schedule (5 Buckets)", group: "Outstanding Reports" },
  { value: "CUSTOMER_STATEMENT", label: "Customer Statement of Account", group: "Customer Reports" },
  { value: "CUSTOMER_LEDGER", label: "Customer Ledger Account", group: "Customer Reports" },
  { value: "SUPPLIER_STATEMENT", label: "Supplier Statement of Account", group: "Supplier Reports" },
  { value: "SUPPLIER_LEDGER", label: "Supplier Ledger Account", group: "Supplier Reports" },
  { value: "CATEGORY_SUMMARY", label: "Category Summary Breakdown", group: "Analysis Reports" },
  { value: "PAYMENT_METHOD_SUMMARY", label: "Payment Method Breakdown", group: "Analysis Reports" },
  { value: "DAILY_SUMMARY", label: "Daily Financial Summary", group: "Analysis Reports" },
  { value: "MONTHLY_SUMMARY", label: "Monthly Multi-Period Trends", group: "Analysis Reports" },
  { value: "MANAGEMENT_SUMMARY", label: "Management Executive Briefing", group: "Analysis Reports" },
];

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
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

export function QuickPdfModal({
  buttonText = "Generate PDF Report",
  buttonClassName = "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white shadow-lg shadow-rose-950/30 hover:bg-rose-500 transition-all",
  defaultReportType = "MONTHLY_ACCOUNTING",
  customerId: initialCustomerId,
  supplierId: initialSupplierId,
  period: initialPeriod = "this-month",
  startDate: initialStartDate,
  endDate: initialEndDate,
}: QuickPdfModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState<PdfReportType>(defaultReportType);
  const [period, setPeriod] = useState<PeriodType>(initialPeriod);
  const [customStart, setCustomStart] = useState<string>(initialStartDate || "");
  const [customEnd, setCustomEnd] = useState<string>(initialEndDate || "");

  // Options
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [isConfidential, setIsConfidential] = useState(false);
  const [isDraft, setIsDraft] = useState(false);

  // Parties
  const [customerId, setCustomerId] = useState<string>(initialCustomerId || "");
  const [supplierId, setSupplierId] = useState<string>(initialSupplierId || "");
  const [customers, setCustomers] = useState<{ id: string; name: string; customerCode: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; supplierCode: string }[]>([]);

  // Preview State
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<PdfReportPreviewDTO | null>(null);

  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{
    fileName: string;
    fileSize: number;
    downloadUrl: string;
    reportReference: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Parties if needed
  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen, reportType, customerId, supplierId]);

  // Fetch Preview
  useEffect(() => {
    if (!isOpen) return;
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
          setErrorMsg(err instanceof Error ? err.message : "Failed to load preview.");
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
  }, [isOpen, reportType, period, customStart, customEnd, customerId, supplierId]);

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
          fileName: res.data.fileName,
          fileSize: res.data.fileSize,
          downloadUrl: res.data.downloadUrl,
          reportReference: res.data.reportReference,
        });
      } else {
        setErrorMsg(res.error || "Failed to generate PDF report.");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error generating PDF report.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = (url: string) => {
    const win = window.open(url, "_blank");
    if (win) {
      win.focus();
      // Browser PDF viewer handles native printing
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className={buttonClassName}>
        <FileText className="w-4 h-4 text-rose-300" />
        <span>{buttonText}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Generate Professional PDF Report
                  </h2>
                  <p className="text-xs text-slate-400">
                    A4 accounting reports with business branding, Tamil Unicode & Rupee formatting
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
              {generatedResult ? (
                /* Success View */
                <div className="space-y-6 text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">PDF Report Ready</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Report generated and stored securely in private business storage.
                    </p>
                    <div className="mt-3 inline-block px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-emerald-400 font-semibold">
                      Ref: {generatedResult.reportReference}
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-left space-y-2 max-w-md mx-auto text-xs">
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
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className="text-emerald-400 font-semibold">Verified Authoritative</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <a
                      href={generatedResult.downloadUrl}
                      download
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/40 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PDF</span>
                    </a>
                    <button
                      onClick={() => window.open(generatedResult.downloadUrl, "_blank")}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all"
                    >
                      <Eye className="w-4 h-4 text-sky-400" />
                      <span>View in Browser</span>
                    </button>
                    <button
                      onClick={() => handlePrint(generatedResult.downloadUrl)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                    >
                      <Printer className="w-4 h-4 text-slate-400" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Form & Preview View */
                <div className="space-y-5">
                  {/* Report Type Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Report Statement Type
                    </label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value as PdfReportType)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition-all"
                    >
                      {REPORT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          [{opt.group}] {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Customer / Supplier Selectors if applicable */}
                  {reportType.startsWith("CUSTOMER") && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        Select Customer <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition-all"
                      >
                        <option value="">-- Choose Customer --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.customerCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {reportType.startsWith("SUPPLIER") && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        Select Supplier <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition-all"
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

                  {/* Period Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                        Accounting Period
                      </label>
                      <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as PeriodType)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition-all"
                      >
                        {PERIOD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {period === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1.5">
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
                          <label className="block text-xs font-semibold text-slate-400 mb-1.5">
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

                  {/* Options Toggles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                    <label className="flex items-center gap-2 p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 text-xs">
                      <input
                        type="checkbox"
                        checked={includeCharts}
                        onChange={(e) => setIncludeCharts(e.target.checked)}
                        className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                      />
                      <span>Visual Charts</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 text-xs">
                      <input
                        type="checkbox"
                        checked={includeNotes}
                        onChange={(e) => setIncludeNotes(e.target.checked)}
                        className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                      />
                      <span>Notes & Memos</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 text-xs">
                      <input
                        type="checkbox"
                        checked={isConfidential}
                        onChange={(e) => setIsConfidential(e.target.checked)}
                        className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                      />
                      <span>Confidential</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 text-xs">
                      <input
                        type="checkbox"
                        checked={isDraft}
                        onChange={(e) => setIsDraft(e.target.checked)}
                        className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                      />
                      <span>Watermark Draft</span>
                    </label>
                  </div>

                  {/* Preview Section */}
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Authoritative Server Preview
                      </span>
                      {isLoadingPreview && (
                        <span className="flex items-center gap-1.5 text-xs text-rose-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Calculating...</span>
                        </span>
                      )}
                    </div>

                    {preview ? (
                      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-white">{preview.reportTitle}</div>
                            <div className="text-[11px] text-slate-400">
                              {preview.businessName} • {preview.periodLabel}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono font-bold text-slate-300">
                              ~{preview.estimatedPages} {preview.estimatedPages === 1 ? "page" : "pages"}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {preview.estimatedRows} records
                            </div>
                          </div>
                        </div>

                        {preview.warning && (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                            <span>{preview.warning}</span>
                          </div>
                        )}

                        {preview.summaryCards.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            {preview.summaryCards.map((sc, idx) => (
                              <div
                                key={idx}
                                className="bg-slate-900 border border-slate-800 rounded-xl p-2.5"
                              >
                                <div className="text-[10px] text-slate-400">{sc.label}</div>
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
                    ) : (
                      !isLoadingPreview && (
                        <div className="text-xs text-slate-500 italic py-2 text-center">
                          {reportType.startsWith("CUSTOMER") && !customerId
                            ? "Select a customer to view statement preview."
                            : reportType.startsWith("SUPPLIER") && !supplierId
                            ? "Select a supplier to view statement preview."
                            : "Preview not available."}
                        </div>
                      )
                    )}
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {!generatedResult && (
              <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Verified Single Source of Accounting Truth</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || (reportType.startsWith("CUSTOMER") && !customerId) || (reportType.startsWith("SUPPLIER") && !supplierId)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Rendering PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Generate PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
