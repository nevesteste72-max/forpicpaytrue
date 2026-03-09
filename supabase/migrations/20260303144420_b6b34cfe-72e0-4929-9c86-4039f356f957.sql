
CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE CASCADE NOT NULL,
  customer_email text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  product_name text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'MZN',
  reason text NOT NULL,
  reason_details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  user_id uuid NOT NULL
);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- Owners can view their refund requests
CREATE POLICY "Users can view their refund requests"
ON public.refund_requests FOR SELECT
USING (auth.uid() = user_id);

-- Owners can update their refund requests
CREATE POLICY "Users can update their refund requests"
ON public.refund_requests FOR UPDATE
USING (auth.uid() = user_id);

-- Anyone can insert refund requests (public form)
CREATE POLICY "Anyone can insert refund requests"
ON public.refund_requests FOR INSERT
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_refund_requests_updated_at
BEFORE UPDATE ON public.refund_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
