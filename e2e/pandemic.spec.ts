import { expect, test, type Browser, type Page } from '@playwright/test';
import { deviceOptions, setGame } from './helpers';

// Pandemic is a desktop game: no phone profiles.
test.skip(({ isMobile }) => isMobile, 'desktop only');

/** Ana creates a 3-player game, Ben and Cleo join through the invite link. */
async function startThreePlayers(browser: Browser, device: ReturnType<typeof deviceOptions>) {
  const pages: Page[] = [];
  for (let i = 0; i < 3; i++) pages.push(await (await browser.newContext(device)).newPage());
  const [ana, ben, cleo] = pages as [Page, Page, Page];

  await ana.goto('/play/pandemic');
  await ana.getByLabel('Your name').fill('Ana');
  await ana.getByRole('radio', { name: '3' }).click();
  await ana.getByRole('button', { name: 'Create a game' }).click();
  await expect(ana.getByText('Waiting for 2 more players')).toBeVisible();
  const code = (await ana.getByLabel(/^Game code/).textContent())!.trim();

  for (const [page, name] of [
    [ben, 'Ben'],
    [cleo, 'Cleo'],
  ] as const) {
    await page.goto(`/r/${code}`);
    await expect(page.getByLabel('Game code')).toHaveValue(code);
    await page.getByLabel('Your name').fill(name);
    await page.getByRole('button', { name: 'Join' }).click();
  }
  for (const page of pages) {
    await expect(page.getByRole('region', { name: 'Actions' })).toBeVisible();
  }
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
      await expect(page.getByRole('region', { name: 'Hands' }).getByText('Ben')).toBeVisible();
      await expect(page.getByText(/4 actions left/)).toBeVisible();
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
    await expect(ana.getByText(/Your turn/)).toBeVisible();
    await expect(ben.getByText("Ana's turn")).toBeVisible();
    await expect(ben.getByRole('button', { name: 'Discover cure: Yellow' })).toBeDisabled();
    await expect(ana.getByRole('button', { name: 'Discover cure: Yellow' })).toBeEnabled();

    await ana.getByRole('button', { name: 'Discover cure: Yellow' }).click();
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
    for (const page of [ana, ben, cleo]) {
      await expect(page.getByRole('heading', { name: 'Humanity is saved' })).toBeHidden();
      await expect(page.getByText(/4 actions left/)).toBeVisible();
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
        if (await pages[i]!.getByText(/Your turn/).isVisible()) return i;
      }
      throw new Error('nobody has the turn');
    };
    const first = await turnOf();
    const active = pages[first]!;
    await active.getByRole('button', { name: 'Pass' }).click();
    await active.getByRole('button', { name: 'Draw cards' }).click();
    // The log of the turn shows the draw for everyone.
    for (const page of pages) {
      await expect(
        page.getByRole('region', { name: 'Turn log' }).getByText(/^Drew /),
      ).toBeVisible();
    }

    // Epidemics and the infect step are one press per step, until the turn passes on.
    for (let i = 0; i < 12; i++) {
      if (await active.getByText("'s turn").isVisible()) break;
      const epidemic = active.getByRole('button', { name: /^Epidemic:/ });
      const infect = active.getByRole('button', { name: 'Infect', exact: true });
      if (await epidemic.isEnabled()) await epidemic.click();
      else if (await infect.isEnabled()) await infect.click();
      else break;
    }
    // The turn is now someone else's, and the log of the finished turn is the previous one.
    await expect(active.getByText(/'s turn/)).toBeVisible();
    for (const page of pages) {
      await expect(page.getByText('Previous turn')).toBeVisible();
    }
  });
});
