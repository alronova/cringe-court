# v3 final review

Branch `v3/e2e`, base `main` at `0a6cbc1` (all of #19–#37 merged). Written
2026-11-04 by the final track (e2e, runbook, review). This is an honest account
of what is complete, what is mocked, what is known to be weak and what nobody
has verified. Operating instructions are in [RUNBOOK.md](RUNBOOK.md).

## 1. Verification run (this branch)

<!-- VERIFICATION -->

## 2. What is complete

**Product: three modes, one app, one courtroom.**

- **Solo (Mode 1).** File a grievance in steps. Your AI lawyer faces an NPC
  prosecutor. Pay 1.20 test USDC (1.00 with a Pass). A 3-NPC jury commits and
  reveals on the ledger twin. Verdict, judge's sentence, share card, receipt,
  and a NO VERDICT path with a claimable full refund (B1).
- **Versus (Mode 2).** Side A files and gets a signed invite. Each side briefs
  its own agent in private, behind redaction and an information wall. Both
  approve the brief and the clerk's draft, then pay 0.70 each. Three World-ID-gated
  jurors (one human plus labelled demo jurors locally) post bonds, seal and
  open Secret Verdict Scrolls. Verdict, share card, per-role receipts and claims.
  Refunds on no consent, no funding or NO VERDICT. Works in one browser
  (persona switch) or across devices through the court server.
- **Grand Jury (Mode 3).** A public docket of famous everyday issues,
  crowdfunding to 7.30 USDC with sponsors (D10 pricing). Seven World-ID (Orb)
  jurors with 1.20 bonds, commit-reveal, permissionless settle, a 4-of-7
  threshold, payouts and claims. A gallery for spectators. Works locally (you
  plus six simulated jurors) or across seven devices through the court server.
- **First-person courtroom (roam)** is the primary trial view in all three
  modes. Walk (WASD, arrows, touch stick), interact (E), seat by role, a 7-seat
  two-tier jury box, scripted hearing beats with Standard, Highlights and Full
  paces, fast-forward, skip to the verdict, X to skip a line, and Tab to leave the
  room (no keyboard trap). The classic stage is a toggle, and the automatic
  fallback without WebGL.
- **App shell.** Landing, `/court` lobby with "Your cases", leaderboard,
  how-to-play, `/settings` (sound, motion, language, court connections with a live
  terms check, demo-data reset), `/gallery`, `/walk`. Papercraft art direction
  on the canonical palette (docs/STYLE-GUIDE.md). Motion tokens with page
  transitions and reduced motion. A 1874-key i18n catalog with a pseudo-locale.
  A WCAG 2.2 AA keyboard audit (docs/A11Y-AUDIT.md). Procedural audio.
- **Economics.** Each mode has a revenue model and per-outcome settlement
  tables (docs/ECONOMICS.md). The same rules run in `CourtMath.sol`, in
  chain-client's TypeScript mirror and in each mode's economics, checked by a
  hand-written settlement oracle.

**Engineering.**

- Contracts (`contracts/`): case escrow, juror bonds, commit-reveal ballots,
  deadlines, pull-payment payouts and refunds, forfeits, fee splits and
  protective cancels for all three modes. 250 Hardhat tests. Under the EIP-170 size limit.
- Ports and adapters (`packages/core`): ChainPort, IdentityPort,
  AiCounselPort. Each has a mock with the real rules, plus a real adapter (viem on
  Arc, IDKit, 0G Compute).
- Court server (`apps/server`, `packages/net`): cross-device Versus and Grand
  Jury, redaction across the wire, server-authoritative time, SSE with a poll
  fallback, signed invites, rate and size limits, JSON-lines durability.
- Tests: Vitest across 11 workspaces, contract tests, a Playwright e2e suite in
  local default mode (desktop, mobile, no-WebGL), the backend e2e with 3 and 7
  browser contexts, and the recorded playtest harness.

## 3. What is mocked (and what the real path needs)

| Concern | What runs | Real adapter | What is missing for real |
|---|---|---|---|
| AI prosecution and defense (0G Compute) | Scripted fixture counsel, deterministic per case | `OgComputeChatClient` (`packages/ai`), unit-tested against a fake broker | Wiring into a mode or the server's clerk; a funded 0G account; checking the broker method names against the live SDK |
| Money (Arc testnet) | Memory chain twin with the contract's state machine and settlement | viem `ChainPort` on Arc (`VITE_LEDGER=arc-testnet`) | **A deployment** (none exists), a funded deployer, the real USDC address, and an ASSIGNER/OPERATOR relayer and ATTESTER service. Without the relayer a live jury cannot be seated |
| Juror gating (World ID) | Mock personas under the real eligibility rules (Orb jurors, Device parties, one seat per human) | IDKit and `IdkitVerifier` (`VITE_IDENTITY=world-idkit`) | A Developer Portal app and a deployed verifier backend. The court server checks proof shape only |
| Live pages on the ledger | Each mode runs on its own twin (SoloSession, the Versus case room, the GJ demo court) | `ArcLedger` | Moving the live pages onto `ArcLedger` (Solo is proven on it in tests only) |
| Grand Jury crowd | Simulated contributors and fill-in jurors (labelled) | — | Real traffic |

## 4. Known gaps and remaining weaknesses

- **Nothing is live.** No 0G call, no Arc transaction, no World ID proof has
  happened in this product as played. It is a convincing, honest demo on
  twins, and it labels itself as one.
- **No Arc deployment path in the repo.** `scripts/deploy.ts` refuses to
  broadcast by design (D14), and the backend roles (relayer, attester) do not exist.
- **Court server is demo-grade.** Single node, bearer tokens without expiry,
  everything in process memory plus a log. **`CC_DEMO_CLOCK` defaults to `on`:
  any visitor can move the shared clock for every case on that server.** It must
  be `off` for anything public (RUNBOOK §4).
- **The Dockerfile has never been built.**
- **Outcomes vary run to run** (the NPC votes hash the frozen transcript).
- **The first-person hearing on phones** works and is docked, but it is cramped. The classic
  stage remains the calmer way to watch on a small screen.
- **Package-composed prose and in-world NPC lines** are not all in the i18n catalog yet.
- **B20 console noise:** `THREE.Clock` deprecation from @react-three/fiber is still present.
- **Open PR #18** (docs: game modes and economics) was never merged. Its
  content was carried into main by later PRs (`docs/GAME-MODES.md`,
  `docs/ECONOMICS.md`).

## 5. Playtest bugs (B1–B20): final status

| # | Sev. | Bug | Final status | Where |
|---|---|---|---|---|
| B1 | major | Solo NO VERDICT unreachable; jury loops after a deadline | **Fixed** | #35 |
| B2 | major | Versus juror misses the commit window while watching | **Fixed** (6-min window, early close, ballot HUD) | #35 |
| B3 | major | GJ verdict renders off-screen after Settle | **Fixed** | #35 |
| B4 | major | Roam onboarding modal and legend cover the hearing | **Fixed** | #37 |
| B5 | major | Mobile: dialogue and touch controls cover the canvas | **Fixed** (docked dialogue) | #37 |
| B6 | major | Every role seated at the defendant's table | **Fixed** (seat by role) | #37 |
| B7 | major | `/walk` without WebGL2 crashes | **Fixed** | #35 |
| B8 | major | Versus and GJ only work in one browser | **Fixed with a court server** (`VITE_BACKEND_URL`). The local default is still one browser, and says so | #36 |
| B9 | minor | GJ simulated crowd throws minimum-contribution errors | **Fixed** | #35 |
| B10 | minor | Redaction misses first names | **Fixed** (cue words and a name list; heuristic, not exhaustive) | #35 |
| B11 | minor | Contradictory redaction note | **Fixed** | #35 |
| B12 | minor | Angle quoted twice | **Fixed** | #35 |
| B13 | minor | Mistrial copy wrong | **Fixed** | #35 |
| B14 | minor | Solo ribbon overlaps intro at 390 px | **Fixed** | #37 |
| B15 | minor | Trial heading under the sticky header | **Fixed (CSS)**, not verified in a browser | #35, #37 |
| B16 | minor | Closed invite still says "summoned" | **Fixed** | #35 |
| B17 | minor | Zone label wrong at the jury-box viewpoint | **Fixed** | #37 |
| B18 | minor | Previous beat's line opens the next beat | **Fixed** | #37 |
| B19 | minor | Demo deadlines follow the wall clock | **Fixed in-page** (monotonic clock; server time in backend mode). Host clock jumps still reach browsers | #35, #36 |
| B20 | minor | Console noise (`THREE.Clock`, `HydrateFallback`) | **Partly fixed**: HydrateFallback gone, THREE.Clock remains | #35 |

Investigated in this track: in the backend Versus e2e only the juror's device
was offered a claim. **Not a bug.** After a verdict the sides get bragging
rights only (ECONOMICS §2: each half paid the jury pool, fees and that side's
agent). The receipts say *Nothing to claim on this case*, and the juror pulls
bond plus reward. After NO VERDICT both sides are offered 0.70 back. This is now
pinned by `apps/server/src/__tests__/versus.claims.test.ts` (both outcomes,
three devices) and asserted in `apps/web/e2e/backend/versus.mjs`.

## 6. Verified vs not verified

| Area | Verified? | How / why not |
|---|---|---|
| Unit and integration tests, lint, typecheck, build | **Yes** | `npm run check` on this branch and on a fresh clone (§1) |
| Contracts | **Yes**, on Hardhat only | 250 tests; no Arc deployment |
| All 3 modes end to end, local default mode | **Yes**, headless Chromium | `npm run e2e` (desktop, mobile emulation, no-WebGL) |
| Cross-device Versus (3) and Grand Jury (7), server down | **Yes**, on one machine | `npm run e2e:backend` |
| Fresh clone: `npm ci`, check, contracts, e2e, server start | see §1 | |
| Real GPU | **No** | WebGL only on SwiftShader (software). Frame rate and comfort are unknown |
| Sound | **No** | The audio engine is tested; nobody has listened to it |
| Real phones | **No** | Mobile is Chromium emulation (390×844, touch) |
| Safari, Firefox | **No** | Chromium only |
| Screen readers | **No** | Keyboard and axe audits only |
| Real Arc chain, 0G, World ID | **No** | No deployment, account or verifier |
| Docker image | **No** | No Docker on the build host |
