
-- Add upsell/downsell flow support columns to payment_links
ALTER TABLE public.payment_links
ADD COLUMN IF NOT EXISTS thank_you_title text,
ADD COLUMN IF NOT EXISTS thank_you_message text,
ADD COLUMN IF NOT EXISTS thank_you_video_url text;

-- Create flow_steps table for upsell/downsell sequences
CREATE TABLE public.flow_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_link_id uuid NOT NULL REFERENCES public.payment_links(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  step_type text NOT NULL DEFAULT 'upsell',
  product_name text NOT NULL,
  product_description text,
  amount numeric NOT NULL,
  image_url text,
  accept_step_id uuid REFERENCES public.flow_steps(id) ON DELETE SET NULL,
  decline_step_id uuid REFERENCES public.flow_steps(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flow_steps ENABLE ROW LEVEL SECURITY;

-- Owners can manage their flow steps
CREATE POLICY "Users can view their own flow steps"
ON public.flow_steps FOR SELECT
USING (EXISTS (
  SELECT 1 FROM payment_links
  WHERE payment_links.id = flow_steps.payment_link_id
  AND payment_links.user_id = auth.uid()
));

CREATE POLICY "Users can create flow steps for their links"
ON public.flow_steps FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM payment_links
  WHERE payment_links.id = flow_steps.payment_link_id
  AND payment_links.user_id = auth.uid()
));

CREATE POLICY "Users can update their own flow steps"
ON public.flow_steps FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM payment_links
  WHERE payment_links.id = flow_steps.payment_link_id
  AND payment_links.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own flow steps"
ON public.flow_steps FOR DELETE
USING (EXISTS (
  SELECT 1 FROM payment_links
  WHERE payment_links.id = flow_steps.payment_link_id
  AND payment_links.user_id = auth.uid()
));

-- Public can view flow steps for active links (needed during checkout)
CREATE POLICY "Anyone can view flow steps for active links"
ON public.flow_steps FOR SELECT
USING (EXISTS (
  SELECT 1 FROM payment_links
  WHERE payment_links.id = flow_steps.payment_link_id
  AND payment_links.is_active = true
));

-- Trigger for updated_at
CREATE TRIGGER update_flow_steps_updated_at
BEFORE UPDATE ON public.flow_steps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add one-click payment support columns to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
ADD COLUMN IF NOT EXISTS parent_transaction_id uuid REFERENCES public.transactions(id),
ADD COLUMN IF NOT EXISTS flow_step_id uuid REFERENCES public.flow_steps(id);

-- Allow service role to insert transactions for upsell (already covered by existing INSERT policy for active links)
-- Allow service role to update stripe_customer_id and stripe_payment_method_id (already covered by existing UPDATE policy for link owners)
