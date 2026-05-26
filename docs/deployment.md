# Deployment

## Prerequisites
- AWS account with permissions for SAM/CloudFormation, Lambda, API Gateway, DynamoDB, S3, Step Functions, SSM, CloudWatch, EventBridge.
- AWS CLI v2 configured.
- AWS SAM CLI installed.
- Node.js 22+ and npm.
- Clerk account and API JWT template.
- Gemini API key.

## Runtime upgrade note

DocuPilot originally targeted AWS Lambda `nodejs20.x`. The backend template was upgraded to `nodejs22.x` because Node.js 20 is deprecated in AWS Lambda.

Compatibility notes for Node.js 22:
- `esbuild` target remains `es2022` and is fully compatible.
- AWS SDK v3 packages used in this project are compatible with Node.js 22.
- If you see native dependency issues locally, remove `node_modules` and reinstall for your current Node version.

## AWS profile setup

Configure a named AWS profile (example: `docupilot-dev`):

```bash
aws configure --profile docupilot-dev
```

If your org uses AWS SSO:

```bash
aws sso login --profile docupilot-dev
```

Validate identity:

```bash
aws sts get-caller-identity --profile docupilot-dev
```

## Clerk setup

1. In Clerk dashboard, create/get your application.
2. Create a JWT template for backend API auth.
3. Use audience value `docupilot-api` (must match SAM parameter `ClerkAudience`).
4. Copy the JWT issuer URL (used as `ClerkIssuer` during deploy).

You will provide these values during `sam deploy --guided`.

## Gemini key in SSM

Store Gemini key as SecureString in SSM Parameter Store.

Example for dev stage:

```bash
aws ssm put-parameter \
  --name /docupilot/dev/GEMINI_API_KEY \
  --type SecureString \
  --value "<your-gemini-api-key>" \
  --overwrite \
  --profile docupilot-dev \
  --region ap-south-1
```

If using another stage, keep the same path pattern:
- `/docupilot/<stage>/GEMINI_API_KEY`

## Validate SAM template

From `serverless/`:

```bash
sam validate -t template.yaml
```

## Build backend

From `serverless/`:

```bash
sam build
```

## Deploy backend

From `serverless/`:

```bash
sam deploy --guided --profile docupilot-dev --region ap-south-1
```

During guided deploy, set at least:
- `Stage` (example: `dev`)
- `ClerkIssuer` (from Clerk)
- `ClerkAudience` (usually `docupilot-api`)
- `GeminiApiKeyParameterName` (example: `/docupilot/dev/GEMINI_API_KEY`)

Save the SAM config when prompted.

After deploy, capture outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name <your-stack-name> \
  --profile docupilot-dev \
  --region ap-south-1 \
  --query "Stacks[0].Outputs"
```

You need:
- `ApiUrl`
- `DocumentsBucketName`
- `DocumentsTableName`

## Client `.env.local`

In `client/.env.local`, set:

```env
NEXT_PUBLIC_API_BASE_URL=<ApiUrl>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
```

If your client also expects Clerk sign-in URLs/keys, include the usual Clerk env vars used by your app.

Required vars are documented in:
- `client/.env.local.example`

## Run frontend locally

From repo root:

```bash
npm install
npm run dev:client
```

Then open:
- `http://localhost:3000`
- Dashboard: `http://localhost:3000/dashboard`

## Deploy client to Vercel (production)

1. Push code to GitHub.
2. In Vercel, import the repository and select the `client/` directory as the project root.
3. Framework preset: Next.js.
4. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_API_BASE_URL`
5. Deploy.

After deploy:
- Confirm `/` redirects authenticated users to `/dashboard`.
- Confirm dashboard API calls go to your deployed API Gateway URL (not localhost).

## Production checklist

- Clerk keys:
  - Use production Clerk keys in Vercel (`pk_live_...`, `sk_live_...`) for production environment.
  - Keep test keys only in preview/dev environments.

- API base URL:
  - `NEXT_PUBLIC_API_BASE_URL` must point to deployed API Gateway base URL.
  - Use HTTPS URL and no trailing slash.
  - Verify browser Network tab requests hit this domain.

- Clerk allowed redirect URLs:
  - In Clerk dashboard, add your Vercel domain(s) to allowed redirect/callback URLs:
    - `https://<your-app>.vercel.app/sign-in`
    - `https://<your-app>.vercel.app/sign-up`
    - `https://<your-custom-domain>/sign-in` (if custom domain)
    - `https://<your-custom-domain>/sign-up` (if custom domain)
  - Also configure allowed origins/domain settings to include your production frontend domain.

## Troubleshooting

- `401 UNAUTHORIZED` from API:
  - Confirm user is signed in.
  - Confirm Clerk JWT template audience is `docupilot-api`.
  - Confirm API request includes `Authorization: Bearer <token>`.

- Upload works but status never progresses:
  - Check S3 object path pattern is `uploads/{userId}/{documentId}/{fileName}`.
  - Check `StartProcessingFunction` logs.
  - Check EventBridge rule and Step Functions executions.

- Gemini processing fails:
  - Confirm SSM parameter exists and name matches `GeminiApiKeyParameterName`.
  - Confirm Lambda IAM has `ssm:GetParameter` for `/docupilot/<stage>/*`.
  - Confirm `GEMINI_MODEL` is valid (current template uses `gemini-2.5-flash`).

- Approve/Reject returns conflict (409):
  - Task token may be expired/invalid, or workflow already finished.
  - Check `ApproveDocumentFunction` logs and Step Functions execution history.

- DynamoDB record not found:
  - Verify deployed `DocumentsTableName` and region.
  - Verify PK/SK format: `USER#{userId}` / `DOC#{documentId}`.

Useful log command:

```bash
sam logs -n GeminiProcessDocumentFunction \
  --stack-name <your-stack-name> \
  --tail \
  --profile docupilot-dev \
  --region ap-south-1
```
