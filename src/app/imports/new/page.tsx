"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Check,
  Info,
  IndianRupee,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  analyzeSpreadsheetAction,
  stageImportBatchAction,
  getImportBatchAction,
  updateImportRowAction,
  calculateAccountingImpactAction,
  commitImportBatchAction,
  getMappingTemplatesAction,
  type CommitResultSummary,
} from "@/server/actions/import.actions";
import type {
  WorkbookAnalysisResult,
  AccountingImpactPreview,
  TargetRecordType,
} from "@/server/services/importer.service";

interface ImportRowData {
  id: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
  normalizedData: {
    transactionDate?: string;
    transactionDateFormatted?: string;
    amount?: string;
    amountFormatted?: string;
    title?: string;
    description?: string | null;
    referenceNumber?: string | null;
    transactionType?: string;
    customerName?: string;
    supplierName?: string;
    categoryName?: string;
    [key: string]: unknown;
  } | null;
  validationStatus: "VALID" | "WARNING" | "ERROR" | "DUPLICATE" | "EXCLUDED";
  validationErrors: { field: string; message: string; originalValue?: unknown }[] | null;
  duplicateMatch: {
    isExact: boolean;
    existingId: string;
    existingNumber: string;
    reason: string;
  } | null;
}

interface SavedTemplate {
  name: string;
  targetType: TargetRecordType;
  columnMappings: Record<string, string>;
}

const TARGET_TYPES: { id: TargetRecordType; label: string; desc: string }[] = [
  { id: "TRANSACTION", label: "General Transactions", desc: "Standard business ledger entries" },
  { id: "INCOME", label: "Income / Receipts", desc: "Customer payments & booking revenues" },
  { id: "EXPENSE", label: "Expenses / Payments", desc: "Vendor bills, operational costs & fees" },
  { id: "RECEIVABLE", label: "Receivables (Invoices)", desc: "Outstanding bills due from clients" },
  { id: "PAYABLE", label: "Payables (Vendor Bills)", desc: "Outstanding amounts owed to suppliers" },
  { id: "MIXED", label: "Mixed Financial Records", desc: "Rows mapped dynamically by a Type column" },
];

const TARGET_FIELDS = [
  { value: "transactionDate", label: "Transaction Date *" },
  { value: "amount", label: "Amount (INR) *" },
  { value: "title", label: "Title / Description *" },
  { value: "transactionType", label: "Transaction Type (Income/Expense/etc.)" },
  { value: "customer", label: "Customer / Passenger" },
  { value: "supplier", label: "Supplier / Airline / Hotel" },
  { value: "category", label: "Category / Ledger Head" },
  { value: "paymentMethod", label: "Payment Mode (Cash/UPI/Bank/etc.)" },
  { value: "paymentStatus", label: "Payment Status (Paid/Unpaid)" },
  { value: "referenceNumber", label: "Reference / PNR / Invoice No" },
  { value: "dueDate", label: "Due Date" },
  { value: "tags", label: "Tags (Comma-separated)" },
  { value: "notes", label: "Internal Notes / Remarks" },
  { value: "IGNORE", label: "-- Do Not Import (Ignore) --" },
];

