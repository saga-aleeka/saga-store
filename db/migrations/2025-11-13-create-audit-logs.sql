-- Create audit_logs table for comprehensive change tracking
-- This table maintains a permanent record of all container and sample changes,
-- even if the original records are deleted

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Who made the change
  user_initials TEXT,
  user_name TEXT,
  
  -- What was changed
  entity_type TEXT NOT NULL, -- 'container', 'sample'
  entity_id UUID, -- Reference to the original record (can be null if deleted)
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'moved', 'archived', 'unarchived'
  
  -- Details about the change
  entity_name TEXT, -- Container name or Sample ID for easy reference
  changes JSONB, -- Before/after values for updates
  metadata JSONB, -- Additional context (location, position, etc.)
  
  -- Searchable fields
  description TEXT -- Human-readable summary of the action
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_initials ON public.audit_logs(user_initials);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read audit logs (authenticated users)
CREATE POLICY "Anyone can read audit logs" ON public.audit_logs
  FOR SELECT
  USING (true);

-- Only service role can insert audit logs (via API)
-- We don't allow updates or deletes - audit logs are immutable
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.audit_logs TO anon;
GRANT ALL ON public.audit_logs TO service_role;
