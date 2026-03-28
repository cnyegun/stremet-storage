# Stremet Storage — Backend API

Express.js + PostgreSQL backend for the Stremet warehouse storage management system.

## Prerequisites

- Node.js 18+
- PostgreSQL 16 (via podman/docker or local install)

## Setup

```bash
# 1. Start Postgres (using podman)
podman run -d --name stremet-postgres \
  -e POSTGRES_USER=stremet \
  -e POSTGRES_PASSWORD=stremet \
  -e POSTGRES_DB=stremet_storage \
  -p 5432:5432 \
  docker.io/postgres:16-alpine

# 2. Install dependencies
cd backend
npm install

# 3. Copy env file (defaults work with the podman command above)
cp .env.example .env

# 4. Run migrations
npm run db:migrate

# 5. Seed with fake data
npm run db:seed

# 6. Start dev server
npm run dev
```

The API runs on `http://localhost:4000`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled JS |
| `npm run typecheck` | Type check without emitting |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run SQL migrations |
| `npm run db:seed` | Seed database with fake data |
| `npm run db:reset` | Drop all tables |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/zones` | List zones with occupancy stats |
| GET | `/api/zones/:id` | Zone detail with racks, shelves, items |
| GET | `/api/racks/:id` | Rack detail with shelves and items |
| GET | `/api/items` | List items (search, filter, sort, paginate) |
| GET | `/api/items/:id` | Item detail with location and history |
| POST | `/api/items` | Create new item |
| PUT | `/api/items/:id` | Update item |
| POST | `/api/items/check-in` | Check in item to shelf |
| POST | `/api/items/check-out` | Check out item from storage |
| POST | `/api/items/move` | Move item between shelves |
| GET | `/api/items/:id/suggest-location` | Smart location suggestion |
| GET | `/api/items/duplicates` | Find duplicate items in storage |
| GET | `/api/activity` | Activity log (filterable) |
| GET | `/api/search?q=` | Global search |
| GET | `/api/stats` | Warehouse occupancy stats |
| GET | `/api/customers` | List customers |
