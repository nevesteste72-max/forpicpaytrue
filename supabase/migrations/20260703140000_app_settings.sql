-- Singleton table for app-wide settings (e.g. Stripe keys) editable from the Dashboard.
-- RLS is enabled with NO policies: only server-side code using the service role key
-- (edge functions) can read/write this table. The anon/authenticated client roles
-- have zero access, so secrets never round-trip through the browser.
CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  stripe_publishable_key text,
  stripe_secret_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings (id) VALUES (1);
