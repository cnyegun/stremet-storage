-- 008_optimization_v2.sql
-- Building on top of migration 007's row/column structure

BEGIN;

-- 1. Add physical limits to shelf slots
ALTER TABLE shelf_slots
ADD COLUMN IF NOT EXISTS max_length INTEGER NOT NULL DEFAULT 2000, -- mm
ADD COLUMN IF NOT EXISTS max_width INTEGER NOT NULL DEFAULT 1000,  -- mm
ADD COLUMN IF NOT EXISTS max_height INTEGER NOT NULL DEFAULT 800,  -- mm
ADD COLUMN IF NOT EXISTS max_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
ADD COLUMN IF NOT EXISTS current_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- 2. Add classification & routing to items
ALTER TABLE items
ADD COLUMN IF NOT EXISTS turnover_class VARCHAR(1) DEFAULT 'C' CHECK (turnover_class IN ('A', 'B', 'C')),
ADD COLUMN IF NOT EXISTS is_stackable BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS next_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;

-- 3. Indexes for the optimizer query
CREATE INDEX IF NOT EXISTS idx_shelf_slots_physical_check 
ON shelf_slots (max_height, max_weight_kg);

COMMIT;
