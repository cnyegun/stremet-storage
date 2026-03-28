-- Expand all racks from 1 column to 10 columns
-- Creates shelf_slots for columns 2-10 on each rack (column 1 already exists)

-- Update rack column_count
UPDATE racks SET column_count = 10;

-- Insert shelf_slots for columns 2 through 10 for every rack/row combination
-- shelf_number must be unique per rack, so we use (row-1)*10 + column
INSERT INTO shelf_slots (rack_id, shelf_number, row_number, column_number, capacity, current_count)
SELECT
  r.id,
  (s.row_number - 1) * 10 + col.n AS shelf_number,
  s.row_number,
  col.n AS column_number,
  s.capacity,
  0
FROM racks r
JOIN shelf_slots s ON s.rack_id = r.id AND s.column_number = 1
CROSS JOIN generate_series(2, 10) AS col(n)
ON CONFLICT DO NOTHING;
