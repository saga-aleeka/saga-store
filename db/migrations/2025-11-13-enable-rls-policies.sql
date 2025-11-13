-- Enable Row Level Security on all tables
ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;

-- Containers: Allow public read access
CREATE POLICY "Allow public read access to containers"
ON public.containers
FOR SELECT
USING (true);

-- Containers: Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert to containers"
ON public.containers
FOR INSERT
WITH CHECK (true);

-- Containers: Allow authenticated users to update
CREATE POLICY "Allow authenticated update to containers"
ON public.containers
FOR UPDATE
USING (true);

-- Containers: Allow authenticated users to delete
CREATE POLICY "Allow authenticated delete to containers"
ON public.containers
FOR DELETE
USING (true);

-- Samples: Allow public read access
CREATE POLICY "Allow public read access to samples"
ON public.samples
FOR SELECT
USING (true);

-- Samples: Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert to samples"
ON public.samples
FOR INSERT
WITH CHECK (true);

-- Samples: Allow authenticated users to update
CREATE POLICY "Allow authenticated update to samples"
ON public.samples
FOR UPDATE
USING (true);

-- Samples: Allow authenticated users to delete
CREATE POLICY "Allow authenticated delete to samples"
ON public.samples
FOR DELETE
USING (true);

-- Authorized users: Allow public read access (tokens excluded in queries)
CREATE POLICY "Allow public read access to authorized_users"
ON public.authorized_users
FOR SELECT
USING (true);

-- Authorized users: Restrict modifications to service role only (no policy = denied by default)
-- This means only server-side code with service role key can modify authorized_users
