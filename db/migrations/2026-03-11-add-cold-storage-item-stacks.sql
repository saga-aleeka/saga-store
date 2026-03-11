-- Add stack grouping for cold storage shelf items

ALTER TABLE public.cold_storage_items
  ADD COLUMN IF NOT EXISTS stack_id UUID,
  ADD COLUMN IF NOT EXISTS stack_label TEXT;

CREATE INDEX IF NOT EXISTS cold_storage_items_stack_idx
  ON public.cold_storage_items(stack_id);
