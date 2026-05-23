export const DOCUMENT_STATUSES = [
  "UPLOADED",
  "PROCESSING",
  "READY_FOR_APPROVAL",
  "APPROVED",
  "REJECTED",
  "FAILED"
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

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
