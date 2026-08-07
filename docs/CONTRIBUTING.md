# Contributing to Openned

Welcome to the Openned Monorepo! As we build a highly scalable, production-ready AI Career OS, we maintain strict engineering standards.

## 1. Monorepo Workflow (Turborepo)
*   **Install dependencies**: `pnpm install`
*   **Run all apps**: `pnpm dev`
*   **Run a specific app**: `pnpm dev --filter=web`
*   **Run tests**: `pnpm test`

## 2. Coding Standards
*   **TypeScript Everywhere**: No `any` types allowed. Use strict Zod schemas for all API boundaries and Database inputs.
*   **SOLID Principles**: Ensure classes and functions have a Single Responsibility.
*   **Clean Architecture**: For backend code, never mix HTTP transport logic (Controllers) with Business Logic (Services) or Database Logic (Repositories).
*   **DRY (Don't Repeat Yourself)**: If a UI component is used in two places, move it to `packages/ui`. If an AI prompt is shared, move it to `packages/ai`.

## 3. Branch Naming Conventions
*   `feat/short-description` (e.g., `feat/github-analyzer`)
*   `fix/short-description` (e.g., `fix/resume-pdf-rendering`)
*   `chore/short-description` (e.g., `chore/update-dependencies`)

## 4. Commits
We follow Conventional Commits.
*   `feat: added email parser`
*   `fix: resolved Redis connection timeout`

## 5. Pull Requests
*   Every PR requires at least one approval from a Staff/Senior Engineer.
*   CI must pass (Linting, TypeScript Compilation, Unit Tests).
*   Include diagrams or screenshots if the PR introduces major architectural or UI changes.

## 6. Adding a new Feature
Before writing implementation code, write a brief Architectural Proposal explaining:
1. Why the feature is needed.
2. The Database schema changes.
3. The API endpoints required.
4. Trade-offs considered.
