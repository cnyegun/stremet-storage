# Agent 2 — Frontend Core (Pages, UI, Layout)

Read `CLAUDE.md` first for the full project spec.

## Your responsibility

You own the **frontend project setup, shared UI components, API client, and all pages except the warehouse map and zone pages**. You build the items list, check-in flow, check-out flow, activity log, and the app shell (layout, navigation).

## Files you own (only edit these)

```
/frontend/package.json
/frontend/tsconfig.json
/frontend/tailwind.config.*
/frontend/postcss.config.*
/frontend/next.config.*
/frontend/.env.local
/frontend/src/app/layout.tsx           — App shell, navigation
/frontend/src/app/globals.css          — Global styles
/frontend/src/app/items/**             — Item list + item detail pages
/frontend/src/app/check-in/**          — Check-in flow page
/frontend/src/app/check-out/**         — Check-out flow page
/frontend/src/app/activity/**          — Activity log page
/frontend/src/components/ui/**         — Shared UI components (buttons, tables, inputs, badges, modals, etc.)
/frontend/src/lib/api.ts               — API client (fetch wrapper for backend)
/frontend/src/lib/utils.ts             — Utility functions
/frontend/src/lib/hooks.ts             — Shared React hooks
```

## Files you must NEVER edit

```
/backend/**                            — Owned by Agent 1
/database/**                           — Owned by Agent 1
/shared/**                             — Owned by Agent 1
/frontend/src/app/page.tsx             — Owned by Agent 3 (warehouse map home)
/frontend/src/app/zones/**             — Owned by Agent 3
/frontend/src/components/map/**        — Owned by Agent 3
```

## What to build

### 1. Project setup
- Next.js with TypeScript and App Router
- Tailwind CSS for styling
- Configure to talk to backend at `http://localhost:4000`
- Import types from `/shared/types.ts` (use a tsconfig path alias like `@shared/*`)

### 2. App layout (`/frontend/src/app/layout.tsx`)
- Top navigation bar with links: **Warehouse map** (`/`), **Items** (`/items`), **Check in** (`/check-in`), **Activity** (`/activity`)
- Navigation should be a simple horizontal bar. No sidebar. Think functional.
- Show the Stremet name/logo in the top left (just text is fine: "Stremet Storage")
- Content area below nav

### 3. Shared UI components (`/frontend/src/components/ui/`)
Build a small component library. Keep it minimal and industrial:
- `Button` — primary (blue), secondary (gray border), danger (red). Large padding for tablet touch targets (min 44px height).
- `Input` — text input with label. Large size.
- `Select` — dropdown select with label.
- `Table` — data table with sortable column headers. Dense rows.
- `Badge` — small status badges (e.g., "customer order", "general stock", "DUPLICATE", "FULL")
- `Modal` — confirmation dialogs (e.g., "Are you sure you want to check out?")
- `SearchBar` — text input with search icon, debounced onChange
- `FilterBar` — row of filter dropdowns + clear button
- `Pagination` — simple prev/next with page numbers
- `EmptyState` — "No items found" type messages
- `LoadingSpinner` — simple spinner for loading states
- `LocationBadge` — shows a location like "Zone A > Rack 3 > Shelf 2" in a readable format
- `Toast` — success/error notifications (e.g., "Item checked in successfully")

### 4. API client (`/frontend/src/lib/api.ts`)
- Thin wrapper around fetch
- Base URL from env var
- Functions matching all backend endpoints (e.g., `getItems(filters)`, `checkInItem(data)`, `searchItems(query)`)
- Handle errors gracefully, return typed responses using types from `/shared/types.ts`

### 5. Items list page (`/items`)
- Table of all items with columns: item code, name, customer, material, type, current location, checked in date
- SearchBar at top (searches across item code, name, customer)
- FilterBar: filter by type (customer order / general stock), customer, zone, material
- Sortable columns
- Pagination
- Click a row → navigate to `/items/:id`

### 6. Item detail page (`/items/:id`)
- Header: item code, name, customer
- Info section: material, dimensions, weight, type, order number, quantity
- Current location: zone > rack > shelf (with a link to the zone map)
- **Activity timeline**: chronological list of all actions for this item (check-in, check-out, move, notes) with timestamps and who did it
- Actions: "Check out" button, "Move" button

### 7. Check-in flow (`/check-in`)
Step-by-step flow on a single page:
1. **Enter item code** — text input + "Look up" button
2. **Duplicate check** — if item code exists in storage, show a prominent warning banner: "This item already exists at [location]. Are you sure you want to store another?" with Continue / Cancel buttons
3. **Item details** — show item name, customer, material (fetched from DB). If new item, show a form to create it.
4. **Location selection** — show the smart suggestion from the API (top 3 suggestions with reasons). Worker can accept one or manually pick zone > rack > shelf from dropdowns.
5. **Confirm** — summary of what's being stored where, worker name input, optional notes, "Confirm check-in" button
6. **Success** — confirmation message with the location

### 8. Check-out flow (`/check-out/:id`)
- Show item details and current location
- Worker name input
- Notes input (e.g., "shipped to Kone", "moved to production line 2")
- "Confirm check-out" button
- Success message

### 9. Activity log page (`/activity`)
- Table of all activity log entries: timestamp, action type, item code, from/to location, performed by, notes
- FilterBar: filter by action type, worker name, date range
- Sortable by date (default: newest first)
- Pagination
- Click an item code → link to item detail

## Design guidelines (from CLAUDE.md)

- Light mode only. White/light gray backgrounds (#F9FAFB). Dark text (#111827).
- Industrial and functional. Dense tables, clean borders. No rounded-everything.
- Sentence case everywhere. No all-caps headings. Only uppercase for short warning badges.
- Big click targets (min 44px) for tablet use.
- No unnecessary animations. Fast and responsive.
- Colors: primary #2563EB, success #16A34A, warning #D97706, danger #DC2626, borders #D1D5DB
- Font: Inter or system font stack.

## Important

- If something breaks when you try to typecheck or compile, and the file that breaks isn't yours, it's probably the other agents editing it. Ignore it and keep working on your files.
- Agent 3 will build the warehouse map at `/` (page.tsx) and `/zones/**`. Your layout.tsx wraps their pages too, so make sure the nav links to `/` for the map.
- Use the types from `/shared/types.ts` that Agent 1 creates. If they aren't available yet, create temporary local types in `/frontend/src/lib/types.ts` and swap them later. But prefer waiting or using the shared ones.
- Write a `README.md` inside `/frontend` with setup instructions.
