-- Create table to persist sample movement events
CREATE TABLE IF NOT EXISTS public.sample_movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp timestamptz NOT NULL DEFAULT now(),
  user_id text,
  user_name text,
  sample_id text NOT NULL,
  action_type text NOT NULL,
  from_container_id uuid,
  from_position text,
  to_container_id uuid,
  to_position text,
  notes text,
  success boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast lookup by sample_id and container
CREATE INDEX IF NOT EXISTS idx_sample_movements_sample_id ON public.sample_movements (sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_movements_to_container ON public.sample_movements (to_container_id);
CREATE INDEX IF NOT EXISTS idx_sample_movements_from_container ON public.sample_movements (from_container_id);
