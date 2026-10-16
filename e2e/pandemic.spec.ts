import { CITIES, CUBES_PER_COLOR, type Color } from '@pandemic/rules';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { deviceOptions, setGame } from './helpers';

/** Every city with no cubes, so a test can put a stack on just the one it cares about. */
function noCubes(): Record<string, Record<Color, number>> {
  return Object.fromEntries(CITIES.map(({ id }) => [id, { blue: 0, yellow: 0, black: 0, red: 0 }]));
}

// Pandemic is a desktop game: no phone profiles.
test.skip(({ isMobile }) => isMobile, 'desktop only');

const NAMES = ['Ana', 'Ben', 'Cleo', 'Dee'] as const;

/**
 * Ana creates a game for `players` (with the lobby's other choices), the others join through the
 * invite link; every page then shows the "before the game" step.
 */
async function seatPlayers(
  browser: Browser,
  device: ReturnType<typeof deviceOptions>,
  players: 2 | 3 | 4,
  options: {
    difficulty?: 'Introductory' | 'Standard' | 'Heroic';
    roles?: 'Random' | 'Choose';
    /** Watch the deal being played (about 10 s); by default it is skipped (reduced motion). */
    deal?: boolean;
  } = {},
) {
  const context = { ...device, reducedMotion: options.deal ? 'no-preference' : 'reduce' } as const;
  const pages: Page[] = [];
  for (let i = 0; i < players; i++) pages.push(await (await browser.newContext(context)).newPage());
  const [ana, ...others] = pages as [Page, ...Page[]];

  await ana.goto('/play/pandemic');
  await ana.getByLabel('Your name').fill('Ana');
  await ana.getByRole('radio', { name: String(players), exact: true }).click();
  if (options.difficulty) await ana.getByRole('radio', { name: options.difficulty }).click();
  if (options.roles) await ana.getByRole('radio', { name: options.roles }).click();
  await ana.getByRole('button', { name: 'Create a game' }).click();
  const missing = players - 1;
  await expect(
    ana.getByText(`Waiting for ${missing} more ${missing === 1 ? 'player' : 'players'}`),
  ).toBeVisible();
  const code = (await ana.getByLabel(/^Game code/).textContent())!.trim();

  for (const [i, page] of others.entries()) {
    await page.goto(`/r/${code}`);
    await expect(page.getByLabel('Game code')).toHaveValue(code);
    await page.getByLabel('Your name').fill(NAMES[i + 1]!);
    await page.getByRole('button', { name: 'Join' }).click();
  }
  for (const page of pages) {
    await expect(page.getByRole('heading', { name: 'Before the game' })).toBeVisible();
  }
  return { pages, code };
}

/** Everyone confirms the "before the game" step; the board is dealt for all of them. */
async function confirmAll(pages: Page[]) {
  for (const page of pages) await page.getByRole('button', { name: 'Confirm and start' }).click();
  for (const page of pages) {
    await expect(page.locator('[data-role][aria-current="true"]')).toHaveCount(1);
  }
}

/** Ana creates a 3-player game, Ben and Cleo join through the invite link; roles dealt at random. */
async function startThreePlayers(browser: Browser, device: ReturnType<typeof deviceOptions>) {
  const { pages, code } = await seatPlayers(browser, device, 3);
  await confirmAll(pages);
  const [ana, ben, cleo] = pages as [Page, Page, Page];
  return { ana, ben, cleo, code };
}

