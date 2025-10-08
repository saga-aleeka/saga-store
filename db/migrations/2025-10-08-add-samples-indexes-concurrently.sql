-- Migration: add indexes on samples.container_id and samples.sample_id using CONCURRENTLY
-- Created: 2025-10-08
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block. Do not wrap this file in BEGIN/COMMIT.

-- Index for fast lookups by container_id (concurrent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_samples_container_id ON public.samples (container_id);

-- Index for fast lookups by sample_id (case-sensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_samples_sample_id ON public.samples (sample_id);

-- Case-insensitive index for sample_id searches using lower(sample_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_samples_sample_id_lower ON public.samples (lower(sample_id));
