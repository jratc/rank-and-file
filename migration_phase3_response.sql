-- Phase 3: Response System
-- Add parent_id to lists table to enable threaded conversations/responses

ALTER TABLE lists 
ADD COLUMN parent_id UUID REFERENCES lists(id) ON DELETE SET NULL;

-- Add index for faster lookups of responses
CREATE INDEX idx_lists_parent_id ON lists(parent_id);

-- Comment
COMMENT ON COLUMN lists.parent_id IS 'Reference to the parent list if this is a response/remix';