test.describe('a three-player Pandemic game', () => {
  test('is won by discovering the fourth cure', async ({ browser, request }, testInfo) => {
    const { ana, ben, cleo, code } = await startThreePlayers(
      browser,
      deviceOptions(testInfo.project.use),
    );

    // Everyone sees the same table: three hands, and a turn that is someone's.
    for (const page of [ana, ben, cleo]) {
      await expect(page.getByRole('region', { name: 'Hands' })).toBeVisible();
      // Whose turn it is is shown on a role card; only the active player has the actions.
      await expect(page.locator('[data-role][aria-current="true"]')).toHaveCount(1);
    }

    // A prepared position: three diseases cured, Ana (seat p1) in Atlanta, which has a research
    // station, with five yellow cards in hand; the other two have no cards.
    await setGame(request, code, {
      turn: {
        seat: 'p1',
        actionsLeft: 4,
        step: 'actions',
        epidemics: 0,
        epidemicStep: 'increase',
        infectionsLeft: 0,
        pawn: 'p1',
      },
      pending: null,
      pawns: { p1: 'atlanta', p2: 'atlanta', p3: 'atlanta' },
      stations: ['atlanta'],
      cures: { blue: 'cured', black: 'cured', red: 'cured', yellow: 'none' },
      hands: {
        p1: ['bogota', 'lima', 'lagos', 'kinshasa', 'khartoum'].map((city) => ({
          kind: 'city',
          city,
        })),
        p2: [],
        p3: [],
      },
    });

    // Only Ana can act, and only she gets the cure button enabled.
    await expect(ana.getByText(/actions left/)).toBeVisible();
    await expect(ben.locator('[data-role][aria-current="true"]')).toContainText('Ana');
    await expect(ben.getByRole('alert', { name: 'Actions' })).toHaveCount(0);
    await expect(ben.getByRole('button', { name: 'Cure: Yellow' })).toHaveCount(0);
    await expect(ana.getByRole('button', { name: 'Cure: Yellow' })).toBeEnabled();

    await ana.getByRole('button', { name: 'Cure: Yellow' }).click();
    for (const page of [ana, ben, cleo]) {
      await expect(page.getByRole('heading', { name: 'Humanity is saved' })).toBeVisible();
      await expect(
        page.getByRole('dialog').getByText('You cured all four diseases. You win!'),
      ).toBeVisible();
    }

    // Play again needs all three: Ana offers, Ben and Cleo accept, then a new game starts.
    await ana.getByRole('button', { name: 'Play again' }).click();
    await expect(ben.getByText('Ana wants to play again.')).toBeVisible();
    await ben.getByRole('button', { name: 'Play again' }).click();
    await expect(ana.getByText(/Waiting for Cleo/)).toBeVisible();
    await cleo.getByRole('button', { name: 'Play again' }).click();
    // A new game starts with the "before the game" step again (a new turn order, new roles).
    for (const page of [ana, ben, cleo]) {
      await expect(page.getByRole('heading', { name: 'Humanity is saved' })).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Before the game' })).toBeVisible();
    }
    await confirmAll([ana, ben, cleo]);
    for (const page of [ana, ben, cleo]) {
      await expect(page.locator('[data-role][aria-current="true"]')).toHaveCount(1);
    }
  });

  test('plays a turn through the board: pass, draw, infect, then the next player', async ({
    browser,
  }, testInfo) => {
    const { ana, ben, cleo } = await startThreePlayers(
      browser,
      deviceOptions(testInfo.project.use),
    );
    const pages = [ana, ben, cleo];

    // Whoever's turn it is (the order is random) plays it: pass the actions, draw, infect.
    const turnOf = async () => {
      for (let i = 0; i < 3; i++) {
        if (await pages[i]!.getByText(/actions left/).isVisible()) return i;
      }
      throw new Error('nobody has the turn');
    };
    const first = await turnOf();
    const active = pages[first]!;
    await active.getByRole('button', { name: 'Pass' }).click();
    await active.getByRole('button', { name: 'Draw cards' }).click();
    // The draw is made: the draw button is gone, and the step goes on (epidemics, infections).
    await expect(active.getByRole('button', { name: 'Draw cards' })).toHaveCount(0);

    // Epidemics and the infect step are one press per step, until the turn passes on.
    for (let i = 0; i < 12; i++) {
      if ((await active.getByText(/actions left/).count()) === 0) break;
      const epidemic = active.getByRole('button', { name: /^Epidemic:/ });
      const infect = active.getByRole('button', { name: 'Infect', exact: true });
      // A button can vanish between looking and clicking when the turn passes: a short wait.
      if (await epidemic.isVisible()) await epidemic.click({ timeout: 1500 }).catch(() => {});
      else if (await infect.isVisible()) await infect.click({ timeout: 1500 }).catch(() => {});
      else break;
    }
    // The turn is now someone else's: their actions left are gone.
    await expect(active.getByText(/actions left/)).toHaveCount(0);
  });

  test('the Dispatcher moves the Medic, who clears a cured city; the Medic then treats a stack at once', async ({
    browser,
    request,
  }, testInfo) => {
    const { ana, ben, code } = await startThreePlayers(
      browser,
      deviceOptions(testInfo.project.use),
    );

    // Ana is the Dispatcher, Ben the Medic. Blue is cured, and Chicago (blue) has 3 cubes of it;
    // Ana holds Chicago's card to pay for a Direct Flight of Ben's pawn there.
    await setGame(request, code, {
      turn: {
        seat: 'p1',
        actionsLeft: 4,
        step: 'actions',
        epidemics: 0,
        epidemicStep: 'increase',
        infectionsLeft: 0,
        pawn: 'p1',
      },
      pending: null,
      roles: { p1: 'dispatcher', p2: 'medic', p3: 'researcher' },
      pawns: { p1: 'atlanta', p2: 'miami', p3: 'atlanta' },
      stations: ['atlanta'],
      cures: { blue: 'cured', yellow: 'none', black: 'none', red: 'none' },
      cubes: { ...noCubes(), chicago: { blue: 3, yellow: 0, black: 0, red: 0 } },
      supply: {
        blue: CUBES_PER_COLOR - 3,
        yellow: CUBES_PER_COLOR,
        black: CUBES_PER_COLOR,
        red: CUBES_PER_COLOR,
      },
      hands: { p1: [{ kind: 'city', city: 'chicago' }], p2: [], p3: [] },
      contingency: null,
    });

    // The Dispatcher picks Ben's pawn to move, then flies it to Chicago.
    await expect(ana.getByText(/4 actions left/)).toBeVisible();
    await ana
      .getByRole('group', { name: 'Pawn to move' })
      .getByRole('button', { name: 'Ben' })
      .click();
    await ana.locator('[data-city="chicago"]').click();
    const menu = ana.getByRole('menu', { name: 'Move Ben to Chicago' });
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Direct Flight' }).click();

    // Ben answers the offer; accepting moves his pawn and clears the cured cubes at once.
    await expect(ben.getByText('Ana offers to move Ben to Chicago.')).toBeVisible();
    await ben.getByRole('button', { name: 'Accept' }).click();
    await expect(ben.getByText('Ana offers to move Ben to Chicago.')).toBeHidden();
    await expect(ana.getByText(/3 actions left/)).toBeVisible();
    await expect(ben.locator('[data-supply="blue"]')).toContainText(String(CUBES_PER_COLOR));

    // Now it is Ben's turn, in Chicago, with a stack of 3 yellow cubes: treating it as the
    // Medic removes the whole stack in one action, not just one cube.
    await setGame(request, code, {
      turn: {
        seat: 'p2',
        actionsLeft: 4,
        step: 'actions',
        epidemics: 0,
        epidemicStep: 'increase',
        infectionsLeft: 0,
        pawn: 'p2',
      },
      pending: null,
      pawns: { p1: 'atlanta', p2: 'chicago', p3: 'atlanta' },
      cubes: { ...noCubes(), chicago: { blue: 0, yellow: 3, black: 0, red: 0 } },
      supply: {
        blue: CUBES_PER_COLOR,
        yellow: CUBES_PER_COLOR - 3,
        black: CUBES_PER_COLOR,
        red: CUBES_PER_COLOR,
      },
      hands: { p1: [], p2: [], p3: [] },
    });

    await expect(ben.getByRole('button', { name: 'Treat Yellow' })).toBeVisible();
    await ben.getByRole('button', { name: 'Treat Yellow' }).click();
    await expect(ben.getByRole('button', { name: 'Treat Yellow' })).toHaveCount(0);
    await expect(ben.getByText(/3 actions left/)).toBeVisible();
    await expect(ana.locator('[data-supply="yellow"]')).toContainText(String(CUBES_PER_COLOR));
  });
  /** Ana's turn, in its actions step, with the given hands; no one holds anything else. */
  const anasTurn = {
    turn: {
      seat: 'p1',
      actionsLeft: 4,
      step: 'actions',
      epidemics: 0,
      epidemicStep: 'increase',
      infectionsLeft: 0,
      pawn: 'p1',
      flightUsed: false,
      epidemicsResolved: 0,
    },
    pending: null,
    roles: { p1: 'medic', p2: 'researcher', p3: 'scientist' },
    pawns: { p1: 'atlanta', p2: 'atlanta', p3: 'atlanta' },
    stations: ['atlanta'],
    contingency: null,
    quietNight: false,
  };

  test('a Teacher creates a student, then uses it for a turn: the choice is fixed until the turn ends', async ({
    browser,
    request,
  }, testInfo) => {
    const { ana, ben, code } = await startThreePlayers(
      browser,
      deviceOptions(testInfo.project.use),
    );
    const turn = {
      seat: 'p1',
      actionsLeft: 4,
      step: 'actions',
      epidemics: 0,
      epidemicStep: 'increase',
      infectionsLeft: 0,
      pawn: 'p1',
      flightUsed: false,
      epidemicsResolved: 0,
    };

    // Ana is the Teacher, with no student yet: her turn starts with the teacher pawn.
    await setGame(request, code, {
      turn,
      pending: null,
      roles: { p1: 'teacher', p2: 'medic', p3: 'researcher' },
      pawns: { p1: 'atlanta', p2: 'atlanta', p3: 'atlanta' },
      stations: ['atlanta'],
      cubes: noCubes(),
      hands: { p1: [], p2: [], p3: [] },
      contingency: null,
    });
    await expect(ana.getByText(/4 actions left/)).toBeVisible();
    await expect(ana.getByRole('group', { name: 'Choose the pawn for this turn' })).toHaveCount(0);

    // Creating a student is an action; both players see the new pawn and the count on the card.
    await ana.getByRole('button', { name: 'Create a student' }).click();
    await expect(ana.getByText(/3 actions left/)).toBeVisible();
    await expect(ben.locator('[data-pawn="p1-s1"]')).toBeVisible();
    await expect(ben.getByText('Students: 1 / 2')).toBeVisible();

    // Her next turn: the student is in Chicago, where 2 blue cubes are; the teacher is in Atlanta.
    await setGame(request, code, {
      turn: { ...turn, pawn: null },
      pawns: { p1: 'atlanta', 'p1-s1': 'chicago', p2: 'atlanta', p3: 'atlanta' },
      cubes: { ...noCubes(), chicago: { blue: 2, yellow: 0, black: 0, red: 0 } },
      supply: {
        blue: CUBES_PER_COLOR - 2,
        yellow: CUBES_PER_COLOR,
        black: CUBES_PER_COLOR,
        red: CUBES_PER_COLOR,
      },
    });

    // No action works before the choice.
    const choice = ana.getByRole('group', { name: 'Choose the pawn for this turn' });
    await expect(choice).toBeVisible();
    await expect(ana.getByRole('button', { name: 'Treat Blue' })).toHaveCount(0);
    await expect(ana.getByRole('button', { name: 'Create a student' })).toHaveCount(0);

    // Choosing the student: the actions are now the student's, in Chicago.
    await choice.getByRole('button', { name: 'Student 1 in Chicago' }).click();
    await expect(choice).toHaveCount(0);
    await expect(ana.getByText('This turn: Student 1 in Chicago')).toBeVisible();
    await ana.getByRole('button', { name: 'Treat Blue' }).click();
    await expect(ana.getByText(/3 actions left/)).toBeVisible();
    await expect(ben.locator('[data-supply="blue"]')).toContainText(String(CUBES_PER_COLOR - 1));

    // The choice holds for the rest of the turn: the other pawn cannot be picked, and a student
    // cannot create a student.
    await expect(choice).toHaveCount(0);
    await expect(ana.getByRole('button', { name: 'Create a student' })).toHaveCount(0);
    await expect(ana.getByText('This turn: Student 1 in Chicago')).toBeVisible();
  });

  test("a Relocation Specialist takes two cubes and a pawn along; the pawn's owner agrees first", async ({
    browser,
    request,
  }, testInfo) => {
    const { ana, ben, code } = await startThreePlayers(
      browser,
      deviceOptions(testInfo.project.use),
    );

    // Ana is the Relocation Specialist in Atlanta, with 3 blue cubes there and Ben's pawn.
    await setGame(request, code, {
      ...anasTurn,
      roles: { p1: 'relocation-specialist', p2: 'researcher', p3: 'scientist' },
      pawns: { p1: 'atlanta', p2: 'atlanta', p3: 'miami' },
      cubes: { ...noCubes(), atlanta: { blue: 3, yellow: 0, black: 0, red: 0 } },
      supply: {
        blue: CUBES_PER_COLOR - 3,
        yellow: CUBES_PER_COLOR,
        black: CUBES_PER_COLOR,
        red: CUBES_PER_COLOR,
      },
      hands: { p1: [], p2: [], p3: [] },
    });
    await expect(ana.getByText(/4 actions left/)).toBeVisible();

    // She chooses two blue cubes and Ben, then drives to Chicago.
    const along = ana.getByRole('group', { name: 'Take along' });
    await along.getByRole('button', { name: 'One more Blue cube' }).click();
    await along.getByRole('button', { name: 'One more Blue cube' }).click();
    await expect(along.getByText('2 / 3 cubes')).toBeVisible();
    await along.getByRole('button', { name: 'Take Ben' }).click();
    await ana.locator('[data-city="chicago"]').click();
    await ana
      .getByRole('menu', { name: 'Fly to Chicago' })
      .getByRole('button', { name: 'Drive / Ferry' })
      .click();

    // Nothing moves until Ben agrees.
    await expect(
      ben.getByText('Ana offers to take Ben along to Chicago. 2 cubes come along.'),
    ).toBeVisible();
    await expect(ben.locator('[data-cube-city="atlanta"]')).toHaveCount(3);
    await ben.getByRole('button', { name: 'Accept' }).click();

    // Both pawns and two cubes are in Chicago; one cube stayed in Atlanta; one action spent.
    await expect(ana.getByText(/3 actions left/)).toBeVisible();
    for (const page of [ana, ben]) {
      await expect(page.locator('[data-cube-city="chicago"]')).toHaveCount(2);
      await expect(page.locator('[data-cube-city="atlanta"]')).toHaveCount(1);
    }
  });

  test("a Generalist's turn starts with 5 actions", async ({ browser, request }, testInfo) => {
    const { ana, ben, code } = await startThreePlayers(
      browser,
      deviceOptions(testInfo.project.use),
    );

    // Ana's last infection is due; Ben, the Generalist, plays next.
    await setGame(request, code, {
      ...anasTurn,
      seats: ['p1', 'p2', 'p3'],
      turn: { ...anasTurn.turn, actionsLeft: 0, step: 'infect', infectionsLeft: 1 },
      roles: { p1: 'medic', p2: 'generalist', p3: 'scientist' },
      cubes: noCubes(),
      hands: { p1: [], p2: [], p3: [] },
    });
    await ana.getByRole('button', { name: 'Infect', exact: true }).click();
    await expect(ben.getByText('5 actions left')).toBeVisible();
  });

  test("a Z-Force Team Member cures with two of a partner's cards once the partner agrees", async ({
    browser,
    request,
  }, testInfo) => {
    const { ana, ben, cleo, code } = await startThreePlayers(
      browser,
      deviceOptions(testInfo.project.use),
    );
    const blue = (...cities: string[]) => cities.map((city) => ({ kind: 'city', city }));

    // Ana (Z-Force) and Ben are at Atlanta's station; Cleo, in Miami, cannot help.
    await setGame(request, code, {
      ...anasTurn,
      roles: { p1: 'z-force-team-member', p2: 'researcher', p3: 'scientist' },
      pawns: { p1: 'atlanta', p2: 'atlanta', p3: 'miami' },
      cubes: noCubes(),
      hands: {
        p1: blue('chicago', 'montreal', 'new-york'),
        p2: blue('london', 'madrid'),
        p3: blue('paris'),
      },
    });

    await ana.getByRole('button', { name: 'Cure: Blue' }).click();
    for (const city of ['Chicago', 'Montreal', 'New York', 'London (Ben)', 'Madrid (Ben)']) {
      await ana.getByRole('button', { name: city, exact: true }).click();
    }
    await expect(ana.getByRole('button', { name: 'Paris (Cleo)' })).toHaveCount(0);
    await ana.getByRole('button', { name: 'Discover the cure' }).click();

    // Nothing happens until Ben agrees; Cleo is not asked.
    await expect(
      ben.getByText('Ana asks to use London (Ben), Madrid (Ben) to cure Blue.', { exact: false }),
    ).toBeVisible();
    await expect(cleo.getByRole('button', { name: 'Give the cards' })).toHaveCount(0);
    await expect(ana.locator('[data-cure="blue"]')).toHaveCount(0);
    await ben.getByRole('button', { name: 'Give the cards' }).click();

    for (const page of [ana, ben, cleo]) {
      await expect(page.locator('[data-cure="blue"]')).toHaveCount(1);
    }
    await expect(ana.getByText(/3 actions left/)).toBeVisible();
  });

  test("an event is played during someone else's turn: Ben's Government Grant on Ana's turn", async ({
    browser,
    request,
  }, testInfo) => {
    const { ana, ben, cleo, code } = await startThreePlayers(
      browser,
      deviceOptions(testInfo.project.use),
    );
    await setGame(request, code, {
      ...anasTurn,
      hands: { p1: [], p2: [{ kind: 'event', event: 'government-grant' }], p3: [] },
    });

    // Only the player holding the card has a button for it, and it works out of turn: Ben's
    // action bar holds only that button (no actions left, it is not his turn).
    await expect(ana.getByText(/actions left/)).toBeVisible();
    // Anyone may play anyone's card: Ana sees Ben's card too, named as his.
    await expect(
      ana.getByRole('button', { name: "Play Government Grant · Ben's card" }),
    ).toBeEnabled();
    const events = ben.getByRole('alert', { name: 'Actions' });
    await expect(events.getByText(/actions left/)).toHaveCount(0);
    await expect(events.getByRole('button', { name: 'Play Government Grant' })).toBeEnabled();
    await events.getByRole('button', { name: 'Play Government Grant' }).click();

    // The grant asks for a city on the map: a station goes up in Tokyo for everyone.
    await expect(events.getByText(/tap the city for the new station/)).toBeVisible();
    await ben.locator('[data-city="tokyo"]').click();
    for (const page of [ana, ben, cleo]) {
      await expect(page.locator('[data-station="tokyo"]')).toBeVisible();
    }

    // The others are told, and Ana's turn was not touched.
    for (const page of [ana, cleo]) {
      await expect(
        page.locator('[data-sonner-toast]').getByText('Ben played Government Grant.'),
      ).toBeVisible();
    }
    await expect(ana.getByText(/actions left/)).toBeVisible();
    await expect(ana.getByText(/4 actions left/)).toBeVisible();
    await expect(ben.getByRole('alert', { name: 'Actions' })).toHaveCount(0);
  });

  test("Forecast is arranged in private, and its order is the next infection's", async ({
    browser,
    request,
  }, testInfo) => {
    const { ana, ben, cleo, code } = await startThreePlayers(
      browser,
      deviceOptions(testInfo.project.use),
    );
    await setGame(request, code, {
      ...anasTurn,
      infectionDeck: ['tokyo', 'paris', 'seoul', 'osaka', 'london', 'essen', 'milan'],
      infectionDiscard: [],
      hands: { p1: [], p2: [], p3: [{ kind: 'event', event: 'forecast' }] },
    });

    await expect(ana.getByText(/actions left/)).toBeVisible();
    await cleo.getByRole('button', { name: 'Play Forecast' }).click();

    // Cleo alone sees the top 6 in a dialog; the others only hear that she is arranging them.
    const dialog = cleo.getByRole('dialog', { name: 'Forecast' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Tokyo')).toBeVisible();
    for (const page of [ana, ben]) {
      await expect(page.getByText('Cleo is arranging the top 6 infection cards.')).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Move .* (up|down)$/ })).toHaveCount(0);
    }

    // Nothing else can happen meanwhile: Ana's actions are gone until the order is kept.
    await expect(ana.getByRole('button', { name: 'Pass' })).toHaveCount(0);

    // Tokyo (red) moves down one place, so Paris (blue) is next.
    await dialog.getByRole('button', { name: 'Move Tokyo down' }).click();
    await expect(dialog.getByRole('listitem').first()).toContainText('Paris');
    await dialog.getByRole('button', { name: 'Keep this order' }).click();
    for (const page of [ana, ben, cleo]) {
      await expect(page.getByText(/is arranging/)).toHaveCount(0);
    }
    await expect(cleo.getByRole('dialog')).toHaveCount(0);

    // The next infection card flipped is Paris: on an empty map, one blue cube appears.
    await setGame(request, code, {
      turn: {
        ...anasTurn.turn,
        actionsLeft: 0,
        step: 'infect',
        infectionsLeft: 1,
      },
      cubes: noCubes(),
    });
    await ana.getByRole('button', { name: 'Infect', exact: true }).click();
    await expect(ben.locator('[data-cube="blue"]')).toHaveCount(1);
    await expect(ben.locator('[data-cube="red"]')).toHaveCount(0);
  });

  test('Restart turn takes back the actions of the turn until the cards are drawn', async ({
    browser,
    request,
  }, testInfo) => {
    const { ana, ben, cleo, code } = await startThreePlayers(
      browser,
      deviceOptions(testInfo.project.use),
    );
    await setGame(request, code, { ...anasTurn, hands: { p1: [], p2: [], p3: [] } });
    const bar = ana.getByRole('alert', { name: 'Actions' });
    await expect(bar.getByText('4 actions left')).toBeVisible();
    // Nothing to take back yet.
    await expect(bar.getByRole('button', { name: 'Restart turn' })).toHaveCount(0);

    // Pass gives up the actions: the cards can be drawn, or the turn restarted.
    await bar.getByRole('button', { name: 'Pass' }).click();
    await expect(bar.getByRole('button', { name: 'Draw cards' })).toBeVisible();
    await expect(bar.getByText('0 actions left')).toBeVisible();
    await bar.getByRole('button', { name: 'Restart turn' }).click();
    await expect(bar.getByText('4 actions left')).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Draw cards' })).toHaveCount(0);
    await expect(bar.getByRole('button', { name: 'Restart turn' })).toHaveCount(0);

    // Once the cards are drawn it is too late, and the others never get the button.
    await bar.getByRole('button', { name: 'Pass' }).click();
    await expect(ben.getByRole('button', { name: 'Restart turn' })).toHaveCount(0);
    await expect(cleo.getByRole('button', { name: 'Restart turn' })).toHaveCount(0);
    await bar.getByRole('button', { name: 'Draw cards' }).click();
    await expect(bar.getByRole('button', { name: 'Restart turn' })).toHaveCount(0);
  });
});

