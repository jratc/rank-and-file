-- Allow users to create their own profile if it's missing (e.g. if the trigger failed)
-- This is necessary for the createList server action's fallback to work.
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Ensure all users have at least a basic profile to avoid FK violations on lists
-- (This is a safety policy in case the trigger is slow or failed)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
