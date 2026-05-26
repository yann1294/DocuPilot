export type DocumentStatus =
  | "UPLOADING"
  | "PROCESSING"
  | "AI_COMPLETED"
  | "NEEDS_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "FAILED";

export type DocumentEventType =
  | "UPLOAD_REQUESTED"
  | "FILE_UPLOADED"
  | "PROCESSING_STARTED"
  | "AI_COMPLETED"
  | "APPROVAL_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "FAILED";

export interface DocumentEvent {
  type: DocumentEventType;
  at: string;
  message?: string;
}

export interface DocumentItem {
  documentId: string;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
  approvalReady: boolean;
  summary: string;
  classification?: string;
  createdAt: string;
}

export interface ListDocumentsResponse {
  documents: DocumentItem[];
}

export interface DocumentDetails {
  documentId: string;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
  approvalReady: boolean;
  summary: string;
  classification: string;
  createdAt: string;
  updatedAt?: string;
  extractedFields?: Record<string, string | null>;
  errorMessage?: string;
  documentEvents: DocumentEvent[];
}

export interface GetDocumentResponse {
  document: DocumentDetails;
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
