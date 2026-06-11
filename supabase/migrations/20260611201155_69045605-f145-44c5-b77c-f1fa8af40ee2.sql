CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id IN ('musicas', 'videos'));

CREATE POLICY "Public Upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id IN ('musicas', 'videos')
);