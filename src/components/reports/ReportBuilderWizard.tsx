"use client";

import { useState, useTransition } from "react";
import {
  FileText,
  Calendar,
  Filter,
  Columns,
  Layers,
  Calculator,
  ArrowUpDown,
  GitCompare,
  BarChart2,
  Eye,
  Save,
  Download,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info,
  X,
  FileSpreadsheet,
} from "lucide-react";
import {
  DATASET_REGISTRY,
  type DatasetDefinition,
} from "@/server/services/reporting/dataset-registry";
import { FINANCIAL_MEASURE_REGISTRY } from "@/server/services/reporting/measure-registry";
import {
  previewCustomReportAction,
  saveCustomReportAction,
  getDrillDownAction,
  proposeAiReportAction,
} from "@/server/actions/custom-report.actions";
import { type ReportDefinition } from "@/server/services/reporting/report-query-planner";
import { type CustomReportExecutionResult } from "@/server/services/reporting/custom-report.service";
import { type AIReportProposalResult } from "@/server/services/reporting/ai-report-planner.service";

interface ReportBuilderWizardProps {
  businessName: string;
  userPermissions?: string[];
  userRoles?: string[];
  initialDefinition?: ReportDefinition;
}

export function ReportBuilderWizard({
  businessName,
  initialDefinition,
}: ReportBuilderWizardProps) {
  const [isPending, startTransition] = useTransition();

  // Step state (0 to 9)
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Core Definition State
  const [definition, setDefinition] = useState<ReportDefinition>(
    initialDefinition || {
      version: 1,
      name: "Custom Management Report",
      description: "Custom operational and financial report.",
      datasetId: "TRANSACTIONS",
      period: { type: "THIS_MONTH", asClosed: false },
      filterGroups: [],
      columns: [
        { columnId: "date" },
        { columnId: "transactionNumber" },
        { columnId: "type" },
        { columnId: "partyName" },
        { columnId: "categoryName" },
        { columnId: "amount" },
        { columnId: "paymentStatus" },
      ],
      grouping: ["categoryName"],
      measures: ["RECOGNIZED_INCOME", "RECOGNIZED_EXPENSES", "NET_RESULT"],
      sort: { columnId: "date", direction: "desc" },
      topN: 10,
      chart: { enabled: true, type: "BAR", title: "Activity by Category" },
    }
  );

  // Preview Result State
  const [previewResult, setPreviewResult] = useState<CustomReportExecutionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Drill-down State
  const [drillDownData, setDrillDownData] = useState<{
    groupField: string;
    groupValue: string;
    parentAggregateTotal: number;
    drillDownSum: number;
    reconciled: boolean;
    records: Record<string, unknown>[];
    totalCount: number;
  } | null>(null);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);

  // AI Assistant Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState<AIReportProposalResult | null>(null);

  // Current Dataset Definition
  const currentDataset: DatasetDefinition =
    DATASET_REGISTRY[definition.datasetId] || DATASET_REGISTRY.TRANSACTIONS;

  const steps = [
    { title: "Dataset", icon: FileText, desc: "Select source data" },
    { title: "Period", icon: Calendar, desc: "Date range & mode" },
    { title: "Filters", icon: Filter, desc: "Target criteria" },
    { title: "Columns", icon: Columns, desc: "Choose fields" },
    { title: "Grouping", icon: Layers, desc: "Summarize by" },
    { title: "Measures", icon: Calculator, desc: "Financial metrics" },
    { title: "Sorting", icon: ArrowUpDown, desc: "Order & Top N" },
    { title: "Compare", icon: GitCompare, desc: "Period comparison" },
    { title: "Charts", icon: BarChart2, desc: "Visualization" },
    { title: "Preview", icon: Eye, desc: "Review & Export" },
  ];

  // Run preview
  const handleRunPreview = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await previewCustomReportAction(definition);
      if (res.success) {
        setPreviewResult(res.data);
      } else {
        setErrorMsg(res.error);
      }
    });
  };

  // Run drill-down
  const handleDrillDown = (groupField: string, groupValue: string) => {
    startTransition(async () => {
      const res = await getDrillDownAction(definition, groupField, groupValue);
      if (res.success) {
        setDrillDownData(res.data);
        setIsDrillDownOpen(true);
      } else {
        setErrorMsg(res.error);
      }
    });
  };

  // Save report
  const handleSave = () => {
    setErrorMsg(null);
    setSaveSuccessMsg(null);
    startTransition(async () => {
      const res = await saveCustomReportAction(definition, { visibility: "SHARED" });
      if (res.success) {
        setSaveSuccessMsg(`Report "${definition.name}" saved successfully!`);
      } else {
        setErrorMsg(res.error);
      }
    });
  };

  // Export Excel
  const handleExportExcel = async () => {
    try {
      const res = await fetch("/api/reports/custom/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition }),
      });
      if (!res.ok) throw new Error("Excel export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${definition.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Export failed.");
    }
  };

  // Export PDF
  const handleExportPdf = async () => {
    try {
      const res = await fetch("/api/reports/custom/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition }),
      });
      if (!res.ok) throw new Error("PDF export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${definition.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Export failed.");
    }
  };

  // AI Prompt Propose
  const handleAiPropose = () => {
    if (!aiPrompt.trim()) return;
    setErrorMsg(null);
    startTransition(async () => {
      const res = await proposeAiReportAction(aiPrompt);
      if (res.success) {
        setAiResponse(res.data);
        if (res.data.proposedDefinition) {
          setDefinition(res.data.proposedDefinition);
        }
      } else {
        setErrorMsg(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
            <span>{businessName}</span>
            <span>•</span>
            <span>Phase 14 Custom Analytics</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Custom Report Builder</h1>
          <p className="text-sm text-slate-400 mt-1">
            Build verified, formula-safe management reports without writing raw SQL.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 border border-amber-500/30 text-amber-300 font-medium text-sm transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            AI Report Assistant
          </button>
          <button
            onClick={handleRunPreview}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
            Preview Report
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}
      {saveSuccessMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Wizard Step Navigation Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 bg-slate-900/60 p-2 rounded-2xl border border-slate-800/80">
        {steps.map((st, idx) => {
          const Icon = st.icon;
          const isActive = currentStep === idx;
          const isDone = currentStep > idx;

          return (
            <button
              key={st.title}
              onClick={() => {
                setCurrentStep(idx);
                if (idx === 9 && !previewResult) {
                  handleRunPreview();
                }
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all text-xs text-center ${
                isActive
                  ? "bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                  : isDone
                  ? "bg-slate-800/80 text-amber-300 hover:bg-slate-800"
                  : "bg-slate-900/40 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <Icon className={`w-4 h-4 mb-1.5 ${isActive ? "text-slate-950" : isDone ? "text-amber-400" : "text-slate-400"}`} />
              <span className="truncate w-full">{st.title}</span>
            </button>
          );
        })}
      </div>

      {/* Main Step Workspace */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl min-h-[420px]">
        {/* STEP 0: DATASET SELECTION */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Choose Controlled Dataset</h2>
              <p className="text-xs text-slate-400">
                Select from verified domain models. Raw SQL and uncontrolled table queries are strictly prohibited.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {Object.values(DATASET_REGISTRY).map((ds) => {
                const isSelected = definition.datasetId === ds.id;
                return (
                  <div
                    key={ds.id}
                    onClick={() => {
                      setDefinition({
                        ...definition,
                        datasetId: ds.id,
                        columns: ds.defaultColumns.map((colId) => ({ columnId: colId })),
                        grouping: [],
                      });
                    }}
                    className={`cursor-pointer p-4 rounded-xl border transition-all text-left flex flex-col justify-between ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10"
                        : "bg-slate-800/40 border-slate-850 hover:border-slate-700 hover:bg-slate-800/70"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {ds.category}
                        </span>
                        {isSelected && <span className="text-xs text-amber-400 font-bold">Selected</span>}
                      </div>
                      <h3 className="text-sm font-semibold text-white">{ds.displayName}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ds.description}</p>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                      <span>{ds.columns.length} Fields</span>
                      <span>•</span>
                      <span>{ds.supportsCharts ? "Charts Supported" : "Tabular Only"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 1: PERIOD & DATA MODE */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Report Period & Data Mode</h2>
              <p className="text-xs text-slate-400">
                Configure operational time window and select between Current Live data and As-Closed snapshot mode.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Period selection */}
              <div className="space-y-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Pre-configured Period
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: "This Month", type: "THIS_MONTH" },
                    { label: "Last Month", type: "LAST_MONTH" },
                    { label: "Today", type: "TODAY" },
                    { label: "Yesterday", type: "YESTERDAY" },
                    { label: "This Week", type: "THIS_WEEK" },
                    { label: "Last Week", type: "LAST_WEEK" },
                    { label: "This Quarter", type: "THIS_QUARTER" },
                    { label: "Last Quarter", type: "LAST_QUARTER" },
                    { label: "This Year", type: "THIS_YEAR" },
                    { label: "Last Year", type: "LAST_YEAR" },
                    { label: "Financial Period", type: "FINANCIAL_PERIOD" },
                    { label: "Custom Range", type: "CUSTOM" },
                  ].map((p) => (
                    <button
                      key={p.type}
                      onClick={() =>
                        setDefinition({
                          ...definition,
                          period: { ...definition.period, type: p.type as ReportDefinition["period"]["type"] },
                        })
                      }
                      className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        definition.period.type === p.type
                          ? "bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm"
                          : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {definition.period.type === "FINANCIAL_PERIOD" && (
                  <div className="flex gap-3 pt-2">
                    <div className="flex-1">
                      <label className="text-xs text-slate-400">Month</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={definition.period.financialMonth || 9}
                        onChange={(e) =>
                          setDefinition({
                            ...definition,
                            period: { ...definition.period, financialMonth: parseInt(e.target.value) || 9 },
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs mt-1"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-400">Year</label>
                      <input
                        type="number"
                        min="2020"
                        max="2030"
                        value={definition.period.financialYear || 2026}
                        onChange={(e) =>
                          setDefinition({
                            ...definition,
                            period: { ...definition.period, financialYear: parseInt(e.target.value) || 2026 },
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Data Mode: Current vs As-Closed */}
              <div className="space-y-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Data Mode Semantics
                </label>
                <div className="space-y-3">
                  <div
                    onClick={() =>
                      setDefinition({
                        ...definition,
                        period: { ...definition.period, asClosed: false },
                      })
                    }
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      !definition.period.asClosed
                        ? "bg-amber-500/10 border-amber-500 shadow-sm"
                        : "bg-slate-800/40 border-slate-750 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">Data Mode: Current</span>
                      {!definition.period.asClosed && (
                        <span className="text-xs text-amber-400 font-bold">Active</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Reflects live system states, current receivable & payable balances, and today&apos;s settlement status.
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      if (currentDataset.supportsAsClosed) {
                        setDefinition({
                          ...definition,
                          period: { ...definition.period, asClosed: true, type: "FINANCIAL_PERIOD" },
                        });
                      }
                    }}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      !currentDataset.supportsAsClosed
                        ? "opacity-50 cursor-not-allowed bg-slate-900 border-slate-800"
                        : definition.period.asClosed
                        ? "bg-purple-500/10 border-purple-500 shadow-sm"
                        : "bg-slate-800/40 border-slate-750 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">Data Mode: As Closed (Snapshot)</span>
                      {definition.period.asClosed && (
                        <span className="text-xs text-purple-400 font-bold">Active</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Uses immutable Phase 10 month-end closing snapshot data. Future payments and settlements will not alter historical balances.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: TYPE-SAFE FILTERS */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white">Structured Filter Rules</h2>
                <p className="text-xs text-slate-400">
                  Filter rows deterministically. Unrestricted SQL or code injection is strictly blocked.
                </p>
              </div>
              <button
                onClick={() => {
                  const defaultCol = currentDataset.columns[0]?.id || "amount";
                  const newRules = [
                    ...(definition.filterGroups[0]?.rules || []),
                    { columnId: defaultCol, operator: "EQUALS", value: "" },
                  ];
                  setDefinition({
                    ...definition,
                    filterGroups: [{ combinator: "AND", rules: newRules }],
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Filter Rule
              </button>
            </div>

            {definition.filterGroups.length === 0 || definition.filterGroups[0].rules.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No active filters applied. All authorized records in period will be included.
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {definition.filterGroups[0].rules.map((rule, idx) => {
                  const colDef = currentDataset.columns.find((c) => c.id === rule.columnId);
                  const allowedOps = colDef ? colDef.allowedOperators : ["EQUALS"];

                  return (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl"
                    >
                      <select
                        value={rule.columnId}
                        onChange={(e) => {
                          const updated = [...definition.filterGroups[0].rules];
                          updated[idx] = { ...rule, columnId: e.target.value };
                          setDefinition({
                            ...definition,
                            filterGroups: [{ combinator: "AND", rules: updated }],
                          });
                        }}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
                      >
                        {currentDataset.columns.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={rule.operator}
                        onChange={(e) => {
                          const updated = [...definition.filterGroups[0].rules];
                          updated[idx] = { ...rule, operator: e.target.value };
                          setDefinition({
                            ...definition,
                            filterGroups: [{ combinator: "AND", rules: updated }],
                          });
                        }}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
                      >
                        {allowedOps.map((op) => (
                          <option key={op} value={op}>
                            {op.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={String(rule.value)}
                        placeholder="Value (e.g. Hotel, 10000)"
                        onChange={(e) => {
                          const updated = [...definition.filterGroups[0].rules];
                          updated[idx] = { ...rule, value: e.target.value };
                          setDefinition({
                            ...definition,
                            filterGroups: [{ combinator: "AND", rules: updated }],
                          });
                        }}
                        className="flex-1 min-w-[140px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
                      />

                      <button
                        onClick={() => {
                          const updated = definition.filterGroups[0].rules.filter((_, i) => i !== idx);
                          setDefinition({
                            ...definition,
                            filterGroups: [{ combinator: "AND", rules: updated }],
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: COLUMN SELECTION & LABELS */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Select Columns & Display Labels</h2>
              <p className="text-xs text-slate-400">
                Choose visible columns and set custom report header labels. Sensitive fields are protected by permissions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {currentDataset.columns.map((col) => {
                const isSelected = definition.columns.some((c) => c.columnId === col.id);
                return (
                  <div
                    key={col.id}
                    onClick={() => {
                      if (isSelected) {
                        setDefinition({
                          ...definition,
                          columns: definition.columns.filter((c) => c.columnId !== col.id),
                        });
                      } else {
                        setDefinition({
                          ...definition,
                          columns: [...definition.columns, { columnId: col.id }],
                        });
                      }
                    }}
                    className={`cursor-pointer p-3 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500 text-white font-medium"
                        : "bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{col.label}</div>
                      <span className="text-[10px] text-slate-500 uppercase">{col.dataType}</span>
                    </div>
                    {col.isSensitive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Sensitive
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: GROUPING */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Grouping & Multi-Level Summaries</h2>
              <p className="text-xs text-slate-400">
                Group records to analyze category distributions, customer totals, and monthly trends.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {currentDataset.columns
                .filter((col) => col.groupable)
                .map((col) => {
                  const isGrouped = definition.grouping.includes(col.id);
                  return (
                    <div
                      key={col.id}
                      onClick={() => {
                        if (isGrouped) {
                          setDefinition({
                            ...definition,
                            grouping: definition.grouping.filter((g) => g !== col.id),
                          });
                        } else {
                          // max 2 levels
                          if (definition.grouping.length < 2) {
                            setDefinition({
                              ...definition,
                              grouping: [...definition.grouping, col.id],
                            });
                          }
                        }
                      }}
                      className={`cursor-pointer p-4 rounded-xl border text-center transition-all ${
                        isGrouped
                          ? "bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md"
                          : "bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <Layers className="w-5 h-5 mx-auto mb-2 opacity-80" />
                      <div className="text-xs font-semibold">{col.label}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* STEP 5: FINANCIAL MEASURES */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Authoritative Semantic Measures</h2>
              <p className="text-xs text-slate-400">
                All financial metrics derive strictly from the Phase 5 Accounting Engine. Net Result is strictly separated from cash flow.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {Object.values(FINANCIAL_MEASURE_REGISTRY).map((m) => {
                const isSelected = definition.measures.includes(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (isSelected) {
                        setDefinition({
                          ...definition,
                          measures: definition.measures.filter((id) => id !== m.id),
                        });
                      } else {
                        setDefinition({
                          ...definition,
                          measures: [...definition.measures, m.id],
                        });
                      }
                    }}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500 text-white shadow-sm"
                        : "bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white">{m.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {m.category.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{m.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 6: SORTING & TOP N */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Sorting & Top N Filter</h2>
              <p className="text-xs text-slate-400">
                Order records and isolate top-performing categories or largest customer balances.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sort Column</label>
                <select
                  value={definition.sort?.columnId || "date"}
                  onChange={(e) =>
                    setDefinition({
                      ...definition,
                      sort: {
                        columnId: e.target.value,
                        direction: definition.sort?.direction || "desc",
                      },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-xs"
                >
                  {currentDataset.columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.label}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() =>
                      setDefinition({
                        ...definition,
                        sort: { columnId: definition.sort?.columnId || "date", direction: "desc" },
                      })
                    }
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                      definition.sort?.direction === "desc"
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    Descending (Highest first)
                  </button>
                  <button
                    onClick={() =>
                      setDefinition({
                        ...definition,
                        sort: { columnId: definition.sort?.columnId || "date", direction: "asc" },
                      })
                    }
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                      definition.sort?.direction === "asc"
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    Ascending (Lowest first)
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Top N Limitation</label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 20, 50].map((n) => (
                    <button
                      key={n}
                      onClick={() => setDefinition({ ...definition, topN: n })}
                      className={`py-2 rounded-lg text-xs font-semibold ${
                        definition.topN === n ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      Top {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Example: Top {definition.topN || 10} records ordered by {definition.sort?.columnId || "primary measure"}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: COMPARISON PERIOD */}
        {currentStep === 7 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Period Comparison & Variance</h2>
              <p className="text-xs text-slate-400">
                Compare report metrics against previous period, month, quarter, or year. Zero previous values are safely handled.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {[
                { label: "None (Single Period)", type: "NONE" },
                { label: "Previous Period", type: "PREVIOUS_PERIOD" },
                { label: "Previous Month", type: "PREVIOUS_MONTH" },
                { label: "Previous Quarter", type: "PREVIOUS_QUARTER" },
                { label: "Previous Year", type: "PREVIOUS_YEAR" },
                { label: "Same Period Last Year", type: "SAME_PERIOD_LAST_YEAR" },
              ].map((c) => {
                const isSelected =
                  c.type === "NONE"
                    ? !definition.comparison?.enabled
                    : definition.comparison?.enabled && definition.comparison.type === c.type;

                return (
                  <div
                    key={c.type}
                    onClick={() => {
                      if (c.type === "NONE") {
                        setDefinition({
                          ...definition,
                          comparison: { enabled: false, type: "PREVIOUS_PERIOD" },
                        });
                      } else {
                        setDefinition({
                          ...definition,
                          comparison: { enabled: true, type: c.type as NonNullable<ReportDefinition["comparison"]>["type"] },
                        });
                      }
                    }}
                    className={`cursor-pointer p-4 rounded-xl border text-center transition-all ${
                      isSelected
                        ? "bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md"
                        : "bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <GitCompare className="w-5 h-5 mx-auto mb-2 opacity-80" />
                    <div className="text-xs font-semibold">{c.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 8: CHARTS */}
        {currentStep === 8 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Interactive Visualizations</h2>
              <p className="text-xs text-slate-400">
                Select visual chart presentation. Chart totals mathematically reconcile with table totals.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              {[
                { label: "Bar Chart", type: "BAR" },
                { label: "Line Chart", type: "LINE" },
                { label: "Area Chart", type: "AREA" },
                { label: "Donut / Share", type: "DONUT" },
                { label: "Aging Breakdown", type: "AGING" },
                { label: "KPI Cards Only", type: "KPI" },
              ].map((ch) => {
                const isSelected = definition.chart?.type === ch.type;
                return (
                  <div
                    key={ch.type}
                    onClick={() => {
                      setDefinition({
                        ...definition,
                        chart: { enabled: true, type: ch.type as NonNullable<ReportDefinition["chart"]>["type"], title: `${ch.label} Analysis` },
                      });
                    }}
                    className={`cursor-pointer p-4 rounded-xl border text-center transition-all ${
                      isSelected
                        ? "bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md"
                        : "bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <BarChart2 className="w-5 h-5 mx-auto mb-2 opacity-80" />
                    <div className="text-xs font-semibold">{ch.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 9: PREVIEW, DRILL-DOWN & EXPORT */}
        {currentStep === 9 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{definition.name}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>{currentDataset.displayName}</span>
                  <span>•</span>
                  <span>{previewResult?.periodLabel || "Period"}</span>
                  <span>•</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      previewResult?.dataMode === "AS_CLOSED"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    Data Mode: {previewResult?.dataMode === "AS_CLOSED" ? `As Closed (${previewResult.asClosedLabel})` : "Current Live"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-700 transition-all"
                >
                  <Save className="w-4 h-4 text-amber-400" />
                  Save Report
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-medium text-xs border border-emerald-500/30 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Export Excel
                </button>
                <button
                  onClick={handleExportPdf}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-medium text-xs border border-rose-500/30 transition-all"
                >
                  <Download className="w-4 h-4 text-rose-400" />
                  Export PDF
                </button>
              </div>
            </div>

            {/* KPI Cards Row */}
            {previewResult?.summaryMetrics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {previewResult.summaryMetrics.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
                  >
                    <span className="text-xs text-slate-400 font-medium">{kpi.label}</span>
                    <div className="text-xl font-bold text-white mt-1">{kpi.value}</div>
                    {kpi.comparison && (
                      <div className="flex items-center gap-1 text-[11px] mt-2">
                        {kpi.comparison.trend === "UP" ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : kpi.comparison.trend === "DOWN" ? (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        ) : null}
                        <span className="text-slate-400">vs prev:</span>
                        <span className="text-slate-300 font-medium">{kpi.comparison.percentageChange}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Deterministic Insights Box */}
            {previewResult?.insights && previewResult.insights.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-slate-300 space-y-1">
                <div className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                  <Info className="w-4 h-4" />
                  Deterministic Insights
                </div>
                {previewResult.insights.map((ins: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-400">•</span>
                    <span>{ins}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Simple Clean Responsive SVG Bar Chart */}
            {previewResult?.chartData && previewResult.chartData.labels.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {previewResult.chartData.title}
                </div>
                <div className="space-y-2 pt-2">
                  {previewResult.chartData.labels.map((lbl: string, idx: number) => {
                    const chart = previewResult.chartData;
                    const val = chart?.datasets[0]?.data[idx] || 0;
                    const maxVal = Math.max(...(chart?.datasets[0]?.data || [1]), 1);
                    const pct = Math.min(100, Math.max(5, (val / maxVal) * 100));

                    return (
                      <div
                        key={idx}
                        onClick={() => handleDrillDown(definition.grouping[0] || "categoryName", lbl)}
                        className="cursor-pointer group"
                      >
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-300 group-hover:text-amber-400 transition-colors font-medium">
                            {lbl}
                          </span>
                          <span className="text-slate-400 font-mono">₹{val.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                          <div
                            style={{ width: `${pct}%` }}
                            className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all group-hover:from-amber-400 group-hover:to-amber-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Data Table */}
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Showing {previewResult?.rows?.length || 0} of {previewResult?.totalMatchingRecords || 0} matching records
                </span>
                {previewResult?.isPreview && (
                  <span className="text-amber-400 font-medium">Preview Limited to 100 Rows</span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
                    <tr>
                      {previewResult?.columns?.map((c) => (
                        <th key={c.id} className="p-3">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {previewResult?.rows?.map((row, rIdx) => (
                      <tr key={(row.id as string) || rIdx} className="hover:bg-slate-850/50 transition-colors">
                        {previewResult.columns.map((c) => (
                          <td key={c.id} className="p-3 font-mono">
                            {String(row[c.id] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 font-medium text-xs disabled:opacity-30 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous Step
        </button>

        <span className="text-xs text-slate-500">
          Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
        </span>

        <button
          onClick={() => {
            const next = Math.min(steps.length - 1, currentStep + 1);
            setCurrentStep(next);
            if (next === 9) {
              handleRunPreview();
            }
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-all shadow-sm"
        >
          {currentStep === 8 ? "Generate Preview" : "Next Step"}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Drill-down Drawer / Modal */}
      {isDrillDownOpen && drillDownData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  Drill-Down: {drillDownData.groupField} = &quot;{drillDownData.groupValue}&quot;
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reconciled Total: ₹{drillDownData.drillDownSum.toLocaleString("en-IN")} across {drillDownData.totalCount} records.
                </p>
              </div>
              <button
                onClick={() => setIsDrillDownOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Tx #</th>
                    <th className="p-2.5">Party</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {drillDownData.records.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-850/40">
                      <td className="p-2.5">{String(r.date || "—")}</td>
                      <td className="p-2.5 font-mono text-amber-400">{String(r.transactionNumber || "—")}</td>
                      <td className="p-2.5">{String(r.partyName || "—")}</td>
                      <td className="p-2.5">{String(r.description || "—")}</td>
                      <td className="p-2.5 text-right font-mono font-semibold text-white">
                        {String(r.amount || "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsDrillDownOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">AI Report Builder Assistant</h3>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Describe what report you need in natural English (e.g. &quot;Show September expenses by category&quot; or &quot;Show customer overdue receivables&quot;).
            </p>

            <textarea
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Create a report showing September expenses grouped by category with a bar chart"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-amber-500"
            />

            {aiResponse && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  aiResponse.understood
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                <div className="font-semibold mb-1">
                  {aiResponse.understood ? "Report Proposal Generated:" : "Unable to fulfill request:"}
                </div>
                <p>{aiResponse.explanation}</p>
                {aiResponse.unavailableMetricReason && (
                  <p className="mt-1 text-rose-400 font-medium">{aiResponse.unavailableMetricReason}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAiPropose}
                disabled={isPending || !aiPrompt.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold disabled:opacity-50"
              >
                Generate Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
