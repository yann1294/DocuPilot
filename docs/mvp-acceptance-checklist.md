# MVP Acceptance Checklist

Use this checklist to manually validate DocuPilot end-to-end in dev.

Environment assumptions:
- Date: May 26, 2026
- Frontend running at `http://localhost:3000`
- Backend deployed via SAM
- You have AWS Console access and `docupilot-dev` CLI profile

---

## 1) Clerk sign-up / sign-in

### What to do
- Open `http://localhost:3000`.
- Create a new user (or sign in with an existing one).

### Expected result
- Authentication succeeds.
- You are redirected to app pages without auth errors.

### Where to verify in AWS
- Not directly in AWS (identity handled by Clerk).
- Verify API calls include `Authorization: Bearer <token>` in browser Network tab.

### Common failure causes
- Clerk publishable key missing/incorrect in `client/.env.local`.
- Wrong Clerk instance/environment.
- Browser third-party cookie/session restrictions.

---

## 2) Protected dashboard access

### What to do
- Attempt to open `/dashboard` while logged out.
- Then sign in and open `/dashboard` again.

### Expected result
- Logged out: redirected to sign-in.
- Logged in: dashboard loads successfully.

### Where to verify in AWS
- API Gateway access pattern via CloudWatch logs for protected endpoints (`/documents`, `/uploads`) after sign-in.

### Common failure causes
- Clerk middleware route matcher misconfigured.
- JWT template/audience mismatch (`docupilot-api`).

---

## 3) File upload request (`POST /uploads`)

### What to do
- On dashboard, choose a valid file (PDF/PNG/JPEG/WEBP).
- Watch Network tab for `POST /uploads`.

### Expected result
- `POST /uploads` returns `200` with `documentId`, `uploadUrl`, `fileKey`.

### Where to verify in AWS
- CloudWatch Logs: `CreateUploadUrlFunction`.
- DynamoDB: new record created with `status=UPLOADING`.

### Common failure causes
- Missing/invalid bearer token.
- Unsupported MIME type.
- `NEXT_PUBLIC_API_BASE_URL` incorrect.
- DynamoDB table env var/region mismatch.

---

## 4) Direct S3 upload (pre-signed URL PUT)

### What to do
- Continue upload flow after `POST /uploads`.
- Confirm browser issues `PUT` to pre-signed S3 URL.

### Expected result
- S3 PUT succeeds (`2xx`).
- UI shows upload completed.

### Where to verify in AWS
- S3 Console: object exists under `uploads/{userId}/{documentId}/{fileName}`.

### Common failure causes
- Expired pre-signed URL.
- Wrong content type/header mismatch.
- CORS restrictions on bucket.

---

## 5) S3 event trigger

### What to do
- After successful S3 upload, wait a few seconds.

### Expected result
- `StartProcessingFunction` is invoked by EventBridge.

### Where to verify in AWS
- CloudWatch Logs: `StartProcessingFunction` log stream with uploaded key.
- EventBridge rule target metrics/invocations.

### Common failure causes
- Object key path not matching expected prefix/pattern.
- EventBridge rule not deployed or target permission missing.

---

## 6) Step Functions execution

### What to do
- Open Step Functions console for `DocumentProcessingStateMachine`.
- Find the latest execution.

### Expected result
- New execution starts per uploaded document.
- Flow reaches success path or explicit failure path.

### Where to verify in AWS
- Step Functions -> Executions -> execution graph/history.

### Common failure causes
- `STATE_MACHINE_ARN` missing in start function env.
- IAM missing `states:StartExecution`.
- Bad execution input from S3 key parsing.

---

## 7) Gemini processing

### What to do
- Inspect Step Functions state invoking `GeminiProcessDocument`.
- Verify Lambda logs for request + success/failure messages.

### Expected result
- Real Gemini call executes (dev deploy uses `MOCK_GEMINI="false"`).
- Output includes classification/summary/extracted fields JSON.

### Where to verify in AWS
- CloudWatch Logs: `GeminiProcessDocumentFunction`.
- SSM Parameter Store for Gemini key path.

