
-- Add redirect_url column to payment_links for post-purchase redirection
ALTER TABLE public.payment_links
ADD COLUMN redirect_url TEXT DEFAULT NULL;
