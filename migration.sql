-- Run these commands in your Supabase SQL Editor to update your existing database
-- ignoring the "profiles" table which already exists.

-- 1. Update 'lists' table
ALTER TABLE lists 
ADD COLUMN IF NOT EXISTS category text default 'music';

-- Update existing singular categories to plural before applying the new constraint
UPDATE lists SET category = 'movies' WHERE category = 'movie';
UPDATE lists SET category = 'bars' WHERE category = 'bar';
UPDATE lists SET category = 'restaurants' WHERE category = 'restaurant';

-- Update the check constraint by recreating it
ALTER TABLE lists DROP CONSTRAINT IF EXISTS lists_category_check;
ALTER TABLE lists ADD CONSTRAINT lists_category_check CHECK (category in ('music', 'movies', 'bars', 'restaurants', 'food', 'books', 'other'));

ALTER TABLE lists 
ADD COLUMN IF NOT EXISTS is_public boolean default true,
ADD COLUMN IF NOT EXISTS parent_list_id uuid references lists(id) on delete set null;

-- 2. Update 'list_items' table
-- We rename album_id to entity_id to be more generic
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='list_items' and column_name='album_id')
  THEN
      ALTER TABLE list_items RENAME COLUMN album_id TO entity_id;
  END IF;
END $$;

-- 3. DEVELOPMENT BYPASS: Disable RLS and Foreign Keys to allow the mock user to work
-- Run these only if you want to bypass authentication checks for development
ALTER TABLE lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE list_items DISABLE ROW LEVEL SECURITY;

-- Drop the foreign key constraint that requires user_id to exist in auth.users
ALTER TABLE lists DROP CONSTRAINT IF EXISTS lists_user_id_fkey;

-- Alternatives:
-- CREATE POLICY "Allow all for mock user" ON lists FOR ALL USING (user_id = '00000000-0000-0000-0000-000000000000');
-- CREATE POLICY "Allow all for mock user items" ON list_items FOR ALL USING (true);

-- 4. CLEANUP & DEFAULTS
-- Delete all existing draft lists
DELETE FROM lists WHERE status = 'draft';

-- Update default status for new lists to 'published'
ALTER TABLE lists ALTER COLUMN status SET DEFAULT 'published';
