import { expect, expectNoHorizontalOverflow, test } from './fixtures';

const PAGES: ReadonlyArray<{ name: string; path: string; heading: RegExp | string }> = [
  { name: 'landing', path: '/', heading: /.+/ },
  { name: 'court lobby', path: '/court', heading: /.+/ },
  { name: 'solo landing', path: '/solo', heading: 'Solo Court' },
  { name: 'versus landing', path: '/versus', heading: /versus/i },
  { name: 'grand jury landing', path: '/grand-jury', heading: /grand jury/i },
  { name: 'grand jury docket', path: '/grand-jury/docket', heading: /docket/i },
  { name: 'grand jury pricing', path: '/grand-jury/pricing', heading: /.+/ },
  { name: 'settings', path: '/settings', heading: /.+/ },
  { name: 'how to play', path: '/how-to-play', heading: /.+/ },
  { name: 'leaderboard', path: '/leaderboard', heading: /.+/ },
  { name: 'unknown route', path: '/no-such-page', heading: /.+/ },
];

for (const p of PAGES) {
  test(`${p.name} renders without errors or horizontal overflow`, async ({ page }) => {
    await page.goto(p.path, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', typeof p.heading === 'string' ? { name: p.heading } : { name: p.heading }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test('court lobby links to the three modes', async ({ page }) => {
  await page.goto('/court');
  for (const name of ['Solo Court', 'Versus Court', 'Grand Jury']) {
    await expect(page.getByRole('link', { name: new RegExp(name, 'i') }).first()).toBeVisible();
  }
});
