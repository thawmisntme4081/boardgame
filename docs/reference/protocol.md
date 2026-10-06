# Socket.IO protocol

[← Master plan](../PLAN.md)

One wire protocol for every game (Platform 03). `packages/protocol` (`@platform/protocol`) defines the events, their Zod payload schemas and the generic types `ClientEvents<Seat, Move, Config, Reason>` / `ServerEvents<Seat, View>`; each game fills in its own types. Sky Team's are in `packages/shared/src/events.ts` (`ClientToServer`, `ServerToClient`), used by both `Server<...>` and `Socket<...>`, so a renamed event breaks the build instead of the game.

## Platform events

| Direction | Event | Payload | Server response |
| --- | --- | --- | --- |
| Client → Server | `room:create` | `{ name, game, config? }` (`game`: the registry id, `'sky-team'`; `config`: the lobby's choices, checked by the game's lobby schema, then its `configSchema` with the server's settings on top) | ack `{ ok, code, seat, token, matchId, seq }`; `unknown-game`, `bad-request` (bad config), `too-many-rooms` |
| Client → Server | `room:join` | `{ code, name }` | ack as above, or `{ ok:false, error }` (`room-not-found`, `room-full`) |
| Client → Server | `room:rejoin` | `{ code, token }` | ack as above (`seq`: the last move counter accepted from this seat in this match) + fresh presence and view |
| Client → Server | `room:leave` | `{}` | ack; seat freed, a new match starts for whoever stays; empty room deleted |
| Client → Server | `room:choose-seat` | `{ seat }` | ack; creator only (`not-creator`), before the game starts (the game decides: Sky Team answers `setup-closed` after round 1 begins): the creator takes that seat, the player in it the other; the game hears it as `table:choose-seat` |
| Client → Server | `room:rematch` | `{ matchId, config? }` (`matchId`: the match the player was looking at; `config`: changes to the lobby's choices) | ack; see "Rematch" below |
| Client → Server | `match:move` | `{ matchId, seq, move }` | ack `{ ok }` or `{ ok:false, error }`: `stale-match` (another match), `bad-request` (fails the game's `moveSchema`), or the game's own reason (e.g. `not-your-turn`) |
| Server → Client | `room:presence` | `{ <seat>: { name, online, creator } \| null, you? }` | to each seat on every change (`you`: that seat); on a disconnect to the room |
| Server → Client | `match:view` | `{ matchId, version, view }` | to each seat after every change; `view` is that seat's own (`definition.view`) |

Every ack is `{ ok: true }` or `{ ok: false, error }`, where `error` is a platform code (`PlatformError`: `bad-request`, `room-not-found`, `room-full`, `bad-token`, `not-in-room`, `already-in-room`, `too-many-rooms`, `unknown-game`, `not-creator`, `stale-match`, `game-not-over`) or the game's reason for refusing a move (Sky Team: a `MoveError` from the shared rules).

- **Matches.** A room plays one match at a time; a rematch (or a restart after someone leaves) starts the next one. `matchId` is `<room code>-<number>-<8 hex digits>`: unique for good, since room codes come back once a room is gone.
- **`seq`** is the client's move counter: a whole number above 0, always increasing (the client never reuses one, across reloads and matches). A move whose `seq` is not above the last one accepted from that seat in the match is a harmless repeat (`{ ok: true }`, nothing changes): a resend after a reconnect is applied once. A refused move does not use up its `seq`.
- **`version`** counts the match's accepted changes (moves, scheduled moves, table moves). Views are complete snapshots, so a client keeps the newest it has and drops an older one of the same match; a missed view loses nothing, so there is no resync request.
- **Rematch** (`room:rematch { matchId }`): for the current match, a new match starts once it is over (`game-not-over` otherwise); before play has begun (`definition.started`), the request only changes the setup, and the same setup changes nothing. For the match just before the current one (the partner already pressed "Fly again"), it changes nothing, unless it asks for another setup and the new match has not started. Any other match: `stale-match`.
- **Order.** The server handles one event at a time (Node's event loop) and every handler runs to completion without waiting, so the moves of a match are applied one after another.

## Sky Team moves (`match:move`)

`move` is one of Sky Team's player moves (`skyTeamMoveSchema` in `packages/shared/src/definition.ts`):

| `move` | Meaning |
| --- | --- |
| `{ type: 'pick-ability', ability: AbilityId \| null }` | Before round 1 only (`setup-closed` after). Two cards: each player picks one, never the partner's (`ability-taken`); one card: only the creator (`not-your-pick`). Cancels any confirm or "Roll dice" already pressed |
| `{ type: 'confirm' }` | Before round 1. Needs a partner (`no-partner`), seats chosen (`roles-missing`) and the cards chosen (`abilities-missing`). When both have confirmed, round 1 starts (traffic die, alarms, then the strategy phase). Changing seats or cards cancels both confirms |
| `{ type: 'ready' }` | "Roll dice": the dice roll once both are ready; `not-strategy` otherwise |
| `{ type: 'place', dieId, slot, coffeeDelta, tokenSlot? }` | `tokenSlot`: where an Intern token goes; the Synchronization traffic die uses its own `dieId` |
| `{ type: 'ability', ability: 'adaptation' \| 'anticipation' \| 'working-together', dieId }` | Working Together: the first call offers a die, the partner's call answers. Refused (`reroll-pending`) while either player still has a reroll to use |
| `{ type: 'cancel-swap' }` | Working Together: the player who offered takes the offer back before the partner answers (`no-swap` otherwise) |
| `{ type: 'spend-reroll' }` | Both players may then reroll once |
| `{ type: 'reroll', dieIds }` | Rerolls your chosen dice (may be none) |

The lobby's choices (`config` in `room:create` and `room:rematch`): `{ scenario?, timer? }` (scenario id, YUL by default; `timer: true` for a timed game). The round length (`roundTimerMs`) and Total Trust's pause (`autoRollDelayMs`) are server settings that a client cannot set.

## Hidden information

`viewFor(state, seat)` is the only way state leaves the server:

- Your own unplaced dice: full values.
- Presence (`room:presence`): per seat only platform facts: the name, online and `creator`. The game's own choices are in the view's `crew` (public: chosen in the open): `host` (the creator's seat), `seated`, `rolesChosen`, each seat's `picks`, `confirmed` and `ready`. New matches start in the `setup` phase. The game's `abilities` follow the picks until the first roll; a new match keeps the last picks of those still seated as its starting point.
- Partner's unplaced dice: a count only (`partnerDiceLeft: 3`, Bad Visibility's set-aside dice included; `setAside` gives both seats' set-aside counts).
- Placed dice, tracks, coffee, altitude, the finished round's board (`lastRound`): public.
- Module state (kerosene, intern tokens, wind, the Alarm board's face-up and face-down tokens, Total Trust's `autoRoll`), the traffic die rolls, the Synchronization traffic die and the die offered for Working Together: public (face up at the table).
- `rngSeed` and the log's future rolls: never sent. Turbulence adds no secret: a flipped Alarm token and a set-aside die are drawn from the RNG only when they come into play.
- Total Trust: when a round ends on a Total Trust space, the next view has `autoRoll: true` and no `ready` is needed; the server rolls the dice once the `NEXT_TURN_MS` (5 s) pause is over: the game keeps the time (`autoRollAt`, not in the view) and `schedule` returns the `roll`; the room's one timer arms whichever scheduled move is next.
- Log events added for Turbulence: `weather` (a player's hand after Turbulence or Bad Visibility changed it) and `alarm` (a token flipped). Move errors added: `alarm-blocked`, `alarm-not-active`.

## Repeated requests

Repeated requests must be harmless: a `match:move` with a `seq` already accepted is a no-op (`{ ok: true }`), a second "Fly again" for a match already replaced is OK, and the client never sends the same request twice while one is pending.

## No-talking rule

There is no in-game chat (removed Sep 28, 2026): players talk outside the app (in person or a call) during the `strategy` phase, and each presses "Roll dice" (in the dice tray) when the discussion is over. From the roll until the round ends they stay silent by agreement, as at the table; a red "No talking" pill reminds them.

## Site password (HTTP, before the socket)

When the server has `SITE_PASSWORD`, the socket handshake is refused without the signed `site_auth` cookie; the client asks first.

| Request | Answer |
| --- | --- |
| `GET /auth/status` | `{ gate: false, ok: true }` without a site password; otherwise `{ gate: true, ok }`, and a valid cookie is renewed (30 days) |
| `POST /auth/login { password }` | `200 { ok: true }` + `Set-Cookie: site_auth=...` (httpOnly, SameSite=Lax, Secure in production); `401 { ok: false, error: 'wrong-password' }`; `429 { ok: false, error: 'too-many-tries' }` after 5 wrong tries in a row from one address (5 minutes) |
