import { expect, press, test, type Page } from './fixtures';
import { expectTrialRoomWorks } from './roam-helpers';

// Local mode keeps every persona in one browser: Side A, Side B and a juror are
// three tabs of the same context (the supported demo path, as in e2e/playtest).

const field = (page: Page, label: RegExp | string) => page.getByLabel(label).last();

async function send(page: Page, answer: string, label: RegExp | string = /^Your answer/) {
  await field(page, label).fill(answer);
  await press(page, /^Send$/);
}

async function fileAsA(A: Page) {
  await A.goto('/versus', { waitUntil: 'networkidle' });
  await press(A, /Start a Versus case/i);
  await field(A, 'Case title').fill('The Last Dumpling');
  await A.getByRole('radio', { name: /NPC Behavior/ }).check({ force: true });
  await press(A, /Brief Agent A/i);
  await send(A, 'We agreed to split the last dumpling. I went to get napkins and came back to an empty plate and a guilty smile. Text me at 555-201-9934 if you disagree.');
  await send(A, 'A split is a contract. Napkin duty is a public service, not abandonment of the dumpling.');
  await send(A, 'This is the third dumpling incident this year.', /^Your answer \(private\)/);
  await expect(A.getByText('Write my own').first()).toBeVisible({ timeout: 60_000 });
  await A.getByText('A deal is a deal').first().click();
  await press(A, /Review my brief/i);
  await expect(A.getByText('What the jury will read').first()).toBeVisible();
  // The jury-facing text never carries the phone number from the private briefing.
  await expect(A.getByText('555-201-9934')).toHaveCount(0);
  await field(A, 'Nickname on the verdict').fill('Napkin Knight');
  await press(A, /File & get invite/i);
  await press(A, /Verify & file/i);
  await expect(A.getByText('Invite code').first()).toBeVisible({ timeout: 30_000 });
  const link = (await A.locator('p', { hasText: '/versus/join/' }).first().textContent())!.replace('Invite link:', '').trim();
  return new URL(link).pathname;
}

async function joinAsB(B: Page, invite: string) {
  await B.goto(invite, { waitUntil: 'networkidle' });
  await press(B, /Accept & become Side B/i);
  await press(B, /Verify & accept/i);
  await expect(B.getByText('Private briefing with Agent B').first()).toBeVisible();
  await send(B, 'The dumpling was going cold. Leaving food unattended is a forfeit, everybody knows that rule. Ask Priya.');
  await send(B, 'Hot food waits for no one. I saved it from a tragic, lukewarm fate.');
  await press(B, /^Skip$/);
  await expect(B.getByText('Write my own').first()).toBeVisible({ timeout: 60_000 });
  await B.getByText('A deal is a deal').first().click();
  await press(B, /Review my brief/i);
  await press(B, /Save my brief/i);
  await press(B, /Approve my brief/i);
}

async function fundCase(A: Page, B: Page) {
  await A.bringToFront();
  await press(A, /Approve my brief/i, { timeout: 60_000 });
  await expect(A.getByRole('button', { name: /Approve the draft/i })).toBeEnabled({ timeout: 90_000 });
  await press(A, /Approve the draft/i);
  await B.bringToFront();
  await press(B, /Approve the draft/i, { timeout: 60_000 });
  await expect(B.getByText('Pay your half').first()).toBeVisible();
  await press(B, /Get test USDC/i);
  await press(B, /Pay 0\.70/i);
  await A.bringToFront();
  await expect(A.getByText('Pay your half').first()).toBeVisible({ timeout: 30_000 });
  await press(A, /Get test USDC/i);
  await press(A, /Pay 0\.70/i);
  await expect(A.getByText('Jury selection').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('versus (local mode)', () => {
  test('both sides, a juror, verdict and claims', async ({ context }) => {
    const A = await context.newPage();
    const invite = await fileAsA(A);

    const B = await context.newPage();
    await joinAsB(B, invite);
    await fundCase(A, B);

    // A juror in a third tab: bond with the mock World ID.
    const J = await context.newPage();
    await J.goto(A.url(), { waitUntil: 'networkidle' });
    await expect(J.getByText('I swear to show up').first()).toBeVisible();
    await press(J, /Get test USDC for the bond/i);
    await press(J, /I swear to show up/i);
    await press(J, /Verify & post/i);
    await A.bringToFront();
    await press(A, /Seat simulated jurors/i);

    // Park A and B on the case list: three tabs of software WebGL would starve the host.
    const caseUrl = A.url();
    await A.goto('/versus/cases', { waitUntil: 'networkidle' });
    await B.goto('/versus/cases', { waitUntil: 'networkidle' });
    await J.bringToFront();
    await expect(J.getByText('Secret Verdict Scroll').first()).toBeVisible({ timeout: 60_000 });
    await expectTrialRoomWorks(J);

    // Vote and seal.
    await J.getByRole('radio', { name: /side b/i }).check({ force: true });
    await press(J, /Seal my Secret Verdict Scroll/i);
    await expect(J.getByText(/sealed/i).first()).toBeVisible({ timeout: 30_000 });

    // The clerk closes the commit window once every juror sealed; otherwise skip to the deadline.
    await A.goto(caseUrl, { waitUntil: 'networkidle' });
    const open = J.getByRole('button', { name: /Open my scroll/i }).first();
    for (let i = 0; i < 10 && !(await open.isVisible()); i++) {
      const skip = A.getByRole('button', { name: /Skip to the deadline/i });
      await skip.click({ timeout: 3000 }).catch(() => undefined); // may be gone: the clerk can close the window itself
      await J.waitForTimeout(2000);
    }
    await open.click();

    // Reveal deadline, then the verdict.
    for (let i = 0; i < 10 && !(await A.getByText(/The jury has spoken|NO VERDICT|mistrial/i).first().isVisible().catch(() => false)); i++) {
      const skip = A.getByRole('button', { name: /Skip to the deadline/i });
      await skip.click({ timeout: 3000 }).catch(() => undefined); // may be gone: the clerk can close the window itself
      await A.waitForTimeout(2500);
    }
    await expect(A.getByText(/The jury has spoken|NO VERDICT|mistrial/i).first()).toBeVisible({ timeout: 30_000 });

    // Every role sees the verdict and its own payout/claim UI.
    for (const [who, page] of [['A', A], ['B', B], ['J', J]] as const) {
      await page.bringToFront();
      await page.goto(caseUrl, { waitUntil: 'networkidle' });
      await expect(page.getByText(/The jury has spoken|NO VERDICT|mistrial/i).first(), `${who} sees the verdict`).toBeVisible({ timeout: 30_000 });
      if (who === 'J') continue;
      // The filing sides paid in at the start: nothing is owed to them afterwards.
      await expect(page.getByText('Nothing to claim on this case.'), `${who} has nothing to claim`).toBeVisible();
      await expect(page.getByRole('button', { name: /^Claim/i })).toHaveCount(0);
    }
    // The juror who finished duty is paid.
    await J.bringToFront();
    await J.goto(caseUrl, { waitUntil: 'networkidle' });
    await press(J, /^Claim 0\.70 USDC$/i);
    await expect(J.getByRole('button', { name: /^Claim/i })).toHaveCount(0);
    await expect(J.getByText('You claimed 0.70 USDC')).toBeVisible();
  });
});
