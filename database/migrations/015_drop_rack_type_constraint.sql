-- Remove the overly restrictive rack_type constraint that locks all racks to general_stock
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_rack_type_check;
