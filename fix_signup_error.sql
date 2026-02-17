-- 1. Re-create the Username Generation Function
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

  -- Extract username from email (before @)
  base_username := LOWER(REGEXP_REPLACE(
    SPLIT_PART(NEW.email, '@', 1),
    '[^a-z0-9]',
    '',
    'g'
  ));
  
  -- Ensure minimum length
  IF LENGTH(base_username) < 3 THEN
    base_username := base_username || 'user';
  END IF;
  
  final_username := base_username;
  
  -- Handle duplicates by appending random suffix
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || FLOOR(RANDOM() * 10000)::TEXT;
    
    -- Safety: prevent infinite loop
    IF counter > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique username for email: %', NEW.email;
    END IF;
  END LOOP;
  
  NEW.username := final_username;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Restore the Trigger on Profiles
DROP TRIGGER IF EXISTS set_username_on_signup ON profiles;
CREATE TRIGGER set_username_on_signup
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_username_from_email();

-- 3. Robust Handle New User (with ON CONFLICT and Display Name)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
