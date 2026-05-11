-- Provide server-side pagination and search for the audit master log.

CREATE OR REPLACE FUNCTION public.search_audit_logs(
  search_text text DEFAULT NULL,
  page_number integer DEFAULT 1,
  per_page integer DEFAULT 24
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  user_initials text,
  user_name text,
  entity_type text,
  entity_id uuid,
  action text,
  entity_name text,
  changes jsonb,
  metadata jsonb,
  description text,
  total_count bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT *
    FROM public.audit_logs
    WHERE COALESCE(search_text, '') = ''
      OR (
        COALESCE(entity_name, '') ILIKE '%' || search_text || '%'
        OR COALESCE(description, '') ILIKE '%' || search_text || '%'
        OR COALESCE(user_initials, '') ILIKE '%' || search_text || '%'
        OR COALESCE(user_name, '') ILIKE '%' || search_text || '%'
        OR COALESCE(action, '') ILIKE '%' || search_text || '%'
        OR COALESCE(entity_type, '') ILIKE '%' || search_text || '%'
        OR COALESCE(metadata::text, '') ILIKE '%' || search_text || '%'
      )
  ), paged AS (
    SELECT
      id,
      created_at,
      user_initials,
      user_name,
      entity_type,
      entity_id,
      action,
      entity_name,
      changes,
      metadata,
      description,
      COUNT(*) OVER() AS total_count
    FROM filtered
    ORDER BY created_at DESC, id DESC
    LIMIT GREATEST(per_page, 1)
    OFFSET GREATEST((GREATEST(page_number, 1) - 1) * GREATEST(per_page, 1), 0)
  )
  SELECT * FROM paged;
$$;

GRANT EXECUTE ON FUNCTION public.search_audit_logs(text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.search_audit_logs(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_audit_logs(text, integer, integer) TO service_role;