test.describe('before the game', () => {
  test('a 2-player game: the turn order and roles are shown, and everyone confirms', async ({
    browser,
  }, testInfo) => {
    const { pages } = await seatPlayers(browser, deviceOptions(testInfo.project.use), 2);
    for (const page of pages) {
      await expect(page.getByText(/4 epidemic cards · roles dealt at random/)).toBeVisible();
      // Both roles are dealt already, for everyone to see, with the player's name on each.
      await expect(page.locator('[data-role]')).toHaveCount(2);
      await expect(page.getByLabel('Ready')).toHaveCount(0);
    }
    const [ana, ben] = pages as [Page, Page];
    await ana.getByRole('button', { name: 'Confirm and start' }).click();
    // A check appears next to Ana's name, for both players.
    for (const page of pages) {
      await expect(
        page.locator('[data-role]').filter({ hasText: 'Ana' }).getByLabel('Ready'),
      ).toBeVisible();
      await expect(page.getByLabel('Ready')).toHaveCount(1);
    }
    // Her confirm can be taken back: the check goes, and she can confirm again.
    await expect(ana.getByRole('button', { name: 'Confirm and start' })).toHaveCount(0);
    await ana.getByRole('button', { name: 'Undo' }).click();
    for (const page of pages) await expect(page.getByLabel('Ready')).toHaveCount(0);
    await ana.getByRole('button', { name: 'Confirm and start' }).click();
    await expect(ana.getByRole('button', { name: 'Undo' })).toBeVisible();
    await ben.getByRole('button', { name: 'Confirm and start' }).click();
    for (const page of pages) {
      await expect(page.locator('[data-role][aria-current="true"]')).toHaveCount(1);
      await expect(page.getByRole('region', { name: 'Roles' })).toBeVisible();
    }
  });

  test('a 4-player game with chosen roles: each takes a role nobody else has', async ({
    browser,
  }, testInfo) => {
    const { pages } = await seatPlayers(browser, deviceOptions(testInfo.project.use), 4, {
      difficulty: 'Standard',
      roles: 'Choose',
    });
    const [ana, ben, cleo, dee] = pages as [Page, Page, Page, Page];
    const role = (page: Page, id: string) => page.locator(`button:has([data-role="${id}"])`);

    for (const page of pages) {
      await expect(page.getByText(/5 epidemic cards · roles chosen by the players/)).toBeVisible();
      await expect(page.locator('[data-role]')).toHaveCount(12);
      // Nothing to confirm before a role is picked.
      await expect(page.getByRole('button', { name: 'Confirm and start' })).toBeDisabled();
    }

    await role(ana, 'medic').click();
    // Ben sees it taken; he picks another, and changes his mind before confirming.
    await expect(role(ben, 'medic')).toBeDisabled();
    await expect(role(ben, 'medic')).toContainText('Ana');
    await role(ben, 'dispatcher').click();
    await role(ben, 'researcher').click();
    await expect(role(cleo, 'dispatcher')).toBeEnabled();
    await expect(role(cleo, 'researcher')).toBeDisabled();
    await role(cleo, 'dispatcher').click();
    await role(dee, 'scientist').click();

    await confirmAll(pages);
    // Everyone has the role they picked, on the board.
    const expected = ['medic', 'researcher', 'dispatcher', 'scientist'];
    for (const page of pages) {
      for (const id of expected) await expect(page.locator(`[data-role="${id}"]`)).toBeVisible();
    }
  });

  test('a new game is dealt step by step, and a reload during play shows the board at once', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    // Motion on: the deal is played (about 10 s).
    const { pages } = await seatPlayers(browser, deviceOptions(testInfo.project.use), 2, {
      deal: true,
    });
    const [ana, ben] = pages as [Page, Page];
    const cubes = (page: Page) => page.locator('[data-cube]');
    // A pile on the map is labeled with its count.
    const pile = (page: Page, label: string) => page.locator(`[data-pile="${label}"]`);
    const discard = (page: Page) =>
      page.locator('[data-pile^="Infection discard pile"]').getAttribute('data-pile');
    await confirmAll(pages);

    // While it is dealt, nobody has actions yet and the board fills up piece by piece.
    for (const page of pages) await expect(page.getByText(/actions left/)).toHaveCount(0);
    await expect(cubes(ana)).toHaveCount(0);
    await expect(pile(ana, 'Infection discard pile: 0 cards')).toHaveCount(1);
    // A few infection cards in: some cubes are on the map, not all of them yet.
    await expect(async () => {
      const count = await cubes(ana).count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(18);
    }).toPass({ timeout: 8000 });
    expect(await discard(ana)).not.toContain('9 cards');
    for (const page of pages) await expect(page.getByText(/actions left/)).toHaveCount(0);

    // At the end: all 9 starting infections (18 cubes), the hands dealt, the actions on, for the
    // player whose turn it is.
    await expect(cubes(ana)).toHaveCount(18, { timeout: 20_000 });
    await expect(pile(ana, 'Infection discard pile: 9 cards')).toHaveCount(1);
    await expect(pile(ben, 'Infection discard pile: 9 cards')).toHaveCount(1);
    const active = ana.locator('[data-role][aria-current="true"]');
    const activeName = (await active.innerText()).split('\n')[0]?.trim();
    const [mine, other] = activeName === 'Ana' ? [ana, ben] : [ben, ana];
    // The actions depend on the role dealt (4, or up to 7 for some roles).
    await expect(mine.getByText(/[4-7] actions left/)).toBeVisible({ timeout: 15_000 });
    await expect(other.getByText(/actions left/)).toHaveCount(0);
    // Two players, 4 cards each.
    await expect(ana.getByRole('region', { name: 'Hands' }).getByRole('listitem')).toHaveCount(8);

    // A reload during play shows the board as it is at once: no deal, the actions straight away.
    await mine.reload();
    await expect(mine.getByText(/[4-7] actions left/)).toBeVisible({ timeout: 3000 });
    await expect(cubes(mine)).toHaveCount(18, { timeout: 3000 });
    await expect(pile(mine, 'Infection discard pile: 9 cards')).toHaveCount(1, { timeout: 3000 });
  });

  test('a heroic 3-player game is played to its end by passing every turn', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(240_000);
    const { pages } = await seatPlayers(browser, deviceOptions(testInfo.project.use), 3, {
      difficulty: 'Heroic',
    });
    for (const page of pages) {
      await expect(page.getByText(/6 epidemic cards · roles dealt at random/)).toBeVisible();
    }
    await confirmAll(pages);

    // Whoever has something to do does it: discard when over the hand limit, pass the actions,
    // draw, resolve the epidemics and flip the infection cards, until the game is over.
    const over = pages.map((page) =>
      page.getByRole('heading', { name: /^(The world was lost|Humanity is saved)$/ }),
    );
    const steps = [
      /^Discard /,
      'Draw cards',
      /^Epidemic:/,
      { name: 'Infect', exact: true },
      'Pass',
    ] as const;
    for (let round = 0; round < 1500; round++) {
      if (await over[0]!.isVisible()) break;
      for (const page of pages) {
        for (const step of steps) {
          const options =
            typeof step === 'object' && !(step instanceof RegExp) ? step : { name: step };
          const button = page.getByRole('button', options).first();
          if (await button.isVisible()) {
            await button.click();
            break;
          }
        }
      }
      await pages[0]!.waitForTimeout(20);
    }
    for (const heading of over) await expect(heading).toBeVisible();
  });
});
