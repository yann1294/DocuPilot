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
  extractedFields: Record<string, string | null>;
  requiresApprovalReason: string;
}

const geminiResponseSchema = z
  .object({
    classification: z.string().min(1).default("other"),
    confidence: z.coerce.number().min(0).max(1).default(0),
    summary: z.string().default(""),
    extractedText: z.string().default(""),
    extractedFields: z.record(z.string().nullable()).nullable().default({}),
    requiresApprovalReason: z.string().default("")
  })
  .passthrough();

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
    "All keys below are REQUIRED; if unknown, return null or empty string as appropriate.",
    "Use this exact schema:",
    "{",
    '  "classification": "string",',
    '  "confidence": number,',
    '  "summary": "string",',
    '  "extractedText": "string",',
    '  "extractedFields": { "key": "value or null" },',
    '  "requiresApprovalReason": "string"',
    "}",
    "confidence must be between 0 and 1.",
    "Unknown/extra fields are allowed only if nullable."
  ].join("\n");
}

type GeminiNormalizedResult = Pick<
  GeminiProcessOutput,
  "classification" | "confidence" | "summary" | "extractedText" | "extractedFields" | "requiresApprovalReason"
>;

function fallbackResult(): GeminiNormalizedResult {
  return {
    classification: "other",
    confidence: 0,
    summary: "AI extraction completed, but the response did not fully match the expected schema.",
    extractedText: "",
    extractedFields: {
      rawClassification: null,
      rawConfidence: null,
      rawSummary: null,
      rawExtractedText: null,
      rawExtractedFields: null,
      rawRequiresApprovalReason: null
    },
    requiresApprovalReason: "AI extraction returned incomplete structured data."
  };
}

function extractJsonCandidate(rawText: string): string | null {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  if (firstBrace < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(firstBrace, i + 1);
      }
    }
  }

  return null;
}

function normalizeGeminiResult(raw: unknown): unknown {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const extractedFieldsRaw = input.extractedFields;
  let extractedFields: Record<string, string | null> | null = null;
  if (extractedFieldsRaw && typeof extractedFieldsRaw === "object" && !Array.isArray(extractedFieldsRaw)) {
    extractedFields = Object.fromEntries(
      Object.entries(extractedFieldsRaw as Record<string, unknown>).map(([k, v]) => [k, v == null ? null : String(v)])
    );
  }

  return {
    classification: typeof input.classification === "string" ? input.classification : "other",
    confidence: input.confidence,
    summary: input.summary == null ? "" : String(input.summary),
    extractedText: input.extractedText == null ? "" : String(input.extractedText),
    extractedFields,
    requiresApprovalReason: input.requiresApprovalReason == null ? "" : String(input.requiresApprovalReason)
  };
}

function parseGeminiJson(rawText: string): z.infer<typeof geminiResponseSchema> {
  const candidate = extractJsonCandidate(rawText);
  if (!candidate) {
    return geminiResponseSchema.parse(fallbackResult());
  }

  try {
    const parsed = JSON.parse(candidate);
    const normalized = normalizeGeminiResult(parsed);
    const validation = geminiResponseSchema.safeParse(normalized);
    if (!validation.success) {
      return geminiResponseSchema.parse(fallbackResult());
    }
    const classification = validation.data.classification.trim().toLowerCase();
    const allowed = new Set(["invoice", "receipt", "contract", "id_document", "general_document", "other"]);
    return {
      ...validation.data,
      classification: allowed.has(classification) ? classification : "other",
      extractedFields: validation.data.extractedFields ?? {}
    };
  } catch {
    return geminiResponseSchema.parse(fallbackResult());
  }
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

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: buildPrompt() },
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    } as never);

    const outputText = response.response.text();
    const parsed = parseGeminiJson(outputText);

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
      extractedFields: parsed.extractedFields ?? {},
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
