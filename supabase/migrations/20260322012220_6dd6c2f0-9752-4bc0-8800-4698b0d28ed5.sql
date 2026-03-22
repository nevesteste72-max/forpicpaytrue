
ALTER TABLE public.payment_links 
  ADD COLUMN order_bump_2_name text DEFAULT NULL,
  ADD COLUMN order_bump_2_description text DEFAULT NULL,
  ADD COLUMN order_bump_2_price numeric DEFAULT NULL,
  ADD COLUMN order_bump_3_name text DEFAULT NULL,
  ADD COLUMN order_bump_3_description text DEFAULT NULL,
  ADD COLUMN order_bump_3_price numeric DEFAULT NULL;
