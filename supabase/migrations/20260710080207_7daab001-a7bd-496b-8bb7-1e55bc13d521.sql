
-- 1) Replace the broad public SELECT policy on payment_links with a safe view that excludes facebook_token
DROP POLICY IF EXISTS "Anyone can view active payment links" ON public.payment_links;

CREATE OR REPLACE VIEW public.payment_links_public
WITH (security_invoker = false) AS
SELECT
  id, user_id, product_name, product_description, logo_url, amount, currency,
  order_bump_name, order_bump_description, order_bump_price,
  order_bump_2_name, order_bump_2_description, order_bump_2_price,
  order_bump_3_name, order_bump_3_description, order_bump_3_price,
  redirect_url, checkout_language, stripe_payment_methods,
  facebook_pixel_id, checkout_banner_url, checkout_timer_minutes,
  recovery_enabled, recovery_discount_percent, recovery_headline,
  recovery_message, recovery_cta_text, recovery_redirect_url,
  show_trust_badges, thank_you_title, thank_you_message, thank_you_video_url,
  product_type, is_active, created_at
FROM public.payment_links
WHERE is_active = true;

GRANT SELECT ON public.payment_links_public TO anon, authenticated;

-- 2) Lock down SECURITY DEFINER function EXECUTE grants
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_facebook_token(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_transaction_for_refund(uuid, text) FROM PUBLIC, authenticated;

-- Preserve needed access
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_facebook_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_transaction_for_refund(uuid, text) TO anon;
