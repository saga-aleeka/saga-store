-- Add training flag to samples table
-- Training samples are visually distinguished in container grid view

ALTER TABLE public.samples
ADD COLUMN IF NOT EXISTS is_training BOOLEAN DEFAULT FALSE;

-- Create index for efficient training sample queries
CREATE INDEX IF NOT EXISTS idx_samples_training ON public.samples(is_training) WHERE is_training = TRUE;

-- Comment for clarity
COMMENT ON COLUMN public.samples.is_training IS 'True when sample is designated for training purposes';
