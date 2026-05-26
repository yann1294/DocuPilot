import { describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { handler } from "./handler";

function makeEvent(body: unknown): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: "2.0",
    routeKey: "POST /uploads",
    rawPath: "/uploads",
    rawQueryString: "",
    headers: {},
    body: JSON.stringify(body),
    requestContext: {
      accountId: "123",
      apiId: "api",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "POST",
        path: "/uploads",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest"
      },
      requestId: "req-1",
      routeKey: "POST /uploads",
      stage: "$default",
      time: "",
      timeEpoch: 0,
      authorizer: {
        principalId: "principal",
        integrationLatency: 0,
        jwt: {
          claims: { sub: "user_123" },
          scopes: []
        }
      }
    },
    isBase64Encoded: false
  };
}

describe("create-upload-url handler validation", () => {
  it("rejects unsupported mime types", async () => {
    const event = makeEvent({
      fileName: "invoice.txt",
      mimeType: "text/plain",
      fileSize: 100
    });

    const result = await handler(event);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body as string) as { error: { code: string } };
    expect(body.error.code).toBe("UNSUPPORTED_MIME_TYPE");
  });

  it("validates missing fileName/mimeType", async () => {
    const event = makeEvent({ fileSize: 100 });

    const result = await handler(event);
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body as string) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_REQUEST");
  });
});
