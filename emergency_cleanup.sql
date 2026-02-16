-- EMERGENCY CLEANUP SCRIPT
-- Run this in the Supabase SQL Editor to fix "Unable to sign in/create account" for test users.

-- 1. Delete the user from the AUTH schema (this cascades to profiles usually, but we'll be thorough)
DELETE FROM auth.users WHERE email = 'testguy@example.com';

-- 2. Delete any lingering profiles just in case
DELETE FROM public.profiles WHERE username = 'testguy';

-- 3. Verify cleanup
SELECT * FROM auth.users WHERE email = 'testguy@example.com';
