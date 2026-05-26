import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

const { mockDdbSend } = vi.hoisted(() => ({
  mockDdbSend: vi.fn()
}));

vi.mock("../../shared/ddb", () => ({
  ddb: {
    send: mockDdbSend
  }
}));

import { handler } from "./handler";

function makeEvent(): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: "2.0",
    routeKey: "POST /documents/{documentId}/approval",
    rawPath: "/documents/doc-1/approval",
    rawQueryString: "",
    headers: {},
    pathParameters: { documentId: "doc-1" },
    body: JSON.stringify({ approved: true, comment: "ok" }),
    requestContext: {
      accountId: "123",
      apiId: "api",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "POST",
        path: "/documents/doc-1/approval",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest"
      },
      requestId: "req-1",
      routeKey: "POST /documents/{documentId}/approval",
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

describe("approve-document handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DOCUMENTS_TABLE = "docs-table";
  });

  it("rejects documents without taskToken", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Item: {
        PK: "USER#user_123",
        SK: "DOC#doc-1",
        documentId: "doc-1",
        status: "NEEDS_APPROVAL"
      }
    });

    const result = await handler(makeEvent());
    expect(result.statusCode).toBe(409);

    const body = JSON.parse(result.body as string) as { error: { code: string } };
    expect(body.error.code).toBe("APPROVAL_CALLBACK_CONFLICT");
  });
});
