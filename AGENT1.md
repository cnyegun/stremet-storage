# Agent 1 — Backend + Database

Read `CLAUDE.md` first for the full project spec.

## Your responsibility

You own the **entire backend API and database layer**. You build the Express.js server, PostgreSQL schema, migrations, seed data, and all API endpoints. You also define the shared TypeScript types that the frontend agents will import.

## Files you own (only edit these)

```
/backend/**                    — Express.js API server
/database/**                   — SQL migrations and seed scripts
/shared/types.ts               — Shared TypeScript types (API request/response shapes, enums)
/docker-compose.yml            — Postgres + any dev services
/.env.example                  — Environment variable template
```

## Files you must NEVER edit

```
/frontend/**                   — Owned by Agent 2 and Agent 3
```

## What to build

### 1. Project setup
- Express.js with TypeScript
- PostgreSQL connection (use `pg` or `knex`)
- CORS enabled for `http://localhost:3000`
- Runs on port 4000

### 2. Database schema
Create all tables as defined in CLAUDE.md:
- zones, racks, shelf_slots, customers, items, storage_assignments, activity_log
- Use UUIDs for all primary keys
- Write migrations that can be run with a single command

### 3. Seed data
Generate realistic fake data:
- 5 zones (A: Raw Materials, B: Work-in-Progress, C: Finished Goods, D: Customer Orders, E: General Stock)
- 5 racks per zone, 4 shelves per rack (100 total shelf slots)
- 8 Finnish customers: Kone, Wärtsilä, Valmet, Ponsse, Cargotec, Outokumpu, Metso, Nokia
- ~200 items with realistic codes like "KONE-003-BRACKET-B", materials, dimensions
- ~150 active storage assignments spread across zones
- ~500 activity log entries over the last 3 months
- Zone positions (position_x, position_y, width, height) for the 2D map — use the layout from CLAUDE.md

### 4. API endpoints
Build all endpoints listed in CLAUDE.md:

```
GET    /api/zones                     — List all zones with rack counts and occupancy
GET    /api/zones/:id                 — Zone detail with racks, shelves, and items
GET    /api/racks/:id                 — Rack detail with shelves and stored items
GET    /api/items                     — List items (search, filter, sort via query params)
GET    /api/items/:id                 — Item detail with current location + full history
POST   /api/items                     — Create new item
PUT    /api/items/:id                 — Update item
POST   /api/items/check-in            — Check in item to a shelf slot
POST   /api/items/check-out           — Check out item from storage
POST   /api/items/move                — Move item between locations
GET    /api/items/:id/suggest-location — Smart location suggestion
GET    /api/items/duplicates           — Find duplicate item codes
GET    /api/activity                   — Activity log (filterable by item, worker, action, date)
GET    /api/stats                      — Occupancy stats per zone/rack for map coloring
GET    /api/search?q=                  — Global search across items, customers, locations
GET    /api/customers                  — List customers
```

### 5. Smart location suggestion logic (`/api/items/:id/suggest-location`)
When suggesting where to store an item, rank locations by:
1. **Same customer nearby** — prefer racks/zones that already hold items from the same customer
2. **Type routing** — raw materials → Zone A, work-in-progress → Zone B, finished goods → Zone C, customer orders → Zone D, general stock → Zone E
3. **Available capacity** — prefer emptier shelves, then emptier racks
4. Return top 3 suggestions with a reason string (e.g., "3 other Kone items on this rack")

### 6. Duplicate detection (`POST /api/items/check-in`)
Before completing check-in, check if the same item_code already exists in storage. If yes, return a warning with the existing location. Let the frontend decide whether to proceed or cancel.

### 7. Shared types (`/shared/types.ts`)
Export TypeScript interfaces for:
- All database entities (Zone, Rack, ShelfSlot, Customer, Item, StorageAssignment, ActivityLog)
- API response wrappers (e.g., `{ data: T, warning?: string }`)
- Enums: ItemType ('customer_order' | 'general_stock'), ActionType ('check_in' | 'check_out' | 'move' | 'note_added')
- Request body types for check-in, check-out, move
- Filter/sort parameter types

These types are the **contract** between you and the frontend agents. Get them right early.

## Important

- If something breaks when you try to typecheck or compile, and the file that breaks isn't yours, it's probably the other agents editing it. Ignore it and keep working on your files.
- Make sure the API returns consistent JSON shapes. Always wrap responses in `{ data: ... }` for collections and single items.
- Include proper error responses with `{ error: string, details?: string }`.
- Add a `GET /api/health` endpoint that returns `{ status: "ok" }`.
- Write a `README.md` inside `/backend` with setup instructions (how to install, migrate, seed, run).
