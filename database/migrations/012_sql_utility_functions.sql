-- 012_sql_utility_functions.sql
BEGIN;

CREATE OR REPLACE FUNCTION build_rack_location_code(rack_code TEXT, row_num INTEGER, col_num INTEGER) 
RETURNS TEXT AS $$
BEGIN
    RETURN rack_code || '/R' || row_num || 'C' || col_num;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMIT;
