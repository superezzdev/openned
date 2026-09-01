-- =============================================================================
-- Browserbase Optional Fallback Automation Engine — Database Migration
-- =============================================================================

-- 1. Add automation engine fields to applications table
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS automation_provider    TEXT DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS automation_preference  TEXT DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS automation_attempts    INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fallback_used          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_reason        TEXT,
  ADD COLUMN IF NOT EXISTS last_automation_error  TEXT,
  ADD COLUMN IF NOT EXISTS browser_provider       TEXT DEFAULT 'LOCAL';

CREATE INDEX IF NOT EXISTS idx_applications_automation_provider ON public.applications(automation_provider);
CREATE INDEX IF NOT EXISTS idx_applications_fallback_used ON public.applications(fallback_used);

-- 2. Add user-level automation preference to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS automation_preference TEXT DEFAULT 'AUTO';

-- 3. Create automation_sessions table for tracking browser execution lifecycles
CREATE TABLE IF NOT EXISTS public.automation_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,                      -- 'LOCAL' | 'BROWSERBASE'
  session_id          TEXT NOT NULL,                      -- Local UUID or Browserbase Session ID
  status              TEXT NOT NULL DEFAULT 'ACTIVE',     -- 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'TERMINATED'
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at            TIMESTAMPTZ,
  current_url         TEXT,
  last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_metadata    JSONB DEFAULT '{}'::jsonb,          -- Debug links, replay URLs, console count
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_sessions_app_id ON public.automation_sessions(application_id);
CREATE INDEX IF NOT EXISTS idx_automation_sessions_session_id ON public.automation_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_automation_sessions_provider ON public.automation_sessions(provider);
CREATE INDEX IF NOT EXISTS idx_automation_sessions_status ON public.automation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_automation_sessions_created_at ON public.automation_sessions(created_at DESC);

-- 4. Enable Row Level Security on automation_sessions
ALTER TABLE public.automation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own automation sessions" ON public.automation_sessions;
CREATE POLICY "Users can select own automation sessions"
  ON public.automation_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = application_id AND a.user_id = auth.uid()::text
  ));

DROP POLICY IF EXISTS "Service can manage automation sessions" ON public.automation_sessions;
CREATE POLICY "Service can manage automation sessions"
  ON public.automation_sessions FOR ALL TO service_role USING (true);
