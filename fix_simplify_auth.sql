
-- Simplify Auth Debug Script
-- This script reduces the handle_new_user trigger to the absolute bare minimum.
-- Usage: Run this in Supabase SQL Editor to rule out complex logic errors.

-- 1. Drop existing triggers to be safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_username_on_signup ON public.profiles;

-- 2. Create a bare-bones handler
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Minimal INSERT: Only ID and Email
  -- We ignore display_name and metadata for now to see if this passes.
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Recheck permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.profiles TO anon;

-- 4. Re-attach the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 5. Create a test profile manually (optional verification)
-- INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000000', 'test.manual@example.com'); 
-- (You can't easily insert into auth.users manually due to permissions, so reliant on sign-up)
