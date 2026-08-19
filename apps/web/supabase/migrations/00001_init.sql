-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL, -- Firebase UID
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create experiences table
CREATE TABLE IF NOT EXISTS public.experiences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  job_title TEXT,
  duration TEXT,
  responsibilities TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create educations table
CREATE TABLE IF NOT EXISTS public.educations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution TEXT,
  degree TEXT,
  field_of_study TEXT,
  duration TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create skills table
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_name TEXT,
  description TEXT,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create certifications table
CREATE TABLE IF NOT EXISTS public.certifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  certification_name TEXT,
  issuer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create links table
CREATE TABLE IF NOT EXISTS public.links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  url_type TEXT,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create resumes table (for tracking uploaded files)
CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- Note: Since authentication is via Firebase, we might need to rely on the service role
-- for server-side operations, or setup a custom JWT verification in Supabase.
-- For simplicity, since the server (Next.js API route) will be doing the inserting 
-- and fetching with the Service Role / Admin context, we can allow anon/authenticated 
-- to read if we want, but using service_role is safer.
-- Let's just create policies that allow all for now, or just use service role key in our app.

-- Let's create policies allowing public access just to ensure the app works during development.
-- (In a real app, you'd integrate Firebase Auth with Supabase or use RLS with custom claims)
CREATE POLICY "Allow public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.profiles FOR UPDATE USING (true);

CREATE POLICY "Allow public read" ON public.experiences FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.experiences FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.experiences FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.experiences FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON public.educations FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.educations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.educations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.educations FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON public.skills FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.skills FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.skills FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.skills FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.projects FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON public.certifications FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.certifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.certifications FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.certifications FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON public.links FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.links FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.links FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.links FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON public.resumes FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.resumes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.resumes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.resumes FOR DELETE USING (true);

-- Create Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', true);

-- Storage policies
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'resumes');
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'resumes');
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id = 'resumes');
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'resumes');
