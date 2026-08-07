-- Phase 1.3 Remediation Migration

-- 1. Ensure content-library bucket exists and is private
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('content-library', 'content-library', false, 104857600, ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo'])
ON CONFLICT (id) DO UPDATE SET 
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo'];

-- 2. Security Definer RPC for claiming the 'sourcee' seed artist
CREATE OR REPLACE FUNCTION public.claim_sourcee_seed()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_artist_id uuid;
BEGIN
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- 2. Check if user already has an artist with slug 'sourcee'
    SELECT id INTO v_artist_id 
    FROM public.artists 
    WHERE user_id = v_user_id AND slug = 'sourcee'
    LIMIT 1;

    IF v_artist_id IS NOT NULL THEN
        RETURN json_build_object('success', true, 'message', 'Sourcee already claimed', 'id', v_artist_id);
    END IF;

    -- 3. Try to claim the unassigned 'sourcee' seed
    UPDATE public.artists
    SET user_id = v_user_id,
        updated_at = now()
    WHERE slug = 'sourcee' 
      AND user_id IS NULL
    RETURNING id INTO v_artist_id;

    IF v_artist_id IS NOT NULL THEN
        RETURN json_build_object('success', true, 'message', 'Sourcee claimed successfully', 'id', v_artist_id);
    ELSE
        -- If no seed exists, create a new one for this user
        INSERT INTO public.artists (name, slug, user_id, status)
        VALUES ('Sourcee', 'sourcee', v_user_id, 'ativo')
        RETURNING id INTO v_artist_id;
        
        RETURN json_build_object('success', true, 'message', 'Sourcee created for user', 'id', v_artist_id);
    END IF;
END;
$$;

-- Revoke execute from anon
REVOKE EXECUTE ON FUNCTION public.claim_sourcee_seed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_sourcee_seed() FROM anon;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_sourcee_seed() TO authenticated;

-- 3. Ensure user_id column in campanhas has a proper constraint or default if needed
-- But first check if it exists (it should from Phase 1.2)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campanhas' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.campanhas ADD COLUMN user_id uuid REFERENCES auth.users(id);
    END IF;
END $$;

