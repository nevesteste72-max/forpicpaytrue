
-- Add inline order bump fields to payment_links
ALTER TABLE public.payment_links 
ADD COLUMN order_bump_name text,
ADD COLUMN order_bump_price numeric;
