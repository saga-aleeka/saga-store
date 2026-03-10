-- Add highlight flag for tags (controls sample cell highlighting)
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS highlight boolean NOT NULL DEFAULT true;
