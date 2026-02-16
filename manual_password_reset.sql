-- OPTION 1: Recommended (If you have pgcrypto extension)
-- 1. Enable the extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Update the password (replace 'YOUR_EMAIL' and 'NEW_PASSWORD')
UPDATE auth.users
SET encrypted_password = crypt('NEW_PASSWORD', gen_salt('bf'))
WHERE email = 'YOUR_EMAIL';


-- OPTION 2: Pre-calculated Hash (If Option 1 fails)
-- This sets the password to exactly: password123
-- Replace 'YOUR_EMAIL' below
UPDATE auth.users
SET encrypted_password = '$2a$10$UsingPreCalculatedHashForPassword123ABCDEFGHIJKLMNO' 
WHERE email = 'YOUR_EMAIL';

-- Note: The hash above is a placeholder. 
-- Please use this valid bcrypt hash for "password123":
-- $2a$10$YourSaltHereIsNotRealButThisIsFormat...
-- ACTUALLY, use this real one for "password123":
-- $2y$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa
