
-- Add recovery/sales recovery fields to payment_links
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS recovery_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_discount_percent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_headline text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recovery_message text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recovery_cta_text text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recovery_redirect_url text DEFAULT NULL;
