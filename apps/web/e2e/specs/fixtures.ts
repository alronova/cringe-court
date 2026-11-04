import { expect, test as base, type Locator, type Page } from '@playwright/test';

/**
 * Console output that is known to be harmless and is ignored by the
 * "no console errors" assertion. Keep this list short and justified.
 */
const BENIGN: ReadonlyArray<RegExp> = [
  // Headless Chromium on a host without a GPU: software WebGL emits GPU-stall
  // performance notes ("GPU stall due to ReadPixels") as warnings, never errors.
  /GPU stall due to ReadPixels/i,
];

const isBenign = (text: string) => BENIGN.some((re) => re.test(text));

interface Fixtures {
  /** Console errors and uncaught page errors from every page of the test's context; asserted empty at the end. */
  problems: string[];
}

export const test = base.extend<Fixtures>({
  problems: [
    async ({ context }, use) => {
      const problems: string[] = [];
      context.on('console', (m) => {
        if (m.type() === 'error' && !isBenign(m.text())) problems.push(`console.error: ${m.text()} @ ${m.location().url}`);
      });
      context.on('weberror', (e) => problems.push(`pageerror: ${e.error().message}`));
      await use(problems);
      expect(problems, 'console errors / uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** No horizontal scrolling: the page is not wider than the viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.scrollingElement?.scrollWidth ?? 0, inner: window.innerWidth }));
  expect(scroll, `scrollWidth ${scroll} vs innerWidth ${inner}`).toBeLessThanOrEqual(inner + 1);
}

/** The Playwright project name decides the viewport and WebGL; specs ask these instead of sniffing. */
export const isMobile = (projectName: string) => projectName === 'mobile';

/** The trial frame of any mode (Solo, Versus, Grand Jury): data-view is "roam" or "classic". */
export const trialFrame = (page: Page) => page.locator('[data-view]').first();

/** The first-person room itself (role=application, carries the roam data attributes). */
export const roomOf = (page: Page) => page.locator('[data-roam-zone]').first();

/** Wait for the trial to open in the first-person room (WebGL projects) with a live canvas. */
export async function expectRoamTrial(page: Page) {
  await expect(trialFrame(page)).toHaveAttribute('data-view', 'roam', { timeout: 90_000 });
  await expect(roomOf(page)).toBeVisible({ timeout: 90_000 });
  await expect(roomOf(page).locator('canvas')).toBeVisible();
}

/** Switch the trial to the classic stage with the toggle and back, asserting both views. */
export async function toggleClassicAndBack(page: Page) {
  const group = page.getByRole('group', { name: 'Trial view' });
  const classic = group.getByRole('button', { name: 'Classic stage' });
  const roam = group.getByRole('button', { name: 'First person' });
  await classic.click();
  await expect(trialFrame(page)).toHaveAttribute('data-view', 'classic');
  await expect(page.locator('[data-roam-zone]')).toHaveCount(0);
  await roam.click();
  await expect(trialFrame(page)).toHaveAttribute('data-view', 'roam');
  await expect(roomOf(page).locator('canvas')).toBeVisible({ timeout: 60_000 });
}

/** Click a button/link by (regex) accessible name once it is visible and enabled. */
export async function press(page: Page, name: RegExp | string, opts: { timeout?: number } = {}) {
  const target = page.getByRole('button', { name }).or(page.getByRole('link', { name })).first();
  await expect(target).toBeEnabled({ timeout: opts.timeout ?? 30_000 });
  await target.scrollIntoViewIfNeeded();
  await target.click();
}

export type { Locator, Page };

/**
 * Drive a first-person hearing to its end with the pace controls instead of sleeping:
 * "Skip to the verdict" jumps to the verdict beat (which always plays in full), and
 * "Fast-forward" shortens the lines. `done` resolves the moment the mode moves on.
 */
export async function rushHearing(page: Page, done: () => Promise<void>) {
  const skip = page.getByRole('button', { name: 'Skip to the verdict' });
  const ff = page.getByRole('button', { name: 'Fast-forward' });
  const finished = done().then(() => true, () => false);
  let over = false;
  void finished.then((ok) => (over = ok));
  for (let i = 0; i < 120 && !over; i++) {
    if (await skip.isVisible().catch(() => false)) await skip.click({ timeout: 2000 }).catch(() => undefined);
    if ((await ff.isVisible().catch(() => false)) && (await ff.getAttribute('aria-pressed')) !== 'true') await ff.click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
  }
  expect(await finished, 'the hearing ended').toBe(true);
}
