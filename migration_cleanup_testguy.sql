-- CLEANUP SCRIPT FOR TEST USERS
-- Run this in your Supabase SQL Editor to remove 'testguy' and 'testagent'

-- 1. Delete list items for these users (to satisfy foreign keys if cascade is missing)
DELETE FROM list_items 
WHERE list_id IN (
  SELECT id FROM lists 
  WHERE user_id IN (SELECT id FROM profiles WHERE username IN ('testguy', 'testagent'))
);

-- 2. Delete lists for these users
DELETE FROM lists 
WHERE user_id IN (SELECT id FROM profiles WHERE username IN ('testguy', 'testagent'));

-- 3. Delete the public profiles
DELETE FROM profiles WHERE username IN ('testguy', 'testagent');

-- 4. Attempt to delete from auth.users (Requires superuser/service role, usually works in Dashboard)
-- Note: existing RLS policies on public tables might blocking deletion if not running as superuser
-- But from the Dashboard SQL Editor, you are a superuser.

-- Find the IDs first (optional verification step)
-- SELECT id, email FROM auth.users WHERE raw_user_meta_data->>'full_name' LIKE '%Test%' OR email LIKE '%test%';

-- Delete from auth.users using the ID linkage (if profiles still existed, but we deleted them above)
-- So we need to do this carefully. 
-- Actually, the best way is to delete from auth.users and let CASCADE handle the public tables if configured.
-- But since we don't know if CASCADE is set up on auth.users -> public.profiles, we did public first.

-- To delete from auth.users by email:
DELETE FROM auth.users WHERE email IN ('testguy@example.com', 'testagent@example.com', 'test@example.com');
-- (Adjust emails if actual emails are different, e.g. based on the pattern used in auth-bypass or previous creations)
