-- Create storage bucket for payment link images
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-images', 'payment-images', true);

-- Allow anyone to view images (public bucket)
CREATE POLICY "Public can view payment images"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-images');

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload payment images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-images' 
  AND auth.role() = 'authenticated'
);

-- Allow users to update their own images
CREATE POLICY "Users can update their payment images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'payment-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own images
CREATE POLICY "Users can delete their payment images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);