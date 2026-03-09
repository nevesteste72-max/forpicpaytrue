
-- Add currency, language, and payment method support to payment_links
ALTER TABLE public.payment_links 
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MZN',
  ADD COLUMN IF NOT EXISTS checkout_language text NOT NULL DEFAULT 'pt',
  ADD COLUMN IF NOT EXISTS stripe_payment_methods text[] NOT NULL DEFAULT '{card}';

-- Add stripe support to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'debito',
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MZN';
