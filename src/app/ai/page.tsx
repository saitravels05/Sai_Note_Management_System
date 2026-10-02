import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { AIAssistantView } from "@/components/ai/AIAssistantView";

export const dynamic = "force-dynamic";

export default async function AIPage() {
  const user = await requireCurrentUser();

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    select: { name: true },
  });

  return (
    <AIAssistantView
      businessName={business?.name || "Sai Tours & Travels"}
    />
  );
}
