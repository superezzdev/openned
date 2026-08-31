This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Adzuna Jobs API Integration

This project integrates the official [Adzuna Jobs API](https://developer.adzuna.com/) for searching and ingesting live job postings across India, the UK, the US, and other supported countries.

### 1. Configure Environment Variables

Obtain your Adzuna App ID and API Key from the [Adzuna Developer Portal](https://developer.adzuna.com/). Add them to your `.env.local`:

```env
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key
ADZUNA_COUNTRY=in
```

### 2. Run Real Adzuna API Test

Verify that your Adzuna API credentials are working and returning live normalized jobs:

```bash
npm run test:adzuna
```

### 3. Run Database Persistence Demonstration

Verify end-to-end ingestion, change detection, and deduplication into PostgreSQL / Supabase:

```bash
npx tsx src/scripts/demonstrate-adzuna-sync.ts
```

### 4. Search Jobs API Endpoint

Query the server-side Adzuna search endpoint:

```bash
curl "http://localhost:3000/api/jobs/search?source=adzuna&query=software%20engineer&location=India&page=1&results_per_page=20"
```

Response format:
```json
{
  "source": "adzuna",
  "jobs": [
    {
      "source": "adzuna",
      "source_job_id": "5392817201",
      "company_name": "Razorpay",
      "title": "Senior Software Engineer",
      "location": "Bengaluru, Karnataka, India",
      "salary_min": 1800000,
      "salary_max": 2600000,
      "salary_currency": "INR",
      "job_url": "https://www.adzuna.in/land/ad/5392817201",
      "apply_url": "https://www.adzuna.in/land/ad/5392817201",
      "posted_at": "2026-08-20T10:15:30.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "resultsPerPage": 20,
    "total": 1450
  }
}
```

### 5. Running Tests

Run the full Vitest suite (including mocked Adzuna unit tests and data quality audits):

```bash
npm run test
```
