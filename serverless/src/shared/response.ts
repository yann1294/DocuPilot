import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiError } from "./types";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
} as const;

export function json<T>(statusCode: number, body: T): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body)
  };
}

export function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): APIGatewayProxyStructuredResultV2 {
  const error: ApiError = { code, message, details };
  return json(statusCode, { error });
}
