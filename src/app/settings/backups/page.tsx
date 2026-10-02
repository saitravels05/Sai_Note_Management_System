import { Metadata } from "next";
import { BackupControlCenter } from "@/components/backup/BackupControlCenter";

export const metadata: Metadata = {
  title: "Backup & Disaster Recovery | Sai Tours & Travels",
  description: "Backup Management, Restore Verification System & Disaster Recovery Framework",
};

export default function BackupsPage() {
  return <BackupControlCenter />;
}
