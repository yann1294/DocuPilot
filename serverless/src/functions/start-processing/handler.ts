import type { EventBridgeEvent, S3Event } from "aws-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

const sfn = new SFNClient({});
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;

type StartProcessingEvent = S3Event | EventBridgeEvent<"Object Created", unknown>;

function isS3Event(event: StartProcessingEvent): event is S3Event {
  return "Records" in event;
}

function getRecords(event: StartProcessingEvent): Array<{ bucket: string; rawKey: string }> {
  if (isS3Event(event)) {
    return (event.Records ?? []).map((record) => ({
      bucket: record.s3.bucket.name,
      rawKey: record.s3.object.key
    }));
  }

  const detail = event.detail as { bucket?: { name?: string }; object?: { key?: string } };
  const bucket = detail.bucket?.name;
  const rawKey = detail.object?.key;
  if (!bucket || !rawKey) {
    throw new Error("EventBridge payload missing detail.bucket.name or detail.object.key");
  }
  return [{ bucket, rawKey }];
}

export async function handler(event: StartProcessingEvent) {
  console.log("StartProcessingFunction invoked");
  console.log("S3 event:", JSON.stringify(event, null, 2));

  if (!STATE_MACHINE_ARN) {
    throw new Error("Missing STATE_MACHINE_ARN environment variable");
  }

  for (const record of getRecords(event)) {
    const bucket = record.bucket;
    const rawKey = record.rawKey;
    const key = decodeURIComponent(rawKey.replace(/\+/g, " "));

    const parts = key.split("/");

    if (parts.length < 4 || parts[0] !== "uploads") {
      console.warn("Skipping object because key does not match expected pattern", {
        bucket,
        rawKey,
        key,
        expected: "uploads/{userId}/{documentId}/{fileName}"
      });
      continue;
    }

    const userId = parts[1];
    const documentId = parts[2];

    console.log("Processing S3 record", {
      bucket,
      rawKey,
      key,
      userId,
      documentId,
      hasStateMachineArn: Boolean(STATE_MACHINE_ARN)
    });

    const executionName = `doc-${documentId}-${Date.now()}`.replace(/[^a-zA-Z0-9-_]/g, "-");

    console.log("Starting Step Functions execution", {
      stateMachineArn: STATE_MACHINE_ARN,
      executionName
    });

    try {
      const result = await sfn.send(
        new StartExecutionCommand({
          stateMachineArn: STATE_MACHINE_ARN,
          name: executionName,
          input: JSON.stringify({
            bucket,
            key,
            userId,
            documentId,
            source: "s3:ObjectCreated",
            startedAt: new Date().toISOString()
          })
        })
      );

      console.log("Started Step Functions execution", {
        executionArn: result.executionArn,
        startDate: result.startDate
      });
    } catch (error) {
      console.error("StartExecution failed", {
        bucket,
        key,
        userId,
        documentId,
        error
      });
      throw error;
    }
  }

  return {
    ok: true
  };
}
