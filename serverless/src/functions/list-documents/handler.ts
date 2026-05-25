import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../shared/ddb";
import { requireClerkUserId } from "../../shared/auth";
import { errorResponse, json } from "../../shared/response";
import type { DocumentRecord, DocumentStatus } from "../../shared/types";

interface ListedDocument {
  documentId: string;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
  summary: string;
  classification: string;
  createdAt: string;
}

interface ListDocumentsResponse {
  documents: ListedDocument[];
}

function readTableName(): string {
  const tableName = process.env.DOCUMENTS_TABLE;
  if (!tableName) {
    throw new Error("Missing required env var DOCUMENTS_TABLE");
  }
  return tableName;
}

function toListedDocument(item: DocumentRecord): ListedDocument {
  return {
    documentId: item.documentId,
    fileName: item.metadata?.fileName ?? item.key.split("/").pop() ?? "unknown",
    mimeType: item.metadata?.mimeType ?? "application/octet-stream",
    status: item.status,
    summary: item.summary ?? "",
    classification: item.classification ?? "",
    createdAt: item.createdAt
  };
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const userId = requireClerkUserId(event);
    const tableName = readTableName();

    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`
        }
      })
    );

    const documents = (result.Items ?? [])
      .filter((item): item is DocumentRecord => typeof item?.documentId === "string")
      .map(toListedDocument)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return json<ListDocumentsResponse>(200, { documents });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing Clerk user id")) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
    }
    console.error("list-documents failed", error);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to list documents.");
  }
};
