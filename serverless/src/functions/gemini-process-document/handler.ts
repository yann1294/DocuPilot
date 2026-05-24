interface GeminiProcessInput {
  bucket: string;
  key: string;
  userId: string;
  documentId: string;
}

interface GeminiProcessOutput extends GeminiProcessInput {
  summary: string;
  classification: string;
  extractedFields: Record<string, string>;
}

export async function handler(event: GeminiProcessInput): Promise<GeminiProcessOutput> {
  const useMockGemini = process.env.MOCK_GEMINI !== "false";

  if (!event.documentId || !event.userId || !event.bucket || !event.key) {
    throw new Error("Missing required processing fields in event payload.");
  }

  if (useMockGemini) {
    return {
      ...event,
      summary: "Mock summary: document appears valid and ready for manual approval.",
      classification: "GENERAL_DOCUMENT",
      extractedFields: {
        documentType: "mock",
        confidence: "0.99",
        sourceKey: event.key
      }
    };
  }

  throw new Error("Real Gemini integration not enabled yet. Set MOCK_GEMINI=true.");
}
