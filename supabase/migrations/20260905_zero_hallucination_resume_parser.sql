-- Migration: 20260905_zero_hallucination_resume_parser.sql
-- Purpose: Add staging table for parsed resume data and audit logging table for zero-hallucination profile updates.

-- 1. Create resume_parsed_profiles staging table
CREATE TABLE IF NOT EXISTS public.resume_parsed_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    resume_file_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
    parser_version TEXT NOT NULL DEFAULT 'resume_parser_v2',
    parsed_data JSONB NOT NULL,
    extraction_confidence TEXT NOT NULL DEFAULT 'HIGH',
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    validation_results JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'verified', 'applied', 'rejected')),
    raw_text TEXT,
    parsed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for resume_parsed_profiles
CREATE INDEX IF NOT EXISTS idx_resume_parsed_profiles_profile_id ON public.resume_parsed_profiles(profile_id);
CREATE INDEX IF NOT EXISTS idx_resume_parsed_profiles_resume_file_id ON public.resume_parsed_profiles(resume_file_id);
CREATE INDEX IF NOT EXISTS idx_resume_parsed_profiles_status ON public.resume_parsed_profiles(status);

-- 2. Create resume_audit_logs table
CREATE TABLE IF NOT EXISTS public.resume_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parser_version TEXT NOT NULL DEFAULT 'resume_parser_v2',
    field TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    source_evidence TEXT,
    confidence TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for resume_audit_logs
CREATE INDEX IF NOT EXISTS idx_resume_audit_logs_profile_id ON public.resume_audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_resume_audit_logs_resume_id ON public.resume_audit_logs(resume_id);

-- Enable RLS
ALTER TABLE public.resume_parsed_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for resume_parsed_profiles
CREATE POLICY "Users can view their own parsed profiles"
    ON public.resume_parsed_profiles
    FOR SELECT
    USING (
        profile_id IN (
            SELECT id FROM public.profiles WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update their own parsed profiles"
    ON public.resume_parsed_profiles
    FOR UPDATE
    USING (
        profile_id IN (
            SELECT id FROM public.profiles WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY "Service role has full access to resume_parsed_profiles"
    ON public.resume_parsed_profiles
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Policies for resume_audit_logs
CREATE POLICY "Users can view their own resume audit logs"
    ON public.resume_audit_logs
    FOR SELECT
    USING (
        profile_id IN (
            SELECT id FROM public.profiles WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY "Service role has full access to resume_audit_logs"
    ON public.resume_audit_logs
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
