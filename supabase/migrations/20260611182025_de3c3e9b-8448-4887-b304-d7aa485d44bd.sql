-- Policies for 'videos-processados' bucket
CREATE POLICY "Public Access for Processed Videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos-processados');

CREATE POLICY "Public Insert for Processed Videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'videos-processados');

CREATE POLICY "Public Update for Processed Videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'videos-processados');

CREATE POLICY "Public Delete for Processed Videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'videos-processados');