export const DOCUMENT_STATUSES = [
  "UPLOADING",
  "UPLOADED",
  "PROCESSING",
  "AI_COMPLETED",
  "NEEDS_APPROVAL",
  "READY_FOR_APPROVAL",
  "APPROVED",
  "REJECTED",
  "FAILED"
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

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

export interface DocumentRecord {
  PK: string;
  SK: string;
  documentId: string;
  status: DocumentStatus;
  bucket: string;
  key: string;
  createdAt: string;
  updatedAt?: string;
  extractedText?: string;
  summary?: string;
  classification?: string;
  extractedFields?: Record<string, string | null>;
  errorMessage?: string;
  taskToken?: string;
  approvalRequestedAt?: string;
  documentEvents?: DocumentEvent[];
  metadata?: Record<string, string>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface GeminiResult {
  model: string;
  outputText: string;
  tokensUsed?: number;
  rawResponse?: unknown;
}
