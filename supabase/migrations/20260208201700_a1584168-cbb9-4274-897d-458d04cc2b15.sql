
-- Add button customization fields to flow_steps
ALTER TABLE public.flow_steps
ADD COLUMN IF NOT EXISTS button_accept_text text DEFAULT 'SIM! Eu quero!',
ADD COLUMN IF NOT EXISTS button_accept_color text DEFAULT '#10b981',
ADD COLUMN IF NOT EXISTS button_decline_text text DEFAULT 'Não, obrigado',
ADD COLUMN IF NOT EXISTS button_decline_color text DEFAULT '#6b7280',
ADD COLUMN IF NOT EXISTS show_accept_button boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_decline_button boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS page_headline text,
ADD COLUMN IF NOT EXISTS page_subheadline text;
