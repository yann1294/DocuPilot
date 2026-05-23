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
