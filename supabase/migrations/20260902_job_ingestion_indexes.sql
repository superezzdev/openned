-- -----------------------------------------------------------------------------
-- Job Ingestion System Indexes & Query Optimization Migration
-- -----------------------------------------------------------------------------

-- 1. Optimized Composite Index for Active Job Queries & Sorting
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_active_posted 
    ON public.canonical_jobs (active, posted_at DESC);

-- 2. Optimized Filter + Active Composite Index for Platform Filtering
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_source_active_posted 
    ON public.canonical_jobs (source, active, posted_at DESC);

-- 3. Source ID Index for Reconciler Lookups
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_source_id 
    ON public.canonical_jobs (source_id);

-- 4. Composite Source & Source ID Index for Sync Reconciliation Diffing
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_source_source_id 
    ON public.canonical_jobs (source, source_id);

-- 5. Common Search & Filtering Indexes
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_title 
    ON public.canonical_jobs (title);

CREATE INDEX IF NOT EXISTS idx_canonical_jobs_location 
    ON public.canonical_jobs (location);

CREATE INDEX IF NOT EXISTS idx_canonical_jobs_remote_type 
    ON public.canonical_jobs (remote_type);

CREATE INDEX IF NOT EXISTS idx_canonical_jobs_employment_type 
    ON public.canonical_jobs (employment_type);

-- 6. Job Sources Lookup Optimization
CREATE INDEX IF NOT EXISTS idx_job_sources_lookup 
    ON public.job_sources (source, enabled);
