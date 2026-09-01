-- Migration: 20260907_tailored_job_matching_system.sql
-- Purpose: Support tailored job matching, profile versioning, normalized job requirements, and match caching.

-- 1. Add profile_version and user preferences to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS preferred_roles TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS preferred_locations TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS remote_preference BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS employment_preferences TEXT[] DEFAULT '{}'::text[];

-- 2. Add feedback flags to public.user_job_interactions
ALTER TABLE public.user_job_interactions
  ADD COLUMN IF NOT EXISTS not_relevant BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_user_job_interactions_not_relevant
  ON public.user_job_interactions(user_id, not_relevant);

CREATE INDEX IF NOT EXISTS idx_user_job_interactions_hidden
  ON public.user_job_interactions(user_id, hidden);

-- 3. Add normalized_job_data to public.canonical_jobs for fast caching of parsed requirements
ALTER TABLE public.canonical_jobs
  ADD COLUMN IF NOT EXISTS normalized_job_data JSONB;

-- 4. Create public.job_matches table for cached recommendation scores
CREATE TABLE IF NOT EXISTS public.job_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    job_id UUID NOT NULL REFERENCES public.canonical_jobs(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    match_level TEXT NOT NULL, -- 'Excellent' | 'Strong' | 'Good' | 'Fair'
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    matched_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience_match INTEGER NOT NULL DEFAULT 0,
    role_match INTEGER NOT NULL DEFAULT 0,
    location_match INTEGER NOT NULL DEFAULT 0,
    explanation TEXT,
    model_version TEXT NOT NULL DEFAULT 'v1',
    profile_version INTEGER NOT NULL DEFAULT 1,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_job_match UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_matches_user_score
  ON public.job_matches(user_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_job_matches_user_profile_ver
  ON public.job_matches(user_id, profile_version);

CREATE INDEX IF NOT EXISTS idx_job_matches_calculated_at
  ON public.job_matches(calculated_at DESC);

-- 5. Row Level Security for public.job_matches
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select job_matches"
  ON public.job_matches
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert job_matches"
  ON public.job_matches
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update job_matches"
  ON public.job_matches
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete job_matches"
  ON public.job_matches
  FOR DELETE
  USING (true);
