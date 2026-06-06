
CREATE POLICY "receipts_party_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'trade-receipts' AND EXISTS (
    SELECT 1 FROM public.trade_offers o
    WHERE o.id::text = split_part(name, '/', 1)
      AND (o.from_user = auth.uid() OR o.to_user = auth.uid())
  )
);

CREATE POLICY "receipts_party_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trade-receipts' AND EXISTS (
    SELECT 1 FROM public.trade_offers o
    WHERE o.id::text = split_part(name, '/', 1)
      AND (o.from_user = auth.uid() OR o.to_user = auth.uid())
  )
);
