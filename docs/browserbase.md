# Browserbase Integration & Cloud Execution Guide

This document details the configuration, security, concurrency management, and observability of Browserbase within the Openned AI Application Automation System.

---

## 1. Overview

[Browserbase](https://browserbase.com) provides reliable, managed Chromium execution in the cloud with built-in anti-bot resilience, stealth profiles, residential proxies, and session recording.

In Openned, Browserbase functions as an **optional fallback browser execution provider** and an alternative primary execution engine for users who prefer remote cloud execution.

---

## 2. Server Configuration & Environment Variables

All Browserbase credentials and connection parameters are strictly managed on the server. They are **never exposed to client-side code** or sent in response payloads.

| Environment Variable | Required | Description | Default |
| :--- | :--- | :--- | :--- |
| `BROWSERBASE_API_KEY` | Yes (for cloud) | Live API key for the Browserbase project (`bb_live_...`). | None |
| `BROWSERBASE_PROJECT_ID` | Optional | Browserbase Project ID to scope sessions and logs. | None |
| `MAX_BROWSERBASE_CONCURRENCY` | Optional | Maximum concurrent active cloud sessions. | `2` |

### Environment Setup (`.env.local`)

```bash
# Browserbase Automation Provider (Server-only)
BROWSERBASE_API_KEY="bb_live_..."
BROWSERBASE_PROJECT_ID="your_project_id_here"
MAX_BROWSERBASE_CONCURRENCY=2
```

---

## 3. Concurrency Control

To respect Browserbase API plan limits and prevent runaway usage:

- All session creation requests are governed by `browserbaseLimiter` (`src/lib/automation/concurrency-limiter.ts`).
- When concurrent requests reach `MAX_BROWSERBASE_CONCURRENCY`, subsequent requests queue until an active session releases its slot.
- `BrowserbaseProvider.closeSession` immediately releases the limiter semaphore and marks the session terminated via the Browserbase API.

---

## 4. Connection Protocol (Playwright over CDP)

Browserbase cloud sessions are controlled using Playwright via the Chrome DevTools Protocol:

```ts
import { chromium } from "playwright";

// 1. Create cloud session via Browserbase SDK
const session = await browserbase.sessions.create({ projectId });

// 2. Connect Playwright over CDP using secure websocket
const browser = await chromium.connectOverCDP(session.connectUrl);

// 3. Reuse default context and page initialized by Browserbase
const context = browser.contexts()[0];
const page = context.pages()[0] || await context.newPage();
```

---

## 5. Security & Credentials Protection

1. **Client Isolation:** The frontend only receives clean session identifiers (`session_id`) and public replay links.
2. **Audit Logging:** Logs emitted through `logApplicationEvent` redact user passwords, cookies, tokens, and resume payloads.
3. **Session Replay Privacy:** Public replay URLs (`https://browserbase.com/sessions/:id`) are strictly accessed by authorized users and do not expose server environment variables or API keys.

---

## 6. Observability & Telemetry

### Admin Metrics Endpoint (`GET /api/admin/automation-metrics`)

Provides aggregated stats on:
- `totalApplications`
- `localSuccessRate` vs `browserbaseSuccessRate`
- `fallbackRate`
- `submissionSuccessRate`
- `averageLocalDurationMs` vs `averageBrowserbaseDurationMs`

### Dashboard Access

Admins can inspect live metrics under `/dashboard/admin/automation`.
Individual session details can be queried via `GET /api/applications/:id/session`.
