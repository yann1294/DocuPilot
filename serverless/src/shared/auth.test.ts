import { describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { getClerkUserId, requireClerkUserId } from "./auth";

function makeEvent(sub?: unknown): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: "2.0",
    routeKey: "GET /",
    rawPath: "/",
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "123",
      apiId: "api",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "GET",
        path: "/",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest"
      },
      requestId: "req-1",
      routeKey: "GET /",
      stage: "$default",
      time: "",
      timeEpoch: 0,
      authorizer: {
        principalId: "principal",
        integrationLatency: 0,
        jwt: {
          claims: (sub === undefined ? {} : { sub }) as Record<string, string | number | boolean | string[]>,
          scopes: []
        }
      }
    },
    isBase64Encoded: false
  };
}

describe("shared/auth", () => {
  it("extracts userId from JWT claims", () => {
    const event = makeEvent("user_123");
    expect(getClerkUserId(event)).toBe("user_123");
    expect(requireClerkUserId(event)).toBe("user_123");
  });

  it("returns null when sub is missing or invalid", () => {
    expect(getClerkUserId(makeEvent(undefined))).toBeNull();
    expect(getClerkUserId(makeEvent(42))).toBeNull();
    expect(getClerkUserId(makeEvent(""))).toBeNull();
  });
});
