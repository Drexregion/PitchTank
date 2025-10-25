-- Add unique constraint to ensure one founder can only have one project per event
-- This prevents duplicate projects at the database level

-- First, check if there are any existing duplicates
SELECT 
    founder_user_id, 
    event_id, 
    COUNT(*) as project_count
FROM founders 
GROUP BY founder_user_id, event_id 
HAVING COUNT(*) > 1;

-- If there are duplicates, you'll need to resolve them first
-- For example, keep the most recent project and delete others:
-- DELETE FROM founders 
-- WHERE id IN (
--     SELECT id FROM (
--         SELECT id, ROW_NUMBER() OVER (
--             PARTITION BY founder_user_id, event_id 
--             ORDER BY created_at DESC
--         ) as rn
--         FROM founders
--     ) t 
--     WHERE rn > 1
-- );

-- Add the unique constraint
ALTER TABLE founders 
ADD CONSTRAINT unique_founder_per_event 
UNIQUE (founder_user_id, event_id);

-- Add a comment to document the constraint
COMMENT ON CONSTRAINT unique_founder_per_event ON founders IS 
'Ensures each founder can only have one project per event';
