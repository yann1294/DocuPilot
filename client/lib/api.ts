import type {
  CreateUploadUrlRequest,
  CreateUploadUrlResponse,
  GetDocumentResponse,
  ListDocumentsResponse
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type GetToken = (options: { template: "docupilot-api" }) => Promise<string | null>;

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set.");
  }
  return API_BASE_URL;
}

export async function createUploadUrl(
  input: CreateUploadUrlRequest,
  getToken: GetToken
): Promise<CreateUploadUrlResponse> {
  const token = await getToken({ template: "docupilot-api" });
  if (!token) {
    throw new Error("Failed to get Clerk token.");
  }

  const response = await fetch(`${getApiBaseUrl()}/uploads`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to request upload URL.");
  }

  return (await response.json()) as CreateUploadUrlResponse;
}

export async function listDocuments(getToken: GetToken): Promise<ListDocumentsResponse> {
  const token = await getToken({ template: "docupilot-api" });
  if (!token) {
    throw new Error("Failed to get Clerk token.");
  }

  const response = await fetch(`${getApiBaseUrl()}/documents`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to list documents.");
  }

  return (await response.json()) as ListDocumentsResponse;
}

export async function getDocument(documentId: string, getToken: GetToken): Promise<GetDocumentResponse> {
  const token = await getToken({ template: "docupilot-api" });
  if (!token) {
    throw new Error("Failed to get Clerk token.");
  }

  const response = await fetch(`${getApiBaseUrl()}/documents/${encodeURIComponent(documentId)}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to get document.");
  }

  return (await response.json()) as GetDocumentResponse;
}

export async function approveDocument(
  getToken: GetToken,
  documentId: string,
  approved: boolean,
  comment?: string
): Promise<{ documentId: string; status: "APPROVED" | "REJECTED" }> {
  const token = await getToken({ template: "docupilot-api" });
  if (!token) {
    throw new Error("Failed to get Clerk token.");
  }

  const response = await fetch(`${getApiBaseUrl()}/documents/${encodeURIComponent(documentId)}/approval`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      approved,
      ...(comment ? { comment } : {})
    })
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = "Failed to update approval status.";

    try {
      const payload = JSON.parse(raw) as { error?: { message?: string }; message?: string };
      if (payload?.error?.message) {
        message = payload.error.message;
      } else if (payload?.message) {
        message = payload.message;
      }
    } catch {
      if (raw.trim().length > 0) {
        message = raw;
      }
    }
    throw new ApiRequestError(response.status, message);
  }

  return (await response.json()) as { documentId: string; status: "APPROVED" | "REJECTED" };
}

export async function uploadFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Upload failed with status ${xhr.status}.`));
    };

    xhr.onerror = () => reject(new Error("Upload failed due to a network error."));
    xhr.send(file);
  });
}
