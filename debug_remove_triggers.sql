
-- REMOVE TRIGGERS TO ISOLATE FAILURE
-- Goal: Verify if we can sign up AT ALL without the trigger.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Also drop dependent triggers just in case
DROP TRIGGER IF EXISTS set_username_on_signup ON public.profiles;
DROP FUNCTION IF EXISTS generate_username_from_email();
