import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../shared/ddb";

interface RecordApprovalTokenInput {
  userId: string;
  documentId: string;
  taskToken?: string;
}

function readTableName(): string {
  const tableName = process.env.DOCUMENTS_TABLE;
  if (!tableName) {
    throw new Error("Missing required env var DOCUMENTS_TABLE");
  }
  return tableName;
}

export const handler = async (input: RecordApprovalTokenInput): Promise<{ ok: boolean; documentId: string }> => {
  if (!input.userId || !input.documentId) {
    throw new Error("userId and documentId are required");
  }
  if (!input.taskToken) {
    throw new Error("taskToken is required");
  }

  const now = new Date().toISOString();
  console.info("record-approval-token request", {
    documentId: input.documentId,
    userId: input.userId,
    hasTaskToken: true
  });

  await ddb.send(
    new UpdateCommand({
      TableName: readTableName(),
      Key: {
        PK: `USER#${input.userId}`,
        SK: `DOC#${input.documentId}`
      },
      UpdateExpression:
        "SET #status = :status, taskToken = :taskToken, approvalRequestedAt = :approvalRequestedAt, updatedAt = :updatedAt, documentEvents = list_append(if_not_exists(documentEvents, :empty), :events)",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":status": "NEEDS_APPROVAL",
        ":taskToken": input.taskToken,
        ":approvalRequestedAt": now,
        ":updatedAt": now,
        ":empty": [],
        ":events": [
          {
            type: "APPROVAL_REQUESTED",
            at: now,
            message: "Waiting for manual approval."
          }
        ]
      }
    })
  );

  return { ok: true, documentId: input.documentId };
};
