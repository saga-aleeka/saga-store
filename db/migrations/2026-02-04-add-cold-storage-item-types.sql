-- Add interior image attachment for cold storage units and item typing for shelf items

ALTER TABLE public.cold_storage_units
  ADD COLUMN IF NOT EXISTS interior_image_url TEXT;

ALTER TABLE public.cold_storage_items
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'reagent',
  ADD COLUMN IF NOT EXISTS container_id UUID REFERENCES public.containers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rack_id UUID REFERENCES public.racks(id) ON DELETE SET NULL;

UPDATE public.cold_storage_items
  SET item_type = COALESCE(item_type, 'reagent');
