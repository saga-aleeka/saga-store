-- Add cold storage units and racks to support storage mapping

CREATE TABLE IF NOT EXISTS public.cold_storage_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Freezer', 'Refrigerator')),
  temperature TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cold_storage_units_name_key
  ON public.cold_storage_units(name);

CREATE TABLE IF NOT EXISTS public.racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cold_storage_id UUID NOT NULL REFERENCES public.cold_storage_units(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS racks_cold_storage_name_key
  ON public.racks(cold_storage_id, name);

CREATE INDEX IF NOT EXISTS racks_cold_storage_id_idx
  ON public.racks(cold_storage_id);

ALTER TABLE public.containers
  ADD COLUMN IF NOT EXISTS cold_storage_id UUID REFERENCES public.cold_storage_units(id),
  ADD COLUMN IF NOT EXISTS rack_id UUID REFERENCES public.racks(id),
  ADD COLUMN IF NOT EXISTS rack_position TEXT;

CREATE INDEX IF NOT EXISTS containers_cold_storage_id_idx
  ON public.containers(cold_storage_id);

CREATE INDEX IF NOT EXISTS containers_rack_id_idx
  ON public.containers(rack_id);

-- Default "UNASSIGNED" records for existing data
INSERT INTO public.cold_storage_units (name, type, temperature, location)
SELECT 'UNASSIGNED', 'Freezer', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.cold_storage_units WHERE name = 'UNASSIGNED');

INSERT INTO public.racks (name, position, cold_storage_id)
SELECT 'UNASSIGNED', NULL, c.id
FROM public.cold_storage_units c
WHERE c.name = 'UNASSIGNED'
  AND NOT EXISTS (
    SELECT 1 FROM public.racks r
    WHERE r.name = 'UNASSIGNED' AND r.cold_storage_id = c.id
  );

-- Backfill containers to default storage/rack if missing
UPDATE public.containers
SET cold_storage_id = c.id
FROM public.cold_storage_units c
WHERE public.containers.cold_storage_id IS NULL
  AND c.name = 'UNASSIGNED';

UPDATE public.containers
SET rack_id = r.id
FROM public.racks r
JOIN public.cold_storage_units c ON c.id = r.cold_storage_id
WHERE public.containers.rack_id IS NULL
  AND r.name = 'UNASSIGNED'
  AND c.name = 'UNASSIGNED';

-- Ensure cold_storage_id aligns with rack when possible
UPDATE public.containers
SET cold_storage_id = r.cold_storage_id
FROM public.racks r
WHERE public.containers.rack_id = r.id
  AND public.containers.cold_storage_id IS NULL;

-- Enable RLS and allow standard access
ALTER TABLE public.cold_storage_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.racks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to cold storage units"
  ON public.cold_storage_units
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert to cold storage units"
  ON public.cold_storage_units
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update to cold storage units"
  ON public.cold_storage_units
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow authenticated delete to cold storage units"
  ON public.cold_storage_units
  FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to racks"
  ON public.racks
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert to racks"
  ON public.racks
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update to racks"
  ON public.racks
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow authenticated delete to racks"
  ON public.racks
  FOR DELETE
  USING (true);

-- Grant permissions
GRANT SELECT ON public.cold_storage_units TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.cold_storage_units TO authenticated;
GRANT SELECT ON public.racks TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.racks TO authenticated;
