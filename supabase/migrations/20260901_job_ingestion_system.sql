-- -----------------------------------------------------------------------------
-- Job Ingestion System Schema Migration
-- -----------------------------------------------------------------------------

-- 1. Job Sources Table
CREATE TABLE IF NOT EXISTS public.job_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL, -- 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'custom'
    source_name TEXT NOT NULL,
    source_identifier TEXT NOT NULL, -- e.g. 'stripe', 'figma', 'openai'
    company_name TEXT NOT NULL,
    company_logo TEXT,
    source_url TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    last_error_message TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_source_identifier UNIQUE (source, source_identifier)
);

CREATE INDEX IF NOT EXISTS idx_job_sources_source ON public.job_sources(source);
CREATE INDEX IF NOT EXISTS idx_job_sources_enabled ON public.job_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_job_sources_company_name ON public.job_sources(company_name);

-- 2. Canonical Jobs Table
CREATE TABLE IF NOT EXISTS public.canonical_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    source_job_id TEXT NOT NULL,
    source_id UUID REFERENCES public.job_sources(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    company_logo TEXT,
    title TEXT NOT NULL,
    description TEXT,
    description_html TEXT,
    location TEXT,
    locations_json JSONB DEFAULT '[]'::jsonb,
    country TEXT,
    region TEXT,
    city TEXT,
    remote_type TEXT, -- 'remote' | 'hybrid' | 'onsite'
    employment_type TEXT, -- 'full-time' | 'part-time' | 'contract' | 'internship'
    department TEXT,
    team TEXT,
    salary_min NUMERIC,
    salary_max NUMERIC,
    salary_currency TEXT,
    salary_interval TEXT, -- 'yearly' | 'monthly' | 'hourly'
    job_url TEXT NOT NULL,
    apply_url TEXT NOT NULL,
    posted_at TIMESTAMPTZ,
    updated_at_source TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    active BOOLEAN NOT NULL DEFAULT true,
    raw_payload JSONB,
    content_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_source_job UNIQUE (source, source_job_id)
);

CREATE INDEX IF NOT EXISTS idx_canonical_jobs_source ON public.canonical_jobs(source);
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_active ON public.canonical_jobs(active);
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_content_hash ON public.canonical_jobs(content_hash);
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_posted_at ON public.canonical_jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_company_name ON public.canonical_jobs(company_name);

-- 3. User Job Interactions Table (Saved / Applied tracking on Canonical Jobs)
CREATE TABLE IF NOT EXISTS public.user_job_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    canonical_job_id UUID NOT NULL REFERENCES public.canonical_jobs(id) ON DELETE CASCADE,
    saved_status BOOLEAN NOT NULL DEFAULT false,
    applied_status BOOLEAN NOT NULL DEFAULT false,
    applied_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_canonical_job UNIQUE (user_id, canonical_job_id)
);

CREATE INDEX IF NOT EXISTS idx_user_job_interactions_user ON public.user_job_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_job_interactions_saved ON public.user_job_interactions(user_id, saved_status);
CREATE INDEX IF NOT EXISTS idx_user_job_interactions_applied ON public.user_job_interactions(user_id, applied_status);

-- 4. Sync Logs Table
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.job_sources(id) ON DELETE SET NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL, -- 'started' | 'success' | 'failed' | 'partial'
    jobs_fetched INTEGER NOT NULL DEFAULT 0,
    jobs_created INTEGER NOT NULL DEFAULT 0,
    jobs_updated INTEGER NOT NULL DEFAULT 0,
    jobs_unchanged INTEGER NOT NULL DEFAULT 0,
    jobs_deactivated INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_source ON public.sync_logs(source);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON public.sync_logs(created_at DESC);

-- 5. Row Level Security Policies
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_job_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Job Sources: readable and manageable
CREATE POLICY "Allow public select job_sources" ON public.job_sources FOR SELECT USING (true);
CREATE POLICY "Allow public insert job_sources" ON public.job_sources FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update job_sources" ON public.job_sources FOR UPDATE USING (true);
CREATE POLICY "Allow public delete job_sources" ON public.job_sources FOR DELETE USING (true);

-- Canonical Jobs: readable and manageable
CREATE POLICY "Allow public select canonical_jobs" ON public.canonical_jobs FOR SELECT USING (true);
CREATE POLICY "Allow public insert canonical_jobs" ON public.canonical_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update canonical_jobs" ON public.canonical_jobs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete canonical_jobs" ON public.canonical_jobs FOR DELETE USING (true);

-- User Job Interactions: users can manage their own interactions
CREATE POLICY "Allow public select user_job_interactions" ON public.user_job_interactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_job_interactions" ON public.user_job_interactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update user_job_interactions" ON public.user_job_interactions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete user_job_interactions" ON public.user_job_interactions FOR DELETE USING (true);

-- Sync Logs: readable and insertable
CREATE POLICY "Allow public select sync_logs" ON public.sync_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert sync_logs" ON public.sync_logs FOR INSERT WITH CHECK (true);
