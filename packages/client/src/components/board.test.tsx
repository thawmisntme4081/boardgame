import {
  ALTITUDE_TRACKS,
  canPlaceInView,
  SLOT_IDS,
  WIND_REVERSED_START,
  WIND_RING,
} from '@sky/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '@/store';
import { catalogScenario, makeView, presence, resetStore } from '@/test/fixtures';
import { Cockpit } from './cockpit/Cockpit';
import { DiceTray } from './tray/DiceTray';
import { GameOverDialog } from './GameOverDialog';
import { StatusBar } from './StatusBar';
import { AltitudeTrack } from '@/svgs/AltitudeTrack';
import { ApproachTrack } from '@/svgs/ApproachTrack';

vi.mock('@/api', () => ({
  placeSelected: vi.fn(async () => true),
  ready: vi.fn(async () => true),
  reroll: vi.fn(async () => true),
  spendReroll: vi.fn(async () => true),
  rematch: vi.fn(async () => true),
  playAbility: vi.fn(async () => true),
  cancelSwap: vi.fn(async () => true),
  leaveGame: vi.fn(),
}));
const api = await import('@/api');

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

const validSlots = () =>
  [...document.querySelectorAll('button[data-valid]')].map((b) => b.getAttribute('aria-label'));

describe('Cockpit slots', () => {
  it('light up exactly the spaces the shared rules allow for the selected die', () => {
    const view = makeView('pilot', { pilot: [5, 1, 6, 2], patch: { coffee: 1 } });
    useGame.setState({ selectedDieId: 'p1', coffeeDelta: 0 });
    render(<Cockpit view={view} />);
    const expected = SLOT_IDS.filter(
      (slot) => canPlaceInView(view, { dieId: 'p1', slot, coffeeDelta: 0 }).ok,
    );
    expect(document.querySelectorAll('button[data-valid]')).toHaveLength(expected.length);
    expect(validSlots()).toContain('Landing gear 3 (pilot, needs 5 or 6)');
    expect(validSlots()).not.toContain('Landing gear 1 (pilot, needs 1 or 2)');
  });

  it('follows the draft coffee: a 5 with -1 fits the 3·4 gear', () => {
    const view = makeView('pilot', { pilot: [5, 1, 6, 2], patch: { coffee: 1 } });
    useGame.setState({ selectedDieId: 'p1', coffeeDelta: -1 });
    render(<Cockpit view={view} />);
    expect(validSlots()).toContain('Landing gear 2 (pilot, needs 3 or 4)');
    expect(validSlots()).not.toContain('Landing gear 3 (pilot, needs 5 or 6)');
  });

  it('lights nothing when it is not your turn', () => {
    useGame.setState({ selectedDieId: 'c1' });
    render(<Cockpit view={makeView('copilot')} />);
    expect(validSlots()).toEqual([]);
  });

  it('sends the move when a lit space is tapped', async () => {
    useGame.setState({ selectedDieId: 'p1' });
    render(<Cockpit view={makeView('pilot')} />);
    await userEvent.click(screen.getByRole('button', { name: 'Axis 1 (pilot)' }));
    expect(api.placeSelected).toHaveBeenCalledWith('axisPilot');
  });

  it('shows placed dice, deployed switches and coffee', () => {
    const view = makeView('copilot', {
      patch: {
        placed: { axisPilot: { seat: 'pilot', dieId: 'p1', value: 4 } },
        gear: [true, false, false],
        coffee: 2,
      },
    });
    render(<Cockpit view={view} />);
    expect(screen.getByRole('button', { name: 'Axis 1 (pilot): 4' })).toBeInTheDocument();
    const gear = screen.getByRole('region', { name: 'Landing gear' });
    expect(within(gear).getByRole('img', { name: 'Switch 1: deployed' })).toBeInTheDocument();
    expect(within(gear).getByRole('img', { name: 'Switch 2: not deployed' })).toBeInTheDocument();
    expect(screen.getByLabelText('2 coffee')).toBeInTheDocument();
  });
});

