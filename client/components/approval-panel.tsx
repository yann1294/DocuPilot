import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiRequestError, approveDocument } from "@/lib/api";
import type { DocumentItem } from "@/lib/types";

interface ApprovalPanelProps {
  documentsNeedingApproval: DocumentItem[];
  onActionComplete?: () => void;
}

export function ApprovalPanel({ documentsNeedingApproval, onActionComplete }: ApprovalPanelProps) {
  const { getToken } = useAuth();
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onDecision(documentId: string, approved: boolean) {
    console.log("approval click");
    console.log("documentId", documentId);
    console.log("approved", approved);
    setPendingDocumentId(documentId);
    setErrorMessage(null);
    try {
      const result = await approveDocument(getToken, documentId, approved);
      console.log("approval api response", result);
      await onActionComplete?.();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        console.error("approval api error", { status: error.status, message: error.message });
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        console.error("approval api error", { status: "unknown", message: error.message });
        setErrorMessage(error.message);
      } else {
        console.error("approval api error", { status: "unknown", message: "Approval action failed." });
        setErrorMessage("Approval action failed.");
      }
    } finally {
      setPendingDocumentId(null);
    }
  }

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
        {errorMessage && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
        )}
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
              <Button
                className="h-8 px-3 py-1 text-xs"
                onClick={() => void onDecision(doc.documentId, true)}
                disabled={pendingDocumentId === doc.documentId}
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                {pendingDocumentId === doc.documentId ? "Saving..." : "Approve"}
              </Button>
              <Button
                variant="outline"
                className="h-8 px-3 py-1 text-xs"
                onClick={() => void onDecision(doc.documentId, false)}
                disabled={pendingDocumentId === doc.documentId}
              >
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
