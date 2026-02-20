-- Robust Migration: Deep Fix for RLS Mock User Access
-- Targets: "Failed to shift ranks" during upsert and "all categories" stability.
-- Mock User ID: 00000000-0000-0000-0000-000000000000

-- 1. PROFILES: Ensure mock profile can exist without auth.users record
-- Drop the FK constraint first if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_key') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_key;
    END IF;
END $$;

INSERT INTO public.profiles (id, username, display_name)
VALUES ('00000000-0000-0000-0000-000000000000', 'antigravity', 'Antigravity (Dev)')
ON CONFLICT (id) DO UPDATE SET display_name = 'Antigravity (Dev)';

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
FOR SELECT USING (true);

-- 2. LISTS: Universal bypass for mock user
DROP POLICY IF EXISTS "Users can create own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can insert own lists" ON public.lists;
CREATE POLICY "Mock user can insert lists" ON public.lists
FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

DROP POLICY IF EXISTS "Users can update own lists" ON public.lists;
CREATE POLICY "Mock user can update lists" ON public.lists
FOR UPDATE USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

DROP POLICY IF EXISTS "Users can delete own lists" ON public.lists;
CREATE POLICY "Mock user can delete lists" ON public.lists
FOR DELETE USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

DROP POLICY IF EXISTS "Users can view own lists" ON public.lists;
CREATE POLICY "Mock user can view lists" ON public.lists
FOR SELECT USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000');

-- 3. LIST_ITEMS: Robust bypass for mock user
-- We explicitly grant the mock user access to items if the parent list belongs to it.
-- This handles the common PostgREST upsert pattern.

DROP POLICY IF EXISTS "Users can insert own list items" ON public.list_items;
CREATE POLICY "Mock user can insert list items" ON public.list_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = list_id
    AND (lists.user_id = auth.uid() OR lists.user_id = '00000000-0000-0000-0000-000000000000')
  )
);

DROP POLICY IF EXISTS "Users can update own list items" ON public.list_items;
CREATE POLICY "Mock user can update list items" ON public.list_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = list_id
    AND (lists.user_id = auth.uid() OR lists.user_id = '00000000-0000-0000-0000-000000000000')
  )
);

DROP POLICY IF EXISTS "Users can delete own list items" ON public.list_items;
CREATE POLICY "Mock user can delete list items" ON public.list_items
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = list_id
    AND (lists.user_id = auth.uid() OR lists.user_id = '00000000-0000-0000-0000-000000000000')
  )
);

-- Ensure categories are updated to include all used ones
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lists_category_check') THEN
        ALTER TABLE lists DROP CONSTRAINT lists_category_check;
    END IF;
END $$;

ALTER TABLE lists ADD CONSTRAINT lists_category_check 
CHECK (category IN ('music', 'movies', 'books', 'places', 'food', 'other', 'more'));

SELECT 'Robust RLS fix applied!' AS status;
