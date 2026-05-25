# Deployment

## 1) Authenticate with IAM Identity Center (AWS SSO)

```bash
aws sso login --profile docupilot-dev
```

## 2) Deploy the SAM stack

From the `serverless/` directory:

```bash
sam build
sam deploy --guided --profile docupilot-dev --region ap-south-1
```

On first deploy, SAM will prompt for stack settings (stack name, parameter values like `ClerkIssuer` and `ClerkAudience`). Save the config when prompted.

## 3) Read stack outputs (`DocumentsBucketName`, `DocumentsTableName`, `ApiUrl`)

Use CloudFormation to fetch outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name <your-stack-name> \
  --profile docupilot-dev \
  --region ap-south-1 \
  --query "Stacks[0].Outputs"
```

Copy:
- `DocumentsBucketName`
- `DocumentsTableName`
- `ApiUrl` (for client config)

## 4) Create `events/local-env.json` from the outputs

Copy the example file:

```bash
cp events/local-env.example.json events/local-env.json
```

Then update values in `events/local-env.json`:
- `DOCUMENTS_BUCKET` = `DocumentsBucketName`
- `DOCUMENTS_TABLE` = `DocumentsTableName`
- `AWS_REGION` = `ap-south-1`

## 5) Run `sam local invoke` with `--profile docupilot-dev`

Example command for `CreateUploadUrlFunction`:

```bash
sam local invoke CreateUploadUrlFunction \
  --event events/api-create-upload-url.json \
  --env-vars events/local-env.json \
  --profile docupilot-dev \
  --region ap-south-1
```

## Debug S3 to Step Functions

Use this flow when uploads are not starting Step Functions executions.

1. Build and deploy:

```bash
cd serverless
sam build
sam deploy --guided --profile docupilot-dev --region ap-south-1
```

2. Fetch stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name docupilot-dev \
  --profile docupilot-dev \
  --region ap-south-1 \
  --query "Stacks[0].Outputs"
```

3. Edit `events/s3-upload-event.json` and replace `REPLACE_WITH_BUCKET_NAME` with your real `BucketName` output.

4. Invoke `StartProcessingFunction` locally with the S3 event:

```bash
sam local invoke StartProcessingFunction \
  --event events/s3-upload-event.json \
  --env-vars events/local-env.json \
  --profile docupilot-dev \
  --region ap-south-1
```

5. Check Step Functions executions:

```bash
aws stepfunctions list-executions \
  --state-machine-arn <StateMachineArn-from-outputs> \
  --profile docupilot-dev \
  --region ap-south-1
```

6. Tail `StartProcessingFunction` logs:

```bash
sam logs -n StartProcessingFunction \
  --stack-name docupilot-dev \
  --tail \
  --profile docupilot-dev \
  --region ap-south-1
```

## Observability and troubleshooting

### Find CloudWatch logs

Use `sam logs` for a function:

```bash
sam logs -n GeminiProcessDocumentFunction \
  --stack-name docupilot-dev \
  --tail \
  --profile docupilot-dev \
  --region ap-south-1
```

Or open CloudWatch console:
1. Go to `CloudWatch` -> `Log groups`.
2. Find `/aws/lambda/<function-name>`.
3. Open latest log stream and inspect errors/warnings.

### View Step Functions executions

CLI:

```bash
aws stepfunctions list-executions \
  --state-machine-arn <StateMachineArn-from-outputs> \
  --profile docupilot-dev \
  --region ap-south-1
```

For one execution history:

```bash
aws stepfunctions get-execution-history \
  --execution-arn <execution-arn> \
  --profile docupilot-dev \
  --region ap-south-1
```

Console:
1. Go to `Step Functions`.
2. Open `DocumentProcessingStateMachine`.
3. Open failed execution and inspect failed state input/output.

### Inspect DynamoDB records

Query all documents for one user:

```bash
aws dynamodb query \
  --table-name <DocumentsTableName> \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"USER#<clerk-user-id>"}}' \
  --profile docupilot-dev \
  --region ap-south-1
```

Get one record:

```bash
aws dynamodb get-item \
  --table-name <DocumentsTableName> \
  --key '{"PK":{"S":"USER#<clerk-user-id>"},"SK":{"S":"DOC#<document-id>"}}' \
  --profile docupilot-dev \
  --region ap-south-1
```

### Common errors and fixes

- `UNAUTHORIZED` on API calls:
  - Check Clerk token template/audience (`docupilot-api`).
  - Confirm API request includes `Authorization: Bearer <token>`.

- `ResourceNotFoundException` for DynamoDB:
  - Verify stack outputs and env vars use correct table name and region.

- Gemini failures:
  - Confirm `GEMINI_API_KEY_PARAMETER` exists in SSM and Lambda role can read it.
  - Check `GeminiProcessDocumentFunction` logs for schema/JSON parse errors.

- Upload succeeds but no processing starts:
  - Check EventBridge rule for S3 object-created events.
  - Check `StartProcessingFunction` logs and `DocumentProcessingStateMachine` execution list.

- Approve/Reject returns conflict:
  - Step Functions task token may be expired/invalid or execution already finished.
  - Check `ApproveDocumentFunction` logs and execution history for callback failures.
