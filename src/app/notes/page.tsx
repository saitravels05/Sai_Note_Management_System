import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { NotesService, type NoteFilterOptions } from "@/server/services/notes.service";
import { NotesWorkspace, type SerializedNote } from "@/components/notes/NotesWorkspace";

export const metadata = {
  title: "Business Notes & Diary | Sai Tours & Travels",
  description: "Smart business notebook, flight reminders, client instructions, and operations diary.",
};

interface NotesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const user = await requireCurrentUser();
  const sp = await searchParams;

  const viewParam = typeof sp.view === "string" ? sp.view : "all";
  const searchParam = typeof sp.search === "string" ? sp.search : undefined;

  const filterOpts: NoteFilterOptions = {
    view: viewParam as NoteFilterOptions["view"],
    search: searchParam,
  };

  type NoteResult = Awaited<ReturnType<typeof NotesService.getNotes>>;
  type PartyItem = { id: string; name: string };

  let notes: NoteResult = [];
  let customers: PartyItem[] = [];
  let suppliers: PartyItem[] = [];

  try {
    [notes, customers, suppliers] = await Promise.all([
      NotesService.getNotes(filterOpts, {
        businessId: user.businessId,
        userId: user.id,
      }),
      prisma.customer.findMany({
        where: { businessId: user.businessId, status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.supplier.findMany({
        where: { businessId: user.businessId, status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
  } catch (err) {
    console.warn("Database offline in NotesPage, rendering clean empty state:", err);
  }

  const serializedNotes: SerializedNote[] = notes.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    noteType: n.noteType,
    isPinned: n.isPinned,
    createdAt: n.createdAt.toISOString(),
    customerName: n.customer ? n.customer.name : null,
    customerId: n.customerId,
    supplierName: n.supplier ? n.supplier.name : null,
    supplierId: n.supplierId,
    transactionNumber: n.transaction ? n.transaction.transactionNumber : null,
    transactionId: n.transactionId,
    tags: n.tags.map((t) => t.tag.name),
  }));

  return (
    <NotesWorkspace
      notes={serializedNotes}
      customers={customers}
      suppliers={suppliers}
    />
  );
}
