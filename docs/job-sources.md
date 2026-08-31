# ATS Provider Adapters & Job Sources Guide

This document details the provider adapters, API endpoints, discovery heuristics, CLI commands, and extension guides for Openned's Job Ingestion System.

---

## 1. Supported ATS Providers

| Provider | Ingestion Method | Public Endpoint Pattern | Identifier / Slug Example |
| :--- | :--- | :--- | :--- |
| **Greenhouse** | Official Public Board API | `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | `stripe`, `figma`, `airbnb` |
| **Lever** | Official Public Postings API | `https://api.lever.co/v0/postings/{slug}?mode=json` | `langchain`, `vercel`, `spotify` |
| **Ashby** | Public Job Board API | `https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true` | `openai`, `anthropic`, `linear` |
| **Workable** | Accounts / Widget API | `https://apply.workable.com/api/v3/accounts/{slug}/jobs` | `perplexity`, `supabase`, `typeform` |
| **Wellfound** | Public Company Jobs API / Feed | `https://wellfound.com/api/v1/companies/{slug}/jobs` | `modal-labs`, `replit`, `cursor` |
| **SmartRecruiters** | Official Public Posting API | `https://api.smartrecruiters.com/v1/companies/{slug}/postings` | `smartrecruiters`, `SGS`, `visa`, `skechers` |
| **Custom / Fallback** | JSON-LD & HTML Parser | HTTP GET to Career Page | `https://company.com/careers` |

---

## 2. Provider Details & Endpoints

### 1. Greenhouse (`greenhouse`)
- **Discovery URL Pattern**: `https://boards.greenhouse.io/{board_slug}` or `https://greenhouse.io/jobs/{board_slug}`
- **Ingestion Endpoint**: `GET https://boards-api.greenhouse.io/v1/boards/{board_slug}/jobs?content=true`
- **Fields Extracted**:
  - `id` -> `source_job_id`
  - `title` -> `title`
  - `absolute_url` -> `job_url`
  - `https://boards.greenhouse.io/{board_slug}/jobs/{id}#app` -> `apply_url`
  - `location.name` -> `location`
  - `offices` & `departments` -> `locations_json`, `department`
  - `content` -> `description_html` (sanitized) & `description` (plain text)
  - `metadata` -> `salary_min`, `salary_max`, `salary_currency`

### 2. Lever (`lever`)
- **Discovery URL Pattern**: `https://jobs.lever.co/{company_slug}`
- **Ingestion Endpoint**: `GET https://api.lever.co/v0/postings/{company_slug}?mode=json`
- **Fields Extracted**:
  - `id` -> `source_job_id`
  - `text` -> `title`
  - `hostedUrl` -> `job_url`
  - `applyUrl` -> `apply_url`
  - `categories.workplaceType` -> `remote_type` (`remote`, `hybrid`, `onsite`)
  - `categories.commitment` -> `employment_type` (`full-time`, `contract`, etc.)
  - `categories.location` & `categories.allLocations` -> `location`, `locations_json`
  - `description` + `additional` -> `description_html` & `description`
  - `salaryRange` (`min`, `max`, `currency`, `interval`) -> `salary_*`

### 3. Ashby (`ashby`)
- **Discovery URL Pattern**: `https://jobs.ashbyhq.com/{job_board_name}`
- **Ingestion Endpoint**: `GET https://api.ashbyhq.com/posting-api/job-board/{job_board_name}?includeCompensation=true`
- **Filtering**: Only jobs with `isListed: true` are ingested.
- **Fields Extracted**:
  - `id` -> `source_job_id`
  - `title` -> `title`
  - `jobUrl` -> `job_url`
  - `applyUrl` -> `apply_url`
  - `isRemote` -> `remote_type`
  - `locationName` & `secondaryLocations` -> `location`, `locations_json`
  - `department` & `team` -> `department`, `team`
  - `compensation.targetSalary` -> `salary_min`, `salary_max`, `salary_currency`, `salary_interval`
  - `descriptionHtml` & `descriptionPlain` -> `description_html` & `description`

### 4. Workable (`workable`)
- **Discovery URL Pattern**: `https://apply.workable.com/{account_slug}` or `https://{account_slug}.workable.com`
- **Primary Endpoint**: `POST https://apply.workable.com/api/v3/accounts/{account_slug}/jobs`
- **Secondary Fallback**: `GET https://apply.workable.com/api/v1/widget/accounts/{account_slug}`
- **Fields Extracted**:
  - `shortcode` -> `source_job_id`
  - `title` -> `title`
  - `url` -> `job_url`
  - `application_url` -> `apply_url`
  - `telecommuting` -> `remote_type`
  - `city`, `state`, `country` -> `location`, `city`, `region`, `country`
  - `department` & `employment_type` -> `department`, `employment_type`
  - `salary` -> `salary_min`, `salary_max`, `salary_currency`

### 5. Wellfound (`wellfound`)
- **Discovery URL Pattern**: `https://wellfound.com/company/{company_slug}/jobs` or `https://angel.co/company/{company_slug}`
- **Primary Endpoint**: `GET https://wellfound.com/api/v1/companies/{company_slug}/jobs?page={page}`
- **Secondary Fallback**: `GET https://wellfound.com/company/{company_slug}/jobs.json`
- **Pagination**: Supports multi-page query traversal (`page=1..5`) with safety ceiling.
- **Fields Extracted**:
  - `id` / `slug` -> `source_job_id`
  - `title` -> `title`
  - `url` / `job_url` -> `job_url`
  - `apply_url` / `application_url` -> `apply_url`
  - `remote` / `remote_type` -> `remote_type` (`remote`, `hybrid`, `onsite`)
  - `job_type` / `commitment` -> `employment_type`
  - `location` / `locations` -> `location`, `locations_json`
  - `salary_min`, `salary_max`, `compensation_string` -> `salary_min`, `salary_max`, `salary_currency`, `salary_interval`
  - `description` / `description_html` -> `description` (plain text) & `description_html` (sanitized)

