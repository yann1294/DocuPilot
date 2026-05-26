# DocuPilot

Serverless document-processing MVP using Next.js, Clerk, AWS SAM, Lambda, API Gateway, S3, DynamoDB, Step Functions, and Gemini.

## Runtime note

This project originally targeted AWS Lambda `nodejs20.x`. It has been upgraded to `nodejs22.x` because Node.js 20 is deprecated in AWS Lambda.

Build/transpile remains compatible:
- SAM build uses `esbuild`
- Target stays `es2022` (compatible with Node.js 22 runtime)
