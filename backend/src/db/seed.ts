import { v4 as uuidv4 } from 'uuid';
import pool from './pool';
import { buildTrackingUnitCode } from '../lib/trackingUnits';
import { getDefaultMachineAssignmentStatus, type MachineAssignmentStatus } from '../lib/machineAssignmentStatus';
import { RackType } from '@shared/types';

// --- Helpers ---

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
}

// --- Static Data ---

const CUSTOMERS = [
  { name: 'Kone Oyj', code: 'KONE', email: 'orders@kone.com' },
  { name: 'Wärtsilä Oyj', code: 'WART', email: 'procurement@wartsila.com' },
  { name: 'Valmet Oyj', code: 'VALM', email: 'supply@valmet.com' },
  { name: 'Ponsse Oyj', code: 'PONS', email: 'parts@ponsse.com' },
  { name: 'Cargotec Oyj', code: 'CARG', email: 'logistics@cargotec.com' },
];

const MATERIALS = [
  'Stainless steel 1.5mm',
  'Stainless steel 2.0mm',
  'Cold-rolled steel 1.0mm',
  'Aluminum 5052 2.0mm',
];

const PART_TYPES = ['Panel', 'Bracket', 'Housing', 'Cover', 'Frame'];

const PART_VARIANTS = ['A', 'B', 'C'];

const MACHINES = [
  { code: 'LASER-1', name: 'Fiber laser 1', category: 'laser', description: '6kW fiber laser' },
  { code: 'BEND-1', name: 'Press brake 1', category: 'bending', description: 'Manual press brake' },
];

const WORKERS = ['Matti Virtanen', 'Juha Korhonen', 'Mikko Nieminen'];

const MACHINE_ASSIGNMENT_STATUSES: MachineAssignmentStatus[] = ['queued', 'processing', 'needs_attention', 'ready_for_storage'];

