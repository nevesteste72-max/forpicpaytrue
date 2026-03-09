
-- Add checkout appearance columns to payment_links
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS checkout_banner_url TEXT,
  ADD COLUMN IF NOT EXISTS checkout_timer_minutes INTEGER DEFAULT 0;
