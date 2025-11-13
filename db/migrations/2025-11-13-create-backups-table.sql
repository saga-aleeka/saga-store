-- Create backups table to track backup history
CREATE TABLE IF NOT EXISTS public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('nightly', 'manual')),
  containers_count INTEGER DEFAULT 0,
  samples_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  storage_path TEXT
);

-- Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS backups_created_at_idx ON public.backups(created_at DESC);

-- Create index on type for filtering
CREATE INDEX IF NOT EXISTS backups_type_idx ON public.backups(type);

-- Enable RLS
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read backups
CREATE POLICY "Allow all reads on backups" ON public.backups
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Service role can insert backups
CREATE POLICY "Allow service role to insert backups" ON public.backups
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.backups TO authenticated;
GRANT SELECT ON public.backups TO anon;
GRANT ALL ON public.backups TO service_role;
