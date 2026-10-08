import { setLanguage } from '@platform/ui/i18n';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi as vitest } from 'vitest';
import { GameOverDialog } from './components/GameOverDialog';
import { StatusBar } from './components/StatusBar';
import en from './locales/en.json';
import fr from './locales/fr.json';
import vi from './locales/vi.json';
import { endReasonText, errorText } from './messages';
import { makeView, NO_OFFER, presence, resetStore } from './test/fixtures';

vitest.mock('./api', () => ({
  leaveGame: vitest.fn(),
  rematch: vitest.fn(async () => true),
}));

/** Every key, with i18next plural endings removed (Vietnamese has no plural forms). */
function keys(tree: object, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      for (const k of keys(value as object, path)) out.add(k);
    } else {
      out.add(path.replace(/_(zero|one|two|few|many|other)$/, ''));
    }
  }
  return out;
}

beforeEach(resetStore);
afterEach(() => setLanguage('en'));

describe("Sky Team's texts", () => {
  it.each([
    ['Vietnamese', vi],
    ['French', fr],
  ])('has a %s text for every English key, and nothing extra', (_name, other) => {
    const english = keys(en);
    const translated = keys(other);
    expect([...english].filter((k) => !translated.has(k))).toEqual([]);
    expect([...translated].filter((k) => !english.has(k))).toEqual([]);
  });

  it('keeps every placeholder and tag of the English text', () => {
    const flat = (tree: object, prefix = ''): [string, string][] =>
      Object.entries(tree).flatMap(([key, value]) =>
        value && typeof value === 'object'
          ? flat(value as object, prefix + key + '.')
          : [[prefix + key, String(value)] as [string, string]],
      );
    const marks = (s: string) => (s.match(/\{\{\w+\}\}|<\/?\w+>/g) ?? []).sort().join(' ');
    const english = new Map(flat(en));
    for (const [key, text] of flat(fr)) {
      expect(marks(text), key).toBe(marks(english.get(key) ?? ''));
    }
  });

  it('translates rule errors and end reasons from their codes', () => {
    setLanguage('vi');
    expect(errorText('not-your-turn')).toBe('Hãy chờ đồng đội đặt xúc xắc.');
    // Not a rule's code: the platform's own message takes over.
    expect(errorText('made-up-code')).toBeUndefined();
    expect(endReasonText('spin')).toBe('Trục nghiêng quá mức: máy bay rơi vào vòng xoáy.');
  });
});

describe('French', () => {
  it('shows the game in French, with French spacing and numbers', () => {
    setLanguage('fr');
    render(<StatusBar view={makeView('pilot')} presence={presence()} connection="online" />);
    expect(screen.getByText('À vous')).toBeInTheDocument();
    expect(screen.getByText(/^Silence\s!!!$/)).toBeInTheDocument();
    // Intl groups thousands with a narrow no-break space in French.
    expect(screen.getByText(/^Manche 1\/7 · 6\s000\sft$/)).toBeInTheDocument();
    expect(errorText('not-your-turn')).toBe('Attendez que votre partenaire pose un dé.');
    expect(endReasonText('spin')).toBe('L’axe a trop penché\u00A0: l’avion est parti en vrille.');
  });
});

describe('switching language', () => {
  it('shows the game in Vietnamese: status bar and game-over dialog', () => {
    setLanguage('vi');
    const { rerender } = render(
      <StatusBar view={makeView('pilot')} presence={presence()} connection="online" />,
    );
    expect(screen.getByText('Lượt của bạn')).toBeInTheDocument();
    expect(screen.getByText('Không trao đổi!!!')).toBeInTheDocument();
    expect(screen.getByText('Vòng 1/7 · 6.000 ft')).toBeInTheDocument();
    rerender(<StatusBar view={makeView('copilot')} presence={presence()} connection="online" />);
    expect(screen.getByText('Lượt của Ana')).toBeInTheDocument();

    render(
      <GameOverDialog
        view={makeView('pilot', { patch: { phase: 'lost', round: 3, endReason: 'spin' } })}
        presence={presence()}
        rematch={NO_OFFER}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Rơi máy bay' });
    expect(within(dialog).getByText('Vòng 3 · 4.000 ft')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Bay lại' })).toBeInTheDocument();
  });
});
