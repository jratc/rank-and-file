-- Create a table to store the latest AI-synthesized feedback summary
CREATE TABLE IF NOT EXISTS feedback_synthesis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE feedback_synthesis ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read the synthesis
CREATE POLICY "Allow public read access to feedback_synthesis"
ON feedback_synthesis FOR SELECT
TO anon, authenticated
USING (true);

-- Only service role or authorized logic (via security definer actions) should write
-- For now, we'll allow authenticated for simplicity if we trust the server action context
CREATE POLICY "Allow authenticated to update feedback_synthesis"
ON feedback_synthesis FOR INSERT
TO authenticated
WITH CHECK (true);
