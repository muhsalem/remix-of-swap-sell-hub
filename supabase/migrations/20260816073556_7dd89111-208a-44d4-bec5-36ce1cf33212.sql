CREATE POLICY "dispute_attach_owner_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dispute-attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator') OR (storage.foldername(name))[1] = auth.uid()::text));

CREATE POLICY "dispute_attach_owner_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dispute-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);