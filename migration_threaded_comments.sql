-- Add parent_id to comments for threading
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;

-- Index for better performance on threaded lookups
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- Update RLS policies to be explicit about threaded comments (usually select is already true but good to be sure)
-- The existing "Comments are viewable by everyone" policy should cover selections.
-- Inserts already check auth.uid() = user_id.

-- Add a comment count column to lists if we want to optimize later, but for now we'll just fetch.