### 6. SmartRecruiters (`smartrecruiters`)
- **Discovery URL Pattern**: `https://careers.smartrecruiters.com/{company_slug}` or `https://jobs.smartrecruiters.com/{company_slug}`
- **Primary Endpoint**: `GET https://api.smartrecruiters.com/v1/companies/{company_slug}/postings?limit=100&offset={offset}`
- **Detail Endpoint**: `GET https://api.smartrecruiters.com/v1/companies/{company_slug}/postings/{posting_id}`
- **Pagination**: Offset-based pagination with batch limit of 100, tracking `totalFound` and page counts.
- **Fields Extracted**:
  - `id` / `uuid` -> `source_job_id`
  - `name` -> `title`
  - `ref` / `https://jobs.smartrecruiters.com/{slug}/{id}` -> `job_url`
  - `https://jobs.smartrecruiters.com/{slug}/{id}/apply` -> `apply_url`
  - `location` (`city`, `region`, `country`, `fullLocation`) -> `location`, `locations_json`
  - `location.remote` & `location.hybrid` -> `remote_type` (`remote`, `hybrid`, `onsite`)
  - `typeOfEmployment` (`permanent`, `contract`, etc.) -> `employment_type`
  - `department` & `function` -> `department`, `team`
  - `compensation` (`min`, `max`, `currency`) & `customField` -> `salary_*`
  - `jobAd.sections` (`companyDescription`, `jobDescription`, `qualifications`, `additionalInformation`) -> `description_html` & `description`

### 7. Generic JSON-LD Fallback (`custom`)
- **Ingestion Flow**: HTTP fetch -> Regex extraction of `<script type="application/ld+json">` -> Search for objects with `@type = "JobPosting"`.
- **Fallbacks**: If no JSON-LD script exists, falls back to OpenGraph meta tags (`og:title`, `og:description`, `og:url`).

---

## 3. CLI Commands & Usage

The system provides flexible CLI tools for manual synchronization and debugging.

### Sync All Sources
```bash
npm run jobs:sync
```

### Dry Run Mode (No Database Changes)
```bash
npm run jobs:sync -- --dry-run
```

### Sync a Specific ATS Provider
```bash
npm run jobs:sync -- --source=greenhouse
npm run jobs:sync -- --source=lever
npm run jobs:sync -- --source=ashby
npm run jobs:sync -- --source=workable
npm run jobs:sync -- --source=wellfound
npm run jobs:sync -- --source=smartrecruiters
```

### Sync a Specific Company
```bash
npm run jobs:sync -- --company=stripe
npm run jobs:sync -- --company=openai
```

### Limit Concurrency and Batch Size
```bash
npm run jobs:sync -- --limit=5 --concurrency=2
```

### Seed Initial Top Tech ATS Sources
```bash
npm run jobs:seed
```

---

## 4. API Endpoints

### 1. Trigger Synchronization
- **Endpoint**: `POST /api/admin/job-sources/sync`
- **Body**:
```json
{
  "source": "greenhouse",
  "company": "stripe",
  "dryRun": false,
  "limit": 10
}
```

### 2. List & Query Sources
- **Endpoint**: `GET /api/admin/job-sources?source=ashby`

### 3. Add a New Source
- **Endpoint**: `POST /api/admin/job-sources`
- **Body (Auto-Discovery)**:
```json
{
  "url": "https://boards.greenhouse.io/stripe"
}
```
- **Body (Explicit)**:
```json
{
  "source": "lever",
  "source_identifier": "vercel",
  "company_name": "Vercel"
}
```

### 4. Enable / Disable Source
- **Endpoint**: `PATCH /api/admin/job-sources`
- **Body**:
```json
{
  "id": "uuid-here",
  "enabled": false
}
```

### 5. Status & Observability Metrics
- **Endpoint**: `GET /api/admin/job-sources/status`

### 6. Scheduled Cron Execution
- **Endpoint**: `GET /api/cron/sync`
- **Header**: `Authorization: Bearer <CRON_SECRET>`

---

## 5. Adding a New ATS Provider (Step-by-Step)

1. **Create Adapter Class**:
   Create a new file in `src/lib/ingestion/adapters/{provider}.ts` implementing the `JobSourceAdapter` interface.
2. **Register in Adapter Registry**:
   Add the adapter instance into `src/lib/ingestion/adapters/index.ts`.
3. **Add URL Discovery Rule**:
   Add the domain regex matching in `src/lib/ingestion/discovery.ts`.
4. **Add Unit Tests & Fixtures**:
   Add a sample JSON response in `tests/fixtures/{provider}-sample.json` and a test file `tests/{provider}-adapter.test.ts`.
5. **Add Platform Logo**:
   Add the brand logo in `public/platforms/{Provider}.png`.

---

## 6. Troubleshooting & FAQ

### Issue: "HTTP 429 Too Many Requests"
- **Behavior**: The HTTP client automatically backs off with exponential delay and jitter. If the remote server sends a `Retry-After` header, the client honors that duration.

### Issue: "Consecutive Failures Count Increasing"
- **Resolution**: Check the `last_error_message` in the Admin Dashboard at `/dashboard/admin/sources`. If a company renamed their board slug, update the `source_identifier` in `job_sources`.

### Issue: "Missing Jobs Not Being Deactivated"
- **Reason**: The engine's safety rule prevents deactivating jobs if the sync returned 0 jobs or had API errors. Deactivation only triggers when a sync succeeds 100% and returns a non-empty active list.
