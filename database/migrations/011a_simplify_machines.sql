-- Simplify: Remove production job system, treat machines as simple locations

-- Drop production job tables
DROP TABLE IF EXISTS production_job_outputs CASCADE;
DROP TABLE IF EXISTS production_job_inputs CASCADE;
DROP TABLE IF EXISTS production_jobs CASCADE;

-- Remove status column from machine_assignments
ALTER TABLE machine_assignments DROP COLUMN IF EXISTS status;

-- Remove production_job_id from activity_log
ALTER TABLE activity_log DROP COLUMN IF EXISTS production_job_id;

-- Clean up activity_log rows with production action types BEFORE re-adding constraint
DELETE FROM activity_log WHERE action NOT IN ('check_in', 'check_out', 'move', 'note_added');

-- Update activity_log action constraint
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_action_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_action_check
  CHECK (action IN ('check_in', 'check_out', 'move', 'note_added'));
