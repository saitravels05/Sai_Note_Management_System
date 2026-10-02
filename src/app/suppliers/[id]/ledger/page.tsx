import { requireCurrentUser } from "@/lib/auth/current-user";
import { LedgerService } from "@/server/services/ledger.service";
import { PartyLedgerView, type SerializedLedgerEntry } from "@/components/accounting/PartyLedgerView";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Supplier Ledger | Sai Tours & Travels",
  description: "Chronological supplier account statement, running balances, bills and payments.",
};

interface SupplierLedgerPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SupplierLedgerPage({ params, searchParams }: SupplierLedgerPageProps) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const sp = await searchParams;

  const startDateStr = typeof sp.startDate === "string" ? sp.startDate : undefined;
  const endDateStr = typeof sp.endDate === "string" ? sp.endDate : undefined;

  const startDate = startDateStr ? new Date(startDateStr) : undefined;
  const endDate = endDateStr ? new Date(endDateStr) : undefined;

  let ledgerData;
  try {
    ledgerData = await LedgerService.getSupplierLedger({
      businessId: user.businessId,
      supplierId: id,
      startDate,
      endDate,
    });
  } catch {
    notFound();
  }

  const serializedEntries: SerializedLedgerEntry[] = ledgerData.entries.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    entityNumber: e.entityNumber,
    referenceNumber: e.referenceNumber,
    description: e.description,
    type: e.type,
    rawType: e.rawType,
    debit: e.debit.getDecimal().toString(),
    credit: e.credit.getDecimal().toString(),
    runningBalance: e.runningBalance.getDecimal().toString(),
    status: e.status,
  }));

  return (
    <PartyLedgerView
      partyType="SUPPLIER"
      party={{
        id: ledgerData.supplier.id,
        name: ledgerData.supplier.name,
        code: ledgerData.supplier.supplierCode,
        companyName: ledgerData.supplier.companyName,
        phone: ledgerData.supplier.phone,
        email: ledgerData.supplier.email,
      }}
      openingBalance={ledgerData.openingBalance.getDecimal().toString()}
      totalDebits={ledgerData.totalDebits.getDecimal().toString()}
      totalCredits={ledgerData.totalCredits.getDecimal().toString()}
      closingBalance={ledgerData.closingBalance.getDecimal().toString()}
      totalOutstanding={ledgerData.totalOutstanding.getDecimal().toString()}
      entries={serializedEntries}
    />
  );
}
