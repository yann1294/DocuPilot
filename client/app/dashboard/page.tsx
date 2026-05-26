"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { AlertCircle, CheckCircle2, FileText, Workflow } from "lucide-react";
import { UploadDropzone } from "@/components/upload-dropzone";
import { DocumentTable } from "@/components/document-table";
import { ApprovalPanel } from "@/components/approval-panel";
import { DocumentDetailsPanel } from "@/components/document-details-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDocument, listDocuments } from "@/lib/api";
import type { DocumentDetails, DocumentItem } from "@/lib/types";

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetails | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setError(null);
      const result = await listDocuments(getToken);
      setDocuments(result.documents);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load documents.");
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const shouldPoll = useMemo(
    () =>
      documents.some(
        (doc) => doc.status === "UPLOADING" || doc.status === "PROCESSING" || doc.status === "NEEDS_APPROVAL"
      ),
    [documents]
  );

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      void fetchDocuments();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fetchDocuments, shouldPoll]);

  const needsApproval = documents.filter((doc) => doc.status === "NEEDS_APPROVAL");
  const failed = documents.filter((doc) => doc.status === "FAILED");

  const handleViewDocument = useCallback(
    async (documentId: string) => {
      setIsDetailsOpen(true);
      setIsDetailsLoading(true);
      setDetailsError(null);
      setSelectedDocument(null);
      try {
        const result = await getDocument(documentId, getToken);
        setSelectedDocument(result.document);
      } catch (fetchError) {
        setDetailsError(fetchError instanceof Error ? fetchError.message : "Failed to load document details.");
      } finally {
        setIsDetailsLoading(false);
      }
    },
    [getToken]
  );

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
          <UploadDropzone onUploaded={() => void fetchDocuments()} />
          <Card>
            <CardHeader>
              <div className="mb-1 flex items-center gap-2 text-sky-700">
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
                <FileText className="h-4 w-4 text-sky-600" />
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
          <div className="space-y-3">
            {isLoading && <p className="text-sm text-slate-600">Loading documents...</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <DocumentTable
              documents={documents}
              onRefresh={() => void fetchDocuments()}
              onView={(documentId) => void handleViewDocument(documentId)}
            />
          </div>
          <ApprovalPanel documentsNeedingApproval={needsApproval} onActionComplete={fetchDocuments} />
        </section>
      </div>
      <DocumentDetailsPanel
        isOpen={isDetailsOpen}
        document={selectedDocument}
        isLoading={isDetailsLoading}
        error={detailsError}
        onClose={() => setIsDetailsOpen(false)}
      />
    </main>
  );
}
