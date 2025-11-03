-- Migration: samples_upsert_v1 - handle missing container explicitly
-- This migration replaces the RPC to fail gracefully when a provided container_id does not exist.
-- It returns a per-sample result with success=false and error='container_not_found' for that sample.

CREATE OR REPLACE FUNCTION public.samples_upsert_v1(sample_json jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec        jsonb;
  results    jsonb := '[]'::jsonb;
  inp_sample_id text;
  inp_container_id uuid;
  inp_position text;
  inp_is_archived boolean;
  inp_data jsonb;
  r RECORD;
  first_id uuid;
  first_container uuid;
  ids_to_delete uuid[] := ARRAY[]::uuid[];
  moved_row record;
  inserted_row record;
  provided_id uuid;
  base_data jsonb;
  base_history jsonb;
  base_no_history jsonb;
  new_event jsonb;
  merged_data jsonb;
BEGIN
  IF sample_json IS NULL THEN
    RETURN results;
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(sample_json)
  LOOP
    BEGIN
      inp_sample_id := upper(trim(coalesce(rec ->> 'sample_id', rec ->> 'sampleId', '')));
      IF inp_sample_id = '' THEN
        results := results || jsonb_build_array(jsonb_build_object(
          'sample_id', NULL,
          'success', false,
          'error', 'missing sample_id'
        ));
        CONTINUE;
      END IF;

      inp_container_id := NULLIF(coalesce(rec ->> 'container_id', rec ->> 'containerId', ''), '')::uuid;
      inp_position := NULLIF(coalesce(rec ->> 'position', rec ->> 'position', ''), '');
      inp_is_archived := COALESCE( (rec ->> 'is_archived')::boolean, false );
      inp_data := COALESCE(rec -> 'data', '{}'::jsonb);
      provided_id := NULLIF(coalesce(rec ->> 'id', ''), '')::uuid;

      -- If a container_id was provided, ensure it exists; otherwise return a clear error for this sample
      IF inp_container_id IS NOT NULL THEN
        PERFORM 1 FROM public.containers WHERE id = inp_container_id;
        IF NOT FOUND THEN
          results := results || jsonb_build_array(jsonb_build_object(
            'sample_id', inp_sample_id,
            'success', false,
            'error', 'container_not_found'
          ));
          CONTINUE;
        END IF;
      END IF;

      -- prepare a minimal history event generator
      new_event := jsonb_build_object('when', now(), 'source', 'samples_upsert_v1', 'action', null);

      IF inp_is_archived THEN
        new_event := new_event || jsonb_build_object('action', 'inserted_archived', 'to_container', inp_container_id);
        INSERT INTO public.samples (sample_id, container_id, position, data, is_archived, created_at, updated_at)
        VALUES (inp_sample_id, inp_container_id, inp_position, (COALESCE(inp_data, '{}'::jsonb) || jsonb_build_object('history', COALESCE((inp_data->'history'), '[]'::jsonb) || jsonb_build_array(new_event))), true, now(), now())
        RETURNING id, sample_id INTO inserted_row;

        results := results || jsonb_build_array(jsonb_build_object(
          'sample_id', inp_sample_id,
          'success', true,
          'action', 'inserted_archived',
          'id', inserted_row.id
        ));
        CONTINUE;
      END IF;

      -- Lock existing active rows
      first_id := NULL;
      first_container := NULL;
      ids_to_delete := ARRAY[]::uuid[];

      FOR r IN
        SELECT id, container_id, data
        FROM public.samples
        WHERE sample_id = inp_sample_id AND COALESCE(is_archived, false) = false
        ORDER BY created_at ASC NULLS FIRST
        FOR UPDATE
      LOOP
        IF first_id IS NULL THEN
          first_id := r.id;
          first_container := r.container_id;
          base_data := COALESCE(r.data, '{}'::jsonb);
        ELSE
          ids_to_delete := array_append(ids_to_delete, r.id);
        END IF;
      END LOOP;

      IF first_id IS NOT NULL THEN
        IF first_container IS NOT NULL AND inp_container_id IS NOT NULL AND first_container = inp_container_id THEN
          base_no_history := (base_data - 'history');
          base_history := COALESCE(base_data->'history', '[]'::jsonb);
          new_event := new_event || jsonb_build_object('action', 'updated', 'to_container', inp_container_id);
          merged_data := (base_no_history || COALESCE(inp_data, '{}'::jsonb)) || jsonb_build_object('history', base_history || jsonb_build_array(new_event));

          UPDATE public.samples
            SET position = COALESCE(NULLIF(inp_position, ''), position),
                data = merged_data,
                updated_at = now()
          WHERE id = first_id
          RETURNING id, sample_id INTO moved_row;

          results := results || jsonb_build_array(jsonb_build_object(
            'sample_id', inp_sample_id,
            'success', true,
            'action', 'updated',
            'id', moved_row.id
          ));

          IF array_length(ids_to_delete, 1) IS NOT NULL THEN
            DELETE FROM public.samples WHERE id = ANY(ids_to_delete);
          END IF;

        ELSE
          base_no_history := (base_data - 'history');
          base_history := COALESCE(base_data->'history', '[]'::jsonb);
          new_event := new_event || jsonb_build_object('action', 'moved', 'from_container', first_container, 'to_container', inp_container_id);
          merged_data := (base_no_history || COALESCE(inp_data, '{}'::jsonb)) || jsonb_build_object('history', base_history || jsonb_build_array(new_event));

          UPDATE public.samples
            SET container_id = inp_container_id,
                position = COALESCE(NULLIF(inp_position, ''), position),
                data = merged_data,
                updated_at = now()
          WHERE id = first_id
          RETURNING id, sample_id INTO moved_row;

          IF array_length(ids_to_delete, 1) IS NOT NULL THEN
            DELETE FROM public.samples WHERE id = ANY(ids_to_delete);
          END IF;

          results := results || jsonb_build_array(jsonb_build_object(
            'sample_id', inp_sample_id,
            'success', true,
            'action', 'moved',
            'from_id', first_id,
            'to_container_id', inp_container_id,
            'id', moved_row.id
          ));
        END IF;

      ELSE
        new_event := new_event || jsonb_build_object('action', 'inserted', 'to_container', inp_container_id);
        INSERT INTO public.samples (sample_id, container_id, position, data, is_archived, created_at, updated_at)
        VALUES (inp_sample_id, inp_container_id, inp_position, (COALESCE(inp_data, '{}'::jsonb) || jsonb_build_object('history', COALESCE((inp_data->'history'), '[]'::jsonb) || jsonb_build_array(new_event))), false, now(), now())
        RETURNING id, sample_id INTO inserted_row;

        results := results || jsonb_build_array(jsonb_build_object(
          'sample_id', inp_sample_id,
          'success', true,
          'action', 'inserted',
          'id', inserted_row.id
        ));
      END IF;

    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_array(jsonb_build_object(
        'sample_id', inp_sample_id,
        'success', false,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN results;
END;
$$;