describe('DiceTray', () => {
  it('selects a die and offers coffee only when there is some', async () => {
    const { rerender } = render(<DiceTray view={makeView('pilot')} presence={presence()} />);
    expect(screen.getByText(/Your turn/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Your die: 3' }));
    expect(useGame.getState().selectedDieId).toBe('p2');
    expect(screen.queryByLabelText('Coffee')).not.toBeInTheDocument();

    rerender(<DiceTray view={makeView('pilot', { patch: { coffee: 1 } })} presence={presence()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Spend coffee: plus 1' }));
    expect(useGame.getState().coffeeDelta).toBe(1);
    // The selected 3 now shows 4 (the other 4 is not pressed).
    expect(screen.getByRole('button', { name: 'Your die: 4', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spend coffee: plus 1' })).toBeDisabled();
  });

  it('says who is placing when it is the partner’s turn', () => {
    render(<DiceTray view={makeView('copilot')} presence={presence()} />);
    expect(screen.getByText('Ana is placing a die… (4 dice left)')).toBeInTheDocument();
    render(
      <DiceTray
        view={makeView('copilot', {
          pilot: [3],
          patch: { rerollPending: { pilot: true, copilot: false } },
        })}
        presence={presence()}
      />,
    );
    expect(screen.getByText('Ana is placing a die… (1 die left, rerolling)')).toBeInTheDocument();
  });

  it('has the "Roll dice" button in the strategy phase; it waits for the partner once pressed', async () => {
    const view = makeView('pilot', { rolled: false });
    const { rerender } = render(<DiceTray view={view} presence={presence(false, true)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    expect(api.ready).toHaveBeenCalled();
    rerender(<DiceTray view={view} presence={presence(true, false)} />);
    expect(screen.getByRole('button', { name: 'Waiting for Ben…' })).toBeDisabled();
  });

  it('disables "Roll dice" during the "Next turn in 5s" pause', () => {
    useGame.setState({ nextTurnAt: Date.now() + 5_000 });
    render(<DiceTray view={makeView('pilot', { rolled: false })} presence={presence()} />);
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeDisabled();
  });

  it('spends a reroll token, then rerolls the ticked dice', async () => {
    const { rerender } = render(<DiceTray view={makeView('pilot')} presence={presence()} />);
    await userEvent.click(screen.getByRole('button', { name: /Spend a reroll token/ }));
    expect(api.spendReroll).toHaveBeenCalled();

    const pending = makeView('pilot', {
      patch: { rerolls: 0, rerollPending: { pilot: true, copilot: true } },
    });
    rerender(<DiceTray view={pending} presence={presence()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Die 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Die 5' }));
    await userEvent.click(screen.getByRole('button', { name: /^Reroll 2/ }));
    expect(api.reroll).toHaveBeenCalledWith(['p1', 'p4']);
    await userEvent.click(screen.getByRole('button', { name: 'Keep all' }));
    expect(api.reroll).toHaveBeenLastCalledWith([]);
  });
});

describe('GameOverDialog', () => {
  it('lists every failed landing condition and offers a rematch', async () => {
    const view = makeView('pilot', {
      patch: {
        phase: 'lost',
        round: 7,
        endReason: 'landing-gear',
        landingFailures: ['landing-gear', 'landing-brakes'],
      },
    });
    render(<GameOverDialog view={view} />);
    const dialog = screen.getByRole('dialog', { name: 'Crashed' });
    expect(within(dialog).getByText('Not all the landing gear was down.')).toBeInTheDocument();
    expect(within(dialog).getByText('Your speed was too high for the brakes.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fly again' }));
    expect(api.rematch).toHaveBeenCalledWith({ scenario: 'yul-green' });
  });

  it('flies again on the same scenario by default', async () => {
    const ice = catalogScenario((s) => s.modules.includes('ice-brakes') && s.abilities === 1);
    const view = makeView('pilot', {
      scenario: ice.id,
      abilities: ['mastery'],
      patch: { phase: 'lost', endReason: 'landing-ice-brakes' },
    });
    render(<GameOverDialog view={view} />);
    expect(screen.getByText('The ice brakes were not fully deployed.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent(ice.name);
    await userEvent.click(screen.getByRole('button', { name: 'Fly again' }));
    expect(api.rematch).toHaveBeenCalledWith({ scenario: ice.id });
  });

  it('celebrates a landing and stays closed during play', () => {
    const { rerender } = render(<GameOverDialog view={makeView('pilot')} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<GameOverDialog view={makeView('pilot', { patch: { phase: 'won' } })} />);
    expect(screen.getByRole('dialog', { name: 'Smooth landing!' })).toBeInTheDocument();
  });
});

describe('ApproachTrack', () => {
  it('describes the planes ahead for screen readers', () => {
    render(<ApproachTrack view={makeView('pilot', { patch: { approachIndex: 2 } })} />);
    expect(
      screen.getByRole('img', {
        name: /4 spaces to the airport\. Planes per space from here: 1, 2, 1, 3, 2/,
      }),
    ).toBeInTheDocument();
  });
});

describe('engines out', () => {
  const placedThree = {
    axisPilot: { seat: 'pilot', dieId: 'x1', value: 3 },
    concentration1: { seat: 'pilot', dieId: 'x2', value: 3 },
    radioPilot: { seat: 'pilot', dieId: 'x3', value: 3 },
  } as const;

  it('show the Engine spaces covered: no die can go there', () => {
    render(<Cockpit view={makeView('pilot', { scenario: { modules: ['engines-out'] } })} />);
    const panel = screen.getByRole('region', { name: 'Axis & Engines' });
    expect(
      within(panel).getByRole('img', { name: /^Engines 1 .*: stuck, no dice here$/ }),
    ).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /^Engines 1/ })).not.toBeInTheDocument();
  });

  it('leave the fourth die unused once three are placed', () => {
    render(
      <DiceTray
        view={makeView('pilot', {
          scenario: { modules: ['engines-out'] },
          pilot: [5],
          patch: { placed: placedThree, currentSeat: 'pilot' },
        })}
        presence={presence()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'You have placed your 3 dice; the rest are not used this round.',
    );
    expect(screen.getByRole('button', { name: 'Your die: 5' })).toBeDisabled();
  });

  it('count only the dice the partner can still place', () => {
    render(
      <DiceTray
        view={makeView('copilot', {
          scenario: { modules: ['engines-out'] },
          patch: {
            placed: { axisPilot: { seat: 'pilot', dieId: 'p1', value: 2 } },
            currentSeat: 'pilot',
          },
        })}
        presence={presence()}
      />,
    );
    // Four dice in hand, but only two more of the pilot's three may be placed.
    expect(screen.getByRole('status')).toHaveTextContent('Ana is placing a die… (2 dice left)');
  });
});

describe('turbulence', () => {
  it('show sounding alarms as spaces for the clearing die, and block their Action', () => {
    const view = makeView('pilot', {
      scenario: { modules: ['alarms'] },
      pilot: [4, 2, 3, 3],
      patch: {
        alarms: { active: ['flaps'], faceDown: ['brakes', 'gear', 'radioPilot', 'radioCopilot'] },
      },
    });
    useGame.setState({ selectedDieId: 'p1' });
    render(<Cockpit view={view} />);
    const board = screen.getByRole('list', { name: 'Alarm board: 1 sounding, 4 face down' });
    expect(within(board).getAllByRole('img', { name: 'Face-down alarm' })).toHaveLength(4);
    expect(
      within(board).getByRole('img', { name: 'Concentration alarm: cleared' }),
    ).toBeInTheDocument();
    // The pilot's 4 lights up the Flaps alarm space; the co-pilot's flaps are blocked.
    expect(validSlots()).toContain('Flaps alarm (pilot, needs 4)');
    expect(
      screen.getByRole('button', {
        name: /^Flaps 1 \(co-pilot, needs 1 or 2\), blocked by the Flaps alarm$/,
      }),
    ).toBeDisabled();
  });

  it('show stuck landing gear for a belly landing', () => {
    render(<Cockpit view={makeView('pilot', { scenario: { modules: ['belly-landing'] } })} />);
    expect(
      screen.getByRole('img', {
        name: 'Landing gear 1 (pilot, needs 1 or 2): stuck, no dice here',
      }),
    ).toBeInTheDocument();
  });

  it('explain the weather in the tray and show the set-aside dice', () => {
    render(
      <DiceTray
        view={makeView('pilot', {
          scenario: { altitudes: ALTITUDE_TRACKS.D },
          pilot: [3, 5],
          patch: { round: 4, currentSeat: 'pilot', setAside: { pilot: 2, copilot: 2 } },
        })}
        presence={presence()}
      />,
    );
    expect(screen.getByText(/^Storm: you hold 2 dice/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '2 dice set aside' })).toBeInTheDocument();
  });

  it('mark the weather on the altitude track', () => {
    render(
      <AltitudeTrack view={makeView('pilot', { scenario: { altitudes: ALTITUDE_TRACKS.D } })} />,
    );
    expect(
      screen.getByRole('img', { name: /3,000 ft: Turbulence and Bad visibility/ }),
    ).toBeInTheDocument();
  });

  it('roll by themselves under Total Trust: no "Roll dice" button, and no talking', () => {
    const view = makeView('pilot', { rolled: false, patch: { round: 2, autoRoll: true } });
    render(<DiceTray view={view} presence={presence()} />);
    expect(screen.queryByRole('button', { name: 'Roll dice' })).not.toBeInTheDocument();
    expect(screen.getByText(/^Total Trust: no strategy talk this round/)).toBeInTheDocument();
    render(<StatusBar view={view} presence={presence()} connection="online" />);
    expect(screen.getByText('No talking!!!')).toBeInTheDocument();
  });

  it('mark Alarm and Total Trust symbols on the approach track', () => {
    render(
      <ApproachTrack
        view={makeView('pilot', {
          scenario: {
            modules: ['alarms', 'total-trust'],
            alarms: [1, 0, 0, 0, 0, 0, 0],
            totalTrust: [1, 0, 0, 0, 0, 0, 0],
          },
        })}
      />,
    );
    expect(
      screen.getByRole('img', {
        name: /Current space: an alarm flips at the start of each round here; Total Trust after a round ending here/,
      }),
    ).toBeInTheDocument();
  });
});

describe('module panels', () => {
  it('show kerosene with its space, only for the Kerosene module', () => {
    render(<Cockpit view={makeView('pilot', { scenario: { modules: ['kerosene'] } })} />);
    const panel = screen.getByRole('region', { name: 'Kerosene' });
    expect(within(panel).getByRole('meter', { name: 'Kerosene' })).toHaveAttribute(
      'aria-valuenow',
      '20',
    );
    expect(
      within(panel).getByRole('button', { name: 'Kerosene 1 (either player)' }),
    ).toBeInTheDocument();
  });

  it('show the leak without a space to play on', () => {
    render(<Cockpit view={makeView('pilot', { scenario: { modules: ['kerosene-leak'] } })} />);
    const panel = screen.getByRole('region', { name: 'Kerosene leak' });
    // Only the panel's info icon: no space to place a die.
    expect(
      within(panel)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['About Kerosene leak']);
  });

  it('replace the brakes with the ice brakes', () => {
    render(
      <Cockpit
        view={makeView('pilot', { scenario: { modules: ['ice-brakes'] }, patch: { brakes: 1 } })}
      />,
    );
    expect(screen.queryByRole('region', { name: 'Brakes' })).not.toBeInTheDocument();
    const ice = screen.getByRole('region', { name: 'Ice brakes' });
    expect(
      within(ice).getByRole('button', { name: 'Ice brakes 1 above (pilot, needs 2)' }),
    ).toBeInTheDocument();
    expect(
      within(ice).getByRole('button', { name: 'Ice brakes 4 below (either player, needs 5)' }),
    ).toBeInTheDocument();
    expect(within(ice).getByRole('img', { name: 'Ice brake 2: deployed' })).toBeInTheDocument();
    expect(within(ice).getByRole('img', { name: 'Ice brake 3: not deployed' })).toBeInTheDocument();
  });

  it('show the wind with the axis, and its speed over the engines', () => {
    render(
      <Cockpit view={makeView('pilot', { scenario: { modules: ['wind'] }, patch: { wind: 2 } })} />,
    );
    const speed = WIND_RING[2]!;
    expect(
      screen.getByRole('img', {
        name: `Wind ${speed > 0 ? '+' : ''}${speed} added to the engines`,
      }),
    ).toBeInTheDocument();
    // The wind speed sits on the Axis & Engines instrument; Wind is its own panel.
    const instrument = screen.getByRole('region', { name: 'Axis & Engines' });
    expect(
      within(instrument).getByRole('note', {
        name: `Wind ${speed > 0 ? '+' : ''}${speed} added to the engines`,
      }),
    ).toHaveTextContent(`${speed > 0 ? '+' : ''}${speed} wind`);
    expect(screen.getByRole('region', { name: 'Wind' })).toBeInTheDocument();
  });

  it('turn the wind ring upside down: the airplane starts at the top on a headwind', () => {
    render(
      <Cockpit
        view={makeView('pilot', {
          scenario: { modules: ['wind-reversed'] },
          patch: { wind: WIND_REVERSED_START },
        })}
      />,
    );
    const ring = screen.getByRole('img', { name: 'Wind -3 added to the engines' });
    // The airplane's space (the highlighted one) is drawn at the top of the ring.
    const spots = [...ring.querySelectorAll('circle.stroke-border')];
    const top = Math.min(...spots.map((c) => Number(c.getAttribute('cy'))));
    expect(spots[WIND_REVERSED_START]).toHaveClass('fill-pilot');
    expect(Number(spots[WIND_REVERSED_START]!.getAttribute('cy'))).toBe(top);
  });

  it('train the intern in two taps: the Intern space, then where the token goes', async () => {
    const view = makeView('pilot', {
      scenario: { modules: ['intern'] },
      pilot: [5, 1, 6, 2],
      patch: { intern: [2, 6, 4, 3, 5, 1] },
    });
    useGame.setState({ selectedDieId: 'p1' });
    const { rerender } = render(<Cockpit view={view} />);
    const tokens = screen.getByLabelText('Intern tokens left: 2, 6, 4, 3, 5, 1');
    // Each token is a badge showing its number, in order (arrows between them are hidden).
    expect([...tokens.querySelectorAll('svg text')].map((n) => n.textContent)).toEqual([
      '2',
      '6',
      '4',
      '3',
      '5',
      '1',
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Intern 1 (pilot)' }));
    expect(api.placeSelected).toHaveBeenCalledWith('internPilot');

    // The token (a 2) goes wherever the pilot could put a 2, but not on Concentration.
    useGame.setState({ internSlot: 'internPilot' });
    rerender(<Cockpit view={view} />);
    const expected = SLOT_IDS.filter(
      (tokenSlot) =>
        canPlaceInView(view, { dieId: 'p1', slot: 'internPilot', coffeeDelta: 0, tokenSlot }).ok,
    );
    expect(document.querySelectorAll('button[data-valid]')).toHaveLength(expected.length);
    expect(validSlots()).toContain('Landing gear 1 (pilot, needs 1 or 2)');
    expect(validSlots()).not.toContain('Concentration 1 (either player)');
    expect(screen.getByRole('button', { name: 'Intern 1 (pilot)', pressed: true })).toBeDisabled();

    // The tray holds the collected token; the die on the Intern space steps back.
    render(<DiceTray view={view} presence={presence()} />);
    expect(screen.getByRole('img', { name: 'Intern token: 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Your die: 5' })).toHaveClass('opacity-40');
  });

  it('refuse a die showing the next intern token', () => {
    const view = makeView('pilot', {
      scenario: { modules: ['intern'] },
      pilot: [2, 1, 6, 2],
      patch: { intern: [2, 6, 4, 3, 5, 1] },
    });
    useGame.setState({ selectedDieId: 'p1' });
    render(<Cockpit view={view} />);
    expect(validSlots()).not.toContain('Intern 1 (pilot)');
  });
});

describe('special abilities in the tray', () => {
  it('offers the abilities the rules allow for the selected die', async () => {
    const view = makeView('pilot', { abilities: ['adaptation', 'working-together'] });
    render(<DiceTray view={view} presence={presence()} />);
    expect(screen.getByText('Adaptation')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Your die: 3' }));
    await userEvent.click(screen.getByRole('button', { name: /Flip to 4/ }));
    expect(api.playAbility).toHaveBeenCalledWith({ ability: 'adaptation', dieId: 'p2' });
    await userEvent.click(screen.getByRole('button', { name: /Offer to swap/ }));
    expect(api.playAbility).toHaveBeenLastCalledWith({ ability: 'working-together', dieId: 'p2' });
  });

  it('asks the partner to answer a Working Together offer', async () => {
    const view = makeView('copilot', {
      abilities: ['working-together'],
      patch: { swap: { seat: 'pilot', dieId: 'p1', value: 2 } },
    });
    render(<DiceTray view={view} presence={presence()} />);
    expect(
      screen.getByText('Ana offers a 2 to swap: tap one of your dice, then Swap.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Your die: 5' }));
    await userEvent.click(screen.getByRole('button', { name: /Swap for the 2/ }));
    expect(api.playAbility).toHaveBeenCalledWith({ ability: 'working-together', dieId: 'c4' });
  });

  it('lets the offering player cancel the swap; the partner has no cancel', async () => {
    const patch = { swap: { seat: 'pilot' as const, dieId: 'p1', value: 2 as const } };
    const { unmount } = render(
      <DiceTray
        view={makeView('pilot', { abilities: ['working-together'], patch })}
        presence={presence()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel swap' }));
    expect(api.cancelSwap).toHaveBeenCalledTimes(1);
    unmount();

    render(
      <DiceTray
        view={makeView('copilot', { abilities: ['working-together'], patch })}
        presence={presence()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Cancel swap' })).toBeNull();
  });

  it('hides ability buttons while a reroll is under way', async () => {
    const view = makeView('pilot', {
      abilities: ['adaptation', 'working-together'],
      patch: { rerollPending: { pilot: false, copilot: true } },
    });
    render(<DiceTray view={view} presence={presence()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Your die: 3' }));
    expect(screen.queryByRole('button', { name: /Flip to 4/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Offer to swap/ })).toBeNull();
  });

  it('hands the co-pilot the traffic die to place (Synchronization)', async () => {
    const bonus = { die: { id: 'r1-traffic', value: 4 as const }, after: 'copilot' as const };
    const patch = { bonus, currentSeat: 'copilot' as const };
    render(
      <DiceTray
        view={makeView('copilot', { abilities: ['synchronization'], patch })}
        presence={presence()}
      />,
    );
    expect(
      screen.getByText('Synchronization: place the traffic die on any empty space.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Traffic die: 4' }));
    expect(useGame.getState().selectedDieId).toBe('r1-traffic');
    render(<Cockpit view={makeView('copilot', { abilities: ['synchronization'], patch })} />);
    // Any color: the pilot's axis too.
    expect(validSlots()).toContain('Axis 1 (pilot)');
  });
});

describe('traffic die', () => {
  it('shows the round’s rolls in the strategy tray and marks the new planes', () => {
    const view = makeView('pilot', {
      rolled: false,
      patch: {
        approachPlanes: [0, 0, 1, 3, 2, 3, 2],
        traffic: [
          { roll: 4, space: 3 },
          { roll: 2, space: null },
        ],
      },
    });
    render(<DiceTray view={view} presence={presence()} />);
    // Only the black dice show; where the planes went is read out, not written.
    expect(
      screen.getByRole('status', {
        name: /rolled 4, a plane 3 spaces ahead; rolled 2, no planes left to add/,
      }),
    ).toBeInTheDocument();
    render(<ApproachTrack view={view} />);
    expect(screen.getAllByText('Added by the traffic die')).toHaveLength(1);
  });

  it('says nothing when no traffic die rolled', () => {
    render(<DiceTray view={makeView('pilot', { rolled: false })} presence={presence()} />);
    expect(screen.queryByText(/Traffic:/)).not.toBeInTheDocument();
  });
});

describe('approach effects', () => {
  it('describe the traffic die and the turn on the current space', () => {
    render(
      <ApproachTrack
        view={makeView('pilot', {
          scenario: { turns: [null, [-2, -1], null, null, null, null, null] },
          patch: { approachIndex: 1 },
        })}
      />,
    );
    expect(
      screen.getByRole('img', {
        name: /Current space: to advance, axis must be 2 toward the pilot or 1 toward the pilot/,
      }),
    ).toBeInTheDocument();
  });
});

describe('StatusBar', () => {
  it('says "Strategy time" before the roll, without a roll button of its own', () => {
    render(
      <StatusBar
        view={makeView('pilot', { rolled: false })}
        presence={presence()}
        connection="online"
      />,
    );
    expect(screen.getByText('Strategy time')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Roll dice|Waiting/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/No talking/)).not.toBeInTheDocument();
  });

  it('adds a red "No talking" next to the turn while dice are placed', () => {
    render(<StatusBar view={makeView('pilot')} presence={presence()} connection="online" />);
    expect(screen.getByText('Your turn')).toBeInTheDocument();
    expect(screen.getByText('No talking!!!')).toHaveClass('bg-danger');
  });
});

describe('Leave game', () => {
  it('asks for confirmation before giving up the seat', async () => {
    render(<StatusBar view={makeView('pilot')} presence={presence()} connection="online" />);
    // One Leave button per layout (phone row, tablet+ row); CSS shows one of them.
    expect(screen.getAllByRole('button', { name: 'Leave game' })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Leave game' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Leave this game?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(api.leaveGame).not.toHaveBeenCalled();

    await userEvent.click(screen.getAllByRole('button', { name: 'Leave game' })[1]!);
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Leave game' }),
    );
    expect(api.leaveGame).toHaveBeenCalled();
  });
});

describe('game over: a win and a loss look different', () => {
  it('shows a landing with where and when, and a green "Fly again"', () => {
    render(<GameOverDialog view={makeView('pilot', { patch: { phase: 'won', round: 7 } })} />);
    const dialog = screen.getByRole('dialog', { name: 'Smooth landing!' });
    expect(within(dialog).getByText('You landed at YUL in round 7.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('YUL Montréal-Trudeau', { selector: 'span.font-medium' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Fly again' })).toHaveClass('bg-emerald-600');
  });

  it('shows a crash with the round and altitude, and each reason', () => {
    const view = makeView('pilot', { patch: { phase: 'lost', round: 3, endReason: 'spin' } });
    render(<GameOverDialog view={view} />);
    const dialog = screen.getByRole('dialog', { name: 'Crashed' });
    expect(within(dialog).getByText('Round 3 · 4,000 ft')).toBeInTheDocument();
    expect(within(dialog).getByRole('listitem')).toHaveTextContent('went into a spin');
    expect(within(dialog).getByRole('button', { name: 'Fly again' })).not.toHaveClass(
      'bg-emerald-600',
    );
  });
});

describe('cockpit hints and module details', () => {
  it('name the marker each system moves', () => {
    render(<Cockpit view={makeView('pilot')} />);
    expect(screen.getByRole('region', { name: 'Brakes' })).toHaveTextContent('Brake marker +2');
    expect(screen.getByRole('region', { name: 'Landing gear' })).toHaveTextContent(
      'Blue aerodynamics marker +1',
    );
    expect(screen.getByRole('region', { name: 'Flaps' })).toHaveTextContent(
      'Orange aerodynamics marker +1',
    );
  });

  it('show the current space’s turn over the axis dial, not in the final round', () => {
    const scenario = { turns: [[-2, -1], null, null, null, null, null, null] };
    const { rerender } = render(<Cockpit view={makeView('pilot', { scenario })} />);
    expect(
      screen.getByRole('note', { name: 'Turn: to advance, the axis must be at −2 or −1' }),
    ).toBeInTheDocument();
    rerender(<Cockpit view={makeView('pilot', { scenario, patch: { round: 7 } })} />);
    expect(screen.queryByRole('note', { name: /Turn/ })).not.toBeInTheDocument();
    rerender(<Cockpit view={makeView('pilot', { scenario, patch: { approachIndex: 1 } })} />);
    expect(screen.queryByRole('note', { name: /Turn/ })).not.toBeInTheDocument();
  });

  it('show how much kerosene each burn took', () => {
    const scenario = { modules: ['kerosene' as const] };
    const { rerender } = render(<Cockpit view={makeView('pilot', { scenario })} />);
    expect(screen.queryByText(/^−\d/)).not.toBeInTheDocument();
    rerender(<Cockpit view={makeView('pilot', { scenario, patch: { kerosene: 14 } })} />);
    expect(screen.getByText('−6')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Kerosene' })).toHaveAttribute('aria-valuenow', '14');
  });
});

describe('panel hints', () => {
  it('sit behind a gray info icon, and a red one on mandatory panels', async () => {
    render(<Cockpit view={makeView('pilot')} />);
    expect(screen.queryByText('Any die: +1 coffee (max 3)')).not.toBeInTheDocument();
    const about = screen.getByRole('button', { name: 'About Concentration' });
    expect(about).toHaveClass('text-muted-foreground');
    await userEvent.click(about);
    expect(await screen.findByText('Any die: +1 coffee (max 3)')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    const axis = screen.getByRole('button', { name: 'Axis & Engines is mandatory' });
    expect(axis).toHaveClass('text-danger');
    await userEvent.click(axis);
    expect(await screen.findByText(/^Must be level to land/)).toBeInTheDocument();
    expect(screen.getByText('Mandatory')).toBeInTheDocument();
  });

  it('leave panels without a hint without an icon', () => {
    render(<Cockpit view={makeView('pilot')} />);
    const gear = screen.getByRole('region', { name: 'Landing gear' });
    expect(within(gear).queryByRole('button', { name: /^About/ })).not.toBeInTheDocument();
  });
});

describe('approach markers', () => {
  it('stack the traffic die above the turn dots on a space with both', () => {
    const { container } = render(
      <ApproachTrack
        view={makeView('pilot', {
          scenario: {
            traffic: [0, 2, 0, 0, 0, 0, 0],
            turns: [null, [-2, -1], null, null, null, null, null],
          },
        })}
      />,
    );
    const die = container.querySelector('rect.fill-neutral-900')!;
    const dot = container.querySelector('circle.fill-amber-400')!;
    expect(Number(dot.getAttribute('cy'))).toBeGreaterThan(
      Number(die.getAttribute('y')) + Number(die.getAttribute('height')),
    );
  });
});

describe('recent board details', () => {
  it('explain an ability in a popover when its name is tapped', async () => {
    render(<DiceTray view={makeView('pilot', { abilities: ['control'] })} presence={presence()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Control' }));
    expect(
      await screen.findByText(
        'If you play 2 dice of the same value on the AXIS, immediately gain a Coffee token.',
      ),
    ).toBeInTheDocument();
  });

  it('mark an ice brake deployed only once its pair is complete', () => {
    render(
      <Cockpit
        view={makeView('pilot', { scenario: { modules: ['ice-brakes'] }, patch: { brakes: 1 } })}
      />,
    );
    expect(screen.getByRole('img', { name: 'Ice brake 2: deployed' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ice brake 3: not deployed' })).toBeInTheDocument();
  });

  it('outline your current approach space in your color, with no marker under it', () => {
    const { container, rerender } = render(<ApproachTrack view={makeView('pilot')} />);
    expect(container.querySelector('rect.stroke-pilot')).not.toBeNull();
    expect(container.querySelector('path.fill-pilot')).toBeNull();
    rerender(<ApproachTrack view={makeView('copilot')} />);
    expect(container.querySelector('rect.stroke-copilot')).not.toBeNull();
    expect(container.querySelector('rect.stroke-pilot')).toBeNull();
  });
});

describe('win conditions', () => {
  it('appear from the round before the final one, as a popover listing each condition', async () => {
    const rounds = makeView('pilot').scenario.altitudes.length;
    const { unmount } = render(
      <DiceTray view={makeView('pilot', { patch: { round: rounds - 2 } })} presence={presence()} />,
    );
    expect(screen.queryByRole('button', { name: 'Win conditions' })).not.toBeInTheDocument();
    unmount();

    render(
      <DiceTray
        view={makeView('pilot', {
          scenario: { modules: ['intern'] },
          patch: { round: rounds - 1 },
        })}
        presence={presence()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Win conditions' }));
    expect(await screen.findByText('All the landing gear down')).toBeInTheDocument();
    expect(screen.getByText('The intern fully trained')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });
});

describe('Axis & Engines instrument', () => {
  it('shows the speed on its number, the brakes deployed in red, and describes both', () => {
    const { container } = render(
      <Cockpit view={makeView('pilot', { patch: { speed: 7, brakes: 2, axis: -1 } })} />,
    );
    const instrument = screen.getByRole('img', { name: /tilted 1 toward the pilot\. Speed 7/ });
    expect(instrument).toBeInTheDocument();
    // Brake sections: the first two filled (offset 0), the third empty (offset 1).
    const fills = [...container.querySelectorAll('path.stroke-danger[stroke-dasharray]')];
    expect(fills.map((p) => p.getAttribute('stroke-dashoffset'))).toEqual(['0', '0', '1']);
  });

  it('hides the speed dot until both engine dice are placed', () => {
    const { container } = render(<Cockpit view={makeView('pilot')} />);
    expect(container.querySelector('g.opacity-0 circle.fill-foreground')).toBeInTheDocument();
  });
});

describe('Radio', () => {
  const radioSpaces = () =>
    within(screen.getByRole('region', { name: 'Radio' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter((label) => label?.startsWith('Radio'));

  it('lists your own radio spaces first', () => {
    const { unmount } = render(<Cockpit view={makeView('pilot')} />);
    expect(radioSpaces()[0]).toMatch(/^Radio 1 \(pilot/);
    unmount();
    render(<Cockpit view={makeView('copilot')} />);
    expect(radioSpaces()[0]).toMatch(/^Radio 2 \(co-pilot/);
  });
});
