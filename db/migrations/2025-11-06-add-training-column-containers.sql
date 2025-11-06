-- Add training boolean to containers table so UI can filter training-only containers
ALTER TABLE IF EXISTS containers
ADD COLUMN IF NOT EXISTS training boolean DEFAULT false;

-- Optionally, if you also want samples to have a training flag, uncomment below:
-- ALTER TABLE IF EXISTS samples
-- ADD COLUMN IF NOT EXISTS training boolean DEFAULT false;
