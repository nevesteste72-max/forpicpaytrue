CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO service_role;

DROP POLICY IF EXISTS "Admins can upload any payment image" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update any payment image" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete any payment image" ON storage.objects;

CREATE POLICY "Admins can upload any payment image"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-images'
  AND private.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update any payment image"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-images'
  AND private.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'payment-images'
  AND private.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete any payment image"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-images'
  AND private.has_role(auth.uid(), 'admin'::public.app_role)
);

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;