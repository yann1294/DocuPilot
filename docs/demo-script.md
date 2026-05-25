# Demo Script (3 Minutes)

## 0:00 - 0:20 | Project Intro
"This is **DocuPilot**, a serverless document processing app. It lets users upload a file, runs AI extraction/classification, and requires human approval before finalizing status."

"The goal is to show a production-style workflow, not just a single API call."

## 0:20 - 0:45 | Architecture Explanation
"Frontend is Next.js with Clerk auth. Backend is API Gateway + Lambda. Files go to S3 via pre-signed upload. S3 events trigger Step Functions orchestration. Gemini processes document content, and DynamoDB stores lifecycle state."

(Show architecture diagram from `docs/architecture.md` or dashboard workflow card)

## 0:45 - 1:00 | Login with Clerk
"I’ll sign in first. Clerk handles authentication and issues JWTs used by the backend authorizer."

(Show sign-in page quickly, then dashboard)

## 1:00 - 1:30 | Upload Document
"Now I upload a PDF/image. The browser requests a pre-signed URL, uploads directly to S3, and backend creates an initial document record."

(Upload one file. Keep browser Network tab open to show `POST /uploads` and S3 PUT)

## 1:30 - 1:55 | Show S3 Event + Step Functions
"Once S3 receives the object, an event triggers processing. A Lambda starts Step Functions, which runs Gemini extraction and persistence steps."

(Show AWS Console: Step Functions execution list/history; optionally CloudWatch logs for StartProcessingFunction)

## 1:55 - 2:20 | Show AI Summary / Classification
"Back in the dashboard, the document transitions through statuses and then shows AI output: summary, classification, and extracted fields."

(Open table row via `View` side panel and point at summary/classification/extracted fields)

## 2:20 - 2:40 | Approve Document
"This queue enforces human-in-the-loop review. I can approve or reject; status updates immediately after API confirmation."

(Click Approve. Show status changes to `APPROVED` and item leaves approval queue)

## 2:40 - 2:55 | Show Monitoring
"Operationally, there’s a CloudWatch dashboard and alarms for Lambda errors, Step Functions failures, and API 5xx."

(Show CloudWatch dashboard `docupilot-dev` and one alarm list)

## 2:55 - 3:00 | What This Proves Technically
"This demonstrates secure auth, event-driven processing, AI integration with validation, single-table state modeling, and observable serverless operations end-to-end."

---

## Optional backup lines (if something is slow)
- "Processing is asynchronous by design; status polling keeps UX responsive while backend orchestration completes."
- "Even if Step Functions callback tokens expire, the approval API returns explicit conflict errors for safe recovery."
- "Mock mode exists for local dev, but deployed dev runs real Gemini processing."
