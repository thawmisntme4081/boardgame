import en from '@platform/ui/locales/en.json';
import fr from '@platform/ui/locales/fr.json';
import vi from '@platform/ui/locales/vi.json';
import i18n, { setLanguage } from '@platform/ui/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi as vitest } from 'vitest';
import { errorText } from './messages';
import { loadGame } from './games';
import { renderAt, resetStore } from './test/fixtures';

vitest.mock('./api', () => ({
  createRoom: vitest.fn(async () => true),
  joinRoom: vitest.fn(async () => true),
  leaveGame: vitest.fn(),
  shareInvite: vitest.fn(async () => {}),
  setNavigate: vitest.fn(),
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

// The game's module is a separate chunk: transformed once, up front (slow on a cold run).
beforeAll(() => loadGame('sky-team'), 60_000);

beforeEach(resetStore);
afterEach(() => setLanguage('en'));

describe("the platform's texts", () => {
  it.each([
    ['Vietnamese', vi],
    ['French', fr],
  ])('has a %s text for every English key, and nothing extra', (_name, other) => {
    const english = keys(en);
    const translated = keys(other);
    expect([...english].filter((k) => !translated.has(k))).toEqual([]);
    expect([...translated].filter((k) => !english.has(k))).toEqual([]);
  });

  it('starts in English whatever the browser language', () => {
    expect(i18n.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('translates platform errors from their codes', () => {
    setLanguage('vi');
    expect(errorText('room-not-found')).toBe('Không có ván nào với mã này.');
    expect(errorText('made-up-code')).toBe('Đã có lỗi xảy ra.');
    setLanguage('fr');
    expect(errorText('room-not-found')).toBe('Aucune partie avec ce code.');
  });
});

describe('switching language', () => {
  it('updates the page at once, remembers the choice and sets <html lang>', async () => {
    await renderAt('/play/sky-team');
    expect(await screen.findByRole('button', { name: 'Create a game' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Language' }));
    await userEvent.click(screen.getByRole('option', { name: 'Tiếng Việt' }));
    expect(screen.getByRole('button', { name: 'Tạo ván mới' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tên')).toBeInTheDocument();
    // The game's own options switch too: they share the one i18n instance.
    expect(screen.getByRole('switch', { name: /Đồng hồ mỗi vòng/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('vi');
    expect(localStorage.getItem('sky-team-language')).toBe('vi');
  });

  it('is offered in French too', async () => {
    await renderAt('/');
    await userEvent.click(screen.getByRole('combobox', { name: 'Language' }));
    await userEvent.click(screen.getByRole('option', { name: 'Français' }));
    expect(screen.getByRole('heading', { name: 'Jeux de société' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr');
  });
});
