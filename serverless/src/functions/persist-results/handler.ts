import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../shared/ddb";

interface PersistInput {
  userId: string;
  documentId: string;
  gemini?: {
    Payload?: {
      summary?: string;
      classification?: string;
      extractedText?: string;
      extractedFields?: Record<string, string | null>;
    };
  };
  summary?: string;
  classification?: string;
  extractedText?: string;
  extractedFields?: Record<string, string | null>;
}

function coalesceResult(event: PersistInput): {
  summary: string;
  classification: string;
  extractedText: string;
  extractedFields: Record<string, string | null>;
} {
  const payload = event.gemini?.Payload;
  return {
    summary: payload?.summary ?? event.summary ?? "",
    classification: payload?.classification ?? event.classification ?? "UNCLASSIFIED",
    extractedText: payload?.extractedText ?? event.extractedText ?? "",
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

  const { summary, classification, extractedText, extractedFields } = coalesceResult(event);
  const tableName = readTableName();

  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: `USER#${event.userId}`,
        SK: `DOC#${event.documentId}`
      },
      UpdateExpression:
        "SET #status = :status, summary = :summary, classification = :classification, extractedText = :extractedText, extractedFields = :extractedFields, updatedAt = :updatedAt, documentEvents = list_append(if_not_exists(documentEvents, :empty), :events)",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":status": "AI_COMPLETED",
        ":summary": summary,
        ":classification": classification,
        ":extractedText": extractedText,
        ":extractedFields": extractedFields,
        ":updatedAt": new Date().toISOString(),
        ":empty": [],
        ":events": [
          {
            type: "AI_COMPLETED",
            at: new Date().toISOString(),
            message: "AI extraction completed."
          }
        ]
      }
    })
  );

  return { ok: true, documentId: event.documentId };
}
