-- ============================================
-- RANK AND FILE: PHASE 1 MIGRATION (FINAL)
-- ============================================
-- Fixes: search_path on SECURITY DEFINER, proper trigger setup

-- ============================================
-- STEP 1: CLEAN UP EVERYTHING
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_username_on_signup ON profiles;
DROP TRIGGER IF EXISTS on_response_created ON lists;
DROP TRIGGER IF EXISTS on_response_deleted ON lists;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_lists_updated_at ON lists;

DROP INDEX IF EXISTS idx_list_items_entity_id;

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS generate_username_from_email() CASCADE;
DROP FUNCTION IF EXISTS increment_response_count() CASCADE;
DROP FUNCTION IF EXISTS decrement_response_count() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

DROP TABLE IF EXISTS list_items CASCADE;
DROP TABLE IF EXISTS lists CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

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

CREATE INDEX idx_profiles_username ON profiles(username);

-- ============================================
-- STEP 3: HANDLE NEW USER SIGNUP
-- ============================================
-- This SINGLE function does everything:
-- 1. Generates username from the auth.users email
-- 2. Inserts a new profile row
-- IMPORTANT: SET search_path = '' is required by Supabase for SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Extract username from email (before @), allow dots, underscores, hyphens
  base_username := LOWER(REGEXP_REPLACE(
    SPLIT_PART(NEW.email, '@', 1),
    '[^a-z0-9._-]',
    '',
    'g'
  ));

  -- Ensure minimum length
  IF LENGTH(base_username) < 3 THEN
    base_username := base_username || 'user';
  END IF;

  final_username := base_username;

  -- Handle duplicates
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || FLOOR(RANDOM() * 10000)::TEXT;
    IF counter > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique username';
    END IF;
  END LOOP;

  -- Insert the profile
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, final_username);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: fires when a new user signs up via Supabase Auth
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STEP 4: CREATE LISTS TABLE
-- ============================================

CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('music', 'movies', 'bars', 'restaurants', 'other')),
  parent_id UUID REFERENCES lists(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lists_user_id ON lists(user_id);
CREATE INDEX idx_lists_parent_id ON lists(parent_id);
CREATE INDEX idx_lists_category ON lists(category);
CREATE INDEX idx_lists_created_at ON lists(created_at DESC);
CREATE INDEX idx_lists_public ON lists(is_public) WHERE is_public = TRUE;

-- ============================================
-- STEP 5: CREATE LIST_ITEMS TABLE
-- ============================================

CREATE TABLE list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_list_items_list_id ON list_items(list_id);
CREATE INDEX idx_list_items_rank ON list_items(list_id, rank);
CREATE INDEX idx_list_items_entity_id ON list_items(entity_id);

-- ============================================
-- STEP 6: ENABLE RLS
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 7: PROFILES POLICIES
-- ============================================

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (TRUE);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- STEP 8: LISTS POLICIES
-- ============================================

CREATE POLICY "Public lists are viewable by everyone"
  ON lists FOR SELECT USING (is_public = TRUE);

CREATE POLICY "Users can view own lists"
  ON lists FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own lists"
  ON lists FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lists"
  ON lists FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists"
  ON lists FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- STEP 9: LIST_ITEMS POLICIES
-- ============================================

CREATE POLICY "Items viewable with list"
  ON list_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND (lists.is_public = TRUE OR lists.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own list items"
  ON list_items FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own list items"
  ON list_items FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own list items"
  ON list_items FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );

-- ============================================
-- STEP 10: HELPER TRIGGERS
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
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 11: CLEAN UP ORPHANED AUTH USERS
-- ============================================
-- Previous failed signups may have left users in auth.users
-- without profiles. Delete them so they can re-register.
DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM auth.identities);

-- ============================================
-- DONE
-- ============================================
SELECT 'Migration complete!' AS status;
