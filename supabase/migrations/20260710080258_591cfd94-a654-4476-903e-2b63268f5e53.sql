
-- Make the public view use invoker rules
ALTER VIEW public.payment_links_public SET (security_invoker = true);

-- Re-add anon SELECT policy on active payment links (column privileges will exclude facebook_token)
CREATE POLICY "Anon can view active payment links"
  ON public.payment_links
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Revoke facebook_token column access from anon so SELECT * or explicit selection fails
REVOKE SELECT ON public.payment_links FROM anon;
GRANT SELECT (
  id, user_id, product_name, product_description, logo_url, amount, currency,
  order_bump_name, order_bump_description, order_bump_price,
  order_bump_2_name, order_bump_2_description, order_bump_2_price,
  order_bump_3_name, order_bump_3_description, order_bump_3_price,
  redirect_url, checkout_language, stripe_payment_methods,
  facebook_pixel_id, checkout_banner_url, checkout_timer_minutes,
  recovery_enabled, recovery_discount_percent, recovery_headline,
  recovery_message, recovery_cta_text, recovery_redirect_url,
  show_trust_badges, thank_you_title, thank_you_message, thank_you_video_url,
  product_type, is_active, created_at, updated_at
) ON public.payment_links TO anon;

-- Drop unused helper function
DROP FUNCTION IF EXISTS public.get_owner_facebook_token(uuid);

-- Convert has_role to SECURITY INVOKER (user_roles has own-row SELECT policy for authenticated)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
