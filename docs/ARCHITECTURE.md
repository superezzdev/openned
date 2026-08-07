# Architecture Design - Openned

## 1. Technology Stack (2026 Production-Ready)
To ensure performance, developer experience, security, AI integration, and scalability, we adopt the following stack:

*   **Monorepo Management**: **Turborepo** + **pnpm**. Offers the best caching and fastest build times for a TS monorepo.
*   **Frontend**: **Next.js 15 (App Router)** + **React 19** + **TypeScript**. Provides React Server Components (RSC) for incredible performance and SEO.
*   **Styling**: **Tailwind CSS v4**. Utility-first, highly scalable, and excellent DX.
*   **Backend API**: **Node.js** + **NestJS** (or Express with strict Clean Architecture). We will use NestJS as it enforces a highly scalable, modular, and dependency-injected architecture out of the box, perfect for enterprise SaaS.
*   **Database**: **MongoDB** (via Mongoose or Prisma). Excellent for rapidly evolving schemas like our Developer Knowledge Graph.
*   **AI Services**: **Node.js / Python (FastAPI)**. We will use LangChain/LlamaIndex for orchestrating LLM calls. The core backend can interact with standard LLM APIs, but specific heavy data-science pipelines (like GitHub AST parsing) might run in isolated Python microservices.
*   **Queue/Background Workers**: **BullMQ + Redis**. Crucial for handling async tasks like syncing GitHub repos and generating resumes without blocking the API.
*   **Authentication**: **Clerk** or **NextAuth (Auth.js)** + standard OAuth providers (GitHub, LinkedIn). Clerk provides a highly secure, drop-in enterprise auth solution.
*   **State Management**: **Zustand** (client state) + **React Query (TanStack Query)** (server state/caching).
*   **Deployment & CI/CD**: **Vercel** (Frontend) + **AWS/GCP / Railway** (Backend & Redis). GitHub Actions for CI/CD. Docker for containerizing backend services.

## 2. Monorepo Structure
```text
openned/
├── apps/
│   ├── web/                 # Next.js user-facing SaaS application
│   ├── api/                 # NestJS core backend API
│   ├── docs/                # Architecture and public documentation
├── packages/
│   ├── ui/                  # Shared React components (Tailwind, Radix UI)
│   ├── config/              # Shared ESLint, TSConfig, Prettier configs
│   ├── types/               # Shared TypeScript interfaces (Zod schemas)
│   ├── utils/               # Shared helper functions
│   ├── ai/                  # Shared AI prompts, LLM orchestration wrappers
├── services/                # Background workers / microservices
│   ├── github-analyzer/     # Pulls and analyzes GH repos (BullMQ worker)
│   ├── resume-engine/       # Generates optimized PDFs
│   ├── email-engine/        # Parses recruiter emails via IMAP/Webhooks
├── infra/
│   ├── docker/              # Docker Compose for local dev (MongoDB, Redis)
│   ├── terraform/           # IaC for cloud deployment
├── .github/workflows/       # CI/CD pipelines
```

## 3. Frontend Architecture (apps/web)
**Design Paradigm**: Feature-Based Architecture.
Instead of grouping by file type (components/, hooks/), we group by feature to ensure modularity.
```text
apps/web/src/
├── app/                     # Next.js App Router (Pages, Layouts)
├── features/                # Feature modules
│   ├── auth/                # Login, Registration UI
│   ├── dashboard/           # Analytics, Knowledge Graph view
│   ├── resume/              # Resume builder, ATS optimizer
│   ├── jobs/                # Job matching, Kanban board
├── shared/                  # Shared resources
│   ├── components/          # Generic UI components (Buttons, Inputs) imported from packages/ui
│   ├── hooks/               # Global hooks (useTheme)
│   ├── lib/                 # API clients, utilities
│   ├── stores/              # Zustand global stores
```
**Key Principles**:
*   **Server Components Default**: Most components fetch data on the server for zero-JS delivery. Client components (`"use client"`) are pushed to the leaves of the UI tree.
*   **Error Boundaries & Suspense**: Extensive use of React Suspense with Skeleton fallbacks for asynchronous AI loading states.
*   **Accessibility (a11y)**: Building on top of unstyled accessible primitives (like Radix UI) styled with Tailwind.

## 4. Backend Architecture (apps/api)
**Design Paradigm**: Clean Architecture & Domain-Driven Design (DDD).
```text
apps/api/src/
├── modules/                 # Independent domains
│   ├── users/
│   ├── projects/
│   ├── knowledge-graph/
│   ├── applications/
│   │   ├── controllers/     # Presentation Layer (HTTP/REST routes)
│   │   ├── services/        # Application Layer (Business Logic)
│   │   ├── repositories/    # Infrastructure Layer (DB operations)
│   │   ├── entities/        # Domain Layer (Models)
│   │   ├── dto/             # Data Transfer Objects & Validation
├── common/                  # Global guards, interceptors, filters
├── core/                    # Config, database connections
```
**Key Principles**:
*   **Dependency Inversion**: Services depend on repository interfaces, not directly on Mongoose. This allows easy swapping of databases or mocking in tests.
*   **Modularity**: The `applications` module does not directly mutate `users` data; it communicates via internal services or events.

## 5. AI Architecture
The AI layer acts as the brain of the OS.

*   **GitHub Analyzer**:
    *   *Input*: GitHub OAuth Token, Webhooks.
    *   *Pipeline*: Clones repo -> Extracts AST / dependencies -> LLM summarizes complexity and architecture.
    *   *Output*: Verified skills added to Knowledge Graph.
    *   *Processing*: Runs entirely on background workers (Redis queue) to prevent API timeouts.
*   **Resume Optimizer**:
    *   *Input*: User Knowledge Graph, Target Job Description URL.
    *   *Prompting*: Few-shot prompting instructing the LLM to rewrite achievements aligning with the JD's keywords.
    *   *Output*: Markdown/JSON which is converted to PDF.
*   **Email Analyzer**:
    *   *Input*: Inbound parsed email via SendGrid/Postmark webhook.
    *   *Pipeline*: LLM classification (Rejection, Interview Invite, Offer).
    *   *Output*: Updates the Application Kanban board automatically.
*   **Caching & Cost Optimization**:
    *   We use **Redis** to cache semantic embeddings and exact LLM responses for common queries.
    *   **Tiered Models**: Use cheaper models (e.g., Gemini 8B / GPT-4o-mini) for routing and classification (like email parsing). Use frontier models (Gemini 1.5 Pro / GPT-4o / Claude 3.5 Sonnet) for complex reasoning (GitHub analysis, Resume optimization).

## 6. System Flow Diagram (Mental Model)
1. **User Auth** -> Clerk authenticates and triggers Webhook -> Creates User in our DB.
2. **Onboarding** -> User connects GitHub/LinkedIn -> API enqueues a "Sync" job in Redis.
3. **Background Worker** -> Picks up job, calls GitHub API, runs AI analysis -> Updates Knowledge Graph in DB.
4. **Client Action** -> User pastes Job Description -> Next.js calls API -> API calls Resume Engine -> Returns streaming response of customized resume.
