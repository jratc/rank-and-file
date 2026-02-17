
-- RECOVERY SCRIPT FOR SIGN-UP
-- Previous debug attempt failed because we removed the username generator, causing a NOT NULL violation.
-- This script restores the full chain: Auth -> Trigger -> Profile -> Username Gen.

-- 1. Restore Username Generation Function (CRITICAL)
CREATE OR REPLACE FUNCTION generate_username_from_email()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Extract username from email
  base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '', 'g'));
  
  -- Fallback if empty
  IF LENGTH(base_username) < 3 THEN
    base_username := 'user' || FLOOR(RANDOM() * 1000)::TEXT;
  END IF;
  
  final_username := base_username;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || FLOOR(RANDOM() * 10000)::TEXT;
    IF counter > 100 THEN RAISE EXCEPTION 'Cannot generate username'; END IF;
  END LOOP;
  
  NEW.username := final_username;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Restore Trigger on Profiles (CRITICAL)
DROP TRIGGER IF EXISTS set_username_on_signup ON public.profiles;
CREATE TRIGGER set_username_on_signup
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_username_from_email();

-- 3. Define the Auth Handler (captures display_name)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_name TEXT;
BEGIN
  -- Safely extract display_name
  meta_name := NEW.raw_user_meta_data->>'display_name';
  
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    meta_name
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Grant Permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.profiles TO anon;

-- 5. Attach Trigger to Auth.Users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
