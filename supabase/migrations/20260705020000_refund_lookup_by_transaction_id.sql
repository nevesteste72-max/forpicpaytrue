-- The public /refund page needs to look up a customer's purchase, but RLS on
-- transactions only allows the payment-link owner to SELECT. Rather than
-- exposing a broad email-based search (which would let anyone enumerate
-- other customers' purchase data just by guessing/spraying emails), this
-- function requires the exact transaction id — a high-entropy UUID the
-- customer only has because it was emailed to them — plus a matching email,
-- and returns just that one row.
CREATE OR REPLACE FUNCTION public.get_transaction_for_refund(p_transaction_id uuid, p_email text)
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
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT t.id, t.customer_email, t.customer_name, t.amount, t.currency,
         t.payment_link_id, pl.product_name, t.created_at
  FROM public.transactions t
  JOIN public.payment_links pl ON pl.id = t.payment_link_id
  WHERE t.id = p_transaction_id
    AND t.customer_email = lower(trim(p_email))
    AND t.status IN ('successful', 'completed', 'success')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_transaction_for_refund(uuid, text) TO anon, authenticated;
