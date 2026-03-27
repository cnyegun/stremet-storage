# Stremet Storage Management System

## Overview
A web-based warehouse storage management system for Stremet, a sheet metal manufacturing company (1000m2 factory). The system helps workers find items, check items in/out of storage, and visualize the warehouse layout. Built as a hackathon prototype with realistic fake data, designed to be easily adapted to the real factory layout later.

## Tech Stack
- **Frontend:** Next.js (React)
- **Backend:** Express.js (REST API)
- **Database:** PostgreSQL
- **Styling:** Light mode only. Industrial, functional, no-nonsense design. Think early web apps that just work — clean tables, clear labels, minimal decoration. No excessive capitalization. Only uppercase where truly needed (e.g., warning badges). Readable, dense, information-first.

## Architecture

```
/frontend    → Next.js app (port 3000)
/backend     → Express.js API (port 4000)
/database    → SQL migrations and seed data
```

Frontend calls backend API. Backend talks to Postgres. No direct DB access from frontend.

## Database Schema

### zones
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | varchar | e.g., "Zone A - Raw Materials" |
| code | varchar | e.g., "A" |
| description | text | Purpose of this zone |
| color | varchar | Hex color for map display |
| position_x | integer | X position on floor plan |
| position_y | integer | Y position on floor plan |
| width | integer | Width on floor plan |
| height | integer | Height on floor plan |
| created_at | timestamp | |
| updated_at | timestamp | |

### racks
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| zone_id | uuid | FK to zones |
| code | varchar | e.g., "A-R1" (Zone A, Rack 1) |
| label | varchar | Human-friendly name |
| position_in_zone | integer | Rack number within zone |
| total_shelves | integer | Default 4 |
| created_at | timestamp | |
| updated_at | timestamp | |

### shelf_slots
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| rack_id | uuid | FK to racks |
| shelf_number | integer | 1-4 (bottom to top) |
| capacity | integer | Max items that fit |
| current_count | integer | Items currently stored |
| created_at | timestamp | |
| updated_at | timestamp | |

### customers
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | varchar | e.g., "Kone Oyj" |
| code | varchar | e.g., "KONE" |
| contact_email | varchar | |
| created_at | timestamp | |

### items
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| item_code | varchar | e.g., "KONE-001-PANEL-A" |
| customer_id | uuid | FK to customers (nullable for general stock) |
| name | varchar | e.g., "Control Panel Side A" |
| description | text | |
| material | varchar | e.g., "Stainless Steel 1.5mm" |
| dimensions | varchar | e.g., "400x300x2mm" |
| weight_kg | decimal | |
| type | enum | 'customer_order' or 'general_stock' |
| order_number | varchar | nullable, for customer orders |
| quantity | integer | How many units of this item |
| created_at | timestamp | |
| updated_at | timestamp | |

### storage_assignments
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| item_id | uuid | FK to items |
| shelf_slot_id | uuid | FK to shelf_slots |
| quantity | integer | How many stored here |
| checked_in_at | timestamp | When placed here |
| checked_out_at | timestamp | Null if still stored |
| checked_in_by | varchar | Worker name |
| checked_out_by | varchar | Worker name |
| notes | text | Optional notes |
| created_at | timestamp | |

### activity_log
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| item_id | uuid | FK to items |
| action | enum | 'check_in', 'check_out', 'move', 'note_added' |
| from_location | varchar | Readable location string |
| to_location | varchar | Readable location string |
| performed_by | varchar | Worker name |
| notes | text | |
| created_at | timestamp | |

## Warehouse Layout (Fake but Realistic)

1000m2 factory floor, divided into 5 zones:

```
+------------------------------------------------------------------+
|                                                                  |
|   [Zone A]              [Zone B]              [Zone C]           |
|   Raw Materials         Work-in-Progress      Finished Goods     |
|   5 racks x 4 shelves   5 racks x 4 shelves   5 racks x 4 shelves|
|                                                                  |
|   [Zone D]              [Zone E]                                 |
|   Customer Orders       General Stock                            |
|   (ready to ship)       (common premade)                         |
|   5 racks x 4 shelves   5 racks x 4 shelves                     |
|                                                                  |
|   [LOADING DOCK]                              [ENTRANCE]         |
+------------------------------------------------------------------+
```

- 5 zones, 5 racks each, 4 shelves per rack = **100 shelf slots total**
- Zone codes: A, B, C, D, E
- Rack codes: A-R1, A-R2, ... E-R5
- Shelf codes: A-R1-S1 (Zone A, Rack 1, Shelf 1)

## Core Features

### 1. Check-in flow
- Worker enters or scans item code
- System checks for duplicates: **warns if item code already exists somewhere** with exact location
- System **suggests best location** based on:
  - Same customer items nearby (cluster by customer)
  - Item type routing (raw materials → Zone A, finished → Zone C, customer orders → Zone D, general stock → Zone E)
  - Available capacity (prefer emptier racks)
