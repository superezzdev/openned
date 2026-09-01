# AI Job Application Automation System

This document outlines the architecture, execution engine, fallback mechanisms, and reliability guarantees of Openned's AI Job Application Automation System.

---

## 1. High-Level Architecture

The automation subsystem coordinates full job application cycles autonomously across major ATS platforms (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, etc.) and custom career sites.

```
                      ┌──────────────────────────────┐
                      │    Inngest Background Job    │
                      └──────────────┬───────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────┐
                      │    ApplicationOrchestrator   │
                      └──────────────┬───────────────┘
                                     │
               ┌─────────────────────┴─────────────────────┐
               ▼                                           ▼
┌─────────────────────────────┐             ┌─────────────────────────────┐
│    LocalBrowserProvider     │             │     BrowserbaseProvider     │
│  (Headless Chromium / CDP)  │             │   (Cloud Sessions / CDP)    │
└──────────────┬──────────────┘             └──────────────┬──────────────┘
               │                                           │
               └─────────────────────┬─────────────────────┘
                                     ▼
                      ┌──────────────────────────────┐
                      │   Shared Workflow Services   │
                      │  - PlatformDetector          │
                      │  - FormDetector              │
                      │  - FieldMapper               │
                      │  - ProfileResolver           │
                      │  - ApplicationFiller         │
                      │  - ApplicationSubmitter      │
                      └──────────────────────────────┘
```

### Core Separation of Concerns

- **Shared Workflow Layer:** The form detector, field mapper, profile resolver, multi-step navigator, status machine, missing-fields flow, and review system are **provider-agnostic**. They never touch vendor-specific SDKs or raw Playwright handles directly.
- **Provider Layer (`BrowserProvider`):** Encapsulates page lifecycle, navigation, element query, typing, selecting, file uploads, and evaluation behind a uniform interface.
  - `LocalBrowserProvider`: Local headless Chromium executed in-process.
  - `BrowserbaseProvider`: Remote cloud execution over Chrome DevTools Protocol (CDP) via Browserbase.

---

## 2. Provider Selection

Before each run, the orchestrator invokes `selectBrowserProvider(application)`:

| User Preference | Prior Fallback Used | Selected Engine | Behavior |
| :--- | :--- | :--- | :--- |
| `LOCAL_ONLY` | Any | `LocalBrowserProvider` | Strict local-only execution. Cloud fallbacks are blocked. |
| `BROWSERBASE_ONLY`| Any | `BrowserbaseProvider` | All runs immediately route to Browserbase cloud sessions. |
| `AUTO` (Default) | `false` | `LocalBrowserProvider` | Primary execution uses local headless Chromium. |
| `AUTO` (Default) | `true` | `BrowserbaseProvider` | Resumes directly with Browserbase; does not re-attempt local. |

---

## 3. Fallback Engine & Conditions

When running under `AUTO` with `LocalBrowserProvider`, unexpected errors are passed to `shouldFallbackToBrowserbase(error, application, stage)`:

### Eligible for Fallback (Infrastructure & Browser Errors)

1. **Browser Crash / Disconnection:** `Target closed`, `Browser process crashed`, `Session disconnected`.
2. **Page Load / Network Failures:** DNS resolution failures, connection resets, gateway errors.
3. **Timeouts:** `page.goto` timeout, element wait timeouts during detection.
4. **DOM Parsing / Interaction Incompatibility:** Disconnected context, headless layout inconsistencies.
5. **Local Headless Limitations:** Features requiring specialized anti-detect flags or GPU emulation.

### Excluded from Fallback (Workflow & Terminal States)

The system **strictly forbids** fallback for workflow and business states:
- **CAPTCHA / Cloudflare Turnstile:** Pauses for human verification (`AWAITING_USER_ACTION`, `CAPTCHA_REQUIRED`).
- **Login Walls:** Pauses for user login (`AWAITING_USER_ACTION`, `AUTH_REQUIRED`).
- **Rate Limits (HTTP 429):** Terminal failure with exponential backoff (`RATE_LIMITED`).
- **Missing Profile Data:** Pauses for user input (`MISSING_PROFILE_INFO`).
- **Unknown Questions:** Pauses for user input (`AWAITING_USER_INPUT`).
- **Submitting / Submitted / Unconfirmed:** Blocked to prevent double submission.

### Max Fallback Ceiling

A single application execution can fallback at most **1 time** (`max_fallback_attempts = 1`). Once `fallback_used = true` is recorded on the application row, further errors are treated as terminal failures, preventing infinite loop cascades.

---

## 4. Double-Submission Safeguards & Idempotency

To prevent submitting duplicate applications to employers:

1. **In-Flight Submit Flag:** Before clicking any submit button, the DB record is marked with `submit_attempted = true`, `pre_submit_url`, and timestamp.
2. **Post-Submit Timeout Handling:** If a network or browser timeout occurs after clicking Submit, the application status transitions to `SUBMISSION_UNCONFIRMED`. It is **never** retried or re-submitted automatically.
3. **Independent Verification:** The submitter independently queries the page URL, success selectors, and confirmation text.
4. **Locking Safeguard:** Active workers acquire distributed DB locks (`application_worker_locks`) with heartbeat renewal, ensuring multiple workers never run the same application concurrently.

---

## 5. Safe Resume State

When fallback to Browserbase occurs:
1. Current stage checkpoint is committed to `applications.debug_info.automation_state`.
2. Local browser session is cleanly terminated.
3. Browserbase session is provisioned and recorded in `automation_sessions`.
4. The application record is updated in place (`fallback_used = true`, `fallback_reason = ...`, `automation_provider = 'BROWSERBASE'`).
5. Browserbase navigates to the application URL, re-detects the form fields, re-validates selectors against the live DOM, and resumes execution seamlessly.
