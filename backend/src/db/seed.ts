import { v4 as uuidv4 } from 'uuid';
import pool from './pool';
import { buildTrackingUnitCode } from '../lib/trackingUnits';
import type { RackType } from '@shared/types';

// --- Helpers ---

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- FULL STATIC DATA (Restored from Original) ---

const CUSTOMERS = [
  { name: 'Kone Oyj', code: 'KONE', email: 'orders@kone.com' },
  { name: 'Wärtsilä Oyj', code: 'WART', email: 'procurement@wartsila.com' },
  { name: 'Valmet Oyj', code: 'VALM', email: 'supply@valmet.com' },
  { name: 'Ponsse Oyj', code: 'PONS', email: 'parts@ponsse.com' },
  { name: 'Cargotec Oyj', code: 'CARG', email: 'logistics@cargotec.com' },
  { name: 'Outokumpu Oyj', code: 'OUTO', email: 'materials@outokumpu.com' },
  { name: 'Metso Oyj', code: 'METS', email: 'orders@metso.com' },
  { name: 'Nokia Oyj', code: 'NOKI', email: 'hardware@nokia.com' },
];

const MATERIALS = [
  'Stainless steel 1.0mm', 'Stainless steel 1.5mm', 'Stainless steel 2.0mm', 'Stainless steel 3.0mm',
  'Cold-rolled steel 1.0mm', 'Cold-rolled steel 1.5mm', 'Cold-rolled steel 2.0mm',
  'Hot-rolled steel 3.0mm', 'Hot-rolled steel 5.0mm',
  'Galvanized steel 1.0mm', 'Galvanized steel 1.5mm',
  'Aluminum 5052 1.5mm', 'Aluminum 5052 2.0mm', 'Aluminum 6061 2.0mm', 'Aluminum 6061 3.0mm',
  'Copper 1.0mm', 'Copper 1.5mm',
];

const PART_TYPES = [
  'Panel', 'Bracket', 'Housing', 'Cover', 'Frame', 'Plate',
  'Enclosure', 'Mount', 'Shield', 'Channel', 'Flange', 'Support',
  'Guard', 'Lid', 'Base', 'Spacer', 'Clip', 'Rail', 'Hinge', 'Vent',
];

const PART_VARIANTS = ['A', 'B', 'C', 'D', 'E', 'F'];

const MACHINES = [
  { code: 'SM-1', name: 'Sheet metal press 1', category: 'sheet_metal', description: 'Hydraulic sheet metal press, 200 ton' },
  { code: 'SM-2', name: 'Sheet metal press 2', category: 'sheet_metal', description: 'Hydraulic sheet metal press, 100 ton' },
  { code: 'SM-3', name: 'Sheet metal roller', category: 'sheet_metal', description: 'Sheet metal rolling machine' },
  { code: 'CUT-1', name: 'Plasma cutter 1', category: 'cutting', description: 'CNC plasma cutting table 3000x1500' },
  { code: 'CUT-2', name: 'Plasma cutter 2', category: 'cutting', description: 'CNC plasma cutting table 2000x1000' },
  { code: 'CUT-3', name: 'Shear 1', category: 'cutting', description: 'Hydraulic guillotine shear 3m' },
  { code: 'CUT-4', name: 'Shear 2', category: 'cutting', description: 'Hydraulic guillotine shear 2m' },
  { code: 'LASER-1', name: 'Fiber laser 1', category: 'laser', description: '6kW fiber laser, 3000x1500 bed' },
  { code: 'LASER-2', name: 'Fiber laser 2', category: 'laser', description: '4kW fiber laser, 2000x1000 bed' },
  { code: 'LASER-3', name: 'CO2 laser', category: 'laser', description: '3kW CO2 laser for non-metal cutting' },
  { code: 'RBEND-1', name: 'Robot bending cell 1', category: 'robot_bending', description: 'Automated press brake with robot loader' },
  { code: 'RBEND-2', name: 'Robot bending cell 2', category: 'robot_bending', description: 'Automated press brake with robot loader' },
  { code: 'RBEND-3', name: 'Robot bending cell 3', category: 'robot_bending', description: 'Automated panel bender' },
  { code: 'BEND-1', name: 'Press brake 1', category: 'bending', description: 'Manual press brake 3m, 160 ton' },
  { code: 'BEND-2', name: 'Press brake 2', category: 'bending', description: 'Manual press brake 2m, 100 ton' },
  { code: 'BEND-3', name: 'Press brake 3', category: 'bending', description: 'Manual press brake 1.5m, 60 ton' },
  { code: 'BEND-4', name: 'Folding machine', category: 'bending', description: 'Swivel bending machine 2.5m' },
];

