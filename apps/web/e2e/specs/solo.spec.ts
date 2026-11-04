import { expect, expectRoamTrial, rushHearing, test } from './fixtures';
import { openSoloTrial } from './solo-flow';

test('solo: file a case, watch the hearing in the first-person room, verdict, receipt and share card', async ({ page }) => {
  await openSoloTrial(page);
  await expectRoamTrial(page);
  await expect(page.getByText(/Beat \d+ of \d+/)).toBeVisible({ timeout: 60_000 });
  await rushHearing(page, () => expect(page.locator('#jury-title')).toBeVisible({ timeout: 4 * 60_000 }));

  const verdict = page.locator('[data-outcome]').first();
  await expect(verdict).toBeVisible({ timeout: 4 * 60_000 });
  await expect(verdict).toHaveAttribute('data-outcome', /guilty|not-cooked|no-verdict|cooked/);
  await expect(page.getByRole('list', { name: 'How each juror voted' })).toBeVisible();
  // The record of the case (fingerprint, counsel, transactions) and the share card.
  await expect(page.getByText('Trial record')).toBeVisible();
  const download = page.getByRole('button', { name: 'Download PNG' });
  await download.scrollIntoViewIfNeeded();
  await expect(download).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy caption' })).toBeVisible();

  // The decided case is in this browser's docket.
  await page.goto('/solo/docket', { waitUntil: 'networkidle' });
  await expect(page.getByRole('link', { name: /replied-all/i }).first()).toBeVisible();
});

test('solo: a jury that misses its deadline gives NO VERDICT and a refund @slow', async ({ page }) => {
  // The refund path is about money, not the 3D room: use the lighter classic stage.
  await page.addInitScript(() => window.localStorage.setItem('cc:trial-view', 'classic'));
  // A controlled clock: it runs at real speed but lets the test jump past the jury deadline.
  await page.clock.install();
  await openSoloTrial(page);
  await page.getByRole('button', { name: /Skip to the jury/i }).click();
  await expect(page.locator('#jury-title')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Pause the jury' }).click();
  await page.clock.fastForward('16:00');
  await page.getByRole('button', { name: 'Resume the jury' }).click();
  await expect(page.locator('[data-outcome="no-verdict"]')).toBeVisible({ timeout: 2 * 60_000 });
  const claim = page.getByRole('button', { name: /Claim your .* refund/ });
  // The verdict panel unfolds with an animation: a click that lands mid-layout is retried until the refund shows.
  await expect(async () => {
    if (await claim.isVisible()) {
      await claim.scrollIntoViewIfNeeded();
      await claim.click({ timeout: 3000 });
    }
    await expect(page.getByText('Refund claimed')).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 60_000 });
});
