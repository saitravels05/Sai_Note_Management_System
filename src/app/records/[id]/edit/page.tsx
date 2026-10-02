import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { RecordService } from "@/server/services/record.service";
import { AuthorizationService } from "@/server/services/authorization.service";
import { QuickEntryForm, type InitialRecordData } from "@/components/records/QuickEntryForm";

interface EditRecordPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRecordPage({ params }: EditRecordPageProps) {
  const user = await requireCurrentUser();
  const { id } = await params;

  if (!id) notFound();

  // Check permission
  if (!user.permissions.includes("records.edit") && !user.roles.includes("OWNER") && !user.roles.includes("ADMIN")) {
    redirect(`/records/${id}`);
  }

  let recordData;
  try {
    recordData = await RecordService.getRecordById(id, {
      businessId: user.businessId,
      userId: user.id,
    });
  } catch {
    notFound();
  }

  const { record } = recordData;

  // Check financial period status
  let isPeriodClosed = false;
  let periodErrorMsg = "";
  try {
    await AuthorizationService.requireOpenFinancialPeriod(user.businessId, record.transactionDate);
  } catch (err: unknown) {
    isPeriodClosed = true;
    periodErrorMsg =
      err instanceof Error
        ? err.message
        : "This accounting period is closed. Reopen the period with appropriate permission before making financial changes.";
  }

  const categories = await prisma.category.findMany({
    where: { businessId: user.businessId, isActive: true },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  const initialRecord: InitialRecordData = {
    id: record.id,
    transactionType: record.transactionType,
    title: record.title,
    amount: record.totalAmount.toString(),
    transactionDate: new Date(record.transactionDate).toISOString().split("T")[0],
    dueDate: record.dueDate ? new Date(record.dueDate).toISOString().split("T")[0] : null,
    categoryId: record.categoryId,
    customerId: record.customerId,
    supplierId: record.supplierId,
    referenceNumber: record.referenceNumber,
    description: record.description,
    notes: record.notes,
    paymentStatus: record.paymentStatus,
    status: record.status,
    isDuplicate: false,
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href={`/records/${record.id}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Cancel & Back to Record #{record.transactionNumber}
        </Link>
      </div>

      {/* Closed Period Alert */}
      {isPeriodClosed && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="leading-relaxed font-medium">{periodErrorMsg}</p>
        </div>
      )}

      {/* Edit Form */}
      <div className="p-6 rounded-2xl glass-card border border-slate-800 shadow-xl space-y-4">
        <div className="border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Editing Record
            </span>
            <span className="text-xs text-slate-500 font-mono">#{record.transactionNumber}</span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">Edit {record.title}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Modify details, adjust category, party, amounts, or internal notes. Financial changes will be audited.
          </p>
        </div>

        {isPeriodClosed ? (
          <div className="text-center py-8 text-xs text-slate-400 space-y-2">
            <p>Editing is locked because this record belongs to a closed accounting period.</p>
            <Link
              href={`/records/${record.id}`}
              className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white font-medium"
            >
              Return to Record
            </Link>
          </div>
        ) : (
          <QuickEntryForm
            categories={categories}
            initialRecord={initialRecord}
          />
        )}
      </div>
    </div>
  );
}
