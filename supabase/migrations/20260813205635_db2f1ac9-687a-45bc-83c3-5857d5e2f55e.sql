
-- Add is_approved column to media_renders
ALTER TABLE public.media_renders ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- Allow authenticated users to update is_approved
CREATE POLICY "Users can update their own renders approval" 
ON public.media_renders 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.media_renders TO authenticated;
GRANT ALL ON public.media_renders TO service_role;
