import { expect, type Page } from './fixtures';
import { press } from './fixtures';

export const CONFESSION = {
  title: 'I replied-all to the whole company',
  story: 'I replied all to a company-wide email with "lol same" and then did it again to apologise. 400 people got both.',
  category: 'NPC Behavior',
};

/** File a Solo case through the wizard and land in the trial (Solo uses demo terms in local mode). */
export async function openSoloTrial(page: Page, confession = CONFESSION) {
  await page.goto('/solo', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Solo Court', level: 1 })).toBeVisible();
  await press(page, /File a confession/i);
  await page.getByRole('radio', { name: new RegExp(confession.category) }).check({ force: true });
  await page.getByLabel('Case title').fill(confession.title);
  await page.getByLabel('Your confession').fill(confession.story);
  await press(page, /File the confession/i);
  await press(page, /Ask Counsel Chaos for angles/i);
  await page.getByRole('radio').first().check({ force: true });
  await press(page, /Approve and send to counsel/i);
  await press(page, /Freeze the transcript/i, { timeout: 60_000 });
  await press(page, /Pay .* and open the case/i);
  await expect(page.locator('[data-view]').first()).toBeVisible({ timeout: 60_000 });
}
