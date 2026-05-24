import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../shared/ddb";

interface PersistInput {
  userId: string;
  documentId: string;
  gemini?: {
    Payload?: {
      summary?: string;
      classification?: string;
      extractedFields?: Record<string, string>;
    };
  };
  summary?: string;
  classification?: string;
  extractedFields?: Record<string, string>;
}

function coalesceResult(event: PersistInput): {
  summary: string;
  classification: string;
  extractedFields: Record<string, string>;
} {
  const payload = event.gemini?.Payload;
  return {
    summary: payload?.summary ?? event.summary ?? "",
    classification: payload?.classification ?? event.classification ?? "UNCLASSIFIED",
    extractedFields: payload?.extractedFields ?? event.extractedFields ?? {}
  };
}

function readTableName(): string {
  const tableName = process.env.DOCUMENTS_TABLE;
  if (!tableName) {
    throw new Error("Missing required env var DOCUMENTS_TABLE");
  }
  return tableName;
}

export async function handler(event: PersistInput): Promise<{ ok: boolean; documentId: string }> {
  if (!event.userId || !event.documentId) {
    throw new Error("userId and documentId are required");
  }

  const { summary, classification, extractedFields } = coalesceResult(event);
  const tableName = readTableName();

  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: `USER#${event.userId}`,
        SK: `DOC#${event.documentId}`
      },
      UpdateExpression:
        "SET #status = :status, summary = :summary, classification = :classification, extractedFields = :extractedFields, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":status": "NEEDS_APPROVAL",
        ":summary": summary,
        ":classification": classification,
        ":extractedFields": extractedFields,
        ":updatedAt": new Date().toISOString()
      }
    })
  );

  return { ok: true, documentId: event.documentId };
}
