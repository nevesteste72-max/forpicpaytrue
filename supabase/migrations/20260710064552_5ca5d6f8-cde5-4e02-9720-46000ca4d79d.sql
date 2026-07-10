
CREATE OR REPLACE FUNCTION public.get_transaction_for_refund(
  p_transaction_id uuid,
  p_email text
)
RETURNS TABLE (
  id uuid,
  customer_email text,
  customer_name text,
  amount numeric,
  currency text,
  payment_link_id uuid,
  product_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.customer_email, t.customer_name, t.amount, t.currency,
         t.payment_link_id, pl.product_name, t.created_at
  FROM public.transactions t
  JOIN public.payment_links pl ON pl.id = t.payment_link_id
  WHERE t.id = p_transaction_id
    AND lower(t.customer_email) = lower(p_email)
    AND t.status = 'approved'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_transaction_for_refund(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_transaction_for_refund(uuid, text) TO anon, authenticated;
