-- Add page_url column to flow_steps (the external URL where the merchant hosts this step)
ALTER TABLE public.flow_steps ADD COLUMN page_url text;