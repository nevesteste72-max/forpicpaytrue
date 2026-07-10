
-- 1. app_settings: admin-only policies
DROP POLICY IF EXISTS "Admins can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can insert app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can delete app settings" ON public.app_settings;

CREATE POLICY "Admins can view app settings" ON public.app_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert app settings" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update app settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete app settings" ON public.app_settings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. payment_links: revoke facebook_token from anon and authenticated (server-side only via service_role)
REVOKE SELECT (facebook_token) ON public.payment_links FROM anon;
REVOKE SELECT (facebook_token) ON public.payment_links FROM authenticated;
-- Owner-facing access for facebook_token via a security definer helper (owner only)
CREATE OR REPLACE FUNCTION public.get_owner_facebook_token(_link_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT facebook_token FROM public.payment_links
  WHERE id = _link_id AND user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_owner_facebook_token(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_owner_facebook_token(uuid) TO authenticated;

-- 3. refund_requests: require insert to match a real transaction owned/matched by the requester
DROP POLICY IF EXISTS "Anyone can insert refund requests" ON public.refund_requests;
CREATE POLICY "Refund insert must match a real transaction"
  ON public.refund_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = refund_requests.transaction_id
        AND t.payment_link_id = refund_requests.payment_link_id
        AND lower(t.customer_email) = lower(refund_requests.customer_email)
        AND t.amount = refund_requests.amount
    )
  );

-- 4. whatsapp_messages: restrict insert to owner of the instance
DROP POLICY IF EXISTS "Service can insert messages" ON public.whatsapp_messages;
CREATE POLICY "Users can insert messages into their own instance"
  ON public.whatsapp_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.whatsapp_instances wi
      WHERE wi.id = whatsapp_messages.instance_id
        AND wi.user_id = auth.uid()
    )
  );

-- 5. Storage: scope INSERT into payment-images to the user's own folder
DROP POLICY IF EXISTS "Users can upload payment images" ON storage.objects;
CREATE POLICY "Users can upload payment images to their folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. Storage: drop broad SELECT policy (bucket is public, files still served via CDN, but listing blocked)
DROP POLICY IF EXISTS "Public can view payment images" ON storage.objects;

-- 7. Revoke EXECUTE on trigger functions from anon/authenticated (SECURITY DEFINER hardening)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM public, anon, authenticated;