const WORKERS = [
  'Matti Virtanen', 'Juha Korhonen', 'Mikko Nieminen', 'Timo Mäkelä', 'Antti Hämäläinen', 
  'Pekka Laine', 'Sari Järvinen', 'Tuomas Lehtonen', 'Ville Heikkinen', 'Lauri Koskinen',
];

async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // --- Physical Racks (10 Standard Volumetric Racks) ---
    interface RackRecord { id: string; rackNum: number; code: string; type: RackType; px: number; py: number }
    const racks: RackRecord[] = [];
    
    for (let r = 1; r <= 10; r++) {
      const id = uuidv4();
      const code = `Rack-${r}`;
      const label = `Physical Rack ${r}`;
      const type = 'general_stock' as RackType;
      const px = 50 + ((r-1) * 95);
      const py = (r % 2 === 0) ? 100 : 350; 

      racks.push({ id, rackNum: r, code, type, px, py });
      
      await client.query(
        `INSERT INTO racks (id, code, label, description, rack_type, row_count, column_count, display_order, color, position_x, position_y, width, height)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, code, label, `Standard Volumetric Rack Unit`, type, 4, 10, r, '#2563EB', px, py, 80, 180]
      );
    }
    console.log('  physical racks: 10');

    // --- Volumetric Cells (4 rows x 10 columns per rack) ---
    interface SlotRecord { id: string; rackId: string; rackNum: number; rowNum: number; colNum: number }
    const slots: SlotRecord[] = [];
    for (const rack of racks) {
      for (let r = 1; r <= 4; r++) {
        for (let c = 1; c <= 10; c++) {
          const id = uuidv4();
          const shelfNumber = (r - 1) * 10 + c;
          slots.push({ id, rackId: rack.id, rackNum: rack.rackNum, rowNum: r, colNum: c });
          await client.query(
            `INSERT INTO shelf_slots (id, rack_id, shelf_number, row_number, column_number, width_m, depth_m, height_m, max_volume_m3, current_volume_m3, current_count, max_weight_kg, measured_weight_kg)
             VALUES ($1, $2, $3, $4, $5, 2.9, 1.1, 6.0, 19.14, 0.00, 0, 2000, 0.00)`,
            [id, rack.id, shelfNumber, r, c]
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

    // --- Items (~300 total with full metadata) ---
    interface ItemRecord { id: string; code: string; type: string; weight_kg: number; volume_m3: number }
    const items: ItemRecord[] = [];

    // 1. Full Raw Materials
    for (let i = 0; i < 40; i++) {
        const id = uuidv4();
        const material = randomChoice(MATERIALS);
        const itemCode = `RAW-${String(i+1).padStart(3, '0')}`;
        const weight = randomInt(80, 250);
        const volume = (randomInt(10, 60) / 10); 
        items.push({ id, code: itemCode, type: 'raw_material', weight_kg: weight, volume_m3: volume });
        await client.query(
            `INSERT INTO items (id, item_code, name, material, weight_kg, volume_m3, type, quantity)
             VALUES ($1, $2, $3, $4, $5, $6, 'raw_material', $7)`,
            [id, itemCode, `${material} Sheet Pack`, material, weight, volume, randomInt(1, 3)]
        );
    }

    // 2. Full Work in Progress
    for (let i = 0; i < 60; i++) {
        const id = uuidv4();
        const itemCode = `WIP-${String(i+1).padStart(3, '0')}`;
        const weight = randomInt(10, 60);
        const volume = (randomInt(2, 30) / 10); 
        items.push({ id, code: itemCode, type: 'work_in_progress', weight_kg: weight, volume_m3: volume });
        await client.query(
            `INSERT INTO items (id, item_code, name, type, weight_kg, volume_m3, quantity)
             VALUES ($1, $2, $3, 'work_in_progress', $4, $5, $6)`,
            [id, itemCode, `Interim Assembly ${i+1}`, weight, volume, randomInt(5, 20)]
        );
    }

    // 3. Full Customer order items
    for (const cust of CUSTOMERS) {
      const numItems = randomInt(12, 18);
      for (let i = 0; i < numItems; i++) {
        const id = uuidv4();
        const partType = randomChoice(PART_TYPES);
        const variant = randomChoice(PART_VARIANTS);
        const itemCode = `${cust.code}-${String(i+1).padStart(3, '0')}-${partType.toUpperCase()}-${variant}`;
        const weight = randomInt(5, 45);
        const volume = (randomInt(1, 15) / 10); 
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + randomInt(1, 21));

        items.push({ id, code: itemCode, type: 'customer_order', weight_kg: weight, volume_m3: volume });
        await client.query(
          `INSERT INTO items (id, item_code, customer_id, name, weight_kg, volume_m3, type, quantity, delivery_date)
           VALUES ($1, $2, $3, $4, $5, $6, 'customer_order', $7, $8)`,
          [id, itemCode, customerIds[cust.code], `${partType} ${variant} Component`, weight, volume, randomInt(1, 50), deliveryDate]
        );
      }
    }
    console.log(`  full items list seeded`);

    // --- Storage assignments ---
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    const toAssign = shuffled.slice(0, 200);
    const trackingUnitSequenceByItemId: Record<string, number> = {};
    const slotUsageVolume: Record<string, number> = {};
    for (const s of slots) slotUsageVolume[s.id] = 0;

    for (const item of toAssign) {
      const qty = randomInt(1, 4);
      const totalVolume = item.volume_m3 * qty;
      const candidateSlots = slots.filter(s => (19.14 - slotUsageVolume[s.id]) >= totalVolume);
      if (candidateSlots.length === 0) continue;

      const slot = randomChoice(candidateSlots);
      const assignmentId = uuidv4();
      const nextUnitSequence = (trackingUnitSequenceByItemId[item.id] || 0) + 1;
      trackingUnitSequenceByItemId[item.id] = nextUnitSequence;
      const unitCode = buildTrackingUnitCode(item.code, nextUnitSequence);

      slotUsageVolume[slot.id] += totalVolume;

      await client.query(
        `INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_at, checked_in_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [assignmentId, item.id, slot.id, unitCode, qty, randomChoice(WORKERS)]
      );

      const totalWeight = item.weight_kg * qty;
      await client.query(
        `UPDATE shelf_slots 
         SET current_count = current_count + 1, 
             current_weight_kg = current_weight_kg + $1, 
             current_volume_m3 = current_volume_m3 + $2, 
             measured_weight_kg = measured_weight_kg + $1 
         WHERE id = $3`,
        [totalWeight, totalVolume, slot.id]
      );
    }
    console.log(`  assignments seeded`);

    // --- Machines ---
    for (const m of MACHINES) {
      await client.query(`INSERT INTO machines (id, name, code, category, description) VALUES ($1, $2, $3, $4, $5)`, [uuidv4(), m.name, m.code, m.category, m.description]);
    }
    console.log(`  machines seeded`);

    await client.query('COMMIT');
    console.log('Seed complete.');

    await pool.query(`UPDATE shelf_slots SET measured_weight_kg = measured_weight_kg + 35.0 WHERE id IN (SELECT id FROM shelf_slots WHERE current_count > 0 ORDER BY random() LIMIT 8)`);
    console.log('  sensor anomalies injected.');
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
