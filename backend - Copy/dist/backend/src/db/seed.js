"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const pool_1 = __importDefault(require("./pool"));
const trackingUnits_1 = require("../lib/trackingUnits");
// --- Helpers ---
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
// --- Static Data ---
const CUSTOMERS = [
    { name: 'Kone Oyj', code: 'KONE', email: 'orders@kone.com' },
    { name: 'Wärtsilä Oyj', code: 'WART', email: 'procurement@wartsila.com' },
    { name: 'Valmet Oyj', code: 'VALM', email: 'supply@valmet.com' },
    { name: 'Ponsse Oyj', code: 'PONS', email: 'parts@ponsse.com' },
    { name: 'Cargotec Oyj', code: 'CARG', email: 'logistics@cargotec.com' },
];
const PART_TYPES = ['Panel', 'Bracket', 'Housing', 'Cover', 'Frame'];
const PART_VARIANTS = ['A', 'B', 'C'];
const MACHINES = [
    { code: 'LASER-1', name: 'Fiber laser 1', category: 'laser', description: '6kW fiber laser' },
    { code: 'BEND-1', name: 'Press brake 1', category: 'bending', description: 'Manual press brake' },
];
const WORKERS = ['Matti Virtanen', 'Juha Korhonen', 'Mikko Nieminen'];
async function seed() {
    const client = await pool_1.default.connect();
    try {
        await client.query('BEGIN');
        const racks = [];
        for (let r = 1; r <= 10; r++) {
            const id = (0, uuid_1.v4)();
            const code = `Rack-${r}`;
            const label = `Physical Rack ${r}`;
            const type = 'general_stock'; // Constraint 013: must be general_stock
            const px = 50 + ((r - 1) * 90);
            const py = (r % 2 === 0) ? 100 : 300;
            racks.push({ id, rackNum: r, code, type, px, py });
            await client.query(`INSERT INTO racks (id, code, label, description, rack_type, row_count, column_count, display_order, color, position_x, position_y, width, height)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [id, code, label, `Standard Volumetric Rack`, type, 4, 10, r, '#2563EB', px, py, 80, 150]);
        }
        console.log('  standard physical racks: 10');
        const slots = [];
        for (const rack of racks) {
            for (let r = 1; r <= 4; r++) {
                for (let c = 1; c <= 10; c++) {
                    const id = (0, uuid_1.v4)();
                    const shelfNumber = (r - 1) * 10 + c;
                    slots.push({ id, rackId: rack.id, rackNum: rack.rackNum, rowNum: r, colNum: c });
                    await client.query(`INSERT INTO shelf_slots (id, rack_id, shelf_number, row_number, column_number, width_m, depth_m, height_m, max_volume_m3, current_volume_m3, current_count, max_weight_kg, measured_weight_kg)
             VALUES ($1, $2, $3, $4, $5, 2.9, 1.1, 6.0, 19.14, 0.00, 0, 2000, 0.00)`, [id, rack.id, shelfNumber, r, c]);
                }
            }
        }
        console.log('  volumetric rack cells: 400');
        // --- Customers ---
        const customerIds = {};
        for (const cust of CUSTOMERS) {
            const id = (0, uuid_1.v4)();
            customerIds[cust.code] = id;
            await client.query(`INSERT INTO customers (id, name, code, contact_email) VALUES ($1, $2, $3, $4)`, [id, cust.name, cust.code, cust.email]);
        }
        // --- Items Section ---
        const items = [];
        // 1. Raw Materials
        for (let i = 0; i < 20; i++) {
            const id = (0, uuid_1.v4)();
            const itemCode = `RAW-${String(i + 1).padStart(3, '0')}`;
            const weight = randomInt(50, 150);
            const volume = (randomInt(5, 50) / 10); // 0.5 to 5.0 m3
            items.push({ id, code: itemCode, type: 'raw_material', weight_kg: weight, volume_m3: volume });
            await client.query(`INSERT INTO items (id, item_code, name, material, weight_kg, volume_m3, type, quantity)
             VALUES ($1, $2, $3, $4, $5, $6, 'raw_material', $7)`, [id, itemCode, `Steel Sheet ${i + 1}`, 'Stainless', weight, volume, randomInt(1, 2)]);
        }
        // 2. Work in Progress
        for (let i = 0; i < 30; i++) {
            const id = (0, uuid_1.v4)();
            const itemCode = `WIP-${String(i + 1).padStart(3, '0')}`;
            const weight = randomInt(10, 40);
            const volume = (randomInt(1, 20) / 10); // 0.1 to 2.0 m3
            items.push({ id, code: itemCode, type: 'work_in_progress', weight_kg: weight, volume_m3: volume });
            await client.query(`INSERT INTO items (id, item_code, name, type, weight_kg, volume_m3, quantity)
             VALUES ($1, $2, $3, 'work_in_progress', $4, $5, $6)`, [id, itemCode, `Interim Part ${i + 1}`, weight, volume, randomInt(1, 5)]);
        }
        // 3. Customer order items
        for (const cust of CUSTOMERS) {
            for (let i = 0; i < 15; i++) {
                const id = (0, uuid_1.v4)();
                const partType = randomChoice(PART_TYPES);
                const variant = randomChoice(PART_VARIANTS);
                const itemCode = `${cust.code}-${String(i + 1).padStart(3, '0')}-${partType.toUpperCase()}-${variant}`;
                const weight = randomInt(5, 25);
                const volume = (randomInt(1, 10) / 10); // 0.1 to 1.0 m3
                const deliveryDate = new Date();
                deliveryDate.setDate(deliveryDate.getDate() + randomInt(1, 14));
                items.push({ id, code: itemCode, type: 'customer_order', weight_kg: weight, volume_m3: volume });
                await client.query(`INSERT INTO items (id, item_code, customer_id, name, weight_kg, volume_m3, type, quantity, delivery_date)
           VALUES ($1, $2, $3, $4, $5, $6, 'customer_order', $7, $8)`, [id, itemCode, customerIds[cust.code], `${partType} ${variant}`, weight, volume, randomInt(1, 10), deliveryDate]);
            }
        }
        console.log(`  items seeded`);
        // --- Storage assignments ---
        const shuffled = [...items].sort(() => Math.random() - 0.5);
        const toAssign = shuffled.slice(0, 100);
        const trackingUnitSequenceByItemId = {};
        // Since all racks are general_stock, we just use the slots list directly
        for (const item of toAssign) {
            if (slots.length === 0)
                continue;
            const slot = randomChoice(slots);
            const qty = randomInt(1, 5);
            const assignmentId = (0, uuid_1.v4)();
            const nextUnitSequence = (trackingUnitSequenceByItemId[item.id] || 0) + 1;
            trackingUnitSequenceByItemId[item.id] = nextUnitSequence;
            const unitCode = (0, trackingUnits_1.buildTrackingUnitCode)(item.code, nextUnitSequence);
            await client.query(`INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_at, checked_in_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`, [assignmentId, item.id, slot.id, unitCode, qty, randomChoice(WORKERS)]);
            const totalWeight = item.weight_kg * qty;
            await client.query(`UPDATE shelf_slots SET current_count = current_count + 1, current_weight_kg = current_weight_kg + $1, measured_weight_kg = measured_weight_kg + $1 WHERE id = $2`, [totalWeight, slot.id]);
        }
        console.log(`  assignments seeded`);
        // --- Machines ---
        for (const m of MACHINES) {
            await client.query(`INSERT INTO machines (id, name, code, category, description) VALUES ($1, $2, $3, $4, $5)`, [(0, uuid_1.v4)(), m.name, m.code, m.category, m.description]);
        }
        await client.query('COMMIT');
        console.log('Seed complete.');
        await pool_1.default.query(`UPDATE shelf_slots SET measured_weight_kg = measured_weight_kg + 25.5 WHERE id IN (SELECT id FROM shelf_slots WHERE current_count > 0 ORDER BY random() LIMIT 5)`);
        console.log('  sensor discrepancies injected.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
        await pool_1.default.end();
    }
}
seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
