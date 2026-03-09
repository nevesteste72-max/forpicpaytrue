-- Add Facebook Pixel and Token fields to payment_links
ALTER TABLE public.payment_links
ADD COLUMN facebook_pixel_id text DEFAULT NULL,
ADD COLUMN facebook_token text DEFAULT NULL;