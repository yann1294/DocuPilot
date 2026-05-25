import { X } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { DocumentDetails } from "@/lib/types";

interface DocumentDetailsPanelProps {
  isOpen: boolean;
  document: DocumentDetails | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

function formatDate(input?: string): string {
  if (!input) return "-";
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export function DocumentDetailsPanel({ isOpen, document, isLoading, error, onClose }: DocumentDetailsPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Document Details</h2>
            {document && <p className="text-xs text-slate-500">{document.documentId}</p>}
          </div>
          <Button variant="outline" className="h-8 px-2" onClick={onClose} aria-label="Close details">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-5">
          {isLoading && <p className="text-sm text-slate-600">Loading document details...</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}

          {!isLoading && !error && document && (
            <>
              <section className="space-y-2 rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Overview</h3>
                <div className="grid grid-cols-1 gap-2 text-sm text-slate-700">
                  <p><span className="font-medium text-slate-900">File:</span> {document.fileName}</p>
                  <p><span className="font-medium text-slate-900">Type:</span> {document.mimeType}</p>
                  <p className="flex items-center gap-2"><span className="font-medium text-slate-900">Status:</span> <StatusBadge status={document.status} /></p>
                  <p><span className="font-medium text-slate-900">Classification:</span> {document.classification || "-"}</p>
                  <p><span className="font-medium text-slate-900">Created:</span> {formatDate(document.createdAt)}</p>
                  <p><span className="font-medium text-slate-900">Updated:</span> {formatDate(document.updatedAt)}</p>
                </div>
              </section>

              <section className="space-y-2 rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Summary</h3>
                <p className="text-sm text-slate-700">{document.summary || "-"}</p>
              </section>

              <section className="space-y-2 rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Extracted Fields</h3>
                {document.extractedFields && Object.keys(document.extractedFields).length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-slate-600">
                        <tr>
                          <th className="px-3 py-2 font-medium">Field</th>
                          <th className="px-3 py-2 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                        {Object.entries(document.extractedFields).map(([key, value]) => (
                          <tr key={key}>
                            <td className="px-3 py-2 font-medium text-slate-900">{key}</td>
                            <td className="px-3 py-2 break-all">{value || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No extracted fields available.</p>
                )}
              </section>

              {document.errorMessage && (
                <section className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <h3 className="text-sm font-semibold text-rose-900">Error</h3>
                  <p className="text-sm text-rose-800">{document.errorMessage}</p>
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
