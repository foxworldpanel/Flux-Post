-- Políticas de Storage para o bucket content-library
-- Permite que usuários autenticados façam upload para sua própria pasta (auth.uid())
CREATE POLICY "Users can upload to their own content library"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'content-library' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Permite que usuários autenticados vejam seus próprios arquivos
CREATE POLICY "Users can view their own content library"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'content-library' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Permite que usuários autenticados deletem seus próprios arquivos
CREATE POLICY "Users can delete their own content library"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'content-library' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Permite que usuários autenticados atualizem seus próprios arquivos
CREATE POLICY "Users can update their own content library"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'content-library' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'content-library' AND (storage.foldername(name))[1] = auth.uid()::text);
