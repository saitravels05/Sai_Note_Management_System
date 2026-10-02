import { Metadata } from "next";
import { AuditControlCenter } from "@/components/audit/AuditControlCenter";

export const metadata: Metadata = {
  title: "Audit Control Center | Sai Tours & Travels",
  description: "Tamper-evident administrative audit trail and security investigation center",
};

export default function AuditPage() {
  return <AuditControlCenter />;
}
