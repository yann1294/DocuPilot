import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockS3Send,
  mockReadSecureParameter,
  mockGenerateContent,
  mockGetGenerativeModel,
  mockGoogleGenerativeAI
} = vi.hoisted(() => {
  const generateContent = vi.fn();
  const getGenerativeModel = vi.fn(() => ({ generateContent }));
  const googleGenerativeAI = vi.fn(() => ({ getGenerativeModel }));

  return {
    mockS3Send: vi.fn(),
    mockReadSecureParameter: vi.fn(),
    mockGenerateContent: generateContent,
    mockGetGenerativeModel: getGenerativeModel,
    mockGoogleGenerativeAI: googleGenerativeAI
  };
});

vi.mock("../../shared/s3", () => ({
  s3: {
    send: mockS3Send
  }
}));

vi.mock("../../shared/ssm", () => ({
  readSecureParameter: mockReadSecureParameter
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: mockGoogleGenerativeAI
}));

import { handler } from "./handler";

describe("gemini-process-document JSON extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOCK_GEMINI = "false";
    process.env.GEMINI_API_KEY_PARAMETER = "/docupilot/dev/GEMINI_API_KEY";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";

    mockS3Send.mockResolvedValue({
      Body: {
        transformToByteArray: async () => Uint8Array.from([1, 2, 3, 4])
      },
      ContentType: "application/pdf"
    });
    mockReadSecureParameter.mockResolvedValue("fake-key");
  });

  it("handles plain JSON response", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            classification: "INVOICE",
            confidence: 0.98,
            summary: "Invoice detected",
            extractedText: "Invoice #INV-1",
            extractedFields: { invoiceNumber: "INV-1" },
            requiresApprovalReason: "Financial documents require review"
          })
      }
    });

    const result = await handler({
      bucket: "bucket",
      key: "uploads/u/d/file.pdf",
      userId: "u",
      documentId: "d"
    });

    expect(result.classification).toBe("INVOICE");
    expect(result.extractedFields.invoiceNumber).toBe("INV-1");
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: "gemini-2.5-flash" });
  });

  it("handles fenced JSON response", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () =>
          "```json\n" +
          JSON.stringify({
            classification: "RECEIPT",
            confidence: 0.88,
            summary: "Receipt detected",
            extractedText: "Receipt text",
            extractedFields: { merchant: "Store" },
            requiresApprovalReason: "Low confidence"
          }) +
          "\n```"
      }
    });

    const result = await handler({
      bucket: "bucket",
      key: "uploads/u/d/file.pdf",
      userId: "u",
      documentId: "d"
    });

    expect(result.classification).toBe("RECEIPT");
    expect(result.extractedFields.merchant).toBe("Store");
  });
});
