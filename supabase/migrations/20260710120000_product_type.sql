-- Distinguish physical vs digital products so the purchase email can differ
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'digital' CHECK (product_type IN ('physical', 'digital'));
