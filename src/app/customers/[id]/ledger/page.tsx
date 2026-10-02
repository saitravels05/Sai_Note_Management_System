import { requireCurrentUser } from "@/lib/auth/current-user";
import { LedgerService } from "@/server/services/ledger.service";
import { PartyLedgerView, type SerializedLedgerEntry } from "@/components/accounting/PartyLedgerView";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Customer Ledger | Sai Tours & Travels",
  description: "Chronological customer account statement, running balances, debits and credits.",
};

interface CustomerLedgerPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CustomerLedgerPage({ params, searchParams }: CustomerLedgerPageProps) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const sp = await searchParams;

  const startDateStr = typeof sp.startDate === "string" ? sp.startDate : undefined;
  const endDateStr = typeof sp.endDate === "string" ? sp.endDate : undefined;

  const startDate = startDateStr ? new Date(startDateStr) : undefined;
  const endDate = endDateStr ? new Date(endDateStr) : undefined;

  let ledgerData;
  try {
    ledgerData = await LedgerService.getCustomerLedger({
      businessId: user.businessId,
      customerId: id,
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
      partyType="CUSTOMER"
      party={{
        id: ledgerData.customer.id,
        name: ledgerData.customer.name,
        code: ledgerData.customer.customerCode,
        companyName: ledgerData.customer.companyName,
        phone: ledgerData.customer.phone,
        email: ledgerData.customer.email,
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
