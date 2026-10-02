# Socket.IO protocol

[← Master plan](../PLAN.md)

All events are typed once in `packages/shared/src/events.ts` (`ClientToServer`, `ServerToClient`) and used by both `Server<...>` and `Socket<...>`, so a renamed event breaks the build instead of the game.

| Direction | Event | Payload | Server response |
| --- | --- | --- | --- |
| Client → Server | `room:create` | `{ name, timer?, scenario?, abilities? }` (`timer: true` for a timed game; scenario id, YUL by default; exactly the scenario's number of abilities, or the first ones by default) | ack `{ ok, code, seat, token }` |
| Client → Server | `room:join` | `{ code, name }` | ack `{ ok, code, seat, token }` or `{ ok:false, error }` |
| Client → Server | `room:rejoin` | `{ code, token }` | ack + fresh `game:view` |
| Client → Server | `room:leave` | `{}` | ack; seat freed, partner's game restarts; empty room deleted |
| Client → Server | `game:ready` | `{}` | ack; rolls dice when both are ready ("Roll dice") |
| Client → Server | `game:place` | `{ dieId, slot, coffeeDelta, tokenSlot? }` (`tokenSlot`: where an Intern token goes; the Synchronization traffic die uses its own `dieId`) | ack `{ ok }` or `{ ok:false, error }` (rule reason, e.g. `not-your-turn`) |
| Client → Server | `game:ability` | `{ ability: 'adaptation' \| 'anticipation' \| 'working-together', dieId }` | ack; Working Together: the first call offers a die, the partner's call answers |
| Client → Server | `game:spend-reroll` | `{}` | ack; both players may then reroll once |
| Client → Server | `game:reroll` | `{ dieIds }` | ack; rerolls your chosen dice (may be none) |
| Client → Server | `game:rematch` | `{ scenario?, abilities? }` | ack; new game, same room and seats (same scenario unless given); before the first roll it only switches the scenario; `game-not-over` otherwise |
| Server → Client | `game:view` | `PlayerView` | to each seat after every change |
| Server → Client | `room:presence` | `{ pilot, copilot }`: `{ name, online, ready }` or `null` | on join/leave/ready/every change |

Every ack is `{ ok: true }` or `{ ok: false, error }`, where `error` is a room error (`bad-request`, `not-in-room`, `game-not-over`, `too-many-rooms`, …) or the `MoveError` from the shared rules.

## Hidden information

`viewFor(state, seat)` is the only way state leaves the server:

- Your own unplaced dice: full values.
- Partner's unplaced dice: a count only (`partnerDiceLeft: 3`).
- Placed dice, tracks, coffee, altitude, the finished round's board (`lastRound`): public.
- Module state (kerosene, intern tokens, wind), the traffic die rolls, the Synchronization traffic die and the die offered for Working Together: public (face up at the table).
- `rngSeed` and the log's future rolls: never sent.

## Repeated requests

Repeated requests must be harmless: a duplicate `game:place` for an already-placed die is accepted as a no-op, a second rematch on a fresh game (one whose log holds at most the opening traffic roll) is OK, and the client never sends the same request twice while one is pending.

## No-talking rule

There is no in-game chat (removed Sep 28, 2026): players talk outside the app (in person or a call) during the `strategy` phase, and each presses "Roll dice" (in the dice tray) when the discussion is over. From the roll until the round ends they stay silent by agreement, as at the table; a red "No talking" pill reminds them.
