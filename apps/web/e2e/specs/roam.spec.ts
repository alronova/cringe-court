import type { Page } from '@playwright/test';
import { expect, expectNoHorizontalOverflow, expectRoamTrial, isMobile, roomOf, test, trialFrame } from './fixtures';
import { dist, expectTabLeavesRoom, eye, openWalk } from './roam-helpers';
import { openSoloTrial } from './solo-flow';

const zoneOf = (page: Page) => roomOf(page).getAttribute('data-roam-zone');

test.describe('walk sandbox (/court/walk)', () => {
  test('keyboard: W and the arrow keys walk, turning changes the view, the zone follows @desktop', async ({ page }, info) => {
    test.skip(isMobile(info.project.name), 'keyboard walking is covered on desktop; mobile uses the touch controls below');
    await openWalk(page);
    await page.getByRole('button', { name: 'Lobby', exact: true }).click();
    await expect(page.locator('.ccr-zone')).toHaveText(/Lobby/);
    const start = await eye(page);
    await roomOf(page).focus();
    await page.keyboard.down('w');
    await expect.poll(async () => dist(await eye(page), start), { timeout: 20_000 }).toBeGreaterThan(20);
    // Keep walking through the doors: the zone follows.
    await expect.poll(() => zoneOf(page), { timeout: 30_000 }).not.toBe('lobby');
    await page.keyboard.up('w');
    // Arrow keys: forward moves, left turns without moving much.
    const before = await eye(page);
    await page.keyboard.down('ArrowUp');
    await expect.poll(async () => dist(await eye(page), before), { timeout: 20_000 }).toBeGreaterThan(5);
    await page.keyboard.up('ArrowUp');
    const yaw = () => page.evaluate(() => (window as unknown as { __roam: { controller: { view(): { yaw: number } } } }).__roam.controller.view().yaw);
    const yaw0 = await yaw();
    await page.keyboard.down('ArrowLeft');
    await expect.poll(async () => Math.abs((await yaw()) - yaw0), { timeout: 20_000 }).toBeGreaterThan(0.2);
    await page.keyboard.up('ArrowLeft');
  });

  test('keyboard: E interacts with what you face, X skips and E advances dialogue @desktop', async ({ page }, info) => {
    test.skip(isMobile(info.project.name), 'desktop keyboard flow');
    await openWalk(page);
    await page.getByRole('button', { name: 'Bench', exact: true }).click();
    await roomOf(page).focus();
    await page.keyboard.down('w');
    await expect(page.locator('.ccr-prompt')).toContainText('Approach the bench', { timeout: 20_000 });
    await page.keyboard.up('w');
    await page.keyboard.press('e');
    const line = page.locator('.ccr-dialogue .ccr-line');
    await expect(line).toBeVisible();
    // Dialogue closes when it has been read through (E advances, X skips the typing).
    await page.keyboard.press('x');
    for (let i = 0; i < 8 && (await page.locator('.ccr-dialogue').isVisible()); i++) {
      await page.keyboard.press('e');
      await page.waitForTimeout(300);
    }
    await expect(page.locator('.ccr-dialogue')).toBeHidden();
  });

  test('beats: hearing lines appear, E advances and X skips a line @desktop', async ({ page }, info) => {
    test.skip(isMobile(info.project.name), 'desktop keyboard flow');
    await openWalk(page);
    const beat = page.getByRole('button', { name: /1\. ALL RISE/i });
    await beat.click();
    await expect(beat).toHaveAttribute('aria-pressed', 'true');
    const dialogue = page.locator('.ccr-dialogue');
    await expect(dialogue).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-roam-control]').first()).toHaveAttribute('data-roam-control', 'cinematic');
    const first = await dialogue.innerText();
    await roomOf(page).focus();
    await page.keyboard.press('x');
    await page.keyboard.press('e');
    // A later line (another speaker or text) replaces the first one.
    await expect.poll(async () => ((await dialogue.isVisible()) ? await dialogue.innerText() : ''), { timeout: 30_000 }).not.toBe(first);
    // The beat ends by itself or with Skip beat; control comes back to the player.
    await page.getByRole('button', { name: 'Skip beat' }).first().click();
    await expect(page.locator('[data-roam-control]').first()).not.toHaveAttribute('data-roam-control', 'cinematic', { timeout: 30_000 });
  });

  test('Tab leaves the room: no keyboard trap @desktop', async ({ page }, info) => {
    test.skip(isMobile(info.project.name), 'desktop keyboard flow');
    await openWalk(page);
    await expectTabLeavesRoom(page);
  });

  test('menu view: skip to the classic view and back to walking', async ({ page }) => {
    // Regression: on touch devices the look zone used to sit above the top bar, so these buttons could not be tapped.
    await openWalk(page);
    await page.getByRole('button', { name: 'Skip to menu view' }).click();
    await expect(roomOf(page)).toHaveCount(0);
    await expect(page.locator('section[aria-label="Courtroom"] canvas, canvas').first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Back to walking' }).click();
    await expect(roomOf(page).locator('canvas')).toBeVisible({ timeout: 60_000 });
  });

  test('touch: on-screen controls are visible, the stick walks, the hand button interacts, dialogue is docked @mobile', async ({ page, context }, info) => {
    test.skip(!isMobile(info.project.name), 'touch devices only');
    await openWalk(page);
    const touch = page.getByTestId('roam-touch');
    await expect(touch).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Interact/ })).toBeVisible();
    await page.getByRole('button', { name: 'Lobby', exact: true }).click();

    // Drag the floating stick upwards with real touch events.
    await page.locator('.ccr-stick-zone').scrollIntoViewIfNeeded();
    const zone = (await page.locator('.ccr-stick-zone').boundingBox())!;
    const lookBox = (await page.locator('.ccr-look-zone').boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Array<{ x: number; y: number }>) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    const x = zone.x + zone.width * 0.4;
    const y = zone.y + zone.height * 0.6;
    const start = await eye(page);
    await send('touchStart', [{ x, y }]);
    for (let i = 1; i <= 6; i++) await send('touchMove', [{ x, y: y - i * 10 }]);
    await expect.poll(async () => dist(await eye(page), start), { timeout: 20_000 }).toBeGreaterThan(10);
    await send('touchEnd', []);

    // Drag on the right half to look around.
    const yaw = () => page.evaluate(() => (window as unknown as { __roam: { controller: { view(): { yaw: number } } } }).__roam.controller.view().yaw);
    const yaw0 = await yaw();
    const lx = lookBox.x + lookBox.width * 0.8;
    const ly = lookBox.y + lookBox.height * 0.3;
    await send('touchStart', [{ x: lx, y: ly }]);
    for (let i = 1; i <= 8; i++) await send('touchMove', [{ x: lx - i * 10, y: ly }]);
    await send('touchEnd', []);
    expect(Math.abs((await yaw()) - yaw0)).toBeGreaterThan(0.05);

    // A beat's dialogue docks below the 3D view on a narrow screen (nothing covers the action) and tapping advances it.
    await page.getByRole('button', { name: /1\. ALL RISE/i }).click();
    const dialogue = page.locator('.ccr-dialogue');
    await expect(dialogue).toBeVisible({ timeout: 30_000 });
    const canvas = (await page.locator('.ccr-canvas').boundingBox())!;
    const box = (await dialogue.boundingBox())!;
    expect(box.y, 'dialogue sits below the canvas').toBeGreaterThanOrEqual(canvas.y + canvas.height - 2);
    const first = await dialogue.innerText();
    await dialogue.tap();
    await expect.poll(async () => ((await dialogue.isVisible()) ? await dialogue.innerText() : ''), { timeout: 30_000 }).not.toBe(first);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('solo trial in the room', () => {
  test('opens in the first-person room; dialogue appears; Tab leaves; classic toggle works', async ({ page }, info) => {
    await openSoloTrial(page);
    await expectRoamTrial(page);
    await expect(page.locator('.ccr-dialogue')).toBeVisible({ timeout: 90_000 });
    if (isMobile(info.project.name)) {
      await expect(page.locator('.ccr-dialogue')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
    await expectTabLeavesRoom(page);
    await page.getByRole('button', { name: 'Skip beat' }).first().click();
    await expect(trialFrame(page)).toHaveAttribute('data-view', 'roam');
  });
});

test.describe('without WebGL @fallback', () => {
  test.beforeEach(({ browserName: _b }, info) => {
    test.skip(info.project.name !== 'no-webgl', 'only meaningful with WebGL disabled');
  });

  test('the walk sandbox explains and points to the courts; no canvas, no crash @fallback', async ({ page }) => {
    await page.goto('/court/walk', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /can.t draw the walkable courtroom/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to the courts' })).toBeVisible();
    await expect(roomOf(page)).toHaveCount(0);
  });

  test('a solo trial shows the classic stage by itself and the flow still completes @fallback', async ({ page }) => {
    await openSoloTrial(page);
    await expect(trialFrame(page)).toHaveAttribute('data-view', 'classic');
    await expect(roomOf(page)).toHaveCount(0);
    // The toggle is not offered and the page says why.
    await expect(page.getByRole('group', { name: 'Trial view' })).toHaveCount(0);
    await expect(page.getByText(/no WebGL2/i)).toBeVisible();
    await page.getByRole('button', { name: /Skip to the jury/i }).click();
    await expect(page.locator('#jury-title')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-outcome]').first()).toBeVisible({ timeout: 4 * 60_000 });
  });
});
