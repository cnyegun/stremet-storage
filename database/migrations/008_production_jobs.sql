CREATE TABLE production_jobs (
  id UUID PRIMARY KEY,
  job_code VARCHAR(64) NOT NULL UNIQUE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  assigned_by VARCHAR(100) NOT NULL,
  completed_by VARCHAR(100),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  result_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE production_job_inputs (
  id UUID PRIMARY KEY,
  production_job_id UUID NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  machine_assignment_id UUID NOT NULL REFERENCES machine_assignments(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit_code VARCHAR(64) NOT NULL,
  planned_quantity INTEGER NOT NULL CHECK (planned_quantity > 0),
  consumed_quantity INTEGER NOT NULL DEFAULT 0 CHECK (consumed_quantity >= 0),
  outcome VARCHAR(32) NOT NULL CHECK (outcome IN ('planned', 'consumed', 'partial')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (production_job_id, machine_assignment_id)
);

CREATE TABLE production_job_outputs (
  id UUID PRIMARY KEY,
  production_job_id UUID NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit_code VARCHAR(64) NOT NULL,
  output_type VARCHAR(16) NOT NULL CHECK (output_type IN ('storage', 'machine', 'none')),
  storage_assignment_id UUID REFERENCES storage_assignments(id) ON DELETE SET NULL,
  machine_assignment_id UUID REFERENCES machine_assignments(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('good', 'scrap', 'rework', 'hold')),
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

ALTER TABLE activity_log
  ADD COLUMN production_job_id UUID REFERENCES production_jobs(id) ON DELETE SET NULL,
  ADD COLUMN tracking_unit_code VARCHAR(64),
  ADD COLUMN machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;

CREATE INDEX idx_production_jobs_machine_id ON production_jobs(machine_id);
CREATE INDEX idx_production_jobs_status ON production_jobs(status);
CREATE INDEX idx_production_job_inputs_job_id ON production_job_inputs(production_job_id);
CREATE INDEX idx_production_job_inputs_machine_assignment_id ON production_job_inputs(machine_assignment_id);
CREATE INDEX idx_production_job_outputs_job_id ON production_job_outputs(production_job_id);
CREATE INDEX idx_activity_log_production_job_id ON activity_log(production_job_id);
