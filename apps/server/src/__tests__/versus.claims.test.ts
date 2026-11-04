/**
 * Who can claim what after a Versus case, through the court server (three
 * devices), against docs/ECONOMICS.md §2:
 * - verdict: sides get nothing back (bragging rights only; their halves paid
 *   the jury pool, fees and their agents); every timely juror gets bond + 0.30;
 * - no verdict (two jurors absent): each side gets its own 0.70 back; the
 *   timely juror gets bond + 0.20.
 * The backend e2e showed only the juror's device being offered a claim after
 * a 2–1 verdict; the first case pins that down as the intended outcome.
 */
import { formatUsdc, subUsdc, usdc, type Usdc } from '@cringe-court/core';
import { claimable, prepareBriefing, type DemoJuryPlan, type Fact } from '@cringe-court/modes-versus';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { device, type Device, type Running, startServer } from './harness';

const amount = (x: Usdc) => formatUsdc(x).replace(/\s*USDC$/, '');

const brief = (happened: string) => prepareBriefing({ happened, why: 'Because the rules of the table say so.', privateNotes: '', angle: 'A deal is a deal.', nickname: '' });

async function advance(d: Device, seconds: number): Promise<void> {
  const fact = { type: 'clock', seconds, seq: 0, at: 0, by: d.persona.id } as Fact;
  for (let i = 0; i < 5; i++) {
    await d.store.pull();
    if (await d.store.append([fact], d.store.read().length)) return;
  }
  throw new Error('could not move the clock');
}

describe('Versus claims across devices follow the settlement table', () => {
  let server: Running;
  const devices: Device[] = [];
  beforeAll(async () => {
    server = await startServer();
  });
  afterAll(async () => {
    devices.forEach((d) => d.close());
    await server.close();
  });

  async function play(plan: DemoJuryPlan) {
    const [a, b, j] = (await Promise.all([device(server.url), device(server.url), device(server.url)])) as [Device, Device, Device];
    devices.push(a, b, j);
    const all = [a, b, j];
    const sync = async () => {
      await Promise.all(all.map((d) => d.store.pull()));
    };
    const clerk = async () => {
      await server.court.tick();
      await sync();
    };
    for (const d of all) await d.desk.faucet(usdc('5.00'));
    const { trialId, code } = await a.desk.fileCase({ title: `Claims (${plan})`, category: 'dating-crimes', patch: brief('I went for napkins and the dumpling vanished.').patch });
    await sync();
    expect((await b.desk.findByCode(code))?.trialId).toBe(trialId);
    await b.desk.acceptInvite(trialId);
    await sync();
    await b.desk.saveBrief(trialId, 'b', brief('It was going cold, so I saved it.').patch);
    await sync();
    await a.desk.approveBrief(trialId, 'a');
    await sync();
    await b.desk.approveBrief(trialId, 'b');
    await clerk();
    await a.desk.runCounsel(trialId);
    await sync();
    await a.desk.approveDraft(trialId, 'a');
    await sync();
    await b.desk.approveDraft(trialId, 'b');
    await sync();
    await a.desk.fund(trialId);
    await sync();
    await b.desk.fund(trialId);
    await sync();
    const paid = Object.fromEntries(await Promise.all(all.map(async (d, i) => [i, await d.desk.balance()] as const)));
    await j.desk.takeSeat(trialId);
    await sync();
    await a.desk.seatDemoJurors(trialId, plan);
    await sync();
    await j.desk.commitBallot(trialId, 1);
    await advance(a, 30);
    await clerk();
    await a.desk.skipAhead(trialId);
    await sync();
    await j.desk.revealBallot(trialId);
    await advance(a, 30);
    await clerk();
    await a.desk.skipAhead(trialId);
    await clerk();
    await clerk();

    // What each device's own (redacted) copy says it may claim.
    const offered = await Promise.all(all.map(async (d) => amount(claimable((await d.desk.world()).case(trialId)!, d.persona.account))));
    for (const [i, d] of all.entries()) if (offered[i] !== '0.00') await d.desk.claim(trialId);
    await sync();
    const after = await Promise.all(all.map((d) => d.desk.balance()));
    const c = (await a.desk.world()).case(trialId)!;
    const s = c.state;
    return {
      verdict: 'verdict' in s && s.verdict ? s.verdict.kind : null,
      offered,
      // Juror balance is measured from before the bond was posted.
      gained: after.map((x, i) => amount(subUsdc(x, paid[i]!))),
    };
  }

  it('verdict: only the juror is offered a claim (bond 0.40 + reward 0.30); sides get nothing back', async () => {
    const r = await play('reliable');
    expect(r.verdict).not.toBe('no-verdict');
    expect(r.offered).toEqual(['0.00', '0.00', '0.70']);
    expect(r.gained).toEqual(['0.00', '0.00', '0.30']);
  });

  it('no verdict: each side is offered its own 0.70 back; the timely juror gets bond + 0.20', async () => {
    const r = await play('two-no-shows');
    expect(r.verdict).toBe('no-verdict');
    expect(r.offered).toEqual(['0.70', '0.70', '0.60']);
    expect(r.gained).toEqual(['0.70', '0.70', '0.20']);
  });
});
