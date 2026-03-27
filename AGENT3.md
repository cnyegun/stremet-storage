# Agent 3 — Frontend Warehouse Map + Zone Pages

Read `CLAUDE.md` first for the full project spec.

## Your responsibility

You own the **warehouse map visualization** (both 2D floor plan and grid view) and the **zone detail pages**. This is the main landing page of the app — the first thing workers see when they open it.

## Files you own (only edit these)

```
/frontend/src/app/page.tsx             — Home page (warehouse map)
/frontend/src/app/zones/**             — Zone detail pages
/frontend/src/components/map/**        — All map-related components
```

## Files you must NEVER edit

```
/backend/**                            — Owned by Agent 1
/database/**                           — Owned by Agent 1
/shared/**                             — Owned by Agent 1
/frontend/src/app/layout.tsx           — Owned by Agent 2
/frontend/src/app/globals.css          — Owned by Agent 2
/frontend/src/app/items/**             — Owned by Agent 2
/frontend/src/app/check-in/**          — Owned by Agent 2
/frontend/src/app/check-out/**         — Owned by Agent 2
/frontend/src/app/activity/**          — Owned by Agent 2
/frontend/src/components/ui/**         — Owned by Agent 2
/frontend/src/lib/**                   — Owned by Agent 2
/frontend/package.json                 — Owned by Agent 2
/frontend/tailwind.config.*            — Owned by Agent 2
/frontend/next.config.*                — Owned by Agent 2
```

## What you CAN import (read-only, don't edit)

```
/shared/types.ts                       — TypeScript types from Agent 1
/frontend/src/components/ui/*          — Shared UI components from Agent 2 (Button, Badge, etc.)
/frontend/src/lib/api.ts               — API client from Agent 2
/frontend/src/lib/utils.ts             — Utility functions from Agent 2
```

If these files don't exist yet, write your components to work standalone first. Use inline fetch calls and local types as temporary stubs. Swap in the shared imports once the other agents have built them.

## What to build

### 1. Home page — Warehouse map (`/frontend/src/app/page.tsx`)
This page has **two views** togglable with a simple tab/button bar at the top: "Floor plan" and "Grid view". Default to floor plan.

Also include at the top:
- A search input (quick search to highlight an item on the map)
- Summary stats: "X items stored | Y/100 slots occupied | Z slots available"

### 2. 2D Floor plan view (`/frontend/src/components/map/FloorPlan.tsx`)

A birds-eye view of the 1000m2 factory floor.

**Layout:**
```
+------------------------------------------------------------------+
|                          FACTORY FLOOR                            |
|                                                                   |
|   +----------+    +----------+    +----------+                    |
|   | Zone A   |    | Zone B   |    | Zone C   |                    |
|   | Raw Mat. |    | WIP      |    | Finished |                    |
|   |          |    |          |    |          |                     |
|   +----------+    +----------+    +----------+                    |
|                                                                   |
|   +----------+    +----------+                                    |
|   | Zone D   |    | Zone E   |                                    |
|   | Customer |    | General  |                                    |
|   | Orders   |    | Stock    |                                    |
|   +----------+    +----------+                                    |
|                                                                   |
|   [LOADING DOCK]                              [ENTRANCE]          |
+------------------------------------------------------------------+
```

**Rendering:**
- Use an HTML/CSS-based approach (absolutely positioned divs inside a relative container), or Canvas, or SVG. Pick whatever lets you build it fastest and cleanest. CSS-based is fine and probably simplest.
- The container represents the factory floor. Scale it to fit the screen width.
- Zones are positioned rectangles based on `position_x`, `position_y`, `width`, `height` from the zone data returned by the API (`GET /api/zones`).
- Each zone rectangle shows: zone name, zone code, and a small occupancy bar or fraction (e.g., "12/20 slots used").

