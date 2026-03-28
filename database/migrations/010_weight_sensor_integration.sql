-- 010_weight_sensor_integration.sql
BEGIN;

-- 1. Add measured weight (from hardware sensor) to cells
ALTER TABLE shelf_slots
ADD COLUMN IF NOT EXISTS measured_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_measured_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Add an alert threshold for weight discrepancy
ALTER TABLE shelf_slots
ADD COLUMN IF NOT EXISTS weight_discrepancy_threshold DECIMAL(10,2) NOT NULL DEFAULT 5.00; -- kg

-- 3. Comment for terminology clarity
COMMENT ON COLUMN shelf_slots.current_weight_kg IS 'Calculated weight based on checked-in items';
COMMENT ON COLUMN shelf_slots.measured_weight_kg IS 'Real-time weight reported by hardware sensor';

COMMIT;
