-- =============================================================================
-- AI Job Application Automation System — Database Migration
-- =============================================================================

-- 1. Application status enum
CREATE TYPE IF NOT EXISTS public.application_status AS ENUM (
  'QUEUED',
  'DETECTING_PLATFORM',
  'DETECTING_FORM',
  'MAPPING_FIELDS',
  'MISSING_PROFILE_INFO',
  'READY_TO_APPLY',
  'FILLING_FORM',
  'AWAITING_USER_REVIEW',
  'AWAITING_USER_ACTION',
  'AWAITING_USER_INPUT',
  'SUBMITTING',
  'SUBMITTED',
  'SUBMISSION_UNCONFIRMED',
  'FAILED',
  'CANCELLED',
  'MANUAL_APPLY_STARTED'
);

-- 2. Application form field status enum
CREATE TYPE IF NOT EXISTS public.field_status AS ENUM (
  'MAPPED',
  'MISSING',
  'AMBIGUOUS',
  'UNSUPPORTED',
  'OPTIONAL'
);

-- 3. Applications table (one per user per job per attempt)
CREATE TABLE IF NOT EXISTS public.applications (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     TEXT NOT NULL,
  job_id                      UUID NOT NULL REFERENCES public.canonical_jobs(id) ON DELETE CASCADE,
  status                      public.application_status NOT NULL DEFAULT 'QUEUED',
  source                      TEXT NOT NULL DEFAULT 'ai_agent',  -- 'ai_agent' | 'manual'
  platform                    TEXT,
  platform_confidence         NUMERIC,
  platform_detection_method   TEXT,
  apply_url                   TEXT NOT NULL,
  browser_session_id          TEXT,                -- opaque identifier for the browser session
  started_at                  TIMESTAMPTZ,
  completed_at                TIMESTAMPTZ,
  submitted_at                TIMESTAMPTZ,
  confirmation_url            TEXT,
  external_application_id     TEXT,
  error_message               TEXT,
  failure_code                TEXT,
  missing_fields              JSONB DEFAULT '[]'::jsonb,
  form_schema_id              UUID,               -- references application_forms(id), set after detection
  resume_file_id              UUID,               -- references resumes(id)
  debug_info                  JSONB DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_user_job ON public.applications(user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON public.applications(created_at DESC);

-- Unique index to prevent concurrent duplicate active applications per user & job
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_application_per_user_job
  ON public.applications(user_id, job_id)
  WHERE status NOT IN ('FAILED', 'CANCELLED');

-- 4. Application forms table (detected form schema)
CREATE TABLE IF NOT EXISTS public.application_forms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  platform      TEXT,
  page_url      TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  fields_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_forms_application_id ON public.application_forms(application_id);

-- 5. Application form fields table (relational field rows)
CREATE TABLE IF NOT EXISTS public.application_form_fields (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_form_id UUID NOT NULL REFERENCES public.application_forms(id) ON DELETE CASCADE,
  field_key           TEXT NOT NULL,
  label               TEXT,
  type                TEXT NOT NULL,     -- text | email | tel | select | radio | checkbox | file | textarea | etc.
  required            BOOLEAN NOT NULL DEFAULT false,
  selector            TEXT,
  options_json        JSONB DEFAULT '[]'::jsonb,
  page_step           INTEGER NOT NULL DEFAULT 1,
  mapped_profile_key  TEXT,
  current_value       TEXT,
  status              public.field_status NOT NULL DEFAULT 'MISSING',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_form_fields_form_id ON public.application_form_fields(application_form_id);
CREATE INDEX IF NOT EXISTS idx_app_form_fields_status ON public.application_form_fields(status);

-- 6. Application worker locks (distributed lock for background processing)
CREATE TABLE IF NOT EXISTS public.application_worker_locks (
  application_id  UUID PRIMARY KEY REFERENCES public.applications(id) ON DELETE CASCADE,
  worker_id       TEXT NOT NULL,         -- random UUID per worker instance
  locked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  heartbeat_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  lock_ttl_seconds INTEGER NOT NULL DEFAULT 300  -- 5 minute TTL
);

CREATE INDEX IF NOT EXISTS idx_worker_locks_locked_at ON public.application_worker_locks(locked_at);

-- 7. Add missing profile columns if they don't exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linkedin_url       TEXT,
  ADD COLUMN IF NOT EXISTS github_url         TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url      TEXT,
  ADD COLUMN IF NOT EXISTS work_authorization TEXT,
  ADD COLUMN IF NOT EXISTS years_experience   INTEGER,
  ADD COLUMN IF NOT EXISTS twitter_url        TEXT,
  ADD COLUMN IF NOT EXISTS website_url        TEXT;

-- 8. Add file_url to resumes for Playwright upload support
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS file_url TEXT;

-- 9. Row Level Security
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_worker_locks ENABLE ROW LEVEL SECURITY;

-- Applications: users manage their own
CREATE POLICY "Users can select own applications"
  ON public.applications FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "Users can insert own applications"
  ON public.applications FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "Users can update own applications"
  ON public.applications FOR UPDATE USING (user_id = auth.uid()::text);

-- Application forms: accessible via application ownership
CREATE POLICY "Users can select own application forms"
  ON public.application_forms FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = application_id AND a.user_id = auth.uid()::text
  ));
CREATE POLICY "Service can insert application forms"
  ON public.application_forms FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service can update application forms"
  ON public.application_forms FOR UPDATE TO service_role USING (true);

-- Application form fields: accessible via form ownership
CREATE POLICY "Users can select own application form fields"
  ON public.application_form_fields FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.application_forms af
    JOIN public.applications a ON a.id = af.application_id
    WHERE af.id = application_form_id AND a.user_id = auth.uid()::text
  ));
CREATE POLICY "Service can manage application form fields"
  ON public.application_form_fields FOR ALL TO service_role USING (true);

-- Worker locks: internal service only
CREATE POLICY "Service can manage worker locks"
  ON public.application_worker_locks FOR ALL TO service_role USING (true);
