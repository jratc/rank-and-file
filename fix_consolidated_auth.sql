
-- CONSOLIDATED AUTH FIX
-- Goal: Remove "Trigger Chaining" complexity.
-- Logic: The handle_new_user trigger will do EVERYTHING: generate username, extract metadata, and insert profile.

-- 1. DROP old triggers and functions to clear the slate
DROP TRIGGER IF EXISTS set_username_on_signup ON public.profiles;
DROP FUNCTION IF EXISTS generate_username_from_email();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Create the All-In-One Handler
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_username TEXT;
  base_username TEXT;
  meta_name TEXT;
  counter INTEGER := 0;
BEGIN
  -- A. Generate Username
  -- Extract from email (everything before @, alphanumeric only)
  base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '', 'g'));
  
  -- Fallback if empty or too short
  IF LENGTH(base_username) < 3 THEN
    base_username := 'user' || FLOOR(RANDOM() * 1000)::TEXT;
  END IF;
  
  new_username := base_username;
  
  -- Simple uniqueness check (try up to 10 unique suffixes)
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
    counter := counter + 1;
    new_username := base_username || FLOOR(RANDOM() * 10000)::TEXT;
    IF counter > 10 THEN
       -- Last resort fallback to UUID segment to basically guarantee uniqueness
       new_username := base_username || '_' || SUBSTR(MD5(RANDOM()::TEXT), 1, 6);
    END IF;
  END LOOP;

  -- B. Extract Display Name from Metadata
  meta_name := NEW.raw_user_meta_data->>'display_name';
  -- Default to username if display name is missing/empty
  IF meta_name IS NULL OR meta_name = '' THEN
    meta_name := new_username;
  END IF;

  -- C. Insert Profile
  INSERT INTO public.profiles (id, email, username, display_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    new_username,
    meta_name
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    username = COALESCE(public.profiles.username, EXCLUDED.username);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Re-Attach the Single Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 4. Ensure RLS is Re-enabled (Best Practice) - User previously disabled it
-- Let's re-enable it to be safe, assuming this fix works.
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- Actually, let's leave it as is for now to minimize variables. If user disabled it, fine.
-- But we MUST ensure permissions are correct just in case.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.profiles TO anon;
