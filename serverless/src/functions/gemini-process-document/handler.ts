import type { Context } from "aws-lambda";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { s3 } from "../../shared/s3";
import { readSecureParameter } from "../../shared/ssm";

interface GeminiProcessInput {
  bucket: string;
  key: string;
  userId: string;
  documentId: string;
}

interface GeminiProcessOutput extends GeminiProcessInput {
  confidence: number;
  summary: string;
  extractedText: string;
  classification: string;
  extractedFields: Record<string, string>;
  requiresApprovalReason: string;
}

const geminiResponseSchema = z
  .object({
    classification: z.string().min(1),
    confidence: z.number().min(0).max(1),
    summary: z.string().min(1),
    extractedText: z.string().min(1),
    extractedFields: z.record(z.string()),
    requiresApprovalReason: z.string().min(1)
  })
  .strict();

class GeminiProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "GeminiProcessingError";
  }
}

function resolveMimeType(key: string, contentType?: string): string {
  if (contentType && contentType.length > 0) {
    return contentType;
  }
  const normalized = key.toLowerCase();
  if (normalized.endsWith(".pdf")) return "application/pdf";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function buildPrompt(): string {
  return [
    "You are a document extraction service.",
    "Analyze the provided document and return STRICT JSON only.",
    "Do not include markdown, code fences, comments, or prose.",
    "Use this exact schema:",
    "{",
    '  "classification": "string",',
    '  "confidence": number,',
    '  "summary": "string",',
    '  "extractedText": "string",',
    '  "extractedFields": { "key": "value" },',
    '  "requiresApprovalReason": "string"',
    "}",
    "confidence must be between 0 and 1.",
    "requiresApprovalReason should explain why a human should or should not review the result."
  ].join("\n");
}

function parseGeminiJson(rawText: string, event: GeminiProcessInput): z.infer<typeof geminiResponseSchema> {
  const trimmed = rawText.trim();
  const normalized = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new GeminiProcessingError("Gemini returned invalid JSON.", "GEMINI_JSON_PARSE_ERROR", {
      documentId: event.documentId,
      userId: event.userId,
      bucket: event.bucket,
      key: event.key,
      responsePreview: normalized.slice(0, 400)
    });
  }

  const validation = geminiResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new GeminiProcessingError("Gemini JSON failed schema validation.", "GEMINI_SCHEMA_VALIDATION_ERROR", {
      documentId: event.documentId,
      userId: event.userId,
      issues: validation.error.issues
    });
  }

  return validation.data;
}

function getRequiredEnv(name: "GEMINI_API_KEY_PARAMETER"): string {
  const value = process.env[name];
  if (!value) {
    throw new GeminiProcessingError(`Missing required env var: ${name}`, "MISSING_ENV", { name });
  }
  return value;
}

export async function handler(event: GeminiProcessInput, context?: Context): Promise<GeminiProcessOutput> {
  const useMockGemini = process.env.MOCK_GEMINI !== "false";
  const requestId = context?.awsRequestId ?? "unknown";

  if (!event.documentId || !event.userId || !event.bucket || !event.key) {
    throw new GeminiProcessingError("Missing required processing fields in event payload.", "INVALID_EVENT", {
      requestId
    });
  }

  if (useMockGemini) {
    return {
      ...event,
      confidence: 0.99,
      summary: "Mock summary: document appears valid and ready for manual approval.",
      extractedText: "Mock extracted text for local/dev testing.",
      classification: "GENERAL_DOCUMENT",
      extractedFields: {
        documentType: "mock",
        confidence: "0.99",
        sourceKey: event.key
      },
      requiresApprovalReason: "Mock mode enabled. Human review recommended before production use."
    };
  }

  try {
    console.info("gemini-process-document start", {
      requestId,
      documentId: event.documentId,
      userId: event.userId,
      bucket: event.bucket,
      key: event.key
    });

    const s3Object = await s3.send(
      new GetObjectCommand({
        Bucket: event.bucket,
        Key: event.key
      })
    );

    if (!s3Object.Body) {
      throw new GeminiProcessingError("S3 object body is empty.", "EMPTY_S3_OBJECT", {
        requestId,
        documentId: event.documentId,
        key: event.key
      });
    }

    const bytes = await s3Object.Body.transformToByteArray();
    const base64Data = Buffer.from(bytes).toString("base64");
    const mimeType = resolveMimeType(event.key, s3Object.ContentType);
    const apiKey = await readSecureParameter(getRequiredEnv("GEMINI_API_KEY_PARAMETER"));
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const response = await model.generateContent([
      buildPrompt(),
      {
        inlineData: {
          mimeType,
          data: base64Data
        }
      }
    ]);

    const outputText = response.response.text();
    const parsed = parseGeminiJson(outputText, event);

    console.info("gemini-process-document success", {
      requestId,
      documentId: event.documentId,
      userId: event.userId,
      classification: parsed.classification,
      confidence: parsed.confidence
    });

    return {
      ...event,
      confidence: parsed.confidence,
      summary: parsed.summary,
      extractedText: parsed.extractedText,
      classification: parsed.classification,
      extractedFields: parsed.extractedFields,
      requiresApprovalReason: parsed.requiresApprovalReason
    };
  } catch (error) {
    if (error instanceof GeminiProcessingError) {
      console.error("gemini-process-document structured failure", {
        requestId,
        code: error.code,
        message: error.message,
        details: error.details
      });
      throw error;
    }

    const normalized = error instanceof Error ? { name: error.name, message: error.message } : { error };
    console.error("gemini-process-document unhandled failure", {
      requestId,
      documentId: event.documentId,
      userId: event.userId,
      bucket: event.bucket,
      key: event.key,
      error: normalized
    });
    throw new GeminiProcessingError("Gemini processing failed.", "GEMINI_PROCESSING_ERROR", {
      requestId,
      documentId: event.documentId,
      error: normalized
    });
  }
}
