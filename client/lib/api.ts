const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function fetchDocuments(): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/documents`);
  if (!response.ok) {
    throw new Error("Failed to fetch documents");
  }
  return response.json();
}
