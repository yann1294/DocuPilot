import { UserButton } from "@clerk/nextjs";
import { AlertCircle, CheckCircle2, FileText, Workflow } from "lucide-react";
import { UploadDropzone } from "@/components/upload-dropzone";
import { DocumentTable } from "@/components/document-table";
import { ApprovalPanel } from "@/components/approval-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentItem } from "@/lib/types";

const documents: DocumentItem[] = [];

export default function DashboardPage() {
  const needsApproval = documents.filter((doc) =>
    doc.status === "NEEDS_APPROVAL" || doc.status === "READY_FOR_APPROVAL"
  );
  const failed = documents.filter((doc) => doc.status === "FAILED");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Document Command Center</h1>
            <p className="mt-1 text-sm text-slate-600">Track uploads, AI processing, and approvals in one place.</p>
          </div>
          <UserButton />
        </header>

        <section className="mb-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <UploadDropzone />
          <Card>
            <CardHeader>
              <div className="mb-1 flex items-center gap-2 text-indigo-700">
                <Workflow className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Workflow</span>
              </div>
              <CardTitle>Pipeline Steps</CardTitle>
              <CardDescription>How each uploaded document moves through DocuPilot.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-slate-700">
                <li className="rounded-lg bg-slate-50 px-3 py-2">1. Pre-signed upload URL request</li>
                <li className="rounded-lg bg-slate-50 px-3 py-2">2. Direct browser upload to S3</li>
                <li className="rounded-lg bg-slate-50 px-3 py-2">3. Step Functions orchestration</li>
                <li className="rounded-lg bg-slate-50 px-3 py-2">4. AI extraction + human approval</li>
              </ol>
            </CardContent>
          </Card>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">Total documents</p>
                <FileText className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{documents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">Needs approval</p>
                <CheckCircle2 className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{needsApproval.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">Failed</p>
                <AlertCircle className="h-4 w-4 text-rose-600" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{failed.length}</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <DocumentTable documents={documents} />
          <ApprovalPanel documentsNeedingApproval={needsApproval} />
        </section>
      </div>
    </main>
  );
}