### Common failure causes
- Invalid model name.
- Missing/incorrect SSM key parameter.
- IAM missing `ssm:GetParameter` or `s3:GetObject`.
- Gemini output schema/JSON parse validation failure.

---

## 8) DynamoDB status update during pipeline

### What to do
- Query the uploaded document item by PK/SK.
- Track status transitions.

### Expected result
- Status moves through processing lifecycle and reaches:
  - `NEEDS_APPROVAL` on successful AI processing, or
  - `FAILED` on pipeline failure.

### Where to verify in AWS
- DynamoDB table record:
  - `PK=USER#{userId}`
  - `SK=DOC#{documentId}`
- Fields like `summary`, `classification`, `extractedFields`, `updatedAt`.

### Common failure causes
- Wrong key format during updates.
- Lambda permission issues for `UpdateItem`.
- Persist/mark-failed Lambda runtime errors.

---

## 9) Dashboard document listing

### What to do
- Return to dashboard after upload.
- Wait for polling cycle (3-5s) or click Refresh.

### Expected result
- New document appears in table.
- Status updates without full page reload.
- `NEEDS_APPROVAL` items appear in approval queue.

### Where to verify in AWS
- API logs for `GET /documents` (`ListDocumentsFunction`).
- DynamoDB record consistency with UI values.

### Common failure causes
- Polling condition not met (client state bug).
- Token fetch failure for API call.
- Response mapping mismatch between backend and frontend types.

---

## 10) Approval / rejection action

### What to do
- In approval queue, click Approve for one doc and Reject for another.

### Expected result
- Button shows loading state.
- `POST /documents/{documentId}/approval` appears in Network tab.
- Status updates to `APPROVED` or `REJECTED` after refetch.
- Item leaves approval queue.

### Where to verify in AWS
- CloudWatch Logs: `ApproveDocumentFunction`.
- DynamoDB item updates: `status`, `approvalComment`, `updatedAt`.

### Common failure causes
- Document not currently `NEEDS_APPROVAL` (409).
- Expired/invalid Step Functions task token (409 callback conflict).
- Missing auth header/JWT mismatch.

---

## 11) CloudWatch logs and alarms

### What to do
- Open CloudWatch dashboard `docupilot-dev` (or `docupilot-${Stage}`).
- Check recent logs for key Lambdas.

### Expected result
- Dashboard shows Lambda Errors, Step Functions failures, API 5xx.
- Alarms remain OK in healthy run.

### Where to verify in AWS
- CloudWatch Dashboard: `docupilot-${Stage}`.
- CloudWatch Alarms list.
- Log groups `/aws/lambda/<function-name>`.

### Common failure causes
- Monitoring resources not deployed.
- Wrong stage/region selected in console.
- No data due to no recent traffic.

---

## 12) Failed document behavior

### What to do
- Trigger a controlled failure (example: upload problematic file or temporarily invalid Gemini config in non-prod test).
- Observe UI and backend state.

### Expected result
- Pipeline catches error and marks document as `FAILED`.
- Failed count increments on dashboard.
- Error diagnostics available in logs.

### Where to verify in AWS
- Step Functions execution shows failed state and catch transition.
- CloudWatch Logs for failing function.
- DynamoDB item has `status=FAILED` and may include `errorMessage`.

### Common failure causes
- Unhandled exception in Gemini/persist step.
- Missing IAM permissions.
- Invalid external dependency config (SSM key/model).

---

## Acceptance sign-off

Mark each check as Pass/Fail:
- [ ] 1) Clerk sign-up/sign-in
- [ ] 2) Protected dashboard access
- [ ] 3) File upload request
- [ ] 4) Direct S3 upload
- [ ] 5) S3 event trigger
- [ ] 6) Step Functions execution
- [ ] 7) Gemini processing
- [ ] 8) DynamoDB status update
- [ ] 9) Dashboard document listing
- [ ] 10) Approval/rejection action
- [ ] 11) CloudWatch logs/alarms
- [ ] 12) Failed document behavior
