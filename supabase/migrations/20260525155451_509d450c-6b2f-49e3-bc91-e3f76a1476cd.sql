ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS donation_testimonials JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS donation_social_proof_enabled BOOLEAN NOT NULL DEFAULT false;