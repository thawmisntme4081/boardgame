import { DIFFICULTY_NAMES, ROUND_TIMER_MS, type GameSetup } from '@sky/rules';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { scenarioSummary } from './lib/setup';
import { SetupForm } from './SetupForm';
import { catalogScenario, makeView } from './test/fixtures';
import { WaitingInfo } from './WaitingInfo';

/** The form with its value kept, as the platform's page does; `onChange` sees every change. */
function Form({ onChange }: { onChange: (setup: GameSetup) => void }) {
  const [value, setValue] = useState<GameSetup>({ scenario: 'yul-green', timer: false });
  return (
    <SetupForm
      value={value}
      onChange={(setup) => {
        setValue(setup);
        onChange(setup);
      }}
    />
  );
}

describe('the lobby options (SetupForm)', () => {
  it('offers a round timer, off by default', async () => {
    const onChange = vi.fn();
    render(<Form onChange={onChange} />);
    const timer = screen.getByRole('switch', { name: /Round timer/ });
    expect(timer).not.toBeChecked();
    expect(screen.getByText(/3:00 to place all the dice each round/)).toBeInTheDocument();
    await userEvent.click(timer);
    expect(onChange).toHaveBeenLastCalledWith({ scenario: 'yul-green', timer: true });
  });

  it('picks a scenario; its special abilities are chosen later, in the game', async () => {
    const two = catalogScenario((s) => s.abilities === 2);
    const onChange = vi.fn();
    render(<Form onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveTextContent('YUL');
    await userEvent.click(screen.getByRole('combobox', { name: 'Scenario' }));
    await userEvent.click(
      screen.getByRole('option', { name: `${two.name}, ${DIFFICULTY_NAMES[two.difficulty]}` }),
    );
    expect(screen.getByText(scenarioSummary(two))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Control' })).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({ scenario: two.id, timer: false });
  });
});

describe('the waiting room heading (WaitingInfo)', () => {
  it('asks for a teammate and says when the game is timed', () => {
    const view = makeView('copilot', {
      rolled: false,
      patch: { phase: 'setup', timerMs: ROUND_TIMER_MS },
    });
    render(<WaitingInfo view={view} />);
    expect(screen.getByText('Waiting for your teammate')).toBeInTheDocument();
    expect(screen.getByText(/Timed game: 3:00 per round/)).toBeInTheDocument();
  });

  it('shows the scenario so whoever joins knows what they fly', () => {
    const scenario = catalogScenario((s) => s.modules.length > 0);
    const view = makeView('pilot', {
      rolled: false,
      scenario: scenario.id,
      patch: { phase: 'setup' },
    });
    render(<WaitingInfo view={view} />);
    expect(screen.getByText('Waiting for your teammate')).toBeInTheDocument();
    expect(screen.getByText(scenario.name)).toBeInTheDocument();
    expect(screen.getByText(scenarioSummary(scenario))).toBeInTheDocument();
  });
});
