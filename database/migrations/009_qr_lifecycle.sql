-- QR lifecycle and fulfillment tracking for product intake, assembly compilation, and tablet progress.
-- Kept additive so the existing storage and machine architecture remains intact.

CREATE TABLE order_fulfillments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
  requested_quantity INTEGER NOT NULL CHECK (requested_quantity >= 0),
  fulfilled_quantity INTEGER NOT NULL DEFAULT 0 CHECK (fulfilled_quantity >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'quota_met', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assembly_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  assembly_code VARCHAR(64) NOT NULL UNIQUE,
  parent_assembly_code VARCHAR(64),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'stored'
    CHECK (status IN ('stored', 'quota_met', 'archived')),
  compiled_from_count INTEGER NOT NULL DEFAULT 0 CHECK (compiled_from_count >= 0),
  compiled_by VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE assembly_batch_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assembly_batch_id UUID NOT NULL REFERENCES assembly_batches(id) ON DELETE CASCADE,
  source_storage_assignment_id UUID REFERENCES storage_assignments(id) ON DELETE SET NULL,
  source_machine_assignment_id UUID REFERENCES machine_assignments(id) ON DELETE SET NULL,
  source_unit_code VARCHAR(64) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assembly_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assembly_batch_id UUID NOT NULL REFERENCES assembly_batches(id) ON DELETE CASCADE,
  shelf_slot_id UUID NOT NULL REFERENCES shelf_slots(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  stored_by VARCHAR(100) NOT NULL,
  removed_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE qr_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_code VARCHAR(120) NOT NULL UNIQUE,
  qr_type VARCHAR(20) NOT NULL
    CHECK (qr_type IN ('product', 'assembly')),
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  storage_assignment_id UUID REFERENCES storage_assignments(id) ON DELETE SET NULL,
  machine_assignment_id UUID REFERENCES machine_assignments(id) ON DELETE SET NULL,
  assembly_batch_id UUID REFERENCES assembly_batches(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ,
  CHECK (
    (qr_type = 'product' AND item_id IS NOT NULL)
    OR (qr_type = 'assembly' AND assembly_batch_id IS NOT NULL)
  )
);

CREATE INDEX idx_order_fulfillments_status ON order_fulfillments(status);
CREATE INDEX idx_assembly_batches_item_id ON assembly_batches(item_id);
CREATE INDEX idx_assembly_batches_status ON assembly_batches(status);
CREATE INDEX idx_assembly_batch_inputs_batch_id ON assembly_batch_inputs(assembly_batch_id);
CREATE INDEX idx_assembly_assignments_batch_id ON assembly_assignments(assembly_batch_id);
CREATE INDEX idx_assembly_assignments_active ON assembly_assignments(removed_at) WHERE removed_at IS NULL;
CREATE INDEX idx_qr_entities_item_id ON qr_entities(item_id);
CREATE INDEX idx_qr_entities_assembly_batch_id ON qr_entities(assembly_batch_id);
CREATE INDEX idx_qr_entities_status ON qr_entities(status);
