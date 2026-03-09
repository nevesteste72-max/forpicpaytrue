-- Add redirect URL columns to flow_steps for accept/decline actions
ALTER TABLE public.flow_steps 
ADD COLUMN accept_redirect_url text DEFAULT NULL,
ADD COLUMN decline_redirect_url text DEFAULT NULL;