import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi as vitest } from 'vitest';
import { GameOverDialog } from '@/components/GameOverDialog';
import { StatusBar } from '@/components/StatusBar';
import i18n, { setLanguage } from '@/i18n';
import en from '@/locales/en.json';
import vi from '@/locales/vi.json';
import { endReasonText, errorText } from '@/messages';
import { Lobby } from '@/screens/Lobby';
import { makeView, presence, resetStore } from '@/test/fixtures';

vitest.mock('@/api', () => ({
  createRoom: vitest.fn(async () => true),
  joinRoom: vitest.fn(async () => true),
  leaveGame: vitest.fn(),
  rematch: vitest.fn(async () => true),
  shareInvite: vitest.fn(async () => {}),
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

describe('translations', () => {
  it('has a Vietnamese text for every English key, and nothing extra', () => {
    const english = keys(en);
    const vietnamese = keys(vi);
    expect([...english].filter((k) => !vietnamese.has(k))).toEqual([]);
    expect([...vietnamese].filter((k) => !english.has(k))).toEqual([]);
  });

  it('starts in English whatever the browser language', () => {
    expect(i18n.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('translates rule errors and end reasons from their codes', () => {
    setLanguage('vi');
    expect(errorText('not-your-turn')).toBe('Hãy chờ đồng đội đặt xúc xắc.');
    expect(errorText('made-up-code')).toBe('Đã có lỗi xảy ra.');
    expect(endReasonText('spin')).toBe('Trục nghiêng quá mức: máy bay rơi vào vòng xoáy.');
  });
});

describe('switching language', () => {
  it('updates the lobby at once, remembers the choice and sets <html lang>', async () => {
    render(<Lobby />);
    expect(screen.getByRole('button', { name: 'Create a game' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Language' }));
    await userEvent.click(screen.getByRole('option', { name: 'Tiếng Việt' }));
    expect(screen.getByRole('button', { name: 'Tạo ván mới' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tên')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('vi');
    expect(localStorage.getItem('sky-team-language')).toBe('vi');
  });

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
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Rơi máy bay' });
    expect(within(dialog).getByText('Vòng 3 · 4.000 ft')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Bay lại' })).toBeInTheDocument();
  });
});
