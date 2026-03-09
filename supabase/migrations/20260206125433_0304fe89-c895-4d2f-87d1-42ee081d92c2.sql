
-- Add order bump support to payment_links (products)
ALTER TABLE public.payment_links 
ADD COLUMN IF NOT EXISTS order_bump_id uuid REFERENCES public.payment_links(id) ON DELETE SET NULL;

-- Add order bump tracking to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS order_bump_accepted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS order_bump_amount numeric DEFAULT 0;

-- Create indexes only if they don't exist
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_link ON public.transactions(payment_link_id);
