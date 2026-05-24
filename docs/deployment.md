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
