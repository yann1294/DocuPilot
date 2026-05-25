import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { SendTaskFailureCommand, SendTaskSuccessCommand, SFNClient } from "@aws-sdk/client-sfn";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { requireClerkUserId } from "../../shared/auth";
import { ddb } from "../../shared/ddb";
import { errorResponse, json } from "../../shared/response";
import type { DocumentRecord } from "../../shared/types";

const sfn = new SFNClient({});

interface ApproveRequestBody {
  approved: boolean;
  comment?: string;
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
    if (!event.body) {
      return errorResponse(400, "INVALID_REQUEST", "Request body is required.");
    }

    let payload: ApproveRequestBody;
    try {
      payload = JSON.parse(event.body) as ApproveRequestBody;
    } catch {
      return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    if (typeof payload.approved !== "boolean") {
      return errorResponse(400, "INVALID_REQUEST", "approved must be a boolean.");
    }

    const tableName = readTableName();
    const result = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `DOC#${documentId}`
        }
      })
    );

    const item = result.Item as (DocumentRecord & { taskToken?: string; approvalComment?: string }) | undefined;
    if (!item) {
      return errorResponse(404, "NOT_FOUND", "Document not found.");
    }

    const previousStatus = item.status;
    const finalStatus = payload.approved ? "APPROVED" : "REJECTED";
    console.info("approve-document request", {
      documentId,
      userId,
      approved: payload.approved,
      previousStatus,
      finalStatus
    });

    if (previousStatus !== "NEEDS_APPROVAL") {
      return errorResponse(409, "INVALID_STATUS", "Document is not waiting for approval.");
    }

    if (item.taskToken) {
      try {
        if (payload.approved) {
          await sfn.send(
            new SendTaskSuccessCommand({
              taskToken: item.taskToken,
              output: JSON.stringify({
                approved: true,
                comment: payload.comment ?? ""
              })
            })
          );
        } else {
          await sfn.send(
            new SendTaskFailureCommand({
              taskToken: item.taskToken,
              error: "DocumentRejected",
              cause: payload.comment ?? "Document rejected by reviewer."
            })
          );
        }
      } catch (error) {
        console.error("approve-document step-functions callback failed", {
          documentId,
          userId,
          approved: payload.approved,
          error
        });
        return errorResponse(
          409,
          "APPROVAL_CALLBACK_CONFLICT",
          "Could not complete approval callback. The workflow may have already ended or task token is invalid."
        );
      }
    } else {
      console.info("approve-document no taskToken found, updating DynamoDB only", {
        documentId,
        userId
      });
    }

    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `DOC#${documentId}`
        },
        UpdateExpression:
          "SET #status = :status, updatedAt = :updatedAt, approvalComment = :approvalComment REMOVE taskToken",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":status": finalStatus,
          ":updatedAt": new Date().toISOString(),
          ":approvalComment": payload.comment ?? ""
        }
      })
    );

    console.info("approve-document success", {
      documentId,
      userId,
      approved: payload.approved,
      previousStatus,
      finalStatus
    });

    return json(200, {
      documentId,
      status: finalStatus
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing Clerk user id")) {
      return errorResponse(401, "UNAUTHORIZED", "Authentication required.");
    }
    console.error("approve-document failed", error);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to process approval decision.");
  }
};
