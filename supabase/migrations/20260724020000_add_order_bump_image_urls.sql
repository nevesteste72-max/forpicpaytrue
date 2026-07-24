-- Optional image per order bump (up to 3 bumps), mirroring the product logo.
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS order_bump_image_url TEXT,
  ADD COLUMN IF NOT EXISTS order_bump_2_image_url TEXT,
  ADD COLUMN IF NOT EXISTS order_bump_3_image_url TEXT;
