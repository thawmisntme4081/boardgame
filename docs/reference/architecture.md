# Architecture

[← Master plan](../PLAN.md)

One Node process serves the built React app and runs Socket.IO; both sides import the same `shared` package, so rules are written once.

**Key principle:** never trust the client. The browser only sends intents ("place die 2 on the axis slot"); the server checks the rules and broadcasts the result.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) everywhere | Shared types catch rule and protocol bugs |
| Monorepo | pnpm workspaces | One repo, `shared` imported by both sides |
| Server | Node 20+, Express, Socket.IO | Rooms, acks and reconnection built in |
| Client | React + Vite, Tailwind CSS v4 | Fast dev server, simple static build |
| UI components | shadcn/ui (lobby, dialogs, toasts, popover, select) | Accessible pieces copied into the repo; the board stays custom |
| Client state | Zustand | Holds the latest server view plus UI-only state |
| Validation | Zod | Checks every incoming socket payload |
| Tests | Vitest (+ fast-check), React Testing Library, Playwright | Same runner for shared, server and client; real browsers for E2E |
| Hosting | Fly.io, one machine with auto stop/start; SQLite on a volume + Litestream (decided Oct 4, 2026) | Long-running Node process with WebSockets; pay only while players are connected |

This is a personal/learning project: if it is ever published, use an original name and artwork rather than the publisher's.

## Data flow

```mermaid
flowchart LR
  P[Pilot browser<br/>React + Vite] -- intent --> G
  C[Co-pilot browser<br/>React + Vite] -- intent --> G
  subgraph S[Node server - Express + Socket.IO]
    G[Socket.IO gateway<br/>Zod-checks events] --> R[Room manager<br/>codes, seats, tokens]
    R --> E[Game engine<br/>shared rules]
    E --> V[View filter<br/>hides partner dice]
  end
  V -- own view --> P
  V -- own view --> C
  SH[(shared package<br/>types, state, rules, scenarios)] -.-> P
  SH -.-> C
  SH -.-> E
```

Each move flows through the server, then each player receives their own filtered view.

**Saving rooms (Sky Team 12):** every accepted change ends in `broadcastRoom`, which also queues `rooms.save(room)`. On the next tick the room manager writes the changed rooms through its `RoomStore` (`store.ts`): `SqliteRoomStore` (Drizzle on `better-sqlite3`, WAL mode, one table `rooms(code, json, version, updated_at)`) when `DATA_DIR` is set, nothing otherwise; `MemoryRoomStore` in tests. A saved room holds the players (with rejoin tokens), the `GameState` and the room's own flags; socket ids and timers are never saved. On start the rooms load with every player offline, idle ones are swept, and their timers are re-armed. Rows saved in another `ROOM_FORMAT` are dropped. Shutdown (SIGINT/SIGTERM, as Fly sends when it stops the machine) flushes pending saves.

## Repository layout

```
boardgame/
├── package.json            # pnpm workspaces root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   ├── engine/                 # @platform/engine: game-agnostic, no Sky Team code
│   │   └── src/
│   │       ├── index.ts        # GameDefinition contract: Actor, Outcome, Result, ScheduledMove
│   │       ├── rng.ts          # seeded RNG (mulberry32) every game uses
│   │       └── testing.ts      # engine test kit (@platform/engine/testing)
│   ├── shared/
│   │   └── src/
│   │       ├── definition.ts   # Sky Team as a GameDefinition (@sky/shared/definition)
│   │       ├── types.ts        # GameState, Seat, Slot, events
│   │       ├── state.ts        # createGame()
│   │       ├── rules.ts        # canPlaceDie, placeDie, endRound, checkLanding
│   │       ├── views.ts        # viewFor(state, seat)
│   │       ├── scenarios.ts    # airport configs as data
│   │       ├── modules/        # Flight Log modules as rule hooks
│   │       ├── abilities.ts    # Special Ability actions
│   │       └── rng.ts          # Sky Team's die (rollDie) on the engine RNG
│   ├── server/
│   │   └── src/
│   │       ├── index.ts        # Express + Socket.IO bootstrap
│   │       ├── rooms.ts        # create/join/leave, cleanup
│   │       ├── handlers.ts     # socket event handlers
│   │       └── schemas.ts      # Zod payload schemas
│   └── client/
│       └── src/
│           ├── main.tsx
│           ├── socket.ts       # typed socket instance
│           ├── store.ts        # Zustand store for the view
│           ├── api.ts          # socket events → store; actions (create, join, place, …)
│           ├── session.ts      # saved seat token, invite links
│           ├── screens/        # Lobby (+ waiting room), Game
│           ├── lib/            # moves, setup, seat styles, shared classes, small hooks
│           ├── components/     # Panel, Slot, StatusBar, Preflight, GameOverDialog,
│           │   │               # ScenarioPicker (+ components/ui from shadcn)
│           │   ├── cockpit/    # Cockpit (dispatcher), layout (order + desktop grid),
│           │   │               # panels (base game), ModulePanels, Slots
│           │   └── tray/       # DiceTray (by phase): Strategy/Reroll/PlacingTray, DieButton,
│           │                   # notes, popovers, CoffeeControl, AbilityActions, text
│           └── svgs/           # one SVG drawing per file: DieFace, FlightInstrument,
│                               # AltitudeTrack, ApproachTrack, WindRing, markers, Plane,
│                               # InternBadge, Switch (+ geometry helpers)
├── e2e/                        # Playwright tests
└── .github/workflows/ci.yml
```

## Engine contract (Platform 01)

`packages/engine` defines what a game gives the platform: `GameDefinition<S, M, V, C>` with `configSchema` and `moveSchema` (Zod), `setup({ config, seats, seed })`, `actors(state)` (who may act: a `turn`, a `simultaneous` choice or a `prompt`), `validate(state, move, by)` and `apply(state, move, by)` (`by` is a seat or `'system'`), `view(state, viewer, now)`, `schedule(state)` (moves the platform must make later), `outcome(state)` and `migrate`. Every function is pure; moves carry their time (`at`), so nothing reads the clock but the caller.

Sky Team implements it in `packages/shared/src/definition.ts` (`skyTeam`) as a thin adapter over the existing rule functions. Seat moves: `place`, `spend-reroll`, `reroll`, `ability`, `cancel-swap`. System moves: `begin` (round 1 starts), `roll` (both players ready, or Total Trust), `time-up` (scheduled at the round's deadline). Seat choice, ability picks, Confirm and "ready" stay room state until Platform 02. In Platform 01 nothing on the server calls the adapter yet: the socket handlers still call the rule functions directly, and the adapter is exported from `@sky/shared/definition` only, so the client bundle does not include it.

## Server handler pattern

`onSeated` in `handlers.ts`: parse the payload with Zod → find the socket's seat → check with the shared rules → apply (rules resolve axis, engines, the end of the round and landing) → `broadcastRoom` sends presence and each seat's `viewFor`. Any failure returns `{ ok: false, error }` and changes nothing.

## Scaling later

More than one server instance needs a shared store (Redis) for game state, the Socket.IO Redis adapter and sticky sessions. Not needed while one instance serves everyone (see [Sky Team 12](../epics/sky-team/phase-12-persistence.md) and, for several instances, [Platform 07](../epics/platform/phase-07-scale-out.md)).
