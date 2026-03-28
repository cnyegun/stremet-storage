-- Additive monitoring schema for QR/unit updates and rack weight sensors.
-- This migration intentionally avoids modifying core storage/machine flows so it can merge cleanly.

CREATE TABLE sensor_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_code VARCHAR(64) NOT NULL UNIQUE,
  sensor_kind VARCHAR(16) NOT NULL DEFAULT 'weight'
    CHECK (sensor_kind IN ('weight')),
  rack_id UUID REFERENCES racks(id) ON DELETE CASCADE,
  shelf_slot_id UUID REFERENCES shelf_slots(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'maintenance')),
  baseline_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
  alert_drop_threshold_kg DECIMAL(10,2) NOT NULL DEFAULT 2.5,
  last_seen_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (rack_id IS NOT NULL OR shelf_slot_id IS NOT NULL)
);

CREATE TABLE sensor_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sensor_device_id UUID NOT NULL REFERENCES sensor_devices(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  weight_kg DECIMAL(10,2) NOT NULL,
  battery_level DECIMAL(5,2),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE unit_field_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_code VARCHAR(64) NOT NULL,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  storage_assignment_id UUID REFERENCES storage_assignments(id) ON DELETE SET NULL,
  machine_assignment_id UUID REFERENCES machine_assignments(id) ON DELETE SET NULL,
  update_category VARCHAR(20) NOT NULL
    CHECK (update_category IN ('assembly', 'storage')),
  status VARCHAR(64) NOT NULL,
  quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
  location_confirmed BOOLEAN NOT NULL DEFAULT false,
  reported_by VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_code VARCHAR(64),
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  storage_assignment_id UUID REFERENCES storage_assignments(id) ON DELETE SET NULL,
  machine_assignment_id UUID REFERENCES machine_assignments(id) ON DELETE SET NULL,
  sensor_device_id UUID REFERENCES sensor_devices(id) ON DELETE SET NULL,
  source VARCHAR(16) NOT NULL
    CHECK (source IN ('worker', 'sensor', 'system')),
  event_type VARCHAR(64) NOT NULL,
  event_status VARCHAR(16) NOT NULL DEFAULT 'recorded'
    CHECK (event_status IN ('recorded', 'open', 'matched', 'resolved', 'dismissed')),
  quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
  location_code VARCHAR(120),
  reported_by VARCHAR(100),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE manager_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_event_id UUID NOT NULL REFERENCES inventory_events(id) ON DELETE CASCADE,
  alert_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(16) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  summary VARCHAR(240) NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100)
);

CREATE INDEX idx_sensor_devices_rack_id ON sensor_devices(rack_id);
CREATE INDEX idx_sensor_devices_shelf_slot_id ON sensor_devices(shelf_slot_id);
CREATE INDEX idx_sensor_readings_device_recorded_at ON sensor_readings(sensor_device_id, recorded_at DESC);
CREATE INDEX idx_unit_field_updates_unit_code_created_at ON unit_field_updates(unit_code, created_at DESC);
CREATE INDEX idx_inventory_events_unit_code_created_at ON inventory_events(unit_code, created_at DESC);
CREATE INDEX idx_inventory_events_sensor_device_id_created_at ON inventory_events(sensor_device_id, created_at DESC);
CREATE INDEX idx_inventory_events_event_status ON inventory_events(event_status);
CREATE INDEX idx_manager_alerts_status_created_at ON manager_alerts(status, created_at DESC);
