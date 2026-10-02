import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { RecordService } from "@/server/services/record.service";
import { AttachmentService } from "@/server/services/attachment.service";
import { RecordDetailView } from "@/components/records/RecordDetailView";

interface RecordDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RecordDetailPage({ params }: RecordDetailPageProps) {
  const user = await requireCurrentUser();
  const { id } = await params;

  if (!id) {
    notFound();
  }

  let recordData;
  let attachments;

  try {
    recordData = await RecordService.getRecordById(id, {
      businessId: user.businessId,
      userId: user.id,
    });

    attachments = await AttachmentService.getEntityAttachments(
      "TRANSACTION",
      recordData.record.id,
      user.businessId
    );
  } catch (error) {
    console.error("Error loading record detail:", error);
    notFound();
  }

  const { record, auditLogs, customFieldValues } = recordData;

  return (
    <RecordDetailView
      record={record}
      auditLogs={auditLogs}
      customFieldValues={customFieldValues}
      attachments={attachments}
      userPermissions={user.permissions}
    />
  );
}
