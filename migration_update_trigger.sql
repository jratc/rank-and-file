-- Update handle_new_user to capture display_name from metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, username)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'display_name',
    -- Use provided username or let the generation trigger handle it (by passing NULL/Default)
    -- Actually, the generation trigger runs BEFORE INSERT on profiles.
    -- So if we insert NULL, it generates one.
    -- If we insert a value, it keeps it (unless trigger overrides).
    -- unique_username trigger logic:
    -- "NEW.username := final_username;" -> It OVERWRITES whatever we pass unless we add logic.
    -- But let's just pass display_name for now.
    -- Wait, the INSERT above in migration_phase1_auth.sql only had (id, email).
    -- So we just add display_name.
    NULL -- Placeholder for username column if needed, but actually we should just let the trigger handle it?
         -- No, we just omit username from columns if we want trigger to generate.
         -- But we can't omit it if it's NOT NULL?
         -- generate_username_from_email runs BEFORE INSERT. It sets NEW.username.
         -- So we don't need to pass it.
  );
  -- Wait, the original function was:
  -- INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  -- So we change it to:
  
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'display_name'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
