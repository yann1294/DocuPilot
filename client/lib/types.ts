export interface DocumentItem {
  documentId: string;
  status: "UPLOADING" | "PROCESSING" | "READY_FOR_APPROVAL" | "COMPLETED" | "FAILED";
  createdAt: string;
}