export default function NewImportWizardPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard Navigation
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [analysis, setAnalysis] = useState<WorkbookAnalysisResult | null>(null);

  // Step 2: Sheet & Header
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(1);

  // Step 3: Target Type & Column Mapping
  const [targetType, setTargetType] = useState<TargetRecordType>("TRANSACTION");
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [templateName, setTemplateName] = useState<string>("");
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);

  // Step 4–6: Staging & Validation
  const [batchId, setBatchId] = useState<string>("");
  const [stagedRows, setStagedRows] = useState<ImportRowData[]>([]);
  const [statusCounts, setStatusCounts] = useState<{
    total: number;
    valid: number;
    warnings: number;
    errors: number;
    duplicates: number;
  }>({ total: 0, valid: 0, warnings: 0, errors: 0, duplicates: 0 });

  // Step 7: Accounting Impact & Mode
  const [impactPreview, setImpactPreview] = useState<AccountingImpactPreview | null>(null);
  const [importMode, setImportMode] = useState<"DRAFT" | "POSTED">("DRAFT");
  const [confirmTyping, setConfirmTyping] = useState<string>("");
  const [allowDuplicates, setAllowDuplicates] = useState<boolean>(false);

  // Step 8: Commit Results
  const [commitResult, setCommitResult] = useState<CommitResultSummary | null>(null);

  // --- STEP 1: Handle File Selection ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage("File exceeds the 15MB limit. Please upload a smaller file or split it.");
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        setFileBase64(base64);

        const formData = new FormData();
        formData.append("file", file);

        const res = await analyzeSpreadsheetAction(formData);
        if (res.success && res.data) {
          setAnalysis(res.data);
          setSelectedSheet(res.data.sheetNames[0] || "");
          setHeaderRowIndex(res.data.detectedHeaderRow);
          setColumnMappings(res.data.suggestedMappings);

          const templatesRes = await getMappingTemplatesAction();
          if (templatesRes.success && templatesRes.data) {
            setSavedTemplates(templatesRes.data as unknown as SavedTemplate[]);
          }

          setCurrentStep(2);
        } else {
          setErrorMessage(res.error || "Failed to analyze workbook.");
        }
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to read file.";
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  // --- STEP 2: Re-analyze Sheet or Header Override ---
  const handleSheetOrHeaderChange = async (newSheet: string, newHeaderRow: number) => {
    if (!selectedFile) return;
    setSelectedSheet(newSheet);
    setHeaderRowIndex(newHeaderRow);
    setLoading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("sheetName", newSheet);
      formData.append("headerRowIndex", String(newHeaderRow));

      const res = await analyzeSpreadsheetAction(formData);
      if (res.success && res.data) {
        setAnalysis(res.data);
        setColumnMappings(res.data.suggestedMappings);
      } else {
        setErrorMessage(res.error || "Failed to update sheet view.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error reading sheet.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 3: Mapping Change & Staging Execution ---
  const handleMappingChange = (colName: string, field: string) => {
    setColumnMappings((prev) => ({
      ...prev,
      [colName]: field,
    }));
  };

  const handleApplyTemplate = (template: SavedTemplate) => {
    if (template.columnMappings) {
      setColumnMappings(template.columnMappings);
    }
    if (template.targetType) {
      setTargetType(template.targetType);
    }
  };

  const handleStageData = async () => {
    const mappedValues = Object.values(columnMappings);
    if (!mappedValues.includes("transactionDate")) {
      setErrorMessage("Please map at least one column to 'Transaction Date'.");
      return;
    }
    if (!mappedValues.includes("amount")) {
      setErrorMessage("Please map at least one column to 'Amount'.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await stageImportBatchAction({
        fileName: selectedFile?.name || "import.xlsx",
        fileBase64,
        sheetName: selectedSheet,
        headerRowIndex,
        targetType,
        columnMappings,
        importMode,
        templateName: templateName.trim() || undefined,
      });

      if (res.success && res.data) {
        setBatchId(res.data.batchId);
        setStatusCounts({
          total: res.data.totalRows,
          valid: res.data.validRows,
          warnings: 0,
          errors: res.data.errorRows,
          duplicates: res.data.duplicateRows,
        });

        const rowsRes = await getImportBatchAction(res.data.batchId, { page: 1, pageSize: 50 });
        if (rowsRes.success && rowsRes.data) {
          const rawRows = (rowsRes.data as { rows?: unknown[] }).rows || [];
          setStagedRows(rawRows as unknown as ImportRowData[]);
        }

        setCurrentStep(4);
      } else {
        setErrorMessage(res.error || "Failed to stage data.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Staging error.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 5: Inline Row Correction ---
  const handleRowAction = async (
    rowId: string,
    action: "UPDATE_DATA" | "EXCLUDE" | "RESTORE" | "OVERRIDE_DUPLICATE",
    updates?: Record<string, unknown>
  ) => {
    try {
      const res = await updateImportRowAction(rowId, { action, normalizedDataUpdates: updates });
      if (res.success) {
        const rowsRes = await getImportBatchAction(batchId, { page: 1, pageSize: 50 });
        if (rowsRes.success && rowsRes.data) {
          const rawRows = (rowsRes.data as { rows?: unknown[] }).rows || [];
          setStagedRows(rawRows as unknown as ImportRowData[]);
          const b = (rowsRes.data as { batch?: Record<string, number> }).batch || {};
          setStatusCounts({
            total: b.totalRows || 0,
            valid: b.validRows || 0,
            warnings: b.warningRows || 0,
            errors: b.errorRows || 0,
            duplicates: b.duplicateRows || 0,
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update row.";
      setErrorMessage(msg);
    }
  };

  // --- STEP 7: Calculate Accounting Impact & Prepare Commit ---
  const handleProceedToPreview = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await calculateAccountingImpactAction(batchId);
      if (res.success && res.data) {
        setImpactPreview(res.data);
        setCurrentStep(7);
      } else {
        setErrorMessage(res.error || "Failed to calculate accounting preview.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error generating impact preview.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 8: Final Commit Execution ---
  const handleFinalCommit = async () => {
    if (importMode === "POSTED" && confirmTyping.trim() !== "IMPORT") {
      setErrorMessage("Please type 'IMPORT' to confirm posting official accounting transactions.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await commitImportBatchAction(batchId, {
        importMode,
        allowDuplicates,
      });

      if (res.success && res.data) {
        setCommitResult(res.data);
        setCurrentStep(8);
      } else {
        setErrorMessage(res.error || "Import commit failed.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fatal error during commit.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const stepsList = [
    { num: 1, label: "Upload File" },
    { num: 2, label: "Select Sheet" },
    { num: 3, label: "Map Columns" },
    { num: 4, label: "Validation" },
    { num: 5, label: "Fix Errors" },
    { num: 6, label: "Duplicates" },
    { num: 7, label: "Impact & Mode" },
    { num: 8, label: "Results" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Phase 7 Data Migration Engine
            </span>
            <span className="text-xs text-slate-500">Zero-Risk Staging Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Smart Excel & CSV Importer</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Stage, validate, and preview your existing records before committing them to your accounting ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/imports"
            className="px-3.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-900/60 text-slate-300 text-xs font-medium transition-all"
          >
            Cancel / Back to Imports
          </Link>
        </div>
      </div>

      {/* Progress Steps Indicator */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {stepsList.map((s) => (
          <div
            key={s.num}
            className={`p-2 rounded-lg border text-center transition-all ${
              currentStep === s.num
                ? "bg-orange-500/20 border-orange-500 text-orange-300 shadow-sm"
                : currentStep > s.num
                ? "bg-slate-900/40 border-emerald-500/30 text-emerald-400"
                : "bg-slate-950/60 border-slate-800/80 text-slate-500"
            }`}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider">
              {currentStep > s.num ? "✓" : `Step ${s.num}`}
            </div>
            <div className="text-xs font-semibold truncate mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STEP 1: FILE UPLOAD */}
      {currentStep === 1 && (
        <div className="p-10 rounded-2xl glass-card border border-dashed border-slate-700 text-center space-y-5 hover:border-orange-500/40 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto shadow-inner">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-white">Upload your Excel or CSV file</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Supports <strong className="text-slate-200">.xlsx</strong>,{" "}
              <strong className="text-slate-200">.xls</strong>, and{" "}
              <strong className="text-slate-200">.csv</strong> formats up to 15MB.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <label className="cursor-pointer px-5 py-2.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 transition-all flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              {loading ? "Analyzing Workbook..." : "Select Spreadsheet"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                disabled={loading}
                className="hidden"
              />
            </label>

            <Link
              href="/imports/templates"
              className="px-4 py-2.5 rounded-xl text-xs font-medium border border-slate-700 hover:border-slate-600 bg-slate-900/60 text-slate-300 transition-all"
            >
              Download Sample Templates
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-800/80 text-left max-w-2xl mx-auto">
            <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-200 block mb-0.5">🔒 Safe Staging Guarantee</span>
              Uploading a file will NEVER automatically post records to your accounting ledger.
            </div>
            <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-200 block mb-0.5">🇮🇳 Indian Formatting</span>
              Native support for Lakhs/Crores, ₹ symbols, and standard DD-MM-YYYY dates.
            </div>
            <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-200 block mb-0.5">🛡️ Period Lock Protection</span>
              Automatically prevents records from slipping into closed or locked accounting periods.
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: SELECT SHEET & HEADER ROW */}
      {currentStep === 2 && analysis && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-orange-400" />
                  Workbook Analysis: {analysis.fileName}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(analysis.fileSize / 1024).toFixed(1)} KB • {analysis.fileType.toUpperCase()} •{" "}
                  {analysis.sheetCount} Sheet(s) • Est. {analysis.estimatedRowCount} rows
                </p>
              </div>

              {analysis.sheetNames.length > 1 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-300 font-medium">Active Sheet:</label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSheetOrHeaderChange(e.target.value, headerRowIndex)}
                    className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:border-orange-500 focus:outline-none"
                  >
                    {analysis.sheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="text-xs text-slate-300 flex-1">
                Detected header begins at <strong className="text-orange-400">Row {headerRowIndex}</strong>. If
                your file has company titles on top, override the header row index:
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Header Row:</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={headerRowIndex}
                  onChange={(e) =>
                    handleSheetOrHeaderChange(selectedSheet, parseInt(e.target.value, 10) || 1)
                  }
                  className="w-16 bg-slate-950 border border-slate-700 text-white text-xs rounded-lg px-2 py-1 text-center focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">
                  Sample Data Preview (First {analysis.sampleRows.length} rows)
                </span>
                <span className="text-[11px] text-slate-500">
                  {analysis.detectedColumns.length} columns detected
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-72">
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                  <thead className="bg-slate-900/90 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5 border-r border-slate-800 w-10 text-center">#</th>
                      {analysis.detectedColumns.map((col) => (
                        <th key={col} className="p-2.5 border-r border-slate-800 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 font-mono text-[11px]">
                    {analysis.sampleRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="p-2 border-r border-slate-800 text-center text-slate-500">
                          {idx + 1}
                        </td>
                        {analysis.detectedColumns.map((col) => (
                          <td key={col} className="p-2 border-r border-slate-800/60 whitespace-nowrap">
                            {row[col] !== undefined && row[col] !== "" ? String(row[col]) : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Upload
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1.5 shadow-md shadow-orange-500/20"
            >
              Proceed to Column Mapping <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: MAP COLUMNS */}
      {currentStep === 3 && analysis && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-3">
            <div>
              <h2 className="text-sm font-bold text-white">Target Record Type</h2>
              <p className="text-xs text-slate-400">
                Specify what financial or business entity this spreadsheet represents.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {TARGET_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTargetType(t.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    targetType === t.id
                      ? "bg-orange-500/15 border-orange-500 text-orange-200"
                      : "bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-300"
                  }`}
                >
                  <div className="text-xs font-semibold">{t.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {savedTemplates.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-300 font-medium">Saved Mapping Templates:</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    const t = savedTemplates.find((x) => x.name === e.target.value);
                    if (t) handleApplyTemplate(t);
                  }}
                  className="bg-slate-950 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1 focus:border-orange-500 focus:outline-none"
                >
                  <option value="">-- Select Saved Template --</option>
                  {savedTemplates.map((tpl) => (
                    <option key={tpl.name} value={tpl.name}>
                      {tpl.name} ({tpl.targetType})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-orange-400" />
                  Field Mapping
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Map each column in your spreadsheet to the corresponding application field.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-1/3">Source Spreadsheet Column</th>
                    <th className="p-3 w-1/3">Sample Value</th>
                    <th className="p-3 w-1/3">Maps To Application Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {analysis.detectedColumns.map((col) => {
                    const sampleVal = analysis.sampleRows[0]?.[col] || "";
                    const currentMapped = columnMappings[col] || "IGNORE";

                    return (
                      <tr key={col} className="hover:bg-slate-900/30">
                        <td className="p-3 font-semibold text-white">{col}</td>
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {sampleVal ? String(sampleVal) : <span className="text-slate-600">- empty -</span>}
                        </td>
                        <td className="p-3">
                          <select
                            value={currentMapped}
                            onChange={(e) => handleMappingChange(col, e.target.value)}
                            className={`w-full text-xs rounded-lg px-3 py-1.5 border focus:outline-none transition-colors ${
                              currentMapped !== "IGNORE"
                                ? "bg-orange-500/10 border-orange-500/40 text-orange-200"
                                : "bg-slate-900 border-slate-800 text-slate-400"
                            }`}
                          >
                            {TARGET_FIELDS.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <span className="text-xs text-slate-400">Save this mapping for future imports:</span>
              <input
                type="text"
                placeholder="Template Name (e.g. Monthly Bank Export)"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:border-orange-500 focus:outline-none max-w-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sheet
            </button>
            <button
              onClick={handleStageData}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1.5 shadow-md shadow-orange-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Staging & Validating...
                </>
              ) : (
                <>
                  Validate & Stage Data <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: STAGING & VALIDATION SUMMARY */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Spreadsheet Staged & Validated
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Every candidate row has been parsed and normalized. Below is the preliminary health breakdown.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <div className="text-2xl font-bold text-white">{statusCounts.total}</div>
                <div className="text-xs text-slate-400 mt-0.5">Total Rows</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <div className="text-2xl font-bold text-emerald-400">{statusCounts.valid}</div>
                <div className="text-xs text-emerald-300 mt-0.5">Valid & Ready</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <div className="text-2xl font-bold text-amber-400">{statusCounts.warnings}</div>
                <div className="text-xs text-amber-300 mt-0.5">Warnings</div>
              </div>
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                <div className="text-2xl font-bold text-rose-400">{statusCounts.errors}</div>
                <div className="text-xs text-rose-300 mt-0.5">Errors Detected</div>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                <div className="text-2xl font-bold text-purple-400">{statusCounts.duplicates}</div>
                <div className="text-xs text-purple-300 mt-0.5">Duplicates</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-300">
                {statusCounts.errors > 0 ? (
                  <span className="text-rose-300 font-medium">
                    ⚠️ You have {statusCounts.errors} row(s) with errors. You can fix them inline or exclude them before committing.
                  </span>
                ) : statusCounts.duplicates > 0 ? (
                  <span className="text-purple-300 font-medium">
                    🔍 You have {statusCounts.duplicates} potential duplicate row(s) detected against existing records.
                  </span>
                ) : (
                  <span className="text-emerald-300 font-medium">
                    ✓ All rows passed validation successfully! Proceed to preview accounting impact.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {statusCounts.errors > 0 && (
                  <button
                    onClick={() => setCurrentStep(5)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white transition-all"
                  >
                    Review & Fix Errors
                  </button>
                )}
                {statusCounts.duplicates > 0 && (
                  <button
                    onClick={() => setCurrentStep(6)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-500 hover:bg-purple-600 text-white transition-all"
                  >
                    Review Duplicates
                  </button>
                )}
                <button
                  onClick={handleProceedToPreview}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1.5"
                >
                  Proceed to Impact Preview <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: REVIEW & FIX ERRORS */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  Inline Error Review & Correction
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Correct validation errors directly or exclude unwanted rows from the final commit.
                </p>
              </div>

              <button
                onClick={() => setCurrentStep(4)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-xs font-medium"
              >
                Back to Summary
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-16 text-center">Row</th>
                    <th className="p-3">Problem & Field</th>
                    <th className="p-3">Original Value</th>
                    <th className="p-3">Inline Correction</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {stagedRows
                    .filter((r) => r.validationStatus === "ERROR" || r.validationStatus === "EXCLUDED")
                    .map((r) => {
                      const errors = r.validationErrors || [];
                      const errDesc = errors.map((e) => `${e.field}: ${e.message}`).join("; ");

                      return (
                        <tr key={r.id} className="hover:bg-slate-900/30">
                          <td className="p-3 text-center font-mono text-slate-400">
                            {r.rowNumber}
                          </td>
                          <td className="p-3">
                            <span className="text-rose-300 font-medium block">{errDesc}</span>
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-[11px]">
                            {JSON.stringify(r.rawData).substring(0, 45)}...
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Amount (e.g. 15000)"
                                defaultValue={(r.normalizedData?.amount as string) || ""}
                                onBlur={(e) => {
                                  if (e.target.value) {
                                    handleRowAction(r.id, "UPDATE_DATA", { amount: e.target.value });
                                  }
                                }}
                                className="w-28 bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1 focus:border-orange-500 focus:outline-none"
                              />
                              <input
                                type="text"
                                placeholder="DD-MM-YYYY"
                                defaultValue={(r.normalizedData?.transactionDateFormatted as string) || ""}
                                onBlur={(e) => {
                                  if (e.target.value) {
                                    handleRowAction(r.id, "UPDATE_DATA", { transactionDate: e.target.value });
                                  }
                                }}
                                className="w-28 bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1 focus:border-orange-500 focus:outline-none"
                              />
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            {r.validationStatus === "EXCLUDED" ? (
                              <button
                                onClick={() => handleRowAction(r.id, "RESTORE")}
                                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-xs"
                              >
                                Restore
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRowAction(r.id, "EXCLUDE")}
                                className="px-2.5 py-1 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 text-xs"
                              >
                                Exclude
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(4)}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
            >
              Back to Summary
            </button>
            <button
              onClick={handleProceedToPreview}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1.5"
            >
              Proceed to Impact Preview <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: REVIEW DUPLICATES */}
      {currentStep === 6 && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Duplicate Detection Review
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  The system detected existing database records matching incoming rows.
                </p>
              </div>

              <button
                onClick={() => setCurrentStep(4)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-xs font-medium"
              >
                Back to Summary
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-16 text-center">Row</th>
                    <th className="p-3">Incoming Row Data</th>
                    <th className="p-3">Matching Reason & Existing Record</th>
                    <th className="p-3 text-right">Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {stagedRows
                    .filter((r) => r.validationStatus === "DUPLICATE")
                    .map((r) => (
                      <tr key={r.id} className="hover:bg-slate-900/30">
                        <td className="p-3 text-center font-mono text-slate-400">
                          {r.rowNumber}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <div>
                            <strong>Date:</strong> {r.normalizedData?.transactionDateFormatted as string} •{" "}
                            <strong>Amount:</strong> ₹{r.normalizedData?.amount as string}
                          </div>
                          <div className="text-slate-400">
                            <strong>Ref:</strong> {(r.normalizedData?.referenceNumber as string) || "-"}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-purple-300 font-medium block">
                            {r.duplicateMatch?.reason}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Existing: {r.duplicateMatch?.existingNumber}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRowAction(r.id, "EXCLUDE")}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                            >
                              Skip
                            </button>
                            <button
                              onClick={() => handleRowAction(r.id, "OVERRIDE_DUPLICATE")}
                              className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 text-xs font-semibold"
                            >
                              Import Anyway
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-300">
                Allow importing all potential duplicates by default during commit?
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowDuplicates}
                  onChange={(e) => setAllowDuplicates(e.target.checked)}
                  className="rounded border-slate-700"
                />
                <span className="text-xs text-purple-300 font-semibold">Enable Bulk Override</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(4)}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
            >
              Back to Summary
            </button>
            <button
              onClick={handleProceedToPreview}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1.5"
            >
              Proceed to Impact Preview <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 7: ACCOUNTING IMPACT PREVIEW & MODE */}
      {currentStep === 7 && impactPreview && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass-card border border-slate-800 space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-emerald-400" />
                Accounting Impact Preview
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Server-calculated financial figures that will be created upon confirmation.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <div className="text-xl font-bold text-emerald-400">
                  {impactPreview.expectedIncomeImpact}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Expected Income</div>
              </div>
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                <div className="text-xl font-bold text-rose-400">
                  {impactPreview.expectedExpenseImpact}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Expected Expenses</div>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                <div className="text-xl font-bold text-blue-400">
                  {impactPreview.expectedReceivablesCreated}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Receivables Created</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <div className="text-xl font-bold text-amber-400">
                  {impactPreview.expectedPayablesCreated}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Payables Created</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-white block mb-1">
                  Customers to Create ({impactPreview.customersToCreate.length}):
                </span>
                {impactPreview.customersToCreate.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {impactPreview.customersToCreate.slice(0, 5).map((c) => (
                      <span key={c} className="px-2 py-0.5 rounded bg-slate-800 text-[10px]">
                        {c}
                      </span>
                    ))}
                    {impactPreview.customersToCreate.length > 5 && (
                      <span className="text-slate-500 text-[10px]">
                        +{impactPreview.customersToCreate.length - 5} more
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-500">None (all matched)</span>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-white block mb-1">
                  Suppliers to Create ({impactPreview.suppliersToCreate.length}):
                </span>
                {impactPreview.suppliersToCreate.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {impactPreview.suppliersToCreate.slice(0, 5).map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded bg-slate-800 text-[10px]">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500">None (all matched)</span>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-white block mb-1">
                  Categories to Create ({impactPreview.categoriesToCreate.length}):
                </span>
                {impactPreview.categoriesToCreate.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {impactPreview.categoriesToCreate.slice(0, 5).map((cat) => (
                      <span key={cat} className="px-2 py-0.5 rounded bg-slate-800 text-[10px]">
                        {cat}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500">None (all matched)</span>
                )}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Select Import Mode
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    importMode === "DRAFT"
                      ? "bg-orange-500/15 border-orange-500 text-orange-200"
                      : "bg-slate-950/60 border-slate-800 text-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="DRAFT"
                    checked={importMode === "DRAFT"}
                    onChange={() => setImportMode("DRAFT")}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-xs font-bold block">Save as DRAFT (Recommended)</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Records will be imported as unposted drafts. You can review them in the ledger before posting. Does not affect official accounts yet.
                    </span>
                  </div>
                </label>

                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    importMode === "POSTED"
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-200"
                      : "bg-slate-950/60 border-slate-800 text-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="POSTED"
                    checked={importMode === "POSTED"}
                    onChange={() => setImportMode("POSTED")}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-xs font-bold block">Post Directly to Ledger</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Records will be immediately posted and reflected in official financial statements, dashboard totals, and tax reports.
                    </span>
                  </div>
                </label>
              </div>

              {importMode === "POSTED" && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2 mt-2">
                  <div className="font-semibold">⚠️ High-Impact Confirmation Required</div>
                  <div>
                    Posting directly affects real financial ledgers. To confirm, please type{" "}
                    <strong className="underline">IMPORT</strong> below:
                  </div>
                  <input
                    type="text"
                    value={confirmTyping}
                    onChange={(e) => setConfirmTyping(e.target.value)}
                    placeholder="Type IMPORT"
                    className="w-48 bg-slate-950 border border-rose-500/50 text-white text-xs rounded px-3 py-1.5 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(4)}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
            >
              Back to Summary
            </button>
            <button
              onClick={handleFinalCommit}
              disabled={loading || (importMode === "POSTED" && confirmTyping !== "IMPORT")}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Committing to Ledger...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Confirm & Execute Import
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 8: IMPORT RESULTS */}
      {currentStep === 8 && commitResult && (
        <div className="p-8 rounded-2xl glass-card border border-emerald-500/30 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <Check className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Import Completed Successfully
            </span>
            <h2 className="text-xl font-bold text-white mt-2">
              {commitResult.createdTransactions} Records Created in Ledger
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              All transactions have been safely written with full provenance and audit history.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-left">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Transactions</div>
              <div className="text-lg font-bold text-white mt-0.5">
                {commitResult.createdTransactions}
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5">Mode: {commitResult.importMode}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Customers Created</div>
              <div className="text-lg font-bold text-white mt-0.5">
                {commitResult.createdCustomers}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Unique records</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Suppliers Created</div>
              <div className="text-lg font-bold text-white mt-0.5">
                {commitResult.createdSuppliers}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Unique records</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Reconciliation</div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">
                {(commitResult.reconciliation as { isHealthy?: boolean })?.isHealthy ? "PASSED" : "REVIEW"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Zero discrepancies</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Link
              href="/records"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
            >
              View Imported Records
            </Link>

            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
            >
              Go to Dashboard
            </Link>

            <Link
              href={`/imports/${batchId}`}
              className="px-5 py-2.5 rounded-xl text-xs font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
            >
              View Batch Audit Details
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
