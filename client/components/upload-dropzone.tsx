"use client";

import { useState, type ChangeEvent } from "react";
import { Loader2, UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { createUploadUrl, uploadFileToPresignedUrl } from "@/lib/api";
import type { UploadState } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

const stateLabel: Record<UploadState, string> = {
  idle: "idle",
  requesting_url: "requesting upload URL",
  uploading: "uploading to S3",
  uploaded: "uploaded",
  error: "error"
};

export function UploadDropzone() {
  const { getToken } = useAuth();
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setDocumentId(null);
    setErrorMessage(null);
    setProgress(0);

    if (!file) {
      setState("idle");
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setState("error");
      setErrorMessage("Unsupported file type. Use PDF, PNG, JPEG, or WEBP.");
      return;
    }

    try {
      setState("requesting_url");
      const uploadTarget = await createUploadUrl(
        {
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size
        },
        getToken
      );

      setState("uploading");
      await uploadFileToPresignedUrl(uploadTarget.uploadUrl, file, setProgress);
      setDocumentId(uploadTarget.documentId);
      setState("uploaded");
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>Send one file directly to S3 using a secure pre-signed URL.</CardDescription>
        </div>
        <Badge>Secure Upload</Badge>
      </CardHeader>
      <CardContent>
        <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
          <UploadCloud className="mx-auto h-8 w-8 text-slate-500" />
          <span className="mt-3 block text-sm font-medium text-slate-800">Choose file to upload</span>
          <span className="mt-1 block text-xs text-slate-500">PDF, PNG, JPEG, WEBP</span>
          <input className="hidden" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={onFileChange} />
        </label>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            {(state === "requesting_url" || state === "uploading") && (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            )}
            {state === "uploaded" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            {state === "error" && <AlertCircle className="h-4 w-4 text-rose-600" />}
            <span>State: {stateLabel[state]}</span>
          </div>

          {state === "uploading" && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-600">{progress}% complete</p>
            </div>
          )}

          {state === "uploaded" && documentId && (
            <p className="mt-2 text-xs text-slate-600">Document ID: {documentId}</p>
          )}

          {state === "error" && errorMessage && <p className="mt-2 text-xs text-rose-600">{errorMessage}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
