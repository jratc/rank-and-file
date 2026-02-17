
-- Disable RLS on profiles to check if it's the blocker
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Also verify the table exists and is accessible
GRANT ALL ON public.profiles TO postgres, service_role, anon, authenticated;
