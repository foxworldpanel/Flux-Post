-- Storage policies for 'rendered' bucket
CREATE POLICY "Users can upload their own renders"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rendered' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read their own renders"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rendered' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own renders"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'rendered' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own renders"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rendered' AND (storage.foldername(name))[1] = auth.uid()::text);
