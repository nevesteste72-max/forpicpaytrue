
ALTER TABLE public.payment_links
  ADD COLUMN is_donation boolean NOT NULL DEFAULT false,
  ADD COLUMN donation_amounts numeric[] NOT NULL DEFAULT '{}',
  ADD COLUMN donation_goal_amount numeric,
  ADD COLUMN donation_goal_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN donation_story_title text,
  ADD COLUMN donation_story_text text,
  ADD COLUMN donation_story_image_url text,
  ADD COLUMN donation_story_video_url text,
  ADD COLUMN donation_cta_text text,
  ADD COLUMN donation_allow_anonymous boolean NOT NULL DEFAULT false;

ALTER TABLE public.transactions
  ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;
