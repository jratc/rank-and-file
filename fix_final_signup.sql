-- 1. Ensure display_name column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
        ALTER TABLE public.profiles ADD COLUMN display_name TEXT;
    END IF;
END
$$;

-- 2. Recreate Username Generation Function (with search_path safety)
CREATE OR REPLACE FUNCTION generate_username_from_email()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Only generate if username is missing or null
  IF NEW.username IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Extract username from email
  base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '', 'g'));
  
  IF LENGTH(base_username) < 3 THEN
    base_username := base_username || 'user';
  END IF;
  
  final_username := base_username;
  
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || FLOOR(RANDOM() * 10000)::TEXT;
    IF counter > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique username for email: %', NEW.email;
    END IF;
  END LOOP;
  
  NEW.username := final_username;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Recreate Trigger on Profiles (for username generation)
DROP TRIGGER IF EXISTS set_username_on_signup ON public.profiles;
CREATE TRIGGER set_username_on_signup
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_username_from_email();

-- 4. Recreate Handler for New User (with search_path and Conflict Handling)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'display_name'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    email = EXCLUDED.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. IMPORTANT: Recreate Trigger on Auth.Users (Start point)
-- We drop it first to ensure no duplicates or old versions exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 6. Verify Output
SELECT 'Fix Applied Successfully' as status;
SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE event_object_table IN ('users', 'profiles');
