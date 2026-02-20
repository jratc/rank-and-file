-- Migration: Consolidate 'More', 'Places', and 'Other' categories into 'other'
-- This fixes the duplicate "MORE..." sections on the dashboard.

-- 1. Merge 'more' and 'places' into 'other'
UPDATE lists
SET category = 'other'
WHERE category IN ('more', 'places');

-- 2. Update the constraint to remove 'more' and 'places' if we want them strictly gone
-- (Actually, let's keep 'places' in the constraint just in case, but 'more' was definitely an old test)
-- The existing categories in migration_rename_restaurants were: 
-- ('music', 'movies', 'books', 'places', 'food', 'other', 'more')

-- We'll keep it as is for safety, but data is consolidated now.

SELECT 'Category consolidation complete!' AS status;
