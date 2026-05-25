# API Contracts

Defines request/response contracts between client and serverless APIs.

Base URL:
- `https://<api-id>.execute-api.<region>.amazonaws.com`

Authentication:
- All endpoints require Clerk JWT bearer token.
- Header: `Authorization: Bearer <clerk-jwt>`

---

## POST /uploads

### Purpose
Create a pre-signed S3 upload URL and initialize a document record.

### Auth requirement
Required (Clerk JWT).

### Request body
```json
{
  "fileName": "invoice-2026-05.pdf",
  "mimeType": "application/pdf",
  "fileSize": 245123
}
```

### Response body (200)
```json
{
  "documentId": "c8ea0d8d-5ec2-4ef2-bf7b-5d1728f2d0d9",
  "uploadUrl": "https://...signed-url...",
  "fileKey": "uploads/user_123/c8ea0d8d-5ec2-4ef2-bf7b-5d1728f2d0d9/invoice-2026-05.pdf"
}
```

### Error responses
- `400 INVALID_REQUEST` (missing/invalid JSON or schema)
- `400 UNSUPPORTED_MIME_TYPE`
- `401 UNAUTHORIZED`
- `500 INTERNAL_ERROR`

Error format:
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request body.",
    "details": {}
  }
}
```

### Example curl
```bash
curl -X POST "$API_BASE_URL/uploads" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "invoice-2026-05.pdf",
    "mimeType": "application/pdf",
    "fileSize": 245123
  }'
```

---

## GET /documents

### Purpose
List all documents for the authenticated user.

### Auth requirement
Required (Clerk JWT).

### Request body
None.

### Response body (200)
```json
{
  "documents": [
    {
      "documentId": "c8ea0d8d-5ec2-4ef2-bf7b-5d1728f2d0d9",
      "fileName": "invoice-2026-05.pdf",
      "mimeType": "application/pdf",
      "status": "NEEDS_APPROVAL",
      "summary": "Invoice for May services.",
      "classification": "INVOICE",
      "createdAt": "2026-05-25T11:21:33.102Z"
    }
  ]
}
```

### Error responses
- `401 UNAUTHORIZED`
- `500 INTERNAL_ERROR`

Error format:
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to list documents."
  }
}
```

### Example curl
```bash
curl -X GET "$API_BASE_URL/documents" \
  -H "Authorization: Bearer $TOKEN"
```

---

## GET /documents/{documentId}

### Purpose
Get one document (owned by authenticated user) with details and extracted fields.

### Auth requirement
Required (Clerk JWT).

### Request body
None.

### Path params
- `documentId` (string, required)

### Response body (200)
```json
{
  "document": {
    "documentId": "c8ea0d8d-5ec2-4ef2-bf7b-5d1728f2d0d9",
    "fileName": "invoice-2026-05.pdf",
    "mimeType": "application/pdf",
    "status": "APPROVED",
    "summary": "Invoice for May services.",
    "classification": "INVOICE",
    "createdAt": "2026-05-25T11:21:33.102Z",
    "updatedAt": "2026-05-25T11:24:09.901Z",
    "extractedFields": {
      "invoiceNumber": "INV-1029",
      "amount": "1400",
      "currency": "USD"
    },
    "errorMessage": ""
  }
}
```

### Error responses
- `400 INVALID_REQUEST` (missing `documentId`)
- `401 UNAUTHORIZED`
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

Error format:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Document not found."
  }
}
```

### Example curl
```bash
curl -X GET "$API_BASE_URL/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## POST /documents/{documentId}/approval

### Purpose
Approve or reject a document currently in `NEEDS_APPROVAL`.

### Auth requirement
Required (Clerk JWT).

### Request body
```json
{
  "approved": true,
  "comment": "Looks good"
}
```

Fields:
- `approved` (boolean, required)
- `comment` (string, optional)

### Response body (200)
```json
{
  "documentId": "c8ea0d8d-5ec2-4ef2-bf7b-5d1728f2d0d9",
  "status": "APPROVED"
}
```

`status` is `APPROVED` when `approved=true`, otherwise `REJECTED`.

### Error responses
- `400 INVALID_REQUEST` (missing body, missing/invalid `documentId`, `approved` not boolean)
- `400 INVALID_JSON`
- `401 UNAUTHORIZED`
- `404 NOT_FOUND`
- `409 INVALID_STATUS` (document not in `NEEDS_APPROVAL`)
- `409 APPROVAL_CALLBACK_CONFLICT` (expired/invalid Step Functions task token)
- `500 INTERNAL_ERROR`

Error format:
```json
{
  "error": {
    "code": "INVALID_STATUS",
    "message": "Document is not waiting for approval."
  }
}
```

### Example curl
```bash
curl -X POST "$API_BASE_URL/documents/$DOCUMENT_ID/approval" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": false,
    "comment": "Missing required fields"
  }'
```
