import type { CreateUploadUrlRequest, CreateUploadUrlResponse } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type GetToken = (options: { template: "docupilot-api" }) => Promise<string | null>;

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
