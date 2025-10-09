-- Add idempotency key and unique constraint (when provided)
ALTER TABLE IF EXISTS public.sample_movements
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Create unique index on idempotency_key for non-null values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ux_sample_movements_idempotency_key'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX ux_sample_movements_idempotency_key ON public.sample_movements (idempotency_key) WHERE idempotency_key IS NOT NULL';
  END IF;
END$$;

-- Trigger to maintain containers.occupied_slots when samples table changes
-- This trigger recalculates the occupied_slots for affected containers
CREATE OR REPLACE FUNCTION public.recalculate_container_occupied_slots()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Recalculate for OLD.container_id and NEW.container_id
  IF (TG_OP = 'DELETE') THEN
    PERFORM (
      UPDATE public.containers c SET occupied_slots = (
        SELECT COUNT(*) FROM public.samples s WHERE s.container_id = OLD.container_id
      ) WHERE c.id = OLD.container_id
    );
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT') THEN
    PERFORM (
      UPDATE public.containers c SET occupied_slots = (
        SELECT COUNT(*) FROM public.samples s WHERE s.container_id = NEW.container_id
      ) WHERE c.id = NEW.container_id
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.container_id IS DISTINCT FROM NEW.container_id) THEN
      PERFORM (
        UPDATE public.containers c SET occupied_slots = (
          SELECT COUNT(*) FROM public.samples s WHERE s.container_id = OLD.container_id
        ) WHERE c.id = OLD.container_id
      );
      PERFORM (
        UPDATE public.containers c SET occupied_slots = (
          SELECT COUNT(*) FROM public.samples s WHERE s.container_id = NEW.container_id
        ) WHERE c.id = NEW.container_id
      );
    ELSE
      PERFORM (
        UPDATE public.containers c SET occupied_slots = (
          SELECT COUNT(*) FROM public.samples s WHERE s.container_id = NEW.container_id
        ) WHERE c.id = NEW.container_id
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_recalculate_container_occupied_slots') THEN
    CREATE TRIGGER trg_recalculate_container_occupied_slots
    AFTER INSERT OR UPDATE OR DELETE ON public.samples
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_container_occupied_slots();
  END IF;
END$$;
