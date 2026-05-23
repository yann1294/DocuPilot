import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

export const ssm = new SSMClient({});

const parameterCache = new Map<string, string>();

interface ReadSecureParameterOptions {
  useCache?: boolean;
}

export async function readSecureParameter(
  parameterName: string,
  options: ReadSecureParameterOptions = {}
): Promise<string> {
  if (options.useCache !== false && parameterCache.has(parameterName)) {
    return parameterCache.get(parameterName)!;
  }

  const response = await ssm.send(
    new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true
    })
  );

  const value = response.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter is missing or empty: ${parameterName}`);
  }

  if (options.useCache !== false) {
    parameterCache.set(parameterName, value);
  }

  return value;
}
