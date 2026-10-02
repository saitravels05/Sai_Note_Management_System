import Link from "next/link";
import {
  Download,
  FileSpreadsheet,
  ArrowLeft,
  Info,
  UploadCloud,
} from "lucide-react";
import { ImporterService } from "@/server/services/importer.service";

export default function ImportTemplatesPage() {
  const templateTypes: Array<{
    type: "INCOME" | "EXPENSE" | "RECEIVABLE" | "PAYABLE" | "TRANSACTIONS" | "CUSTOMERS" | "SUPPLIERS";
    title: string;
    description: string;
  }> = [
    {
      type: "INCOME",
      title: "Income & Receipts Template",
      description: "For customer payments, tour bookings, ticket commissions, and daily receipts.",
    },
    {
      type: "EXPENSE",
      title: "Expenses & Vendor Payments Template",
      description: "For hotel payments, airline tickets, fleet diesel, office rent, and utility costs.",
    },
    {
      type: "RECEIVABLE",
      title: "Receivables (Client Invoices) Template",
      description: "For credit bookings and corporate travel accounts with outstanding balances.",
    },
    {
      type: "PAYABLE",
      title: "Payables (Supplier Bills) Template",
      description: "For incoming hotel bills, airline ticketing dues, and fleet operator payables.",
    },
    {
      type: "TRANSACTIONS",
      title: "General Mixed Ledger Template",
      description: "Multi-purpose ledger workbook containing both debit and credit entries classified by type.",
    },
    {
      type: "CUSTOMERS",
      title: "Customer Master Data Template",
      description: "Bulk import client contact information, phone numbers, cities, and opening balances.",
    },
    {
      type: "SUPPLIERS",
      title: "Supplier Master Data Template",
      description: "Bulk import vendors, transport fleet agencies, hotel partners, and opening payables.",
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/imports"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Imports
            </Link>
            <span className="text-xs text-slate-600">/</span>
            <span className="text-xs text-orange-400 font-semibold">Standard Templates</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
            <Download className="w-6 h-6 text-orange-400" />
            Download Clean Import Templates & Guides
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Pre-formatted spreadsheets with column guides. You can also use your own custom spreadsheet formats.
          </p>
        </div>

        <Link
          href="/imports/new"
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4" /> Start Import Wizard
        </Link>
      </div>

      {/* Helpful Hint */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white">Templates are completely optional!</strong> Our Intelligent Column Mapper
          recognizes hundreds of standard header aliases (e.g. <em>Txn Date</em>, <em>Party</em>, <em>Amt</em>,{" "}
          <em>Remarks</em>). If you already have your own Excel files from Tally, Busy, or manual bookkeeping, you
          can upload them directly without reformatting.
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-6">
        {templateTypes.map((t) => {
          const doc = ImporterService.getTemplateHeaders(t.type);

          return (
            <div
              key={t.type}
              className="p-5 rounded-2xl glass-card border border-slate-800 space-y-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-orange-400" />
                    {t.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/api/imports/templates/${t.type.toLowerCase()}?format=xlsx`}
                    download
                    className="px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> Excel (.xlsx)
                  </a>
                  <a
                    href={`/api/imports/templates/${t.type.toLowerCase()}?format=csv`}
                    download
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV (.csv)
                  </a>
                </div>
              </div>

              {/* Column Documentation Table */}
              <div>
                <span className="text-[11px] font-semibold text-slate-300 block mb-2">
                  Spreadsheet Column Specification:
                </span>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300 border-collapse">
                    <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-2.5 w-1/4">Column Name</th>
                        <th className="p-2.5 w-24">Type</th>
                        <th className="p-2.5">Field Instructions & Examples</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 text-[11px]">
                      {Object.entries(doc.columnDocumentation).map(([col, note]) => {
                        const isReq = note.startsWith("Required");
                        return (
                          <tr key={col} className="hover:bg-slate-900/30">
                            <td className="p-2.5 font-semibold text-white font-mono">{col}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  isReq
                                    ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {isReq ? "Required" : "Optional"}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-400">{note}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
