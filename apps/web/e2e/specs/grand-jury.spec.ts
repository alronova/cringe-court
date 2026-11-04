import { expect, press, test, type Page } from './fixtures';
import { expectTrialRoomWorks } from './roam-helpers';

const FUND_CASE = 'Should code be indented with tabs?';

const caseLinks = (page: Page) => page.locator('a[href*="/grand-jury/case/"]');

test('grand jury: docket, summon, World ID, bond, commit, reveal, settle, verdict, claim', async ({ page }) => {
  await page.goto('/grand-jury/docket', { waitUntil: 'networkidle' });
  await expect(page.getByText('The docket').first()).toBeVisible();
  await expect(caseLinks(page).first()).toBeVisible();
  const total = await caseLinks(page).count();

  // Filters and search narrow the docket.
  const filters = page.getByRole('group', { name: /filter|show/i }).first();
  await filters.getByRole('button', { name: /Decided/ }).click();
  await expect(filters.getByRole('button', { name: /Decided/ })).toHaveAttribute('aria-pressed', 'true');
  await filters.getByRole('button', { name: /All cases/ }).click();
  await page.getByRole('searchbox').fill('zzzz-nothing');
  // (a featured case link may stay pinned above the list)
  await expect.poll(() => caseLinks(page).count()).toBeLessThan(total);
  await page.getByRole('searchbox').fill('');
  await expect.poll(() => caseLinks(page).count()).toBe(total);

  // Summon: chip in to a case that is still raising its crowdfund.
  await filters.getByRole('button', { name: /Open to join/ }).click();
  await page.getByRole('link', { name: new RegExp(FUND_CASE.replace('?', '\\?')) }).first().click();
  await expect(page.getByText('Summon the court').first()).toBeVisible();
  await page.getByText('1.00', { exact: true }).first().click();
  await press(page, /Summon with/i);
  await expect(page.getByText('You have chipped in').first()).toBeVisible();

  // Jury duty: find the case that is seating jurors.
  await page.goto('/grand-jury/docket?show=open', { waitUntil: 'networkidle' });
  const hrefs = await caseLinks(page).evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
  let seating = false;
  for (const href of hrefs) {
    await page.goto(href, { waitUntil: 'networkidle' });
    if (await page.getByRole('button', { name: /Volunteer for the jury/i }).isVisible()) {
      seating = true;
      break;
    }
  }
  expect(seating, 'some case is seating jurors').toBe(true);
  await press(page, /Volunteer for the jury/i);
  await expect(page.getByText('Juror Screening').first()).toBeVisible();
  await press(page, /Verify with World ID/i);
  await expect(page.getByText('A seat is offered to you').first()).toBeVisible();
  await press(page, /I swear to show up/i);
  await expect(page.getByRole('button', { name: /Seal my ballot/i })).toBeVisible({ timeout: 60_000 });

  // The hearing as a juror, in the first-person room (WebGL projects).
  if (await page.locator('[data-view="roam"]').count()) {
    await expectTrialRoomWorks(page);
  }

  // Seal the first ballot option.
  await page.getByRole('radio').first().check({ force: true });
  await press(page, /Seal my ballot/i);
  await expect(page.getByText('Secret Verdict Scroll').first()).toBeVisible();

  // Demo clock: skip to the reveal deadline, open the scroll, skip to settlement.
  await press(page, /Skip to the deadline/i);
  await expect(page.getByText('Open your scroll').first()).toBeVisible({ timeout: 60_000 });
  await press(page, /Open my scroll/i);
  await expect(page.getByText('Your vote is counted').first()).toBeVisible();
  await press(page, /Skip to the deadline/i);
  await expect(page.getByText('Settle the case').first()).toBeVisible({ timeout: 60_000 });
  // Settlement is permissionless: the simulated bailiff may get there first.
  await page.getByRole('button', { name: /Settle and read the verdict/i }).click({ timeout: 8000 }).catch(() => undefined);

  // The verdict lands inside the viewport (not above the fold where the Settle button was).
  const verdict = page.getByText(/strangers agreed|no verdict/i).first();
  await expect(verdict).toBeVisible({ timeout: 60_000 });
  await expect(verdict).toBeInViewport();

  // Claim.
  await press(page, /^Collect /i);
  await expect(page.getByText('Collected.').first()).toBeVisible();
  await page.getByRole('link', { name: /My court/i }).first().click();
  await expect(page.getByRole('heading', { name: 'My court' })).toBeVisible();
  await expect(page.getByText('Seats held')).toBeVisible();
});
