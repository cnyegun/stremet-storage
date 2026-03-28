import { v4 as uuidv4 } from 'uuid';
import pool from './pool';
import { buildTrackingUnitCode } from '../lib/trackingUnits';
import { RackType } from '@shared/types';

// --- Helpers ---
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomChoice<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// --- Restored Metadata ---
const CUSTOMERS = [
  { name: 'Kone Oyj', code: 'KONE', email: 'orders@kone.com' },
  { name: 'Wärtsilä Oyj', code: 'WART', email: 'procurement@wartsila.com' },
  { name: 'Valmet Oyj', code: 'VALM', email: 'supply@valmet.com' },
  { name: 'Ponsse Oyj', code: 'PONS', email: 'parts@ponsse.com' },
  { name: 'Cargotec Oyj', code: 'CARG', email: 'logistics@cargotec.com' },
];

const MATERIALS = [
  'Stainless steel 1.0mm', 'Stainless steel 2.0mm', 'Cold-rolled steel 1.5mm', 'Aluminum 5052 2.0mm', 'Copper 1.0mm',
];

const PART_TYPES = ['Panel', 'Bracket', 'Housing', 'Cover', 'Frame', 'Plate', 'Base'];

const MACHINES = [
  { code: 'LASER-1', name: 'Fiber laser 1', category: 'laser' },
  { code: 'BEND-1', name: 'Press brake 1', category: 'bending' },
  { code: 'WELD-1', name: 'Welding Station', category: 'sheet_metal' },
  { code: 'QC-1', name: 'Quality Check', category: 'sheet_metal' },
];

const WORKERS = [
  'Matti Virtanen', 'Juha Korhonen', 'Mikko Nieminen', 'Timo Mäkelä', 'Antti Hämäläinen', 
  'Pekka Laine', 'Sari Järvinen', 'Tuomas Lehtonen', 'Ville Heikkinen', 'Lauri Koskinen',
];

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create 10 Standard Racks (Production -> Delivery Axis)
    const racks: any[] = [];
    for (let r = 1; r <= 10; r++) {
      const id = uuidv4();
      const px = 50 + ((r-1) * 95);
      const py = (r % 2 === 0) ? 100 : 350;
      racks.push({ id, rackNum: r });
      await client.query(
        `INSERT INTO racks (id, code, label, rack_type, row_count, column_count, display_order, position_x, position_y, width, height, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [id, `Rack-${r}`, `Physical Rack ${r}`, 'general_stock', 4, 10, r, px, py, 80, 180, '#2563EB']
      );
    }

    // 2. Create 400 Volumetric Cells (Standard 19.14 m3)
    for (const rack of racks) {
      for (let row = 1; row <= 4; row++) {
        for (let col = 1; col <= 10; col++) {
          const id = uuidv4();
          await client.query(
            `INSERT INTO shelf_slots (id, rack_id, shelf_number, row_number, column_number, width_m, depth_m, height_m, max_volume_m3, current_volume_m3, current_count, max_weight_kg)
             VALUES ($1, $2, $3, $4, $5, 2.9, 1.1, 6.0, 19.14, 0, 0, 2000)`,
            [id, rack.id, (row-1)*10+col, row, col]
          );
        }
      }
    }
    console.log('  Standard 4x10 grid initialized (400 volumetric cells).');

    // 3. Create Customers & Items
    const customerIds: any = {};
    for (const c of CUSTOMERS) {
      const id = uuidv4();
      customerIds[c.code] = id;
      await client.query(`INSERT INTO customers (id, name, code, contact_email) VALUES ($1, $2, $3, $4)`, [id, c.name, c.code, c.email]);
    }

    for (let i = 0; i < 50; i++) {
      const id = uuidv4();
      const type = randomChoice(['customer_order', 'raw_material', 'work_in_progress']);
      const weight = randomInt(5, 100);
      const volume = (randomInt(5, 40) / 10);
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + randomInt(1, 14));

      await client.query(
        `INSERT INTO items (id, item_code, customer_id, name, weight_kg, volume_m3, type, quantity, delivery_date, turnover_class)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, `ITEM-${String(i+1).padStart(3, '0')}`, type === 'customer_order' ? customerIds['KONE'] : null, `${randomChoice(PART_TYPES)}`, weight, volume, type, randomInt(1, 10), deliveryDate, randomChoice(['A', 'B', 'C'])]
      );
    }

    // 4. Create Machines
    for (const m of MACHINES) {
      await client.query(`INSERT INTO machines (id, name, code, category) VALUES ($1, $2, $3, $4)`, [uuidv4(), m.name, m.code, m.category]);
    }

    await client.query('COMMIT');
    console.log('Seed Complete: Standard Volumetric 10-Rack Grid Ready.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
