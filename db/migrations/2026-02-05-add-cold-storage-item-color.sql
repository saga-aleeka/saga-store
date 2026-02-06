-- Add color for cold storage items

ALTER TABLE public.cold_storage_items
  ADD COLUMN IF NOT EXISTS item_color TEXT;
