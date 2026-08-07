# API Design - Openned

Our API is built using NestJS (or Express with a strict Clean Architecture layout). We expose a RESTful API for standard operations and WebSockets for real-time background task updates (like AI generation progress).

## 1. Authentication
Authentication is handled via standard HTTP Bearer Tokens (issued by Clerk).
*   Header: `Authorization: Bearer <clerk_jwt>`
*   The Backend `AuthGuard` verifies the JWT with Clerk's public keys.

## 2. Core REST Endpoints

### Users & Profile
*   `GET /api/v1/users/me` -> Fetch current user profile.
*   `PATCH /api/v1/users/me` -> Update profile (e.g., subscription tier).

### Integrations
*   `GET /api/v1/integrations` -> List connected platforms.
*   `POST /api/v1/integrations/:provider/connect` -> Initiate OAuth flow.
*   `DELETE /api/v1/integrations/:provider` -> Disconnect a platform.

### Knowledge Graph
*   `GET /api/v1/knowledge-graph` -> Fetch the unified developer profile and extracted skills.
*   `POST /api/v1/knowledge-graph/sync` -> Manually trigger a background sync for all connected integrations.

### Projects
*   `GET /api/v1/projects` -> List all analyzed projects (paginated).
*   `GET /api/v1/projects/:id` -> Detailed view of a project's AI analysis.

### Resumes
*   `POST /api/v1/resumes/generate` 
    *   *Payload*: `{ targetJobDescription: "..." }`
    *   *Response*: `202 Accepted` with a `jobId` for tracking generation status.
*   `GET /api/v1/resumes/:id` -> Fetch generated resume JSON/Markdown.
*   `GET /api/v1/resumes/:id/pdf` -> Download PDF version.

### Job Applications (Kanban)
*   `GET /api/v1/applications` -> List all applications.
*   `POST /api/v1/applications` -> Manually add a job application.
*   `PATCH /api/v1/applications/:id/status` -> Move application across Kanban columns.

## 3. Real-time Communication (WebSockets)
For long-running AI tasks, REST polling is inefficient. We will use `Socket.io` or SSE (Server-Sent Events).
*   **Event**: `job:progress`
    *   *Payload*: `{ jobId: "...", status: "Parsing AST", progress: 45 }`
*   **Event**: `job:completed`
    *   *Payload*: `{ jobId: "...", resultId: "..." }`

## 4. API Response Standardization (JSend format)
```json
// Success
{
  "status": "success",
  "data": { "id": "123", "name": "..." }
}

// Fail (Client Error)
{
  "status": "fail",
  "data": { "email": "A valid email is required" }
}

// Error (Server Error)
{
  "status": "error",
  "message": "Internal Server Error",
  "code": 500
}
```

## 5. Rate Limiting & Security
*   Global API rate limiting (e.g., 100 req/min).
*   AI generation endpoints are strictly rate-limited based on subscription tiers (e.g., 5 resumes/day for FREE).
*   CORS configured strictly for `*.openned.com` and `localhost`.
