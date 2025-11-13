-- Add checkout tracking fields to samples table
-- Samples can be "checked out" (removed from container but not deleted)
-- Track previous position for undo functionality

ALTER TABLE public.samples
ADD COLUMN IF NOT EXISTS is_checked_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS checked_out_by TEXT,
ADD COLUMN IF NOT EXISTS previous_container_id UUID REFERENCES public.containers(id),
ADD COLUMN IF NOT EXISTS previous_position TEXT;

-- Create index for efficient checkout queries
CREATE INDEX IF NOT EXISTS idx_samples_checked_out ON public.samples(is_checked_out) WHERE is_checked_out = TRUE;

-- Comments for clarity
COMMENT ON COLUMN public.samples.is_checked_out IS 'True when sample is checked out from container for processing';
COMMENT ON COLUMN public.samples.checked_out_at IS 'Timestamp when sample was checked out';
COMMENT ON COLUMN public.samples.checked_out_by IS 'User initials who checked out the sample';
COMMENT ON COLUMN public.samples.previous_container_id IS 'Container ID before checkout (for undo)';
COMMENT ON COLUMN public.samples.previous_position IS 'Position before checkout (for undo)';
