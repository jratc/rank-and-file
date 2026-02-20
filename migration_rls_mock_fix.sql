-- Migration: Fix RLS policies to allow the mock/bypass user
-- Mock User ID: 00000000-0000-0000-0000-000000000000

-- 1. Update LISTS policies
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

-- 2. Update LIST_ITEMS policies
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

-- 3. Feedback table robust access (Final fix)
DROP POLICY IF EXISTS "Allow anyone to insert feedback" ON public.feedback;
CREATE POLICY "Allow anyone to insert feedback" 
ON public.feedback FOR INSERT 
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anyone to view feedback" ON public.feedback;
CREATE POLICY "Allow anyone to view feedback" 
ON public.feedback FOR SELECT 
TO authenticated, anon
USING (true);
