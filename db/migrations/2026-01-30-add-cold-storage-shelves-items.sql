-- Add preventive maintenance fields and shelf/item tracking for cold storage units

ALTER TABLE public.cold_storage_units
  ADD COLUMN IF NOT EXISTS pm_due_date DATE,
  ADD COLUMN IF NOT EXISTS last_pm_date DATE,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

CREATE TABLE IF NOT EXISTS public.cold_storage_shelves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cold_storage_id UUID NOT NULL REFERENCES public.cold_storage_units(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cold_storage_shelves_unit_name_key
  ON public.cold_storage_shelves(cold_storage_id, name);

CREATE INDEX IF NOT EXISTS cold_storage_shelves_unit_idx
  ON public.cold_storage_shelves(cold_storage_id);

CREATE TABLE IF NOT EXISTS public.cold_storage_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cold_storage_id UUID NOT NULL REFERENCES public.cold_storage_units(id) ON DELETE CASCADE,
  shelf_id UUID REFERENCES public.cold_storage_shelves(id) ON DELETE SET NULL,
  item_id TEXT NOT NULL,
  lot_id TEXT,
  description TEXT,
  quantity INTEGER,
  status TEXT DEFAULT 'stored',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cold_storage_items_unit_idx
  ON public.cold_storage_items(cold_storage_id);

CREATE INDEX IF NOT EXISTS cold_storage_items_shelf_idx
  ON public.cold_storage_items(shelf_id);

-- Enable RLS and allow standard access
ALTER TABLE public.cold_storage_shelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cold_storage_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to cold storage shelves"
  ON public.cold_storage_shelves
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert to cold storage shelves"
  ON public.cold_storage_shelves
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update to cold storage shelves"
  ON public.cold_storage_shelves
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow authenticated delete to cold storage shelves"
  ON public.cold_storage_shelves
  FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to cold storage items"
  ON public.cold_storage_items
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert to cold storage items"
  ON public.cold_storage_items
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update to cold storage items"
  ON public.cold_storage_items
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow authenticated delete to cold storage items"
  ON public.cold_storage_items
  FOR DELETE
  USING (true);

-- Grant permissions
GRANT SELECT ON public.cold_storage_shelves TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.cold_storage_shelves TO authenticated;
GRANT SELECT ON public.cold_storage_items TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.cold_storage_items TO authenticated;
