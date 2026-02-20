-- Migration: Robust Feedback System
-- Ensures the feedback table exists, has correct FKs, and permissive RLS.

-- 1. Create table if not exists (with user_id referencing profiles)
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add Foreign Key if it doesn't exist
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

-- 3. Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- 4. Clean up old policies
DROP POLICY IF EXISTS "Allow authenticated users to insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow anonymous users to insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow authenticated users to view feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow anonymous users to view feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow anyone to insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow anyone to view feedback" ON public.feedback;

-- 5. Create robust, permissive policies
CREATE POLICY "Allow anyone to insert feedback" 
ON public.feedback FOR INSERT 
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Allow anyone to view feedback" 
ON public.feedback FOR SELECT 
TO authenticated, anon
USING (true);

-- 6. Grant basic permissions
GRANT ALL ON public.feedback TO anon, authenticated, postgres, service_role;

SELECT 'Robust feedback migration applied!' AS status;
