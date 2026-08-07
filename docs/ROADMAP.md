# Project Roadmap & Milestones - Openned

Each milestone is designed to take 1-3 days, resulting in a runnable, deployable state.

## Milestone 1: Foundation & Monorepo Setup (Days 1-2)
*   **Goal**: Establish the base Turborepo architecture, Next.js web app, and NestJS/Express API skeleton.
*   **Dependencies**: None.
*   **Acceptance Criteria**: 
    *   `apps/web` running on `localhost:3000` with Tailwind CSS v4.
    *   `apps/api` running on `localhost:4000` with a `/health` endpoint.
    *   Shared `ui`, `config`, and `eslint` packages working.
*   **Testing**: Basic unit tests for the health endpoint.
*   **Deployment**: Vercel deployed for `web`, Railway/Render for `api`. CI pipeline linting/building the monorepo.

## Milestone 2: Authentication & Database Connection (Days 3-4)
*   **Goal**: Integrate Clerk Auth (Frontend) and secure the API (Backend). Connect to MongoDB.
*   **Dependencies**: Milestone 1.
*   **Acceptance Criteria**:
    *   User can Sign up / Log in using GitHub via Clerk.
    *   Frontend sends JWT to Backend; Backend validates it using Clerk SDK.
    *   Backend creates/fetches User document in MongoDB.
*   **Testing**: Integration tests for authenticated API routes.

## Milestone 3: Integrations & Background Workers Setup (Days 5-7)
*   **Goal**: Allow users to connect GitHub and trigger a background job via BullMQ.
*   **Dependencies**: Milestone 2.
*   **Acceptance Criteria**:
    *   Integration collection stores GitHub tokens (encrypted).
    *   API pushes a 'sync-github' job to Redis.
    *   BullMQ worker picks up the job, fetches user repos, and saves basic repo data to `Projects` collection.
*   **Testing**: Mock GitHub API responses to test worker logic. Redis local container via Docker Compose.

## Milestone 4: The Developer Knowledge Graph & AI (Days 8-10)
*   **Goal**: Implement the AI `github-analyzer` to extract skills from repositories.
*   **Dependencies**: Milestone 3, LLM API Access (OpenAI/Gemini).
*   **Acceptance Criteria**:
    *   Worker sends repo languages and readmes to LLM.
    *   LLM extracts structured JSON (Skills, Technologies).
    *   Updates the `KnowledgeGraphs` collection.
    *   Frontend dashboard visualizes these skills.
*   **Testing**: E2E testing of the AI pipeline with fixed, cached LLM responses to save costs.

## Milestone 5: ATS-Friendly Resume Builder (Days 11-13)
*   **Goal**: Generate customized resumes based on the Knowledge Graph.
*   **Dependencies**: Milestone 4.
*   **Acceptance Criteria**:
    *   User inputs a Job Description.
    *   `resume-engine` AI rewrites project summaries to match JD keywords.
    *   Frontend displays a preview and allows PDF export.
*   **Testing**: Snapshot testing of generated PDFs/Markdown.

## Milestone 6: Application Tracker & Kanban (Days 14-16)
*   **Goal**: Build the Job Application Kanban board.
*   **Dependencies**: Milestone 2.
*   **Acceptance Criteria**:
    *   CRUD operations for `JobApplications`.
    *   Drag-and-drop Kanban UI in Next.js.
*   **Testing**: React Testing Library for drag-and-drop interactions.

## Milestone 7: Email Analyzer Webhook (Days 17-19)
*   **Goal**: Automate application status updates by parsing recruiter emails.
*   **Dependencies**: Milestone 6, Inbound Email Service (SendGrid/Postmark).
*   **Acceptance Criteria**:
    *   Webhook receives raw email.
    *   `email-engine` LLM parses intent (Rejection vs Interview).
    *   Updates `JobApplications` status automatically.
    *   Triggers real-time notification to frontend.
*   **Testing**: E2E webhook simulation using Ngrok.
