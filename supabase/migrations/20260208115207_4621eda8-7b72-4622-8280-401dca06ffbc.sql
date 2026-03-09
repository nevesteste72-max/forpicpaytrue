-- Add customer_name column to transactions
ALTER TABLE public.transactions ADD COLUMN customer_name text NOT NULL DEFAULT '';
