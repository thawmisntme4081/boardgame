import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SCENARIO_LIST } from '@sky/rules';
import type { GameRecord } from '../lib/history';
import { resetStore } from '../test/fixtures';
import { FlightLog } from './FlightLog';
import { ScenarioPicker } from './ScenarioPicker';

const game = (over: Partial<GameRecord>): GameRecord => ({
  v: 1,
  scenario: 'yul-green',
  seat: 'pilot',
  partner: 'Ben',
  abilities: [],
  result: 'won',
  reasons: [],
  rounds: 7,
  at: Date.UTC(2026, 9, 4, 12),
  ...over,
});

beforeEach(() => {
  resetStore();
  localStorage.clear();
});

/** Games already on this device: the Flight Log reads them when nobody is signed in. */
const seed = (history: GameRecord[]) =>
  localStorage.setItem('sky-team:history', JSON.stringify(history));

describe('FlightLog', () => {
  it('shows wins and losses per scenario and seat, coloured by result', async () => {
    seed([
      game({ seat: 'pilot', result: 'won' }),
      game({ seat: 'pilot', result: 'lost', reasons: ['spin'] }),
      game({ seat: 'copilot', result: 'lost' }),
    ]);
    render(<FlightLog />);
    await userEvent.click(screen.getByRole('button', { name: 'Flight Log' }));

    const row = screen.getByRole('row', { name: /^Routine landing YUL/ });
    const pilot = within(row).getByRole('cell', { name: 'Pilot: 1 won, 1 lost' });
    expect(pilot).toHaveTextContent('1/1');
    expect(pilot.className).toContain('bg-emerald-100');
    const copilot = within(row).getByRole('cell', { name: 'Co-pilot: 0 won, 1 lost' });
    expect(copilot.className).toContain('bg-orange-100');

    const unplayed = screen.getByRole('row', { name: /^Routine landing LHR/ });
    expect(within(unplayed).getByRole('cell', { name: 'Pilot: not played' })).toHaveTextContent('');
  });

  it('lists past games, newest first, with why a game was lost', async () => {
    seed([game({ result: 'lost', reasons: ['spin'], rounds: 3 }), game({ partner: '' })]);
    render(<FlightLog />);
    await userEvent.click(screen.getByRole('button', { name: 'Flight Log' }));
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Crashed');
    expect(items[0]).toHaveTextContent('as Pilot with Ben · round 3');
    expect(items[1]).toHaveTextContent('Landed');
    expect(items[1]).toHaveTextContent('as Pilot · round 7');
  });

  it('numbers the code when an airport has two scenarios of a colour', async () => {
    render(<FlightLog />);
    await userEvent.click(screen.getByRole('button', { name: 'Flight Log' }));
    expect(screen.getByRole('img', { name: 'DUS1' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'DUS2' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'YUL' }).length).toBeGreaterThan(0);
  });

  it('says so when there are no games yet', async () => {
    render(<FlightLog />);
    await userEvent.click(screen.getByRole('button', { name: 'Flight Log' }));
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByText(/No games yet/)).toBeInTheDocument();
  });
});

describe('ScenarioPicker', () => {
  it('marks scenarios landed on this device', async () => {
    seed([game({ scenario: 'lhr-green' })]);
    render(<ScenarioPicker id="t" value={{ scenario: 'yul-green' }} onChange={() => {}} />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(
      within(screen.getByRole('option', { name: /^LHR.*, Routine landing/ })).getByRole('img', {
        name: 'landed',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('option', { name: /^YUL.*, Routine landing/ })).queryByRole('img', {
        name: 'landed',
      }),
    ).toBeNull();
  });

  it('lists the weather of a Turbulence scenario like a module', () => {
    const turbulent = SCENARIO_LIST.find((x) => x.altitudes.some((a) => a.turbulence))!;
    render(<ScenarioPicker id="t" value={{ scenario: turbulent.id }} onChange={() => {}} />);
    expect(
      screen.getByText(/each die you place rerolls your other dice \(at [\d,· ]+ ft\)/),
    ).toBeInTheDocument();
    expect(screen.getByText('Turbulence:')).toBeInTheDocument();
  });

  it('lists no weather on a calm scenario', () => {
    render(<ScenarioPicker id="t" value={{ scenario: 'yul-green' }} onChange={() => {}} />);
    expect(screen.queryByText('Turbulence:')).toBeNull();
    expect(screen.queryByText('Bad visibility:')).toBeNull();
  });
});
