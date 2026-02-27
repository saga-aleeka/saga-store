-- Fix IDT plates accidentally set to 9x9 and ensure totals are correct.
UPDATE public.containers
SET layout = '14x7',
    total = 98
WHERE type = 'IDT Plates'
  AND layout = '9x9';

UPDATE public.containers
SET total = 98
WHERE type = 'IDT Plates'
  AND layout = '14x7'
  AND (total IS NULL OR total <> 98);

-- Lock container layout after creation.
CREATE OR REPLACE FUNCTION public.prevent_container_layout_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.layout IS NOT NULL AND NEW.layout IS DISTINCT FROM OLD.layout THEN
    RAISE EXCEPTION 'Container layout is locked after creation.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS containers_layout_lock ON public.containers;

CREATE TRIGGER containers_layout_lock
BEFORE UPDATE OF layout ON public.containers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_container_layout_change();
