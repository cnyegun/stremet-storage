-- 009_logistical_flow_metadata.sql
BEGIN;

-- 1. Add delivery deadline to items
ALTER TABLE items
ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS production_priority INTEGER DEFAULT 5; -- 1 (High) to 10 (Low)

-- 2. Expand item types to include WIP and Raw
-- First, drop the old constraint
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_type_check;

-- Add the new expanded constraint
ALTER TABLE items
ADD CONSTRAINT items_type_check 
CHECK (type IN ('customer_order', 'general_stock', 'raw_material', 'work_in_progress'));

-- 3. Index for delivery date queries
CREATE INDEX IF NOT EXISTS idx_items_delivery_date ON items (delivery_date);

COMMIT;
