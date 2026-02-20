-- Migration: Fix feedback table for mock/anonymous users
-- 1. Drop the foreign key constraint that requires user_id to exist in auth.users
-- This allows our mock user (IS_AUTH_DISABLED) to submit feedback without failing FK check.
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_user_id_fkey;

-- 2. Update RLS policies to be more robust
DROP POLICY IF EXISTS "Allow authenticated users to insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow anonymous users to insert feedback" ON public.feedback;

-- New INSERT policies
CREATE POLICY "Allow anyone to insert feedback" 
ON public.feedback FOR INSERT 
TO authenticated, anon
WITH CHECK (true);

-- Ensure everyone can still see the void
DROP POLICY IF EXISTS "Allow anonymous users to view feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow authenticated users to view feedback" ON public.feedback;

CREATE POLICY "Allow anyone to view feedback" 
ON public.feedback FOR SELECT 
TO authenticated, anon
USING (true);
