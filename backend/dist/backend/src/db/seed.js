"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const pool_1 = __importDefault(require("./pool"));
const rackCells_1 = require("../lib/rackCells");
const trackingUnits_1 = require("../lib/trackingUnits");
const machineAssignmentStatus_1 = require("../lib/machineAssignmentStatus");
// --- Helpers ---
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function randomDate(daysAgo) {
    const now = new Date();
    const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
}
function formatLocation(zoneCode, rackNum, shelfNum) {
    return `${zoneCode}/R${rackNum}/S${shelfNum}`;
}
// --- Static Data ---
const ZONES = [
    { code: 'A', name: 'Zone A - Raw materials', description: 'Incoming raw sheet metal and materials before processing', color: '#6366F1', px: 50, py: 50, w: 250, h: 180 },
    { code: 'B', name: 'Zone B - Work-in-progress', description: 'Partially processed items between production stages', color: '#F59E0B', px: 350, py: 50, w: 250, h: 180 },
    { code: 'C', name: 'Zone C - Finished goods', description: 'Completed items ready for quality check or customer assignment', color: '#10B981', px: 650, py: 50, w: 250, h: 180 },
    { code: 'D', name: 'Zone D - Customer orders', description: 'Customer-specific items packed and ready for shipping', color: '#3B82F6', px: 50, py: 300, w: 250, h: 180 },
    { code: 'E', name: 'Zone E - General stock', description: 'Common premade parts and standard components', color: '#8B5CF6', px: 350, py: 300, w: 250, h: 180 },
];
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
    'Stainless steel 1.0mm',
    'Stainless steel 1.5mm',
    'Stainless steel 2.0mm',
    'Stainless steel 3.0mm',
    'Cold-rolled steel 1.0mm',
    'Cold-rolled steel 1.5mm',
    'Cold-rolled steel 2.0mm',
    'Hot-rolled steel 3.0mm',
    'Hot-rolled steel 5.0mm',
    'Galvanized steel 1.0mm',
    'Galvanized steel 1.5mm',
    'Aluminum 5052 1.5mm',
    'Aluminum 5052 2.0mm',
    'Aluminum 6061 2.0mm',
    'Aluminum 6061 3.0mm',
    'Copper 1.0mm',
    'Copper 1.5mm',
];
const PART_TYPES = [
    'Panel', 'Bracket', 'Housing', 'Cover', 'Frame', 'Plate',
    'Enclosure', 'Mount', 'Shield', 'Channel', 'Flange', 'Support',
    'Guard', 'Lid', 'Base', 'Spacer', 'Clip', 'Rail', 'Hinge', 'Vent',
];
const PART_VARIANTS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MACHINES = [
    // Sheet metal
    { code: 'SM-1', name: 'Sheet metal press 1', category: 'sheet_metal', description: 'Hydraulic sheet metal press, 200 ton' },
    { code: 'SM-2', name: 'Sheet metal press 2', category: 'sheet_metal', description: 'Hydraulic sheet metal press, 100 ton' },
    { code: 'SM-3', name: 'Sheet metal roller', category: 'sheet_metal', description: 'Sheet metal rolling machine' },
    // Cutting
    { code: 'CUT-1', name: 'Plasma cutter 1', category: 'cutting', description: 'CNC plasma cutting table 3000x1500' },
    { code: 'CUT-2', name: 'Plasma cutter 2', category: 'cutting', description: 'CNC plasma cutting table 2000x1000' },
    { code: 'CUT-3', name: 'Shear 1', category: 'cutting', description: 'Hydraulic guillotine shear 3m' },
    { code: 'CUT-4', name: 'Shear 2', category: 'cutting', description: 'Hydraulic guillotine shear 2m' },
    // Laser
    { code: 'LASER-1', name: 'Fiber laser 1', category: 'laser', description: '6kW fiber laser, 3000x1500 bed' },
    { code: 'LASER-2', name: 'Fiber laser 2', category: 'laser', description: '4kW fiber laser, 2000x1000 bed' },
    { code: 'LASER-3', name: 'CO2 laser', category: 'laser', description: '3kW CO2 laser for non-metal cutting' },
    // Robot bending
    { code: 'RBEND-1', name: 'Robot bending cell 1', category: 'robot_bending', description: 'Automated press brake with robot loader' },
    { code: 'RBEND-2', name: 'Robot bending cell 2', category: 'robot_bending', description: 'Automated press brake with robot loader' },
    { code: 'RBEND-3', name: 'Robot bending cell 3', category: 'robot_bending', description: 'Automated panel bender' },
    // Bending workcentres
    { code: 'BEND-1', name: 'Press brake 1', category: 'bending', description: 'Manual press brake 3m, 160 ton' },
    { code: 'BEND-2', name: 'Press brake 2', category: 'bending', description: 'Manual press brake 2m, 100 ton' },
    { code: 'BEND-3', name: 'Press brake 3', category: 'bending', description: 'Manual press brake 1.5m, 60 ton' },
    { code: 'BEND-4', name: 'Folding machine', category: 'bending', description: 'Swivel bending machine 2.5m' },
];
const WORKERS = [
    'Matti Virtanen', 'Juha Korhonen', 'Mikko Nieminen',
    'Timo Mäkelä', 'Antti Hämäläinen', 'Pekka Laine',
    'Sari Järvinen', 'Tuomas Lehtonen', 'Ville Heikkinen',
    'Lauri Koskinen',
];
const MACHINE_ASSIGNMENT_STATUSES = ['queued', 'processing', 'needs_attention', 'ready_for_storage'];
async function seed() {
    const client = await pool_1.default.connect();
    try {
        await client.query('BEGIN');
        // --- Zones ---
        const zoneIds = {};
        for (const z of ZONES) {
            const id = (0, uuid_1.v4)();
            zoneIds[z.code] = id;
            await client.query(`INSERT INTO zones (id, name, code, description, color, position_x, position_y, width, height)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [id, z.name, z.code, z.description, z.color, z.px, z.py, z.w, z.h]);
        }
        console.log('  zones: 5');
        const racks = [];
        for (const z of ZONES) {
            for (let r = 1; r <= 5; r++) {
                const id = (0, uuid_1.v4)();
                const code = `${z.code}-R${r}`;
                const label = `Rack ${r} (${z.name.split(' - ')[1] || z.name})`;
                racks.push({ id, zoneCode: z.code, rackNum: r });
                await client.query(`INSERT INTO racks (id, zone_id, code, label, description, rack_type, row_count, column_count, display_order, position_in_zone, total_shelves)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [id, zoneIds[z.code], code, label, z.description, (0, rackCells_1.buildRackTypeFromZone)(z.code, z.name), 4, 1, r, r, 4]);
            }
        }
        console.log('  racks: 25');
        const slots = [];
        for (const rack of racks) {
            for (let s = 1; s <= 4; s++) {
                const id = (0, uuid_1.v4)();
                const capacity = randomInt(6, 12);
                slots.push({ id, rackId: rack.id, zoneCode: rack.zoneCode, rackNum: rack.rackNum, shelfNum: s, capacity });
                await client.query(`INSERT INTO shelf_slots (id, rack_id, shelf_number, row_number, column_number, capacity, current_count)
           VALUES ($1, $2, $3, $4, $5, $6, 0)`, [id, rack.id, s, s, 1, capacity]);
            }
        }
        console.log('  shelf_slots: 100');
        // --- Customers ---
        const customerIds = {};
        for (const c of CUSTOMERS) {
            const id = (0, uuid_1.v4)();
            customerIds[c.code] = id;
            await client.query(`INSERT INTO customers (id, name, code, contact_email)
         VALUES ($1, $2, $3, $4)`, [id, c.name, c.code, c.email]);
        }
        console.log('  customers: 8');
        const items = [];
        // Customer order items (~150)
        for (const cust of CUSTOMERS) {
            const numItems = randomInt(15, 22);
            for (let i = 0; i < numItems; i++) {
                const id = (0, uuid_1.v4)();
                const partType = randomChoice(PART_TYPES);
                const variant = randomChoice(PART_VARIANTS);
                const seqNum = String(i + 1).padStart(3, '0');
                const itemCode = `${cust.code}-${seqNum}-${partType.toUpperCase()}-${variant}`;
                const name = `${partType} ${variant} for ${cust.name.split(' ')[0]}`;
                const material = randomChoice(MATERIALS);
                const w = randomInt(50, 800);
                const h = randomInt(50, 600);
                const thickness = parseFloat(material.split(' ').pop()?.replace('mm', '') || '1');
                const dimensions = `${w}x${h}x${thickness}mm`;
                const weightKg = parseFloat(((w * h * thickness * 0.0000079).toFixed(2)));
                const orderNumber = `ORD-${cust.code}-${2026}-${String(randomInt(1, 50)).padStart(3, '0')}`;
                items.push({ id, code: itemCode, customerId: customerIds[cust.code], customerCode: cust.code, type: 'customer_order', name });
                await client.query(`INSERT INTO items (id, item_code, customer_id, name, description, material, dimensions, weight_kg, type, order_number, quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [id, itemCode, customerIds[cust.code], name, `${partType} component for ${cust.name}`, material, dimensions, weightKg, 'customer_order', orderNumber, randomInt(1, 50)]);
            }
        }
        // General stock items (~50)
        const stockParts = [
            'Standard mounting bracket', 'Universal L-bracket', 'Cable tray cover',
            'Ventilation panel', 'Blank faceplate', 'DIN rail mount', 'Earth strap',
            'Terminal cover', 'Junction box lid', 'Standard gasket plate',
            'Mounting plate 300x200', 'Mounting plate 400x300', 'Mounting plate 500x400',
            'Blank panel 19 inch', 'Blank panel 24 inch', 'Drip tray small',
            'Drip tray large', 'Cable gland plate', 'Hinge plate standard',
            'Hinge plate heavy duty', 'Standard shelf bracket', 'Wall mount bracket',
            'Floor stand base', 'Equipment guard small', 'Equipment guard large',
            'Access panel 200x200', 'Access panel 300x300', 'Access panel 400x400',
            'Kick plate 1000x150', 'Kick plate 1200x150', 'Service hatch cover',
            'Inspection window frame', 'Control panel surround', 'Switch plate blank',
            'Handle mounting plate', 'Nameplate holder', 'Document pocket frame',
            'Clip rail 500mm', 'Clip rail 1000mm', 'Support angle 50x50',
            'Support angle 75x75', 'Support angle 100x100', 'Flat bar spacer 10mm',
            'Flat bar spacer 20mm', 'Gusset plate standard', 'Corner bracket reinforced',
            'Pipe clamp base plate', 'Sensor mounting bracket', 'Motor mount plate',
            'Fan guard grille',
        ];
        for (let i = 0; i < stockParts.length; i++) {
            const id = (0, uuid_1.v4)();
            const seqNum = String(i + 1).padStart(3, '0');
            const itemCode = `STK-${seqNum}-${stockParts[i].split(' ').slice(0, 2).join('-').toUpperCase()}`;
            const material = randomChoice(MATERIALS);
            const w = randomInt(50, 500);
            const h = randomInt(50, 400);
            const thickness = parseFloat(material.split(' ').pop()?.replace('mm', '') || '1');
            const dimensions = `${w}x${h}x${thickness}mm`;
            const weightKg = parseFloat(((w * h * thickness * 0.0000079).toFixed(2)));
            items.push({ id, code: itemCode, customerId: null, customerCode: null, type: 'general_stock', name: stockParts[i] });
            await client.query(`INSERT INTO items (id, item_code, customer_id, name, description, material, dimensions, weight_kg, type, order_number, quantity)
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, NULL, $9)`, [id, itemCode, stockParts[i], `Standard stock item: ${stockParts[i]}`, material, dimensions, weightKg, 'general_stock', randomInt(10, 200)]);
        }
        console.log(`  items: ${items.length}`);
        // --- Storage assignments (~150 active) ---
        // Shuffle items and pick ~150 to assign to shelves
        const shuffled = [...items].sort(() => Math.random() - 0.5);
        const toAssign = shuffled.slice(0, 150);
        const activityEntries = [];
        let assignmentCount = 0;
        // Build a map from zone code to slots for smart placement
        const zoneSlots = {};
        for (const s of slots) {
            if (!zoneSlots[s.zoneCode])
                zoneSlots[s.zoneCode] = [];
            zoneSlots[s.zoneCode].push(s);
        }
        const slotCounts = {};
        for (const s of slots) {
            slotCounts[s.id] = 0;
        }
        const trackingUnitSequenceByItemId = {};
        for (const item of toAssign) {
            // Decide target zone based on item type
            let targetZone;
            if (item.type === 'general_stock') {
                targetZone = 'E';
            }
            else {
                // Customer orders go to D primarily, some to C (finished), some to A/B (in progress)
                const roll = Math.random();
                if (roll < 0.4)
                    targetZone = 'D';
                else if (roll < 0.7)
                    targetZone = 'C';
                else if (roll < 0.85)
                    targetZone = 'B';
                else
                    targetZone = 'A';
            }
            // Find a slot with capacity in target zone
            const candidateSlots = zoneSlots[targetZone].filter(s => slotCounts[s.id] < s.capacity);
            if (candidateSlots.length === 0)
                continue;
            const slot = randomChoice(candidateSlots);
            const qty = randomInt(1, 5);
            const checkedInAt = randomDate(90);
            const worker = randomChoice(WORKERS);
            const assignmentId = (0, uuid_1.v4)();
            const nextUnitSequence = (trackingUnitSequenceByItemId[item.id] || 0) + 1;
            trackingUnitSequenceByItemId[item.id] = nextUnitSequence;
            const unitCode = (0, trackingUnits_1.buildTrackingUnitCode)(item.code, nextUnitSequence);
            slotCounts[slot.id] += 1;
            await client.query(`INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_at, checked_in_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [assignmentId, item.id, slot.id, unitCode, qty, checkedInAt, worker]);
            // Update shelf slot count
            await client.query(`UPDATE shelf_slots SET current_count = current_count + 1 WHERE id = $1`, [slot.id]);
            const location = formatLocation(slot.zoneCode, slot.rackNum, slot.shelfNum);
            activityEntries.push({
                itemId: item.id,
                action: 'check_in',
                from: null,
                to: location,
                by: worker,
                notes: null,
                date: checkedInAt,
            });
            assignmentCount++;
        }
        console.log(`  storage_assignments: ${assignmentCount}`);
        // Add some checked-out assignments for history (~50)
        const remainingItems = shuffled.slice(150, 200);
        for (const item of remainingItems) {
            const targetZone = item.type === 'general_stock' ? 'E' : randomChoice(['A', 'B', 'C', 'D']);
            const candidateSlots = zoneSlots[targetZone];
            if (candidateSlots.length === 0)
                continue;
            const slot = randomChoice(candidateSlots);
            const qty = randomInt(1, 3);
            const checkedInAt = randomDate(90);
            const checkedOutAt = new Date(checkedInAt.getTime() + randomInt(1, 30) * 24 * 60 * 60 * 1000);
            if (checkedOutAt > new Date())
                continue;
            const workerIn = randomChoice(WORKERS);
            const workerOut = randomChoice(WORKERS);
            const nextUnitSequence = (trackingUnitSequenceByItemId[item.id] || 0) + 1;
            trackingUnitSequenceByItemId[item.id] = nextUnitSequence;
            const unitCode = (0, trackingUnits_1.buildTrackingUnitCode)(item.code, nextUnitSequence);
            await client.query(`INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_at, checked_out_at, checked_in_by, checked_out_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [(0, uuid_1.v4)(), item.id, slot.id, unitCode, qty, checkedInAt, checkedOutAt, workerIn, workerOut, randomChoice([null, 'Shipped to customer', 'Moved to production', 'Quality check', 'Returned to supplier'])]);
            const locationIn = formatLocation(slot.zoneCode, slot.rackNum, slot.shelfNum);
            activityEntries.push({
                itemId: item.id,
                action: 'check_in',
                from: null,
                to: locationIn,
                by: workerIn,
                notes: null,
                date: checkedInAt,
            });
            activityEntries.push({
                itemId: item.id,
                action: 'check_out',
                from: locationIn,
                to: null,
                by: workerOut,
                notes: randomChoice([null, 'Shipped to customer', 'Moved to production line']),
                date: checkedOutAt,
            });
        }
        // Add some move entries and note entries to bulk up the activity log
        for (let i = 0; i < 100; i++) {
            const item = randomChoice(toAssign);
            const fromZone = randomChoice(ZONES);
            const toZone = randomChoice(ZONES);
            const fromLoc = formatLocation(fromZone.code, randomInt(1, 5), randomInt(1, 4));
            const toLoc = formatLocation(toZone.code, randomInt(1, 5), randomInt(1, 4));
            const date = randomDate(90);
            const worker = randomChoice(WORKERS);
            if (i < 70) {
                activityEntries.push({
                    itemId: item.id,
                    action: 'move',
                    from: fromLoc,
                    to: toLoc,
                    by: worker,
                    notes: randomChoice([null, 'Reorganizing', 'Making room', 'Customer request', 'Better access needed']),
                    date,
                });
            }
            else {
                activityEntries.push({
                    itemId: item.id,
                    action: 'note_added',
                    from: null,
                    to: null,
                    by: worker,
                    notes: randomChoice([
                        'Needs quality inspection before shipping',
                        'Customer requested hold until next week',
                        'Minor surface scratch - acceptable per spec',
                        'Waiting for matching parts from production',
                        'Priority shipment - handle first',
                        'Material certificate attached',
                        'Count verified',
                        'Packaging instructions updated',
                        'Customer changed delivery date',
                        'Relabeled per customer request',
                    ]),
                    date,
                });
            }
        }
        // Sort activity entries by date and insert
        activityEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
        for (const entry of activityEntries) {
            await client.query(`INSERT INTO activity_log (id, item_id, action, from_location, to_location, performed_by, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [(0, uuid_1.v4)(), entry.itemId, entry.action, entry.from, entry.to, entry.by, entry.notes, entry.date]);
        }
        console.log(`  activity_log: ${activityEntries.length}`);
        // --- Machines ---
        const machineIds = {};
        for (const m of MACHINES) {
            const id = (0, uuid_1.v4)();
            machineIds[m.code] = id;
            await client.query(`INSERT INTO machines (id, name, code, category, description)
         VALUES ($1, $2, $3, $4, $5)`, [id, m.name, m.code, m.category, m.description]);
        }
        console.log(`  machines: ${MACHINES.length}`);
        // --- Machine assignments (some items currently at machines) ---
        const machineAssignItems = shuffled.slice(0, 20);
        let machineAssignCount = 0;
        for (const item of machineAssignItems) {
            const machine = randomChoice(MACHINES);
            const qty = randomInt(1, 3);
            const date = randomDate(14);
            const worker = randomChoice(WORKERS);
            const id = (0, uuid_1.v4)();
            const nextUnitSequence = (trackingUnitSequenceByItemId[item.id] || 0) + 1;
            trackingUnitSequenceByItemId[item.id] = nextUnitSequence;
            const unitCode = (0, trackingUnits_1.buildTrackingUnitCode)(item.code, nextUnitSequence);
            const status = randomChoice(MACHINE_ASSIGNMENT_STATUSES) || (0, machineAssignmentStatus_1.getDefaultMachineAssignmentStatus)();
            await client.query(`INSERT INTO machine_assignments (id, item_id, machine_id, unit_code, status, quantity, assigned_at, assigned_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [id, item.id, machineIds[machine.code], unitCode, status, qty, date, worker, randomChoice([null, 'Processing', 'Waiting for setup', 'In queue'])]);
            // Activity log entry for the machine assignment
            await client.query(`INSERT INTO activity_log (id, item_id, action, from_location, to_location, performed_by, notes, created_at)
         VALUES ($1, $2, 'move', $3, $4, $5, $6, $7)`, [(0, uuid_1.v4)(), item.id, null, `M/${machine.code}`, worker, `Sent to ${machine.name}`, date]);
            machineAssignCount++;
        }
        console.log(`  machine_assignments: ${machineAssignCount}`);
        await client.query('COMMIT');
        console.log('Seed complete.');
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
