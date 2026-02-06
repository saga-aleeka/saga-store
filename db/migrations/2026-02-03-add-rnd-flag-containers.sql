-- Add R&D flag to containers

ALTER TABLE public.containers
ADD COLUMN IF NOT EXISTS is_rnd BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.containers.is_rnd IS 'True when container is designated for R&D';
