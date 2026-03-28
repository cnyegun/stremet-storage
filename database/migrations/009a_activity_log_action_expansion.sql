ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_action_check;

ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_action_check CHECK (
    action IN (
      'check_in',
      'check_out',
      'move',
      'note_added',
      'job_created',
      'job_started',
      'job_completed',
      'job_cancelled',
      'unit_consumed',
      'unit_produced',
      'unit_scrapped',
      'unit_reworked',
      'unit_held'
    )
  );
