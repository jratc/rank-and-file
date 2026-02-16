-- Social Features Migration

CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Allow public read access to follows
CREATE POLICY "Public follows are viewable by everyone."
  ON follows FOR SELECT
  USING (true);

-- Allow authenticated users to follow others
CREATE POLICY "Users can insert their own follows."
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Allow users to unfollow
CREATE POLICY "Users can delete their own follows."
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS follows_follower_id_idx ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_id_idx ON follows(following_id);
