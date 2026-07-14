
-- Allow admins to upload/update/delete payment-images for any product owner's folder
CREATE POLICY "Admins can upload any payment image"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any payment image"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'payment-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any payment image"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-images' AND public.has_role(auth.uid(), 'admin'));
