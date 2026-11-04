import { expect, roomOf, toggleClassicAndBack, trialFrame, expectRoamTrial, type Page } from './fixtures';

/** The camera eye of the /court/walk?debug controller, as numbers. */
export async function eye(page: Page): Promise<[number, number, number]> {
  return page.evaluate(() => {
    const w = window as unknown as { __roam: { controller: { view(): { eye: [number, number, number] } } } };
    return [...w.__roam.controller.view().eye] as [number, number, number];
  });
}

export const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[2]! - b[2]!);

/** Open the sandbox with the debug hook and wait for a live controller. */
export async function openWalk(page: Page) {
  await page.goto('/court/walk?debug', { waitUntil: 'networkidle' });
  await expect(roomOf(page).locator('canvas')).toBeVisible({ timeout: 90_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __roam?: unknown }).__roam), null, { timeout: 60_000 });
  // The first-visit card is non-blocking; dismissing it is what a keyboard player does.
  const keyboardOnly = page.getByRole('button', { name: 'Use keyboard only' });
  if (await keyboardOnly.isVisible()) await keyboardOnly.click();
}

/** Tab out of the room: focus must reach something outside it within a few presses (no keyboard trap). */
export async function expectTabLeavesRoom(page: Page) {
  await roomOf(page).focus();
  let outside = false;
  for (let i = 0; i < 25 && !outside; i++) {
    await page.keyboard.press('Tab');
    outside = await page.evaluate(() => {
      const room = document.querySelector('[data-roam-zone]');
      const a = document.activeElement;
      return Boolean(a && a !== document.body && room && !room.contains(a));
    });
  }
  expect(outside, 'Tab moved focus out of the first-person room').toBe(true);
}

/**
 * Checks every mode's trial shares: it opens in the first-person room (data-view=roam, canvas live),
 * the hearing's beat status shows, Tab leaves the room, and the classic toggle works both ways.
 */
export async function expectTrialRoomWorks(page: Page) {
  await expectRoamTrial(page);
  await expect(trialFrame(page).getByText(/Beat \d+ of \d+|The court is about to sit|The hearing is over/)).toBeVisible({ timeout: 60_000 });
  await expectTabLeavesRoom(page);
  await toggleClassicAndBack(page);
}
