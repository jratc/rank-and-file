-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Update the trigger function to include email in the insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Extract username from email
  base_username := LOWER(REGEXP_REPLACE(
    SPLIT_PART(NEW.email, '@', 1),
    '[^a-z0-9._-]',
    '',
    'g'
  ));

  IF LENGTH(base_username) < 3 THEN
    base_username := base_username || 'user';
  END IF;

  final_username := base_username;

  -- Handle duplicates
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || FLOOR(RANDOM() * 10000)::TEXT;
    IF counter > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique username';
    END IF;
  END LOOP;

  -- Insert the profile WITH EMAIL
  INSERT INTO public.profiles (id, username, email)
  VALUES (NEW.id, final_username, NEW.email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill email from auth.users (Best effort, might require superuser)
-- We wrap in a DO block to ignore errors if permission issues occur, 
-- but strictly specialized query is safer. For now we assume we can run this.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
and p.email is null;
