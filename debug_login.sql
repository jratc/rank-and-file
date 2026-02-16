-- DIAGNOSTIC QUERY
-- Run this to check your user status
SELECT 
    id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    last_sign_in_at,
    raw_user_meta_data
FROM auth.users;

-- FIX 1: If email_confirmed_at is NULL, run this:
-- UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'YOUR_EMAIL';

-- FIX 2: Re-run Password Reset (Try this simple hash for 'password')
-- This is a raw bcrypt hash for the word "password"
-- UPDATE auth.users 
-- SET encrypted_password = '$2a$10$X7V.jOzH8.t.t.t.t.t.t.t.t.t.t.t.t.t.t.t.t.t.t.t.t.t.' 
-- WHERE email = 'YOUR_EMAIL';
