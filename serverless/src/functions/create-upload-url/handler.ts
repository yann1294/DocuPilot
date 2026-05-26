import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { getClerkUserId } from "../../shared/auth";
import { ddb } from "../../shared/ddb";
import { errorResponse, json } from "../../shared/response";
import { s3 } from "../../shared/s3";
import type { DocumentEvent, DocumentRecord } from "../../shared/types";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp"
]);

const requestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive()
});

function getRequiredEnv(name: "DOCUMENTS_TABLE" | "DOCUMENTS_BUCKET"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split("/").pop() ?? "upload";
  const normalized = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized.length > 0 ? normalized : "upload";
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  const requestId = event.requestContext.requestId ?? randomUUID();

  try {
    const userId = getClerkUserId(event);
    if (!userId) {
      console.warn("create-upload-url unauthorized", { requestId });
      return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
    }

    if (!event.body) {
      return errorResponse(400, "INVALID_REQUEST", "Request body is required.");
    }

    const parsedBody = requestSchema.safeParse(JSON.parse(event.body));
    if (!parsedBody.success) {
      return errorResponse(400, "INVALID_REQUEST", "Invalid request body.", parsedBody.error.flatten());
    }

    const { fileName, mimeType, fileSize } = parsedBody.data;
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return errorResponse(400, "UNSUPPORTED_MIME_TYPE", "Unsupported file type.");
    }

    const tableName = getRequiredEnv("DOCUMENTS_TABLE");
    const bucketName = getRequiredEnv("DOCUMENTS_BUCKET");
    const documentId = randomUUID();
    const safeFileName = sanitizeFileName(fileName);
    const fileKey = `uploads/${userId}/${documentId}/${safeFileName}`;
    const now = new Date().toISOString();
    const awsRegion = process.env.AWS_REGION;

    console.info("create-upload-url ddb preflight", {
      DOCUMENTS_TABLE: tableName,
      DOCUMENTS_BUCKET: bucketName,
      AWS_REGION: awsRegion,
      requestId,
      userId,
      documentId
    });

    const item: DocumentRecord = {
      PK: `USER#${userId}`,
      SK: `DOC#${documentId}`,
      documentId,
      status: "UPLOADING",
      bucket: bucketName,
      key: fileKey,
      createdAt: now,
      updatedAt: now,
      documentEvents: [
        {
          type: "UPLOAD_REQUESTED",
          at: now,
          message: "Upload URL generated."
        } satisfies DocumentEvent
      ],
      metadata: {
        fileName: safeFileName,
        mimeType,
        fileSize: String(fileSize),
        userId
      }
    };

    try {
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        })
      );
    } catch (error) {
      if (error instanceof Error && error.name === "ResourceNotFoundException") {
        console.error(
          "DynamoDB table not found. Check DOCUMENTS_TABLE and AWS_REGION in events/local-env.json.",
          {
            DOCUMENTS_TABLE: tableName,
            AWS_REGION: awsRegion,
            requestId,
            userId,
            documentId
          }
        );
      }
      throw error;
    }

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        ContentType: mimeType
      }),
      { expiresIn: 300 }
    );

    console.info("create-upload-url success", {
      requestId,
      userId,
      documentId,
      fileKey
    });

    return json(200, {
      documentId,
      uploadUrl,
      fileKey
    });
  } catch (error) {
    console.error("create-upload-url failed", {
      requestId,
      error: error instanceof Error ? { name: error.name, message: error.message } : error
    });

    if (error instanceof SyntaxError) {
      return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    return errorResponse(500, "INTERNAL_ERROR", "Failed to create upload URL.");
  }
};
