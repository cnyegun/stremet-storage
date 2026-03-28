-- 011_deprecate_zones.sql
-- Merging zones into racks to match physical warehouse terminology

BEGIN;

-- 1. Add spatial and styling columns to racks
ALTER TABLE racks
ADD COLUMN IF NOT EXISTS position_x INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS position_y INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS width INTEGER NOT NULL DEFAULT 200,
ADD COLUMN IF NOT EXISTS height INTEGER NOT NULL DEFAULT 150,
ADD COLUMN IF NOT EXISTS color VARCHAR(7) NOT NULL DEFAULT '#2563EB';

-- 2. Migrate data from zones to racks
-- We take the spatial data from the zone and apply it to the associated racks.
-- Since the user wants "Zone" to be removed, the Rack itself becomes the primary physical unit on the map.
UPDATE racks r
SET 
  position_x = z.position_x,
  position_y = z.position_y,
  width = z.width,
  height = z.height,
  color = z.color,
  description = CASE WHEN r.description = '' THEN z.description ELSE r.description END
FROM zones z
WHERE r.zone_id = z.id;

-- 3. Remove zone_id and drop zones table
ALTER TABLE racks DROP COLUMN IF EXISTS zone_id;
ALTER TABLE racks DROP COLUMN IF EXISTS position_in_zone;

-- Drop foreign key and table
DROP TABLE IF EXISTS zones CASCADE;

COMMIT;
