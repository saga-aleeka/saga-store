-- Optional: More secure RLS policies that validate authorization
-- These policies check if the anon key user has proper permissions
-- For now, we'll use simple "allow all authenticated" policies
-- but you can enhance these later to check against authorized_users table

-- Drop the permissive policies if you want tighter security
-- DROP POLICY IF EXISTS "Allow authenticated insert to containers" ON public.containers;
-- DROP POLICY IF EXISTS "Allow authenticated update to containers" ON public.containers;
-- DROP POLICY IF EXISTS "Allow authenticated delete to containers" ON public.containers;
-- DROP POLICY IF EXISTS "Allow authenticated insert to samples" ON public.samples;
-- DROP POLICY IF EXISTS "Allow authenticated update to samples" ON public.samples;
-- DROP POLICY IF EXISTS "Allow authenticated delete to samples" ON public.samples;

-- More restrictive policies example (commented out for now):
-- Only allow inserts/updates if there's a matching token in authorized_users
-- This requires setting a custom header or using Supabase auth

-- CREATE POLICY "Containers insert with valid token"
-- ON public.containers
-- FOR INSERT
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 FROM public.authorized_users
--     WHERE token = current_setting('request.headers.authorization', true)::uuid
--   )
-- );

-- For now, the permissive policies above will work fine since you control who has the anon key
