-- Attempt to manually create a user in auth.users and see if the trigger fires
-- NOTE: We cannot insert into auth.users directly usually, but we can try to insert into profiles directly to test RLS/Constraints

-- 1. Check if we can view profiles
SELECT count(*) FROM profiles;

-- 2. Check if we can view lists
SELECT count(*) FROM lists;

-- 3. Check for any orphaned users (users without profiles)
SELECT id, email FROM auth.users WHERE id NOT IN (SELECT id FROM profiles);