async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // --- Physical Racks (Standardized 1-10 sequence) ---
    // Mapping logistical flow to Rack ID
    const rackTypes: Record<number, RackType> = {
        1: 'raw_materials',
        2: 'raw_materials',
        3: 'work_in_progress',
        4: 'work_in_progress',
        5: 'work_in_progress',
        6: 'finished_goods',
        7: 'finished_goods',
        8: 'customer_orders',
        9: 'customer_orders',
        10: 'customer_orders'
    };

    interface RackRecord { id: string; rackNum: number; code: string; type: RackType; px: number; py: number }
    const racks: RackRecord[] = [];
    
    for (let r = 1; r <= 10; r++) {
      const id = uuidv4();
      const code = `Rack-${r}`;
      const label = `Physical Rack ${r}`;
      const type = rackTypes[r] || 'general_stock';
      
      // X-Coordinate from 50 (Production/Left) to 950 (Delivery/Right)
      const px = 50 + ((r-1) * 90);
      const py = (r % 2 === 0) ? 100 : 300; 

      racks.push({ id, rackNum: r, code, type, px, py });
      
      await client.query(
        `INSERT INTO racks (id, code, label, description, rack_type, row_count, column_count, display_order, color, position_x, position_y, width, height)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, code, label, `Storage for ${type.replace('_', ' ')}`, type, 4, 10, r, '#2563EB', px, py, 80, 150]
      );
    }
    console.log('  physical racks: 10');

    // --- Rack Cells (4 rows x 10 columns per rack) ---
    interface SlotRecord { id: string; rackId: string; rackNum: number; rowNum: number; colNum: number; capacity: number }
    const slots: SlotRecord[] = [];
    for (const rack of racks) {
      for (let r = 1; r <= 4; r++) {
        for (let c = 1; c <= 10; c++) {
          const id = uuidv4();
          const capacity = randomInt(15, 30);
          const shelfNumber = (r - 1) * 10 + c;
          slots.push({ id, rackId: rack.id, rackNum: rack.rackNum, rowNum: r, colNum: c, capacity });
          await client.query(
            `INSERT INTO shelf_slots (id, rack_id, shelf_number, row_number, column_number, capacity, current_count, max_height, max_weight_kg, measured_weight_kg)
             VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, 0.00)`,
            [id, rack.id, shelfNumber, r, c, capacity, randomChoice([400, 600, 800, 1000]), 2000]
          );
        }
      }
    }
    console.log('  rack cells: 400');

    // --- Customers ---
    const customerIds: Record<string, string> = {};
    for (const c of CUSTOMERS) {
      const id = uuidv4();
      customerIds[c.code] = id;
      await client.query(`INSERT INTO customers (id, name, code, contact_email) VALUES ($1, $2, $3, $4)`, [id, c.name, c.code, c.email]);
    }

    // --- Items (~200 total with logistical types) ---
    interface ItemRecord { id: string; code: string; type: string; weight_kg: number }
    const items: ItemRecord[] = [];

    // 1. Raw Materials
    for (let i = 0; i < 20; i++) {
        const id = uuidv4();
        const itemCode = `RAW-${String(i+1).padStart(3, '0')}`;
        const weight = randomInt(50, 150);
        items.push({ id, code: itemCode, type: 'raw_material', weight_kg: weight });
        await client.query(
            `INSERT INTO items (id, item_code, name, material, weight_kg, type, quantity)
             VALUES ($1, $2, $3, $4, $5, 'raw_material', $6)`,
            [id, itemCode, `Steel Sheet ${i+1}`, 'Stainless', weight, randomInt(5, 10)]
        );
    }

    // 2. Work in Progress
    for (let i = 0; i < 30; i++) {
        const id = uuidv4();
        const itemCode = `WIP-${String(i+1).padStart(3, '0')}`;
        const weight = randomInt(10, 40);
        items.push({ id, code: itemCode, type: 'work_in_progress', weight_kg: weight });
        await client.query(
            `INSERT INTO items (id, item_code, name, type, weight_kg, quantity)
             VALUES ($1, $2, $3, 'work_in_progress', $4, $5)`,
            [id, itemCode, `Interim Part ${i+1}`, weight, randomInt(10, 20)]
        );
    }

    // 3. Customer order items (Finished Goods)
    for (const cust of CUSTOMERS) {
      for (let i = 0; i < 15; i++) {
        const id = uuidv4();
        const partType = randomChoice(PART_TYPES);
        const variant = randomChoice(PART_VARIANTS);
        const itemCode = `${cust.code}-${String(i+1).padStart(3, '0')}-${partType.toUpperCase()}-${variant}`;
        const weight = randomInt(5, 25);
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + randomInt(1, 14));

        items.push({ id, code: itemCode, type: 'customer_order', weight_kg: weight });
        await client.query(
          `INSERT INTO items (id, item_code, customer_id, name, weight_kg, type, quantity, delivery_date)
           VALUES ($1, $2, $3, $4, $5, 'customer_order', $6, $7)`,
          [id, itemCode, customerIds[cust.code], `${partType} ${variant}`, weight, randomInt(1, 10), deliveryDate]
        );
      }
    }
    console.log(`  items seeded`);

    // --- Storage assignments ---
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    const toAssign = shuffled.slice(0, 100);
    const trackingUnitSequenceByItemId: Record<string, number> = {};

    const rackSlots: Record<string, SlotRecord[]> = {};
    for (const s of slots) {
      const r = racks.find(rack => rack.id === s.rackId);
      if (r) {
          if (!rackSlots[r.type]) rackSlots[r.type] = [];
          rackSlots[r.type].push(s);
      }
    }
    const slotCounts: Record<string, number> = {};
    for (const s of slots) slotCounts[s.id] = 0;

    for (const item of toAssign) {
      let targetType: RackType;
      if (item.type === 'raw_material') targetType = 'raw_materials';
      else if (item.type === 'work_in_progress') targetType = 'work_in_progress';
      else targetType = 'customer_orders';

      const candidateSlots = rackSlots[targetType]?.filter(s => slotCounts[s.id] < s.capacity) || [];
      if (candidateSlots.length === 0) continue;

      const slot = randomChoice(candidateSlots);
      const qty = randomInt(1, 5);
      const assignmentId = uuidv4();
      const nextUnitSequence = (trackingUnitSequenceByItemId[item.id] || 0) + 1;
      trackingUnitSequenceByItemId[item.id] = nextUnitSequence;
      const unitCode = buildTrackingUnitCode(item.code, nextUnitSequence);

      slotCounts[slot.id] += 1;

      await client.query(
        `INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_at, checked_in_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [assignmentId, item.id, slot.id, unitCode, qty, randomChoice(WORKERS)]
      );

      const totalWeight = item.weight_kg * qty;
      await client.query(
        `UPDATE shelf_slots SET current_count = current_count + 1, current_weight_kg = current_weight_kg + $1, measured_weight_kg = measured_weight_kg + $1 WHERE id = $2`,
        [totalWeight, slot.id]
      );
    }
    console.log(`  assignments seeded`);

    // --- Machines ---
    for (const m of MACHINES) {
      await client.query(`INSERT INTO machines (id, name, code, category, description) VALUES ($1, $2, $3, $4, $5)`, [uuidv4(), m.name, m.code, m.category, m.description]);
    }

    await client.query('COMMIT');
    console.log('Seed complete.');

    await pool.query(`UPDATE shelf_slots SET measured_weight_kg = measured_weight_kg + 25.5 WHERE id IN (SELECT id FROM shelf_slots WHERE current_count > 0 ORDER BY random() LIMIT 5)`);
    console.log('  sensor discrepancies injected.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
