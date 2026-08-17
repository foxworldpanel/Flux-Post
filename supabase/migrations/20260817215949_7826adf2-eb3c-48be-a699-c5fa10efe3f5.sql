-- 1. Refresh grants to be explicit
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_renders TO authenticated;
GRANT ALL ON public.media_renders TO service_role;

-- 2. Ensure RLS is enabled
ALTER TABLE public.media_renders ENABLE ROW LEVEL SECURITY;

-- 3. Drop any existing restrictive policies and create standard CRUD policies for users
DROP POLICY IF EXISTS "Users can manage their own renders" ON public.media_renders;
DROP POLICY IF EXISTS "Users can see own renders" ON public.media_renders;
DROP POLICY IF EXISTS "Users can insert own renders" ON public.media_renders;
DROP POLICY IF EXISTS "Users can update own renders" ON public.media_renders;

CREATE POLICY "Users can see own renders"
ON public.media_renders FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own renders"  
ON public.media_renders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own renders"
ON public.media_renders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own renders"
ON public.media_renders FOR DELETE
TO authenticated
USING (auth.uid() = user_id);