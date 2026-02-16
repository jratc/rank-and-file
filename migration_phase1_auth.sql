-- ============================================
-- RANK AND FILE: SOCIAL PLATFORM MIGRATION
-- Phase 1: Authentication Foundation
-- ============================================

-- This migration transforms Rank and File into a social platform
-- by adding user authentication, profiles, and Row Level Security.

-- ============================================
-- STEP 1: DROP EXISTING TABLES (DATA RESET)
-- ============================================

DROP TABLE IF EXISTS list_items CASCADE;
DROP TABLE IF EXISTS lists CASCADE;

-- ============================================
-- STEP 2: CREATE PROFILES TABLE
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for username lookups
CREATE INDEX idx_profiles_username ON profiles(username);

-- ============================================
-- STEP 3: AUTO-GENERATE USERNAME FROM EMAIL
-- ============================================

CREATE OR REPLACE FUNCTION generate_username_from_email()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Extract username from email (before @)
  base_username := LOWER(REGEXP_REPLACE(
    SPLIT_PART(NEW.email, '@', 1),
    '[^a-z0-9]',
    '',
    'g'
  ));
  
  -- Ensure minimum length
  IF LENGTH(base_username) < 3 THEN
    base_username := base_username || 'user';
  END IF;
  
  final_username := base_username;
  
  -- Handle duplicates by appending random suffix
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || FLOOR(RANDOM() * 10000)::TEXT;
    
    -- Safety: prevent infinite loop
    IF counter > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique username for email: %', NEW.email;
    END IF;
  END LOOP;
  
  NEW.username := final_username;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate username on profile creation
CREATE TRIGGER set_username_on_signup
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_username_from_email();

-- ============================================
-- STEP 4: AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- STEP 5: RECREATE LISTS TABLE WITH USER OWNERSHIP
-- ============================================

CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('music', 'movies', 'bars', 'restaurants', 'other')),
  parent_id UUID REFERENCES lists(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_lists_user_id ON lists(user_id);
CREATE INDEX idx_lists_parent_id ON lists(parent_id);
CREATE INDEX idx_lists_category ON lists(category);
CREATE INDEX idx_lists_created_at ON lists(created_at DESC);
CREATE INDEX idx_lists_public ON lists(is_public) WHERE is_public = TRUE;

-- ============================================
-- STEP 6: RECREATE LIST_ITEMS TABLE
-- ============================================

CREATE TABLE list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_list_items_list_id ON list_items(list_id);
CREATE INDEX idx_list_items_rank ON list_items(list_id, rank);

-- ============================================
-- STEP 7: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 8: PROFILES RLS POLICIES
-- ============================================

-- Everyone can view all profiles (public platform)
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (TRUE);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- STEP 9: LISTS RLS POLICIES
-- ============================================

-- Everyone can view public lists
CREATE POLICY "Public lists are viewable by everyone"
  ON lists FOR SELECT
  USING (is_public = TRUE);

-- Users can view their own lists (public or private)
CREATE POLICY "Users can view own lists"
  ON lists FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own lists
CREATE POLICY "Users can create own lists"
  ON lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own lists
CREATE POLICY "Users can update own lists"
  ON lists FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own lists
CREATE POLICY "Users can delete own lists"
  ON lists FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 10: LIST_ITEMS RLS POLICIES
-- ============================================

-- Items inherit list visibility
CREATE POLICY "Items inherit list visibility"
  ON list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND (lists.is_public = TRUE OR lists.user_id = auth.uid())
    )
  );

-- Users can manage items in their own lists
CREATE POLICY "Users can insert own list items"
  ON list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own list items"
  ON list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own list items"
  ON list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );

-- ============================================
-- STEP 11: HELPER FUNCTIONS
-- ============================================

-- Function to increment response count
CREATE OR REPLACE FUNCTION increment_response_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    UPDATE lists
    SET response_count = response_count + 1
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_response_created
  AFTER INSERT ON lists
  FOR EACH ROW
  EXECUTE FUNCTION increment_response_count();

-- Function to decrement response count
CREATE OR REPLACE FUNCTION decrement_response_count()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.parent_id IS NOT NULL THEN
    UPDATE lists
    SET response_count = response_count - 1
    WHERE id = OLD.parent_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_response_deleted
  AFTER DELETE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION decrement_response_count();

-- ============================================
-- STEP 12: UPDATED_AT TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify tables exist
SELECT 'Migration complete!' AS status;
SELECT 'Tables created:' AS info;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'lists', 'list_items');
