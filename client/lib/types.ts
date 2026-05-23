export type DocumentStatus =
  | "UPLOADING"
  | "PROCESSING"
  | "READY_FOR_APPROVAL"
  | "NEEDS_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "FAILED";

export interface DocumentItem {
  documentId: string;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
  summary: string;
  classification?: string;
  createdAt: string;
}

export type UploadState = "idle" | "requesting_url" | "uploading" | "uploaded" | "error";

export interface CreateUploadUrlRequest {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface CreateUploadUrlResponse {
  documentId: string;
  uploadUrl: string;
  fileKey: string;
}
