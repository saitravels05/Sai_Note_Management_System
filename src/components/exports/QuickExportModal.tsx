"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { generateExportAction, getExportPreviewAction } from "@/server/actions/export.actions";
import { type ExportType, type ExportFormat } from "@/server/services/export.service";
import { type PeriodType } from "@/server/services/analytics.service";

interface QuickExportModalProps {
  buttonText?: string;
  buttonClassName?: string;
  defaultExportType?: ExportType;
  allowedTypes?: { value: ExportType; label: string; description: string }[];
  filters?: Record<string, unknown>;
  partyId?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
}

const DEFAULT_EXPORT_TYPES: { value: ExportType; label: string; description: string }[] = [
  {
    value: "MONTHLY_WORKBOOK",
    label: "Monthly Accounting Workbook",
    description: "Complete 13-sheet executive package (Summary, Income, Expense, Payables, Receivables, Ledgers).",
  },
  {
    value: "FINANCIAL_SUMMARY",
    label: "Executive Financial Summary",
    description: "One-page P&L, Net Result, Cash Flow and Outstanding Working Capital.",
  },
  {
    value: "TRANSACTIONS",
    label: "All Transactions / Filtered View",
    description: "Every authorized transaction with date, party, category, amounts, and reference numbers.",
  },
  {
    value: "INCOME",
    label: "Income & Revenue Statement",
    description: "Detailed breakdown of flight bookings, holiday packages, visa fees & commissions.",
  },
  {
    value: "EXPENSES",
    label: "Expenses & Overhead Statement",
    description: "Operating costs, airline ticket settlements, hotel disbursements & office overheads.",
  },
  {
    value: "RECEIVABLES",
    label: "Accounts Receivable (Customer Dues)",
    description: "Pending customer invoices, partial payments received, and overdue debt aging.",
  },
  {
    value: "PAYABLES",
    label: "Accounts Payable (Vendor Dues)",
    description: "Outstanding liabilities to airlines, tour operators, and transport suppliers.",
  },
  {
    value: "PAYMENTS",
    label: "Cash & Bank Settlements",
    description: "Bank transfers, UPI receipts, cash collections and vendor payouts.",
  },
  {
    value: "CUSTOMER_SUMMARY",
    label: "Customer Account Summary",
    description: "Consolidated billing, payments received, and balance per customer.",
  },
  {
    value: "SUPPLIER_SUMMARY",
    label: "Supplier Liability Summary",
    description: "Consolidated billings, settlements, and outstanding dues per supplier.",
  },
  {
    value: "RECEIVABLE_AGING",
    label: "Receivable Aging Schedule",
    description: "Debt aging distributed into 5 buckets (Current, 1-30, 31-60, 61-90, 90+ days).",
  },
  {
    value: "PAYABLE_AGING",
    label: "Payable Aging Schedule",
    description: "Vendor liabilities distributed into 5 aging buckets.",
  },
];

