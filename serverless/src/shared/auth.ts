import type { APIGatewayProxyEventV2 } from "aws-lambda";

export function readBearerToken(event: APIGatewayProxyEventV2): string | null {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth) return null;
  const [, token] = auth.split(" ");
  return token || null;
}
