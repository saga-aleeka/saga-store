-- Migration: add indexes on samples.container_id and samples.sample_id
-- Created: 2025-10-08

BEGIN;

-- Index for fast lookups by container_id
CREATE INDEX IF NOT EXISTS idx_samples_container_id ON public.samples (container_id);

-- Index for fast lookups by sample_id (case-sensitive)
CREATE INDEX IF NOT EXISTS idx_samples_sample_id ON public.samples (sample_id);

-- Case-insensitive index for sample_id searches using ILIKE
CREATE INDEX IF NOT EXISTS idx_samples_sample_id_lower ON public.samples (lower(sample_id));

COMMIT;
