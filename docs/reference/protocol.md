# Socket.IO protocol

[← Master plan](../PLAN.md)

All events are typed once in `packages/shared/src/events.ts` (`ClientToServer`, `ServerToClient`) and used by both `Server<...>` and `Socket<...>`, so a renamed event breaks the build instead of the game.

| Direction | Event | Payload | Server response |
| --- | --- | --- | --- |
| Client → Server | `room:create` | `{ name, timer?, scenario? }` (`timer: true` for a timed game; scenario id, YUL by default; the Special Abilities are picked in the game) | ack `{ ok, code, seat, token }` |
| Client → Server | `room:join` | `{ code, name }` | ack `{ ok, code, seat, token }` or `{ ok:false, error }` |
| Client → Server | `room:rejoin` | `{ code, token }` | ack + fresh `game:view` |
| Client → Server | `room:leave` | `{}` | ack; seat freed, partner's game restarts; empty room deleted |
| Client → Server | `game:ready` | `{}` | ack; rolls dice when both are ready ("Roll dice"); `not-strategy` in the setup phase |
| Client → Server | `game:pick-ability` | `{ ability: AbilityId \| null }` | ack; before round 1 only (`setup-closed` after). Two cards: each player picks one, never the partner's (`ability-taken`); one card: only the creator (`not-your-pick`). Cancels any "Roll dice" already pressed |
| Client → Server | `room:choose-seat` | `{ seat }` | ack; setup phase only, creator only (`not-creator`): the creator takes that seat, the partner the other; picks move with the players |
| Client → Server | `game:confirm` | `{}` | ack; setup phase only. Needs a partner (`no-partner`), seats chosen (`roles-missing`) and the cards chosen (`abilities-missing`). When both have confirmed, round 1 starts (`beginGame`: traffic die, alarms, then the strategy phase). Changing seats or cards cancels both confirms |
| Client → Server | `game:place` | `{ dieId, slot, coffeeDelta, tokenSlot? }` (`tokenSlot`: where an Intern token goes; the Synchronization traffic die uses its own `dieId`) | ack `{ ok }` or `{ ok:false, error }` (rule reason, e.g. `not-your-turn`) |
| Client → Server | `game:ability` | `{ ability: 'adaptation' \| 'anticipation' \| 'working-together', dieId }` | ack; Working Together: the first call offers a die, the partner's call answers. Refused (`reroll-pending`) while either player still has a reroll to use |
| Client → Server | `game:cancel-swap` | `{}` | ack; Working Together: the player who offered takes the offer back before the partner answers (`no-swap` otherwise) |
| Client → Server | `game:spend-reroll` | `{}` | ack; both players may then reroll once |
| Client → Server | `game:reroll` | `{ dieIds }` | ack; rerolls your chosen dice (may be none) |
| Client → Server | `game:rematch` | `{ scenario? }` | ack; new game, same room and seats (same scenario unless given); before the first roll it only switches the scenario; `game-not-over` otherwise |
| Server → Client | `game:view` | `PlayerView` | to each seat after every change |
| Server → Client | `room:presence` | `{ pilot, copilot }`: `{ name, online, creator }` or `null` | on join/leave and every change |

Every ack is `{ ok: true }` or `{ ok: false, error }`, where `error` is a room error (`bad-request`, `not-in-room`, `game-not-over`, `too-many-rooms`, …) or the `MoveError` from the shared rules.

## Hidden information

`viewFor(state, seat)` is the only way state leaves the server:

- Your own unplaced dice: full values.
- Presence (`room:presence`): per seat only platform facts: the name, online and `creator` (Platform 02). The game's own choices are in the view's `crew` (public: chosen in the open): `host` (the creator's seat), `seated`, `rolesChosen`, each seat's `picks`, `confirmed` and `ready`. New games start in the `setup` phase. The game's `abilities` follow the picks until the first roll; a new game keeps the last picks of those still seated as its starting point.
- Every `game:*` event except `game:rematch` is a game move: the server turns `game:<type>` and its payload into `{ type, ...payload }`, checks it with Sky Team's `moveSchema` (`bad-request` if malformed) and runs it through `validate` / `apply` at the server's time. `room:choose-seat` stays a room event: the server checks the creator, the game checks the phase (`table:choose-seat`), then the players move.
- Partner's unplaced dice: a count only (`partnerDiceLeft: 3`, Bad Visibility's set-aside dice included; `setAside` gives both seats' set-aside counts).
- Placed dice, tracks, coffee, altitude, the finished round's board (`lastRound`): public.
- Module state (kerosene, intern tokens, wind, the Alarm board's face-up and face-down tokens, Total Trust's `autoRoll`), the traffic die rolls, the Synchronization traffic die and the die offered for Working Together: public (face up at the table).
- `rngSeed` and the log's future rolls: never sent. Turbulence adds no secret: a flipped Alarm token and a set-aside die are drawn from the RNG only when they come into play.
- Total Trust: when a round ends on a Total Trust space, the next view has `autoRoll: true` and no `game:ready` is needed; the server rolls the dice once the `NEXT_TURN_MS` (5 s) pause is over: the game keeps the time (`autoRollAt`, not in the view) and `schedule` returns the `roll`; the room's one timer arms whichever scheduled move is next.
- Log events added for Turbulence: `weather` (a player's hand after Turbulence or Bad Visibility changed it) and `alarm` (a token flipped). Move errors added: `alarm-blocked`, `alarm-not-active`.

## Repeated requests

Repeated requests must be harmless: a duplicate `game:place` for an already-placed die is accepted as a no-op, a second rematch on a fresh game (one whose log holds at most the opening traffic roll) is OK, and the client never sends the same request twice while one is pending.

## No-talking rule

There is no in-game chat (removed Sep 28, 2026): players talk outside the app (in person or a call) during the `strategy` phase, and each presses "Roll dice" (in the dice tray) when the discussion is over. From the roll until the round ends they stay silent by agreement, as at the table; a red "No talking" pill reminds them.

## Site password (HTTP, before the socket)

When the server has `SITE_PASSWORD`, the socket handshake is refused without the signed `site_auth` cookie; the client asks first.

| Request | Answer |
| --- | --- |
| `GET /auth/status` | `{ gate: false, ok: true }` without a site password; otherwise `{ gate: true, ok }`, and a valid cookie is renewed (30 days) |
| `POST /auth/login { password }` | `200 { ok: true }` + `Set-Cookie: site_auth=...` (httpOnly, SameSite=Lax, Secure in production); `401 { ok: false, error: 'wrong-password' }`; `429 { ok: false, error: 'too-many-tries' }` after 5 wrong tries in a row from one address (5 minutes) |

