-- Fix RLS policies for audit_logs table
-- Service role should bypass RLS, but let's ensure policies are correct

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;

-- Recreate policies with explicit conditions
-- Allow all reads
CREATE POLICY "Allow all reads on audit logs" ON public.audit_logs
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Allow service role to insert (service role bypasses RLS by default)
CREATE POLICY "Allow inserts on audit logs" ON public.audit_logs
  FOR INSERT
  TO authenticated, anon, service_role
  WITH CHECK (true);

-- Ensure service role has all permissions
GRANT ALL ON public.audit_logs TO service_role;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.audit_logs TO anon;
