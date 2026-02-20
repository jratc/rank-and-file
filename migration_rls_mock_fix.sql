-- Consolidated Migration: Create Feedback Table and Fix RLS for Mock User
-- Mock User ID: 00000000-0000-0000-0000-000000000000

-- 1. Create feedback table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- No FK constraint to auth.users for mock mode flexibility
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure RLS is enabled
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- 2. Update LISTS policies
DROP POLICY IF EXISTS "Users can insert own lists" ON public.lists;
CREATE POLICY "Users can insert own lists" ON public.lists
FOR INSERT WITH CHECK (
  auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'
);

DROP POLICY IF EXISTS "Users can update own lists" ON public.lists;
CREATE POLICY "Users can update own lists" ON public.lists
FOR UPDATE USING (
  auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'
);

DROP POLICY IF EXISTS "Users can delete own lists" ON public.lists;
CREATE POLICY "Users can delete own lists" ON public.lists
FOR DELETE USING (
  auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'
);

-- 3. Update LIST_ITEMS policies
DROP POLICY IF EXISTS "Users can insert own list items" ON public.list_items;
CREATE POLICY "Users can insert own list items" ON public.list_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = list_items.list_id
    AND (lists.user_id = auth.uid() OR lists.user_id = '00000000-0000-0000-0000-000000000000')
  )
);

DROP POLICY IF EXISTS "Users can update own list items" ON public.list_items;
CREATE POLICY "Users can update own list items" ON public.list_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = list_items.list_id
    AND (lists.user_id = auth.uid() OR lists.user_id = '00000000-0000-0000-0000-000000000000')
  )
);

DROP POLICY IF EXISTS "Users can delete own list items" ON public.list_items;
CREATE POLICY "Users can delete own list items" ON public.list_items
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.lists
    WHERE lists.id = list_items.list_id
    AND (lists.user_id = auth.uid() OR lists.user_id = '00000000-0000-0000-0000-000000000000')
  )
);

-- 4. Feedback table robust access (Final fix)
DROP POLICY IF EXISTS "Allow authenticated users to insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow anonymous users to insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow anyone to insert feedback" ON public.feedback;
CREATE POLICY "Allow anyone to insert feedback" 
ON public.feedback FOR INSERT 
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to view feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow anonymous users to view feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow anyone to view feedback" ON public.feedback;
CREATE POLICY "Allow anyone to view feedback" 
ON public.feedback FOR SELECT 
TO authenticated, anon
USING (true);

SELECT 'Consolidated migration complete!' AS status;