- Worker can accept suggestion or pick manually
- Logs the action to activity_log

### 2. Check-out flow
- Worker searches for item or browses to it
- Clicks "check out"
- Enters their name and optional notes (e.g., "shipped to customer" or "moved to production")
- System updates storage_assignment (sets checked_out_at)
- Updates shelf slot count
- Logs the action

### 3. Move item
- Select item → select new location
- System updates storage, logs both "from" and "to"

### 4. Search and filter
Search by:
- Item code
- Customer name
- Order number
- Zone
- Rack/shelf location
- Material type

Filters:
- Item type (customer order / general stock)
- Zone
- Customer
- Date range (checked in between)
- Age (items older than X days)

Sort by:
- Date checked in (newest/oldest)
- Customer name
- Item code
- Location

### 5. Warehouse map (two views, togglable)

**2D floor plan view:**
- Birds-eye view of the factory
- Zones shown as colored rectangles
- Racks shown inside zones
- Color coding: green = empty, yellow = partially full, red = full
- Click a rack → shows its contents in a side panel

**Grid view:**
- Table/spreadsheet style
- Rows = racks, columns = shelves
- Each cell shows item count and can expand to show contents
- Faster for finding specific locations

### 6. Duplicate detection
- On check-in: warn if same item code already stored
- Search results highlight if multiple entries exist
- Optional: periodic report of potential duplicates

### 7. Activity log
- Full history of all check-ins, check-outs, moves
- Filterable by item, worker, date, action type
- Shown per-item (timeline view) and globally (recent activity feed)

## Fake Seed Data

Generate realistic data:
- **8 customers** with Finnish company names (e.g., Kone, Wärtsilä, Valmet, Ponsse, Cargotec, Outokumpu, Metso, Nokia)
- **~200 items** across customers and general stock
- **~150 active storage assignments** (some slots empty, some full)
- **~500 activity log entries** spanning the last 3 months
- Materials: stainless steel, aluminum, galvanized steel, cold-rolled steel
- Item names: panels, brackets, housings, covers, frames, plates, enclosures

## API Endpoints

```
GET    /api/zones                     - List all zones with rack counts
GET    /api/zones/:id                 - Zone detail with racks and occupancy
GET    /api/racks/:id                 - Rack detail with shelves and items
GET    /api/items                     - List items (with search/filter/sort query params)
GET    /api/items/:id                 - Item detail with storage history
POST   /api/items                     - Create new item
PUT    /api/items/:id                 - Update item
POST   /api/items/check-in            - Check in item to a location
POST   /api/items/check-out           - Check out item from storage
POST   /api/items/move                - Move item between locations
GET    /api/items/:id/suggest-location - Get smart location suggestion
GET    /api/items/duplicates           - Check for duplicate item codes
GET    /api/activity                   - Activity log (filterable)
GET    /api/stats                      - Occupancy stats for map coloring
GET    /api/search?q=                  - Global search across items, customers, locations
GET    /api/customers                  - List customers
```

## Pages

```
/                    → Warehouse map (default view, 2D floor plan with grid toggle)
/items               → Item list with search, filter, sort
/items/:id           → Item detail page with location, history timeline
/check-in            → Check-in flow (enter code → duplicate check → suggest location → confirm)
/check-out/:id       → Check-out flow
/activity            → Activity log with filters
/zones/:id           → Zone detail view
```

## Design Principles

- **Industrial and functional.** No flashy gradients, no rounded-everything. Clean borders, readable fonts, dense information. Think factory management software, not a SaaS landing page.
- **Light mode only.** White/light gray backgrounds. Dark text. Blue for primary actions, red for warnings, green for confirmations.
- **Sentence case everywhere.** No all-caps headings. Only uppercase for short warning badges like "DUPLICATE" or "FULL".
- **Information density.** Show as much useful data as possible without scrolling. Tables over cards. Data over decoration.
- **Big click targets.** Remember this will be used on tablets by workers with gloves. Buttons and interactive elements should be large enough to tap.
- **Fast.** Every page should load and respond instantly. No unnecessary animations or transitions.
- **Font:** System font stack or something like Inter. Nothing fancy.
- **Colors:**
  - Primary: #2563EB (blue)
  - Success/empty: #16A34A (green)
  - Warning/partial: #D97706 (amber)
  - Danger/full/error: #DC2626 (red)
  - Background: #F9FAFB
  - Borders: #D1D5DB
  - Text: #111827

## Integration-ready design

The system should be built so that swapping fake data for real ERP data is straightforward:
- All data access goes through the API layer
- Item codes, zone layouts, rack counts are configurable (not hardcoded in frontend)
- Zones can be added/removed/resized without code changes
- The 2D map positions are stored in the database, not hardcoded