**Color coding for zones:**
- Green (#16A34A) background tint: < 50% occupied
- Amber (#D97706) background tint: 50-80% occupied
- Red (#DC2626) background tint: > 80% occupied
- Use light/pastel versions of these colors as backgrounds so text remains readable.

**Interactivity:**
- Hover over a zone → show a tooltip with: zone name, total racks, total items, occupancy percentage
- Click a zone → expand to show racks inside it (either inline expand or navigate to `/zones/:id`)
- When a rack is visible, clicking it opens a **side panel** (right side of screen) showing:
  - Rack code and zone
  - All 4 shelves with their contents (item codes, names, quantities)
  - Quick action links: "Check out" for each item, "Check in to this rack"

**Search highlight:**
- When the user types in the search bar at the top, if a match is found, the zone/rack containing that item should pulse or highlight with a border.

### 3. Grid view (`/frontend/src/components/map/GridView.tsx`)

A table/spreadsheet-style view of the entire warehouse.

**Structure:**
- Group by zone (collapsible sections)
- Within each zone: rows = racks, columns = shelf 1, shelf 2, shelf 3, shelf 4
- Each cell shows:
  - Number of items on that shelf (e.g., "3 items")
  - Color-coded: green (empty), amber (has items but not full), red (full)
- Click a cell → expand to show list of items on that shelf with item codes, names, customers
- Click an item → link to `/items/:id`

**Header per zone section:**
- Zone name, code, occupancy fraction, occupancy bar

### 4. Zone detail page (`/zones/:id`)

A dedicated page for one zone showing:
- Zone name, description, occupancy stats
- Visual layout of the 5 racks (simple horizontal row of rack boxes)
- Each rack box shows its 4 shelves stacked vertically
- Each shelf shows items stored on it
- Color coding same as above
- Click an item → link to `/items/:id`
- "Check in to this zone" button → links to `/check-in` with zone pre-selected

### 5. Side panel component (`/frontend/src/components/map/RackDetailPanel.tsx`)

A slide-in panel from the right side that shows rack contents:
- Rack code, zone name
- 4 shelves listed vertically (shelf 1 at bottom, shelf 4 at top — represents physical reality)
- Each shelf: capacity bar + list of items
- Each item row: item code (linked), customer name, quantity, "check out" link
- "Check in here" button per shelf that has space
- Close button (X) in the top right

### 6. Map utility components

Create these helper components in `/frontend/src/components/map/`:
- `ZoneBlock.tsx` — a single zone rectangle for the floor plan
- `RackBox.tsx` — a single rack visualization (used in both floor plan expanded view and zone detail)
- `ShelfRow.tsx` — a single shelf with its items
- `OccupancyBar.tsx` — a small horizontal bar showing used/total capacity
- `MapToggle.tsx` — the floor plan / grid view toggle buttons
- `MapSearch.tsx` — search input for the map page
- `MapStats.tsx` — summary stats bar

## Design guidelines (from CLAUDE.md)

- Light mode only. White/light gray backgrounds (#F9FAFB). Dark text (#111827).
- Industrial and functional. The map should feel like a control room display, not a pretty infographic.
- Zones should have clear borders and labels. No rounded corners on zone blocks — use sharp rectangles.
- Color coding must be immediately obvious (green = good, amber = watch, red = attention).
- Big click targets. Zone blocks and rack boxes should be easy to tap on a tablet.
- The floor plan should scale responsively to fill available width.
- Sentence case. No all-caps headings.
- Colors: primary #2563EB, success #16A34A, warning #D97706, danger #DC2626, borders #D1D5DB, background #F9FAFB, text #111827

## Important

- If something breaks when you try to typecheck or compile, and the file that breaks isn't yours, it's probably the other agents editing it. Ignore it and keep working on your files.
- Agent 2 builds the shared UI components in `/frontend/src/components/ui/` and the API client in `/frontend/src/lib/api.ts`. Import from these when available. If they aren't ready yet, write self-contained components and refactor to use shared ones later.
- Agent 2 sets up the Next.js project (`package.json`, `tailwind.config`, etc). If the project isn't initialized yet when you start, wait for it or coordinate. Don't create a second `package.json`.
- The zone `position_x`, `position_y`, `width`, `height` values come from the database (Agent 1 seeds them). Fetch from `GET /api/zones` and use those values for positioning. Don't hardcode positions — this is how the real factory layout gets swapped in later.
- For the floor plan container, use a fixed aspect ratio (e.g., 16:9 or 2:1) and scale zone positions proportionally within it.
