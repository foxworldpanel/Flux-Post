-- Políticas para o bucket 'rendered' para permitir upload e leitura autenticada
DO $$
BEGIN
    -- Verifica se a política de inserção já existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Allow authenticated uploads to rendered'
    ) THEN
        CREATE POLICY "Allow authenticated uploads to rendered"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'rendered');
    END IF;

    -- Verifica se a política de seleção já existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Allow authenticated reads from rendered'
    ) THEN
        CREATE POLICY "Allow authenticated reads from rendered"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (bucket_id = 'rendered');
    END IF;

    -- Política de update (necessária para upsert: true)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Allow authenticated updates to rendered'
    ) THEN
        CREATE POLICY "Allow authenticated updates to rendered"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (bucket_id = 'rendered');
    END IF;
END
$$;
