-- Add sortable order for cold storage items

ALTER TABLE public.cold_storage_items
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

CREATE INDEX IF NOT EXISTS cold_storage_items_shelf_order_idx
  ON public.cold_storage_items(shelf_id, sort_order);
