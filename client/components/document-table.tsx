import { Eye, FileSearch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentItem } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";

interface DocumentTableProps {
  documents: DocumentItem[];
  onRefresh?: () => void;
}

function formatDate(input: string): string {
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

export function DocumentTable({ documents, onRefresh }: DocumentTableProps) {
  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <FileSearch className="h-6 w-6 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No documents yet</h3>
          <p className="mt-1 text-sm text-slate-600">Upload a file to populate your command center table.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <CardTitle>Document Pipeline</CardTitle>
          <CardDescription>Track extraction and approval progress for uploaded files.</CardDescription>
        </div>
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">File name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Summary</th>
                <th className="px-4 py-3 font-medium">Created date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {documents.map((doc) => (
                <tr key={doc.documentId} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{doc.fileName}</p>
                    {doc.classification && (
                      <Badge variant="secondary" className="mt-1">
                        {doc.classification}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{doc.mimeType}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="max-w-sm px-4 py-3">
                    <p className="line-clamp-2 text-slate-700">{doc.summary || "-"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(doc.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Button variant="outline" className="h-8 px-3 py-1 text-xs">
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
