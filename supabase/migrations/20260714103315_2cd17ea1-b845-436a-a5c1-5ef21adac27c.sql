REVOKE ALL ON TABLE public.user_roles FROM anon;
REVOKE ALL ON TABLE public.user_roles FROM PUBLIC;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.user_roles TO service_role;