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

function callbackRejectedByStepFunctions(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === "InvalidToken" ||
    error.name === "TaskTimedOut" ||
    error.name === "TaskDoesNotExist" ||
    error.name === "InvalidOutput"
  );
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
      console.warn("approve-document conflict: document not found", {
        documentId,
        userId,
        currentStatus: null,
        hasTaskToken: false,
        callbackAttempted: false
      });
      return errorResponse(
        409,
        "APPROVAL_DOCUMENT_NOT_FOUND",
        "Approval conflict: document not found for this user."
      );
    }

    const previousStatus = item.status;
    const finalStatus = payload.approved ? "APPROVED" : "REJECTED";
    console.info("approve-document request", {
      documentId,
      userId,
      approved: payload.approved,
      currentStatus: previousStatus,
      finalStatus,
      hasTaskToken: Boolean(item.taskToken),
      callbackAttempted: false
    });

    if (previousStatus !== "NEEDS_APPROVAL") {
      console.warn("approve-document conflict: invalid current status", {
        documentId,
        userId,
        currentStatus: previousStatus,
        hasTaskToken: Boolean(item.taskToken),
        callbackAttempted: false
      });
      return errorResponse(
        409,
        "APPROVAL_INVALID_STATUS",
        "Approval conflict: document status is not NEEDS_APPROVAL."
      );
    }

    if (item.taskToken) {
      try {
        const callbackType = payload.approved ? "SendTaskSuccess" : "SendTaskFailure";
        console.info("approve-document attempting Step Functions callback", {
          documentId,
          userId,
          currentStatus: previousStatus,
          hasTaskToken: true,
          callbackAttempted: true,
          callbackType
        });

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
        if (callbackRejectedByStepFunctions(error)) {
          console.error("approve-document conflict: Step Functions rejected callback", {
            documentId,
            userId,
            currentStatus: previousStatus,
            hasTaskToken: true,
            callbackAttempted: true,
            callbackType: payload.approved ? "SendTaskSuccess" : "SendTaskFailure",
            error: error instanceof Error ? { name: error.name, message: error.message } : error
          });
          return errorResponse(
            409,
            "APPROVAL_CALLBACK_REJECTED",
            "Approval conflict: Step Functions rejected the callback (token invalid, timed out, or task already closed)."
          );
        }

        console.error("approve-document step-functions callback failed", {
          documentId,
          userId,
          currentStatus: previousStatus,
          hasTaskToken: true,
          callbackAttempted: true,
          callbackType: payload.approved ? "SendTaskSuccess" : "SendTaskFailure",
          error: error instanceof Error ? { name: error.name, message: error.message } : error
        });
        throw error;
      }
    } else {
      console.warn("approve-document conflict: missing taskToken", {
        documentId,
        userId,
        currentStatus: previousStatus,
        hasTaskToken: false,
        callbackAttempted: false
      });
      return errorResponse(
        409,
        "APPROVAL_MISSING_TASK_TOKEN",
        "Approval conflict: document has no active task token."
      );
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
      currentStatus: previousStatus,
      hasTaskToken: true,
      callbackAttempted: true,
      callbackType: payload.approved ? "SendTaskSuccess" : "SendTaskFailure",
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
