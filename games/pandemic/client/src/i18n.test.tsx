import { CITIES, createGame, viewFor, type PandemicView } from '@pandemic/rules';
import { setLanguage } from '@platform/ui/i18n';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi as vitest } from 'vitest';
import { ActionBar } from './components/ActionBar';
import { RoleCards } from './components/RoleCards';
import { WorldMap } from './components/WorldMap';
import en from './locales/en.json';
import fr from './locales/fr.json';
import vi from './locales/vi.json';
import { cityName, labelLines } from './lib/names';
import { errorText } from './messages';

vitest.mock('./platform', () => ({ platform: () => ({ send: vitest.fn() }) }));

/** Every text with its full key (plural endings included). */
function texts(tree: object, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    value && typeof value === 'object'
      ? texts(value as object, `${prefix}${key}.`)
      : [[`${prefix}${key}`, String(value)] as [string, string]],
  );
}
/** The keys without plural endings (Vietnamese has no plural forms). */
const keys = (tree: object) =>
  new Set(texts(tree).map(([key]) => key.replace(/_(zero|one|two|few|many|other)$/, '')));
const marks = (s: string) => (s.match(/\{\{\w+\}\}|<\/?\w+>/g) ?? []).sort().join(' ');

const presence = {
  p1: { name: 'Ana', online: true, creator: true },
  p2: { name: 'Ben', online: true, creator: false },
  p3: { name: 'Cleo', online: true, creator: false },
};

function view(): PandemicView {
  const game = createGame({ seats: ['p1', 'p2', 'p3'], epidemics: 4, seed: 1 });
  game.roles = { p1: 'medic', p2: 'z-force-team-member', p3: 'teacher' };
  game.turn = { ...game.turn, seat: 'p1', pawn: 'p1', actionsLeft: 4, step: 'actions' };
  return viewFor(game, 'p1');
}

afterEach(() => setLanguage('en'));

describe("Pandemic's texts", () => {
  it.each([
    ['Vietnamese', vi],
    ['French', fr],
  ])('has a %s text for every English key, and nothing extra', (_name, other) => {
    const english = keys(en);
    const translated = keys(other);
    expect([...english].filter((k) => !translated.has(k))).toEqual([]);
    expect([...translated].filter((k) => !english.has(k))).toEqual([]);
  });

  it.each([
    ['Vietnamese', vi],
    ['French', fr],
  ])('keeps every placeholder of the English text in %s', (_name, other) => {
    const english = new Map(texts(en));
    for (const [key, text] of texts(other)) {
      expect(marks(text), key).toBe(marks(english.get(key) ?? ''));
    }
  });

  it('gives French its plural forms, as English has them', () => {
    const plural = (tree: object) =>
      Object.keys(Object.fromEntries(texts(tree))).length &&
      JSON.stringify(tree).match(/_one"/g)?.length;
    expect(plural(fr)).toBe(plural(en));
  });

  it('writes French with typographic apostrophes and French spacing', () => {
    for (const [key, text] of texts(fr)) {
      expect(text.includes("'"), `${key}: straight apostrophe`).toBe(false);
      expect(/ [:;!?]/.test(text), `${key}: plain space before : ; ! ?`).toBe(false);
    }
  });

  it('names all 48 cities in each language, short enough to wrap in two lines', () => {
    for (const tree of [en, vi, fr]) {
      for (const { id } of CITIES) {
        const name = tree.cities[id];
        expect(name, id).toBeTruthy();
        expect(
          labelLines(name).every((line) => line.length <= 12),
          `${id}: ${name}`,
        ).toBe(true);
      }
    }
  });

  it('wraps long names at a space or hyphen, and leaves short ones alone', () => {
    expect(labelLines('Paris')).toEqual(['Paris']);
    expect(labelLines('Ho Chi Minh City')).toEqual(['Ho Chi', 'Minh City']);
    expect(labelLines('St-Pétersbourg')).toEqual(['St-', 'Pétersbourg']);
  });
});

describe('Vietnamese', () => {
  it('shows the roles, actions and cities in Vietnamese', () => {
    setLanguage('vi');
    render(<RoleCards view={view()} presence={presence} />);
    expect(screen.getByLabelText('Nhân viên y tế làm được gì')).toBeInTheDocument();
    expect(screen.getByLabelText('Thành viên Z-Force làm được gì')).toBeInTheDocument();
    expect(cityName('beijing')).toBe('Bắc Kinh');
    expect(cityName('ho-chi-minh-city')).toBe('TP. Hồ Chí Minh');
    expect(errorText('not-your-turn')).toBe('Chưa đến lượt bạn.');
    expect(errorText('too-many-cubes')).toBe('Chỉ mang theo được tối đa 3 khối.');
  });

  it('labels the map and every city in Vietnamese', () => {
    setLanguage('vi');
    const { container } = render(<WorldMap />);
    expect(container.querySelector('svg[aria-label="Bản đồ"]')).not.toBeNull();
    expect(container.querySelector('[data-city="moscow"]')?.textContent).toBe('Mát-xcơ-va');
  });

  it('puts the action bar in Vietnamese', () => {
    setLanguage('vi');
    render(<ActionBar view={view()} presence={presence} />);
    expect(screen.getByText('Còn 4 hành động')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bỏ lượt' })).toBeInTheDocument();
  });
});

describe('French', () => {
  it('shows the roles, actions and cities in French, with French spacing', () => {
    setLanguage('fr');
    render(<RoleCards view={view()} presence={presence} />);
    // The texts hold a no-break space before the colon; \s matches it.
    expect(screen.getByLabelText(/^Médecin\s:\spouvoir$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Membre de la Z-Force\s:\spouvoir$/)).toBeInTheDocument();
    expect(screen.getByText(/^Élèves\s:\s0 \/ 2$/)).toBeInTheDocument();
    expect(cityName('cairo')).toBe('Le Caire');
    expect(cityName('st-petersburg')).toBe('St-Pétersbourg');
    expect(errorText('not-your-turn')).toBe('Ce n’est pas votre tour.');
  });

  it('labels the map and the cities in French', () => {
    setLanguage('fr');
    const { container } = render(<WorldMap />);
    expect(container.querySelector('svg[aria-label="Carte du monde"]')).not.toBeNull();
    expect(container.querySelector('[data-city="london"]')?.textContent).toBe('Londres');
  });

  it('puts the action bar in French', () => {
    setLanguage('fr');
    render(<ActionBar view={view()} presence={presence} />);
    expect(screen.getByText('4 actions restantes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeInTheDocument();
  });
});
