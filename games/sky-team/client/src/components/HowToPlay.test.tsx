import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HowToPlay } from './HowToPlay';

/** Open the guide from its lobby button. */
async function open() {
  render(<HowToPlay />);
  await userEvent.click(screen.getByRole('button', { name: 'How to play' }));
}

describe('the How to play slider', () => {
  it('opens on the first step, with Previous disabled', async () => {
    await open();
    expect(screen.getByText('Step 1 of 17')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Land the plane together' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('moves with Next and Previous, and stops on the last step', async () => {
    await open();
    const next = screen.getByRole('button', { name: 'Next' });
    await userEvent.click(next);
    expect(screen.getByText('Step 2 of 17')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Step 1 of 17')).toBeInTheDocument();
    for (let i = 0; i < 16; i++) await userEvent.click(next);
    expect(screen.getByText('Step 17 of 17')).toBeInTheDocument();
    expect(next).toBeDisabled();
  });

  it('moves with the arrow keys and with a swipe', async () => {
    await open();
    const slider = screen.getByRole('region', { name: 'How to play' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(screen.getByText('Step 2 of 17')).toBeInTheDocument();
    fireEvent.pointerDown(slider, { clientX: 200 });
    fireEvent.pointerUp(slider, { clientX: 100 });
    expect(screen.getByText('Step 3 of 17')).toBeInTheDocument();
    fireEvent.pointerDown(slider, { clientX: 100 });
    fireEvent.pointerUp(slider, { clientX: 120 });
    expect(screen.getByText('Step 3 of 17')).toBeInTheDocument();
  });

  it('shows the game screenshot of the step, and loads only the nearby ones', async () => {
    await open();
    const first = screen.getByRole('img', {
      name: 'Screenshot of the game: Land the plane together',
    });
    expect(first).toHaveAttribute('src', expect.stringContaining('/en/goal.png'));
    expect(screen.getAllByRole('img')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });
});