export function QuickExportModal({
  buttonText = "Export Data",
  buttonClassName,
  defaultExportType = "MONTHLY_WORKBOOK",
  allowedTypes,
  filters,
  partyId,
  period = "this-month",
  startDate,
  endDate,
}: QuickExportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportType, setExportType] = useState<ExportType>(defaultExportType);
  const [format, setFormat] = useState<ExportFormat>("EXCEL");
  const [selectedPeriod, setSelectedPeriod] = useState<string>(period);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<{
    estimatedRows: number;
    estimatedSheets: number;
    periodLabel: string;
  } | null>(null);
  const [result, setResult] = useState<{
    fileName: string;
    downloadUrl: string;
    fileSize: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const typeList = allowedTypes || DEFAULT_EXPORT_TYPES;

  const handleOpen = async () => {
    setIsOpen(true);
    setError(null);
    setResult(null);

    // Fetch initial preview
    try {
      const prev = await getExportPreviewAction({
        exportType,
        period: selectedPeriod as PeriodType,
        startDate,
        endDate,
        partyId,
      });
      if (prev.success && prev.data) {
        setPreviewData({
          estimatedRows: prev.data.estimatedRows,
          estimatedSheets: prev.data.estimatedSheets,
          periodLabel: prev.data.periodLabel,
        });
      }
    } catch {
      // preview error non-blocking
    }
  };

  const handleTypeChange = async (newType: ExportType) => {
    setExportType(newType);
    setError(null);
    setResult(null);
    try {
      const prev = await getExportPreviewAction({
        exportType: newType,
        period: selectedPeriod as PeriodType,
        startDate,
        endDate,
        partyId,
      });
      if (prev.success && prev.data) {
        setPreviewData({
          estimatedRows: prev.data.estimatedRows,
          estimatedSheets: prev.data.estimatedSheets,
          periodLabel: prev.data.periodLabel,
        });
      }
    } catch {
      // ignore
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await generateExportAction({
        exportType,
        format,
        period: selectedPeriod,
        startDate,
        endDate,
        filters: filters as Record<string, unknown> | undefined,
        partyId,
      });

      if (!res.success || !res.data) {
        setError(res.error || "Failed to generate report.");
      } else {
        setResult({
          fileName: res.data.fileName,
          downloadUrl: res.data.downloadUrl,
          fileSize: res.data.fileSize,
        });
        // Auto trigger browser download
        const a = document.createElement("a");
        a.href = res.data.downloadUrl;
        a.download = res.data.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className={
          buttonClassName ||
          "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-all"
        }
      >
        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
        <span>{buttonText}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Generate Accounting Export</h3>
                  <p className="text-xs text-slate-400">
                    Verified figures derived directly from PostgreSQL accounting engine
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Error Alert */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success Result */}
              {result && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Export Generated & Download Triggered!</span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono bg-slate-950/60 p-2.5 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                    <span className="truncate">{result.fileName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {(result.fileSize / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className="pt-1 flex items-center justify-end">
                    <a
                      href={result.downloadUrl}
                      download={result.fileName}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Again
                    </a>
                  </div>
                </div>
              )}

              {/* Report Type Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Report Package</label>
                <select
                  value={exportType}
                  onChange={(e) => handleTypeChange(e.target.value as ExportType)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  {typeList.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  {typeList.find((t) => t.value === exportType)?.description}
                </p>
              </div>

              {/* Format Toggle: Excel vs CSV */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">File Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormat("EXCEL")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-semibold transition-all ${
                      format === "EXCEL"
                        ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-900/20"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormat("CSV")}
                    className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-semibold transition-all ${
                      format === "CSV"
                        ? "bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-900/20"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span>CSV (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Period Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Reporting Scope</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => {
                    setSelectedPeriod(e.target.value);
                    handleTypeChange(exportType);
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="this-month">This Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="this-quarter">This Quarter</option>
                  <option value="this-year">This Financial Year</option>
                  <option value="last-year">Last Financial Year</option>
                  <option value="all">All Authorized Records</option>
                </select>
              </div>

              {/* Scope & Size Preview Card */}
              {previewData && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Layers className="w-3.5 h-3.5 text-orange-400" />
                      Scope Preview:
                    </span>
                    <span className="font-semibold text-slate-200">{previewData.periodLabel}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Estimated Rows</span>
                      <span className="font-bold text-white text-sm">{previewData.estimatedRows} records</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Worksheet Structure</span>
                      <span className="font-bold text-white text-sm">{previewData.estimatedSheets} sheet(s)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Guarantees */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                <p>• <strong>Source of Truth:</strong> Values calculated exclusively server-side via Phase 5 Accounting Engine.</p>
                <p>• <strong>Security:</strong> Text cells are sanitized against spreadsheet formula injection (=, +, -, @).</p>
                <p>• <strong>Unicode:</strong> UTF-8 BOM is embedded to safeguard Tamil names and notes.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-950/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Workbook...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Generate & Download</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
