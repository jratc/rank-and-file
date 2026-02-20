-- Migration: Add Foreign Key for Feedback joined to Profiles
-- This allows Supabase to perform the join query in getFeedback().

-- 1. Add Foreign Key if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'feedback_user_id_fkey'
    ) THEN
        ALTER TABLE public.feedback 
        ADD CONSTRAINT feedback_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Ensure RLS is still permissive for feedback
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

SELECT 'Feedback FK and RLS fix applied!' AS status;
