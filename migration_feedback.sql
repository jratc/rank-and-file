-- Migration: Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert feedback
CREATE POLICY "Allow authenticated users to insert feedback" 
ON public.feedback FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Allow anonymous users to insert feedback (optional, but requested for general feedback)
CREATE POLICY "Allow anonymous users to insert feedback" 
ON public.feedback FOR INSERT 
TO anon 
WITH CHECK (user_id IS NULL);

-- Admin can view all feedback (assuming an admin role exists or just for superuser)
-- For now, we'll keep it simple and just allow inserts.
