
-- Create a helper function for slug generation in the database to prevent race conditions
CREATE OR REPLACE FUNCTION public.generate_unique_artist_slug(p_name TEXT, p_user_id UUID, p_exclude_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    v_base_slug TEXT;
    v_final_slug TEXT;
    v_counter INTEGER := 1;
BEGIN
    -- Basic slugification
    v_base_slug := lower(p_name);
    v_base_slug := regexp_replace(v_base_slug, '[áàâãä]', 'a', 'g');
    v_base_slug := regexp_replace(v_base_slug, '[éèêë]', 'e', 'g');
    v_base_slug := regexp_replace(v_base_slug, '[íìîï]', 'i', 'g');
    v_base_slug := regexp_replace(v_base_slug, '[óòôõö]', 'o', 'g');
    v_base_slug := regexp_replace(v_base_slug, '[úùûü]', 'u', 'g');
    v_base_slug := regexp_replace(v_base_slug, '[ç]', 'c', 'g');
    v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9]+', '-', 'g');
    v_base_slug := trim(both '-' from v_base_slug);
    
    IF v_base_slug = '' THEN
        v_base_slug := 'artista';
    END IF;

    v_final_slug := v_base_slug;

    -- Loop to find unique slug
    -- Note: Since artists_slug_key is currently global UNIQUE(slug), we check globally
    WHILE EXISTS (
        SELECT 1 FROM public.artists 
        WHERE slug = v_final_slug 
        AND (p_exclude_id IS NULL OR id != p_exclude_id)
    ) LOOP
        v_counter := v_counter + 1;
        v_final_slug := v_base_slug || '-' || v_counter;
    END LOOP;

    RETURN v_final_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.generate_unique_artist_slug(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_artist_slug(TEXT, UUID, UUID) TO service_role;
