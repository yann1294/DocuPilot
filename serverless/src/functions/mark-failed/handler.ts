import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../shared/ddb";

interface FailedInput {
  userId: string;
  documentId: string;
  error?: {
    Error?: string;
    Cause?: string;
  };
}

function readTableName(): string {
  const tableName = process.env.DOCUMENTS_TABLE;
  if (!tableName) {
    throw new Error("Missing required env var DOCUMENTS_TABLE");
  }
  return tableName;
}

export async function handler(event: FailedInput): Promise<{ ok: boolean; documentId: string }> {
  if (!event.userId || !event.documentId) {
    throw new Error("userId and documentId are required");
  }

  const tableName = readTableName();
  const errorMessage = event.error?.Cause || event.error?.Error || "Unknown processing error";
  const now = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: `USER#${event.userId}`,
        SK: `DOC#${event.documentId}`
      },
      UpdateExpression:
        "SET #status = :status, errorMessage = :errorMessage, updatedAt = :updatedAt, documentEvents = list_append(if_not_exists(documentEvents, :empty), :events)",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":status": "FAILED",
        ":errorMessage": errorMessage,
        ":updatedAt": now,
        ":empty": [],
        ":events": [
          {
            type: "FAILED",
            at: now,
            message: errorMessage
          }
        ]
      }
    })
  );

  return { ok: true, documentId: event.documentId };
}
