-- Delete lists that have no items in list_items table
-- We match lists where NO corresponding record exists in list_items

DELETE FROM lists
WHERE id NOT IN (
    SELECT DISTINCT list_id 
    FROM list_items
);

-- Optional: If you want to be more specific (e.g. only lists older than a certain time), add AND created_at < ...
-- But the request was "delete all lists ... that have no items".

-- Note: This will fail if there are foreign key constraints without ON DELETE CASCADE 
-- (e.g. comments, responses/children).
-- If constraints exist, we might need to delete those first or use CASCADE.
-- Assuming standard Supabase/Postgres cascade setup for child tables like comments.
