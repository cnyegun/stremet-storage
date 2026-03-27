-- Stremet Storage Management System
-- Initial database schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Zones: physical areas of the factory
CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  color VARCHAR(7) NOT NULL DEFAULT '#2563EB',
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 200,
  height INTEGER NOT NULL DEFAULT 150,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Racks: shelving units within a zone
CREATE TABLE racks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  position_in_zone INTEGER NOT NULL,
  total_shelves INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shelf slots: individual shelves within a rack
CREATE TABLE shelf_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rack_id UUID NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
  shelf_number INTEGER NOT NULL CHECK (shelf_number >= 1),
  capacity INTEGER NOT NULL DEFAULT 10,
  current_count INTEGER NOT NULL DEFAULT 0 CHECK (current_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rack_id, shelf_number)
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  contact_email VARCHAR(200) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items: products / parts tracked in the system
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_code VARCHAR(100) NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  material VARCHAR(100) NOT NULL DEFAULT '',
  dimensions VARCHAR(100) NOT NULL DEFAULT '',
  weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
  type VARCHAR(20) NOT NULL CHECK (type IN ('customer_order', 'general_stock')),
  order_number VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Storage assignments: tracks which item is on which shelf
CREATE TABLE storage_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  shelf_slot_id UUID NOT NULL REFERENCES shelf_slots(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_out_at TIMESTAMPTZ,
  checked_in_by VARCHAR(100) NOT NULL,
  checked_out_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity log: audit trail of all storage actions
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('check_in', 'check_out', 'move', 'note_added')),
  from_location VARCHAR(200),
  to_location VARCHAR(200),
  performed_by VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_racks_zone_id ON racks(zone_id);
CREATE INDEX idx_shelf_slots_rack_id ON shelf_slots(rack_id);
CREATE INDEX idx_items_customer_id ON items(customer_id);
CREATE INDEX idx_items_item_code ON items(item_code);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_storage_assignments_item_id ON storage_assignments(item_id);
CREATE INDEX idx_storage_assignments_shelf_slot_id ON storage_assignments(shelf_slot_id);
CREATE INDEX idx_storage_assignments_active ON storage_assignments(checked_out_at) WHERE checked_out_at IS NULL;
CREATE INDEX idx_activity_log_item_id ON activity_log(item_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
