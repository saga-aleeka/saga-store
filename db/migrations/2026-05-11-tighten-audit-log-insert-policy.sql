-- Tighten audit_logs insert policy so only service_role can write audit rows.

DROP POLICY IF EXISTS "Allow inserts on audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;

CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

REVOKE INSERT ON public.audit_logs FROM anon;
REVOKE INSERT ON public.audit_logs FROM authenticated;
GRANT INSERT ON public.audit_logs TO service_role;
