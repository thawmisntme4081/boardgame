// Pandemic on the platform: a room through RoomManager only, as the handlers drive it.
import type { GameState, PandemicState } from '@pandemic/rules';
import { describe, expect, it } from 'vitest';
import { RoomManager, type Room } from './rooms';
import { MemoryMatchStore } from './store';

const DAY_MS = 24 * 60 * 60_000;

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`refused: ${String(result.error)}`);
  return result.value;
}

/**
 * A Pandemic room for `players`, created by the first name; the others join in turn. Sockets are
 * named `<prefix>0`, `<prefix>1`… so several tables can share a manager.
 */
function table(
  rooms: RoomManager,
  players: number,
  names = ['Ana', 'Ben', 'Cy', 'Di'],
  prefix = 's',
) {
  const { room } = unwrap(
    rooms.create(names[0]!, `${prefix}0`, 'ip', { game: 'pandemic', config: { players } }),
  );
  const joined = names
    .slice(1, players)
    .map((name, i) => unwrap(rooms.join(room.code, name, `${prefix}${i + 1}`)));
  return { room: room as Room<PandemicState>, joined };
}

const game = (room: Room<PandemicState>): GameState => {
  if (room.game.status === 'waiting') throw new Error('still waiting');
  return room.game;
};

describe('Pandemic rooms', () => {
  it('wait for the chosen number of players, then deal the game', () => {
    const rooms = new RoomManager({ seed: () => 11 });
    const { room } = unwrap(
      rooms.create('Ana', 's0', 'ip', { game: 'pandemic', config: { players: 3 } }),
    );
    const pandemicRoom = room as Room<PandemicState>;
    expect(pandemicRoom.game).toMatchObject({ status: 'waiting', seated: ['p1'], players: 3 });
    unwrap(rooms.join(room.code, 'Ben', 's1'));
    expect(pandemicRoom.game.status).toBe('waiting');
    unwrap(rooms.join(room.code, 'Cy', 's2'));
    expect([...game(pandemicRoom).seats].sort()).toEqual(['p1', 'p2', 'p3']);
    expect(room.config).toEqual({ players: 3, epidemics: 4 });
  });

  it('refuses a lobby choice out of range', () => {
    const rooms = new RoomManager();
    const result = rooms.create('Ana', 's0', 'ip', { game: 'pandemic', config: { players: 5 } });
    expect(result).toEqual({ ok: false, error: 'bad-request' });
  });

  it('plays moves in a 3-seat room through rooms.move', () => {
    const rooms = new RoomManager({ seed: () => 11 });
    const { room } = table(rooms, 3);
    const first = game(room).turn.seat;
    const other = game(room).seats.find((seat) => seat !== first)!;

    expect(rooms.move(room, 'system', { type: 'pass' })).toEqual({
      ok: false,
      error: 'not-allowed',
    });
    expect(rooms.move(room, other, { type: 'pass' })).toEqual({
      ok: false,
      error: 'not-your-turn',
    });
    expect(rooms.move(room, first, { type: 'drive', to: 'tokyo' })).toEqual({
      ok: false,
      error: 'not-adjacent',
    });

    const version = room.match.version;
    expect(rooms.move(room, first, { type: 'drive', to: 'chicago' })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(game(room).pawns[first]).toBe('chicago');
    expect(game(room).turn.actionsLeft).toBe(3);
    expect(room.match.version).toBe(version + 1);

    unwrap(rooms.move(room, first, { type: 'pass' }));
    unwrap(rooms.move(room, first, { type: 'draw' }));
    // Epidemics, the hand limit, then the infect step: play the turn out.
    for (let i = 0; i < 20 && game(room).turn.seat === first; i++) {
      const g = game(room);
      const step = g.turn.step;
      if (g.pending?.kind === 'discard') {
        const card = g.hands[g.pending.seat]![0]!;
        unwrap(rooms.move(room, g.pending.seat, { type: 'discard', card }));
      } else {
        unwrap(rooms.move(room, first, { type: step === 'epidemic' ? 'epidemic' : 'infect' }));
      }
    }
    const next = game(room).turn.seat;
    expect(next).not.toBe(first);
    expect(next).toBe(game(room).seats[(game(room).seats.indexOf(first) + 1) % 3]);
  });

  it('gives each seat a view without the decks or the seed', () => {
    const rooms = new RoomManager({ seed: () => 11 });
    const { room } = table(rooms, 2);
    const view = rooms.entry(room).definition.view(room.game, 'p2', 0);
    const json = JSON.stringify(view);
    for (const key of ['"playerDeck"', '"infectionDeck"', 'rngSeed', 'rngState']) {
      expect(json).not.toContain(key);
    }
  });

  it('keep an empty room for a day, while Sky Team rooms go after the default idle time', () => {
    let now = 0;
    const rooms = new RoomManager({ now: () => now, idleTtlMs: 30 * 60_000 });
    const { room: pandemicRoom } = table(rooms, 2);
    const sky = unwrap(rooms.create('Eve', 'sky', 'ip2', { game: 'sky-team' })).room;
    for (const socket of ['s0', 's1', 'sky']) rooms.disconnect(socket);

    now = 31 * 60_000;
    expect(rooms.sweep()).toEqual([sky.code]);
    expect(rooms.get(pandemicRoom.code)).toBeDefined();

    now = DAY_MS + 1;
    expect(rooms.sweep()).toEqual([pandemicRoom.code]);
  });
});

describe('Pandemic rooms with N seats', () => {
  const rooms = (options = {}) => new RoomManager({ seed: () => 11, ...options });
  const taken = (room: Room) =>
    Object.keys(room.players)
      .filter((seat) => room.players[seat])
      .sort();

  it('fill the next free seat, and refuse a player once the chosen number is seated', () => {
    const manager = rooms();
    const { room, joined } = table(manager, 3);
    expect(joined.map(({ player }) => player.seat)).toEqual(['p2', 'p3']);
    expect(taken(room)).toEqual(['p1', 'p2', 'p3']);
    // Seat p4 is free on the platform's side, but the game plays for three.
    expect(manager.join(room.code, 'Late', 'late')).toEqual({ ok: false, error: 'room-full' });
    expect(taken(room)).toEqual(['p1', 'p2', 'p3']);
  });

  it('seat 2, 3 and 4 players', () => {
    for (const players of [2, 3, 4]) {
      const { room } = table(rooms(), players);
      expect(game(room).seats).toHaveLength(players);
      expect(taken(room)).toHaveLength(players);
    }
  });

  it('free a seat while waiting, and give it to the next player before any other', () => {
    const manager = rooms();
    const { room } = unwrap(
      manager.create('Ana', 's0', 'ip', { game: 'pandemic', config: { players: 4 } }),
    );
    unwrap(manager.join(room.code, 'Ben', 's1'));
    unwrap(manager.join(room.code, 'Cy', 's2'));
    expect((room.game as PandemicState).status).toBe('waiting');

    expect(manager.leave('s1')?.closed).toBe(false);
    expect(taken(room)).toEqual(['p1', 'p3']);
    expect(room.game).toMatchObject({ status: 'waiting', seated: ['p1', 'p3'] });

    expect(unwrap(manager.join(room.code, 'Di', 's3')).player.seat).toBe('p2');
    expect(room.game).toMatchObject({ status: 'waiting', seated: ['p1', 'p3', 'p2'] });
    unwrap(manager.join(room.code, 'Ed', 's4'));
    expect([...game(room as Room<PandemicState>).seats].sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('deal the same game whoever sat down first', () => {
    const inOrder = table(rooms(), 3).room;
    const manager = rooms();
    const { room } = unwrap(
      manager.create('Ana', 's0', 'ip', { game: 'pandemic', config: { players: 3 } }),
    );
    unwrap(manager.join(room.code, 'Ben', 's1'));
    manager.leave('s1');
    unwrap(manager.join(room.code, 'Cy', 's2'));
    unwrap(manager.join(room.code, 'Di', 's3'));
    expect(game(room as Room<PandemicState>)).toEqual(game(inOrder));
  });

  it('keep the match and the hand when a player leaves mid-game, for whoever joins next', () => {
    const manager = rooms();
    const { room } = table(manager, 3);
    const before = structuredClone(game(room));
    const match = room.match.id;
    const version = room.match.version;

    expect(manager.leave('s1')).toMatchObject({ closed: false });
    expect(taken(room)).toEqual(['p1', 'p3']);
    expect(room.match.id).toBe(match);
    expect(room.match.version).toBe(version + 1);
    expect(game(room)).toEqual(before);

    const taker = unwrap(manager.join(room.code, 'Newcomer', 'new'));
    expect(taker.player.seat).toBe('p2');
    expect(game(room)).toEqual(before);
    expect(manager.join(room.code, 'Late', 'late')).toEqual({ ok: false, error: 'room-full' });
  });

  it('go on when the player who left had the turn: the game waits for the next one', () => {
    const manager = rooms();
    const { room, joined } = table(manager, 2);
    const active = game(room).turn.seat;
    const socket = active === 'p1' ? 's0' : 's1';
    manager.leave(socket);
    const other = game(room).seats.find((seat) => seat !== active)!;
    expect(manager.move(room, other, { type: 'pass' })).toEqual({
      ok: false,
      error: 'not-your-turn',
    });
    const taker = unwrap(manager.join(room.code, 'Newcomer', 'new'));
    expect(taker.player.seat).toBe(active);
    expect(manager.move(room, active, { type: 'pass' }).ok).toBe(true);
    expect(joined).toHaveLength(1);
  });

  it('hand the room to the next player when its creator leaves, and close it when empty', () => {
    const manager = rooms();
    const { room } = table(manager, 2);
    manager.leave('s0');
    expect(room.players.p2?.creator).toBe(true);
    expect(manager.leave('s1')).toMatchObject({ closed: true });
    expect(manager.get(room.code)).toBeUndefined();
  });

  it('refuse a seat choice: the turn order is random', () => {
    const manager = rooms();
    const { room, joined } = table(manager, 3);
    expect(manager.chooseSeat(room, room.players.p1!, 'p2')).toEqual({
      ok: false,
      error: 'not-allowed',
    });
    expect(manager.chooseSeat(room, joined[0]!.player, 'p1')).toEqual({
      ok: false,
      error: 'not-creator',
    });
    expect(manager.chooseSeat(room, room.players.p1!, 'p9')).toEqual({
      ok: false,
      error: 'bad-request',
    });
    expect(taken(room)).toEqual(['p1', 'p2', 'p3']);
  });

  it('come back after a restart as they were, waiting or dealt', () => {
    const store = new MemoryMatchStore();
    const first = rooms({ store });
    const waiting = unwrap(
      first.create('Ana', 's0', 'ip', { game: 'pandemic', config: { players: 3 } }),
    ).room;
    unwrap(first.join(waiting.code, 'Ben', 's1'));
    const dealt = table(first, 3, ['Ed', 'Fay', 'Gus'], 'd').room;
    first.leave('d1');
    first.save(waiting);
    first.save(dealt);
    first.flush();

    const second = rooms({ store });
    expect(second.get(waiting.code)?.game).toEqual(waiting.game);
    expect(second.get(dealt.code)?.game).toEqual(dealt.game);
    expect(unwrap(second.join(dealt.code, 'New', 'n1')).player.seat).toBe('p2');
  });
});

describe('Pandemic rematch with N players', () => {
  const rooms = () => new RoomManager({ seed: () => 11 });
  /** Ends the room's game (a loss), as if the last move had lost it. */
  const end = (room: Room<PandemicState>) => {
    const g = game(room);
    g.status = 'lost';
    g.lossReason = 'cubes';
  };

  it('needs every seated player: the offer, each answer, then the new game', () => {
    const manager = rooms();
    const { room } = table(manager, 3);
    const first = room.match.id;
    expect(manager.requestRematch(room, first, 'p1')).toEqual({
      ok: false,
      error: 'game-not-over',
    });
    end(room);

    unwrap(manager.requestRematch(room, first, 'p1'));
    expect(manager.rematchOfferOf(room)).toMatchObject({ by: 'p1', accepted: ['p1'] });
    unwrap(manager.requestRematch(room, first, 'p2'));
    expect(manager.rematchOfferOf(room)).toMatchObject({ by: 'p1', accepted: ['p1', 'p2'] });
    expect(room.match.id).toBe(first);

    unwrap(manager.requestRematch(room, first, 'p3'));
    expect(room.match.id).not.toBe(first);
    expect(room.match.previousId).toBe(first);
    expect(game(room)).toMatchObject({ status: 'playing', epidemics: 4 });
    expect([...game(room).seats].sort()).toEqual(['p1', 'p2', 'p3']);
    expect(manager.rematchOfferOf(room)).toMatchObject({ by: null, accepted: [] });
    // A late "play again" for the match already replaced changes nothing.
    expect(manager.requestRematch(room, first, 'p2')).toEqual({ ok: true, value: undefined });
  });

  it('starts at once with 2 players when the other asks', () => {
    const manager = rooms();
    const { room } = table(manager, 2);
    end(room);
    const first = room.match.id;
    unwrap(manager.requestRematch(room, first, 'p2'));
    expect(room.match.id).toBe(first);
    unwrap(manager.requestRematch(room, first, 'p1'));
    expect(room.match.id).not.toBe(first);
    expect(game(room).seats).toHaveLength(2);
  });

  it('lets the offerer take the offer back, and a player take their answer back', () => {
    const manager = rooms();
    const { room } = table(manager, 3);
    end(room);
    const match = room.match.id;
    unwrap(manager.requestRematch(room, match, 'p1'));
    unwrap(manager.requestRematch(room, match, 'p2'));
    unwrap(manager.declineRematch(room, match, 'p2'));
    expect(manager.rematchOfferOf(room)).toMatchObject({ by: 'p1', accepted: ['p1'] });
    // "Not now" from someone who never answered changes nothing.
    unwrap(manager.declineRematch(room, match, 'p3'));
    expect(manager.rematchOfferOf(room)).toMatchObject({ by: 'p1', accepted: ['p1'] });
    unwrap(manager.declineRematch(room, match, 'p1'));
    expect(manager.rematchOfferOf(room)).toMatchObject({ by: null, accepted: [] });
    expect(room.match.id).toBe(match);
  });

  it('plays the new game with the players still seated, same epidemics', () => {
    const manager = new RoomManager({ seed: () => 11 });
    const { room } = unwrap(
      manager.create('Ana', 's0', 'ip', { game: 'pandemic', config: { players: 3 } }),
    );
    unwrap(manager.join(room.code, 'Ben', 's1'));
    unwrap(manager.join(room.code, 'Cy', 's2'));
    const pandemicRoom = room as Room<PandemicState>;
    end(pandemicRoom);
    manager.leave('s2');

    const match = room.match.id;
    unwrap(manager.requestRematch(room, match, 'p1'));
    unwrap(manager.requestRematch(room, match, 'p2'));
    expect(room.match.id).not.toBe(match);
    expect([...game(pandemicRoom).seats].sort()).toEqual(['p1', 'p2']);
    expect(game(pandemicRoom).epidemics).toBe(4);
    expect(manager.join(room.code, 'Late', 'late')).toEqual({ ok: false, error: 'room-full' });
  });

  it('starts when the only player who had not answered leaves', () => {
    const manager = rooms();
    const { room } = table(manager, 3);
    end(room);
    const match = room.match.id;
    unwrap(manager.requestRematch(room, match, 'p1'));
    unwrap(manager.requestRematch(room, match, 'p2'));
    manager.leave('s2');
    expect(room.match.id).not.toBe(match);
    expect([...game(room).seats].sort()).toEqual(['p1', 'p2']);
  });

  it('drops the offer of a player who leaves', () => {
    const manager = rooms();
    const { room } = table(manager, 3);
    end(room);
    const match = room.match.id;
    unwrap(manager.requestRematch(room, match, 'p2'));
    manager.leave('s1');
    expect(manager.rematchOfferOf(room)).toMatchObject({ by: null, accepted: [] });
    expect(room.match.id).toBe(match);
  });

  it('waits again for the chosen number when only one player is left', () => {
    const manager = rooms();
    const { room } = table(manager, 2);
    end(room);
    manager.leave('s1');
    unwrap(manager.requestRematch(room, room.match.id, 'p1'));
    expect(room.game).toMatchObject({ status: 'waiting', seated: ['p1'], players: 2 });
  });

  it('changes the setup before the game starts, still waiting', () => {
    const manager = rooms();
    const { room } = unwrap(
      manager.create('Ana', 's0', 'ip', { game: 'pandemic', config: { players: 3 } }),
    );
    unwrap(manager.join(room.code, 'Ben', 's1'));
    unwrap(manager.requestRematch(room, room.match.id, 'p1', { players: 4 }));
    expect(room.game).toMatchObject({ status: 'waiting', seated: ['p1', 'p2'], players: 4 });
    expect(room.config).toMatchObject({ players: 4 });
  });
});
