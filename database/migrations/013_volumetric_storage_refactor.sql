-- 013_volumetric_storage_refactor.sql
BEGIN;

-- 1. Standardize Rack Metadata
-- Ensure row and column counts are fixed for all racks
UPDATE racks 
SET row_count = 4, 
    column_count = 10, 
    total_shelves = 40,
    rack_type = 'general_stock';

-- 2. Refactor Shelf Slots (Storage Cells) to Volumetric Model
ALTER TABLE shelf_slots
-- Remove legacy count-based capacity
DROP COLUMN IF EXISTS capacity,
-- Add strict physical dimensions (meters)
ADD COLUMN IF NOT EXISTS width_m DECIMAL(10,2) NOT NULL DEFAULT 2.9,
ADD COLUMN IF NOT EXISTS depth_m DECIMAL(10,2) NOT NULL DEFAULT 1.1,
ADD COLUMN IF NOT EXISTS height_m DECIMAL(10,2) NOT NULL DEFAULT 6.0,
-- Add volume tracking (cubic meters)
ADD COLUMN IF NOT EXISTS max_volume_m3 DECIMAL(10,2) NOT NULL DEFAULT 19.14,
ADD COLUMN IF NOT EXISTS current_volume_m3 DECIMAL(10,4) NOT NULL DEFAULT 0.0000;

-- 3. Update Items to include volume
ALTER TABLE items
ADD COLUMN IF NOT EXISTS volume_m3 DECIMAL(10,4) DEFAULT 0.0000;

-- 4. Clean up legacy Zone/Type constraints if any remain
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_rack_type_check;

COMMIT;
