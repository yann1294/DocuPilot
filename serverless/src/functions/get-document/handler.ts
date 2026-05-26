import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../shared/ddb";
import { requireClerkUserId } from "../../shared/auth";
import { errorResponse, json } from "../../shared/response";
import type { DocumentEvent, DocumentRecord, DocumentStatus } from "../../shared/types";

interface GetDocumentResponse {
  document: {
    documentId: string;
    fileName: string;
    mimeType: string;
    status: DocumentStatus;
    approvalReady: boolean;
    summary: string;
    classification: string;
    createdAt: string;
    updatedAt?: string;
    extractedFields?: Record<string, string | null>;
    errorMessage?: string;
    documentEvents: DocumentEvent[];
  };
}

function readTableName(): string {
  const tableName = process.env.DOCUMENTS_TABLE;
  if (!tableName) {
    throw new Error("Missing required env var DOCUMENTS_TABLE");
  }
  return tableName;
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const userId = requireClerkUserId(event);
    const documentId = event.pathParameters?.documentId;
    if (!documentId) {
      return errorResponse(400, "INVALID_REQUEST", "documentId path parameter is required.");
    }

    const result = await ddb.send(
      new GetCommand({
        TableName: readTableName(),
        Key: {
          PK: `USER#${userId}`,
          SK: `DOC#${documentId}`
        }
      })
    );

    const item = result.Item as DocumentRecord | undefined;
    if (!item) {
      return errorResponse(404, "NOT_FOUND", "Document not found.");
    }

    return json<GetDocumentResponse>(200, {
      document: {
        documentId: item.documentId,
        fileName: item.metadata?.fileName ?? item.key.split("/").pop() ?? "unknown",
        mimeType: item.metadata?.mimeType ?? "application/octet-stream",
        status: item.status,
        approvalReady: item.status === "NEEDS_APPROVAL" && Boolean(item.taskToken),
        summary: item.summary ?? "",
        classification: item.classification ?? "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        extractedFields: item.extractedFields,
        errorMessage: item.errorMessage,
        documentEvents: item.documentEvents ?? []
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing Clerk user id")) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
    }
    console.error("get-document failed", error);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to get document.");
  }
};
