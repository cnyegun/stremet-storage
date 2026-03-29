-- Restore status column on machine_assignments (dropped by 011a but still used everywhere)
ALTER TABLE machine_assignments ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'queued';
