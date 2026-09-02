# PCO Kanban Mirror — First-Pass Scaffold

Mirrors Planning Center Online workflow cards into a real-time swimlane
Kanban board, for a 55" TV (read-only) and tablets (drag-and-drop).

## How the pieces fit together

```
PCO  --webhook-->  Node/Express (/webhooks/pco)  --write-->  Supabase (Postgres)
                                                                    |
                                                          pg_changes (Realtime)
                                                                    |
                                                                    v
                                                        React (useRealtimeBoard)
                                                          /board/:id/tv    (read-only)
                                                          /board/:id/admin (drag-and-drop)
```

Dragging a card on `/admin` calls `POST /api/cards/:id/move` on the
backend, which writes the move to PCO *first*, then optimistically patches
Supabase. When PCO's own webhook for that move arrives moments later, it
overwrites the row with PCO's confirmed state — so PCO always wins if
anything ever disagreed.

## Repo layout

```
supabase/schema.sql          Tables, RLS policies, Realtime + replica identity setup
backend/src/server.js        Express app entrypoint
backend/src/routes/webhooks.js  POST /webhooks/pco — parses PCO events, upserts Supabase
backend/src/routes/cards.js     POST /api/cards/:id/move — admin drag-and-drop write-through
backend/src/lib/verifyPcoSignature.js  HMAC verification of PCO webhook deliveries
backend/src/lib/columnMapping.js       Default PCO-step -> universal-column heuristic
frontend/src/hooks/useRealtimeBoard.js Loads + subscribes to workflows/steps/cards
frontend/src/components/SwimlaneBoard.jsx  CSS Grid swimlanes, auto-expanding cells
frontend/src/pages/TvBoardPage.jsx     /board/:id/tv
frontend/src/pages/AdminBoardPage.jsx  /board/:id/admin
```

## Setup

**Supabase**
1. Run `supabase/schema.sql` in the SQL editor.
2. Copy the project URL, `anon` key, and `service_role` key.

**Backend** (`backend/`)
1. `cp .env.example .env` and fill in Supabase keys + PCO credentials.
2. In the PCO Developer console, create a webhook subscription pointed at
   `https://<your-backend>.onrender.com/webhooks/pco`, subscribed to
   `workflow_card.*` events. Save its Authenticity Secret into
   `PCO_WEBHOOK_SECRET`.
3. `npm install && npm run dev`

**Frontend** (`frontend/`)
1. `cp .env.example .env` and fill in Supabase anon key + backend URL.
2. `npm install && npm run dev`
3. Visit `/board/<any-id>/admin` or `/board/<any-id>/tv`.

## Known gaps to close before production

- **Multi-board partitioning**: `workflows` has no `board_id` yet — every
  board currently shows every active workflow. Add the column and filter
  both the initial Supabase query and the realtime subscription by it.
- **Column mapping UI**: `steps.board_column` defaults via a name-based
  heuristic (`columnMapping.js`). Build a small admin screen to let staff
  override which of the 4 universal columns each native PCO step belongs
  to, since this varies per church workflow.
- **Auth**: `/board/:id/admin` has no auth guard yet, and RLS policies are
  wide-open reads. Add Supabase Auth (or your church's SSO) before this
  goes on a tablet outside a locked room.
- **Webhook replay / dead-letter handling**: failed events are currently
  just logged. For production, persist failures to a table and add a
  retry/replay job.
- **PCO rate limits on writes**: the `/api/cards/:id/move` write to PCO
  isn't rate-limited on our side yet — fine at pastoral-staff scale, but
  add a queue if multiple tablets could realistically fire moves faster
  than 100 req / 20s.
