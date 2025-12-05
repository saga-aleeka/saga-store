-- Backfill audit logs with container names for better readability
-- This migration adds container_name fields to existing audit log metadata

-- Function to backfill container names in audit log metadata
DO $$
DECLARE
  audit_record RECORD;
  updated_metadata JSONB;
  container_name_val TEXT;
BEGIN
  -- Loop through all audit logs with metadata
  FOR audit_record IN 
    SELECT id, metadata 
    FROM audit_logs 
    WHERE metadata IS NOT NULL
  LOOP
    updated_metadata := audit_record.metadata;
    
    -- Handle container_id
    IF updated_metadata->>'container_id' IS NOT NULL AND updated_metadata->>'container_name' IS NULL THEN
      SELECT name INTO container_name_val
      FROM containers
      WHERE id = (updated_metadata->>'container_id')::UUID;
      
      IF container_name_val IS NOT NULL THEN
        updated_metadata := jsonb_set(updated_metadata, '{container_name}', to_jsonb(container_name_val));
      END IF;
    END IF;
    
    -- Handle previous_container_id
    IF updated_metadata->>'previous_container_id' IS NOT NULL AND updated_metadata->>'previous_container_name' IS NULL THEN
      SELECT name INTO container_name_val
      FROM containers
      WHERE id = (updated_metadata->>'previous_container_id')::UUID;
      
      IF container_name_val IS NOT NULL THEN
        updated_metadata := jsonb_set(updated_metadata, '{previous_container_name}', to_jsonb(container_name_val));
      END IF;
    END IF;
    
    -- Handle from_container
    IF updated_metadata->>'from_container' IS NOT NULL AND updated_metadata->>'from_container_name' IS NULL THEN
      SELECT name INTO container_name_val
      FROM containers
      WHERE id = (updated_metadata->>'from_container')::UUID;
      
      IF container_name_val IS NOT NULL THEN
        updated_metadata := jsonb_set(updated_metadata, '{from_container_name}', to_jsonb(container_name_val));
      END IF;
    END IF;
    
    -- Handle to_container
    IF updated_metadata->>'to_container' IS NOT NULL AND updated_metadata->>'to_container_name' IS NULL THEN
      SELECT name INTO container_name_val
      FROM containers
      WHERE id = (updated_metadata->>'to_container')::UUID;
      
      IF container_name_val IS NOT NULL THEN
        updated_metadata := jsonb_set(updated_metadata, '{to_container_name}', to_jsonb(container_name_val));
      END IF;
    END IF;
    
    -- Update the audit log if metadata changed
    IF updated_metadata != audit_record.metadata THEN
      UPDATE audit_logs
      SET metadata = updated_metadata
      WHERE id = audit_record.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Backfill completed successfully';
END $$;

-- Update descriptions to use formatted container names and positions
DO $$
DECLARE
  audit_record RECORD;
  new_description TEXT;
  from_container_name TEXT;
  to_container_name TEXT;
  container_name TEXT;
  previous_container_name TEXT;
BEGIN
  FOR audit_record IN
    SELECT id, description, metadata, action
    FROM audit_logs
    WHERE entity_type = 'sample' AND metadata IS NOT NULL
  LOOP
    new_description := audit_record.description;
    
    -- Handle moved action
    IF audit_record.action = 'moved' AND 
       audit_record.metadata->>'from_container' IS NOT NULL AND
       audit_record.metadata->>'to_container' IS NOT NULL THEN
      
      from_container_name := audit_record.metadata->>'from_container_name';
      to_container_name := audit_record.metadata->>'to_container_name';
      
      IF from_container_name IS NOT NULL AND to_container_name IS NOT NULL THEN
        new_description := 'Sample ' || (audit_record.metadata->>'sample_id') || 
                          ' moved from ' || from_container_name || 
                          ' (' || (audit_record.metadata->>'from_position') || ') > ' ||
                          to_container_name || ' (' || (audit_record.metadata->>'to_position') || ')';
      END IF;
    END IF;
    
    -- Handle created action
    IF audit_record.action = 'created' AND audit_record.metadata->>'container_id' IS NOT NULL THEN
      container_name := audit_record.metadata->>'container_name';
      
      IF container_name IS NOT NULL THEN
        new_description := 'Sample ' || (audit_record.metadata->>'sample_id') ||
                          ' scanned into ' || container_name ||
                          ' (' || (audit_record.metadata->>'position') || ')';
      END IF;
    END IF;
    
    -- Handle checked_out action
    IF audit_record.action = 'checked_out' AND audit_record.metadata->>'previous_container_id' IS NOT NULL THEN
      previous_container_name := audit_record.metadata->>'previous_container_name';
      
      IF previous_container_name IS NOT NULL THEN
        new_description := 'Sample ' || (audit_record.metadata->>'sample_id') ||
                          ' checked out from ' || previous_container_name ||
                          ' (' || (audit_record.metadata->>'previous_position') || ')' ||
                          ' (displaced by ' || (audit_record.metadata->>'displaced_by') || ')';
      END IF;
    END IF;
    
    -- Update if description changed
    IF new_description != audit_record.description THEN
      UPDATE audit_logs
      SET description = new_description
      WHERE id = audit_record.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Description formatting completed successfully';
END $$;
