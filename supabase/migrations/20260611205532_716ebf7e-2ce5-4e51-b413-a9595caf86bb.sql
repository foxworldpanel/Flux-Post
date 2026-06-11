-- Ensure policies exist for public access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access" ON storage.objects
        FOR SELECT USING (bucket_id IN ('musicas', 'videos'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Upload'
    ) THEN
        CREATE POLICY "Public Upload" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id IN ('musicas', 'videos')
        );
    END IF;
END
$$;
