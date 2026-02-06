-- Add grid dimensions to racks for configurable layouts

ALTER TABLE public.racks
  ADD COLUMN IF NOT EXISTS grid_rows INTEGER,
  ADD COLUMN IF NOT EXISTS grid_cols INTEGER;
