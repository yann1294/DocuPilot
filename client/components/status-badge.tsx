import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: DocumentStatus;
}

const statusStyles: Record<DocumentStatus, string> = {
  UPLOADING: "bg-slate-100 text-slate-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  AI_COMPLETED: "bg-cyan-100 text-cyan-700",
  NEEDS_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  FAILED: "bg-rose-100 text-rose-700"
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = status.replaceAll("_", " ");

  return <Badge className={statusStyles[status]}>{label}</Badge>;
}
