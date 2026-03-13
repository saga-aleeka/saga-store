-- Allow tags to be archived without removing them from existing samples.
-- Archived tags remain visible/searchable on historical samples but should not
-- be offered in future tag assignment pickers.
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;