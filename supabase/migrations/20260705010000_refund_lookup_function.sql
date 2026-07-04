-- The public /refund page lets a customer look up their own purchases by
-- email, but transactions RLS only allows the payment-link owner to SELECT
-- rows — so the anonymous lookup always returned zero results. This function
-- runs with elevated privileges to do the email-scoped lookup safely, without
-- opening a broad public SELECT policy on the whole transactions table.
CREATE OR REPLACE FUNCTION public.search_transactions_by_email(p_email text)
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
  WHERE t.customer_email = lower(trim(p_email))
    AND t.status IN ('successful', 'completed', 'success')
  ORDER BY t.created_at DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_transactions_by_email(text) TO anon, authenticated;
