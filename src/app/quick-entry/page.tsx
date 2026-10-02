import { requireCurrentUser } from "@/lib/auth/current-user";
import { CategoryService } from "@/server/services/category.service";
import { RecordService } from "@/server/services/record.service";
import { QuickEntryForm, type InitialRecordData, type EntryType } from "@/components/records/QuickEntryForm";
import { redirect } from "next/navigation";
import { PaymentStatus } from "@prisma/client";

export const metadata = {
  title: "Add Record | Sai Tours & Travels",
  description: "Fast daily business record and notes entry workspace.",
};

interface QuickEntryPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function QuickEntryPage({ searchParams }: QuickEntryPageProps) {
  const user = await requireCurrentUser().catch(() => null);

  if (!user) {
    redirect("/login?returnTo=/quick-entry");
  }

  const sp = await searchParams;
  const duplicateId = typeof sp.duplicateId === "string" ? sp.duplicateId : undefined;
  const typeParam = typeof sp.type === "string" ? (sp.type.toUpperCase() as EntryType) : undefined;

  let initialRecord: InitialRecordData | undefined = undefined;

  if (duplicateId) {
    try {
      const { record } = await RecordService.getRecordById(duplicateId, {
        businessId: user.businessId,
        userId: user.id,
      });

      initialRecord = {
        title: record.title,
        amount: record.totalAmount.toString(),
        transactionType: record.transactionType,
        categoryId: record.categoryId,
        customerId: record.customerId,
        supplierId: record.supplierId,
        description: record.description,
        notes: record.notes,
        referenceNumber: "", // Reset per rule 23
        paymentStatus: PaymentStatus.UNPAID, // Reset per rule 23
        isDuplicate: true,
      };
    } catch (e) {
      console.warn("Could not load duplicate record:", e);
    }
  }

  const categories = await CategoryService.getCategories(user.businessId, "ALL");

  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-4 space-y-4">
      {duplicateId && initialRecord && (
        <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs flex items-center justify-between">
          <span>Duplicating previous entry. Please review dates, amounts, and details before saving.</span>
        </div>
      )}

      <QuickEntryForm
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }))}
        initialType={typeParam || "EXPENSE"}
        initialRecord={initialRecord}
      />
    </div>
  );
}
