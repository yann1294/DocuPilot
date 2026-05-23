import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentItem } from "@/lib/types";

interface ApprovalPanelProps {
  documentsNeedingApproval: DocumentItem[];
}

export function ApprovalPanel({ documentsNeedingApproval }: ApprovalPanelProps) {
  if (documentsNeedingApproval.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval Queue</CardTitle>
          <CardDescription>No documents waiting for reviewer action.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Human approval tasks will appear here when documents require manual checks.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Queue</CardTitle>
        <CardDescription>Review AI outputs before final status transitions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {documentsNeedingApproval.map((doc) => (
          <div key={doc.documentId} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{doc.fileName}</p>
                <p className="text-xs text-slate-500">{doc.documentId}</p>
              </div>
              <Badge variant="secondary">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                Pending
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button className="h-8 px-3 py-1 text-xs">
                <Check className="mr-1 h-3.5 w-3.5" />
                Approve
              </Button>
              <Button variant="outline" className="h-8 px-3 py-1 text-xs">
                <X className="mr-1 h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
