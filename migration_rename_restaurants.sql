
-- Migration: Combine 'bars' and 'restaurants' into 'food'

-- 1. Drop the constraint FIRST so we can update values freely
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lists_category_check') THEN
        ALTER TABLE lists DROP CONSTRAINT lists_category_check;
    END IF;
END $$;

-- 2. Update existing lists
-- Rename 'restaurants' -> 'food'
UPDATE lists
SET category = 'food'
WHERE category = 'restaurants';

-- Merge 'bars' -> 'food'
UPDATE lists
SET category = 'food'
WHERE category = 'bars';

-- 3. Re-create the constraint with the new allowed values
-- Note: 'bars' and 'restaurants' are removed from the allowed list
ALTER TABLE lists ADD CONSTRAINT lists_category_check 
CHECK (category IN ('music', 'movies', 'books', 'places', 'food', 'other', 'more'));

