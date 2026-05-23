import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

type JwtClaims = Record<string, unknown>;

export function getClerkUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string | null {
  const claims = event.requestContext.authorizer.jwt.claims as JwtClaims | undefined;
  const sub = claims?.sub;
  return typeof sub === "string" && sub.length > 0 ? sub : null;
}

export function requireClerkUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const userId = getClerkUserId(event);
  if (!userId) {
    throw new Error("Missing Clerk user id in JWT claims.");
  }
  return userId;
}
