-- Fix containers with missing or incorrect total positions
-- This script identifies and updates containers where the total field is NULL, 0, or doesn't match the layout

-- First, let's see what needs to be fixed (run this in Supabase SQL Editor)
-- Uncomment the SELECT below to see which containers will be updated:

-- SELECT 
--   id,
--   name,
--   type,
--   layout,
--   total as current_total,
--   CASE 
--     WHEN type = 'DP Pools' AND layout = '9x9' THEN 80
--     ELSE CAST(SPLIT_PART(layout, 'x', 1) AS INTEGER) * CAST(SPLIT_PART(layout, 'x', 2) AS INTEGER)
--   END as correct_total
-- FROM containers
-- WHERE total IS NULL 
--   OR total = 0
--   OR total != CASE 
--     WHEN type = 'DP Pools' AND layout = '9x9' THEN 80
--     ELSE CAST(SPLIT_PART(layout, 'x', 1) AS INTEGER) * CAST(SPLIT_PART(layout, 'x', 2) AS INTEGER)
--   END
-- ORDER BY name;

-- Update containers with missing or incorrect totals
UPDATE containers
SET total = CASE 
  WHEN type = 'DP Pools' AND layout = '9x9' THEN 80
  ELSE CAST(SPLIT_PART(layout, 'x', 1) AS INTEGER) * CAST(SPLIT_PART(layout, 'x', 2) AS INTEGER)
END,
updated_at = NOW()
WHERE layout IS NOT NULL
  AND (
    total IS NULL 
    OR total = 0
    OR total != CASE 
      WHEN type = 'DP Pools' AND layout = '9x9' THEN 80
      ELSE CAST(SPLIT_PART(layout, 'x', 1) AS INTEGER) * CAST(SPLIT_PART(layout, 'x', 2) AS INTEGER)
    END
  );

-- Show the results
SELECT 
  COUNT(*) as containers_updated,
  'Containers with correct totals have been updated' as message
FROM containers
WHERE total = CASE 
  WHEN type = 'DP Pools' AND layout = '9x9' THEN 80
  ELSE CAST(SPLIT_PART(layout, 'x', 1) AS INTEGER) * CAST(SPLIT_PART(layout, 'x', 2) AS INTEGER)
END;
