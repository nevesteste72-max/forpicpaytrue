-- Per-product checkout accent color (hex). NULL = use the platform default theme.
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS checkout_accent_color TEXT;
