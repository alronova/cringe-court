# Runbook

How to set up, run, test and deploy CringeCourt, and which parts are real and
which are mocked. **Testnet only (D14):** every amount is test USDC. Nothing here
moves real money.

- [1. Setup](#1-setup)
- [2. Run it](#2-run-it)
- [3. Mocks vs real services](#3-mocks-vs-real-services)
- [4. Configuration](#4-configuration)
- [5. Tests and checks](#5-tests-and-checks)
- [6. End-to-end suites](#6-end-to-end-suites)
- [7. Fresh-clone verification](#7-fresh-clone-verification)
- [8. Deploying](#8-deploying)
- [9. Troubleshooting](#9-troubleshooting)

> ⚠️ **Demo-only: `CC_DEMO_CLOCK` defaults to `on`.** On a court server, **any
> visitor** can press *Skip to the deadline* and move the **shared** court clock
> forward for **every** case on that server. That is what makes a ten-minute demo
> possible. It also lets a stranger expire your invite or close your jury. Set
> `CC_DEMO_CLOCK=off` on any server that strangers can reach. With it off, the
> button explains why it was refused. (The local default mode has no shared
> clock: each browser's demo clock is its own.)

---

## 1. Setup

| Need | Version | Why |
|---|---|---|
| Node.js | ≥ 20.19 (built and verified on 20.19.2) | `engines` in `package.json` |
| npm | ≥ 10 (verified on 11.21) | workspaces |
| Chromium for e2e | Playwright's (`npx playwright install chromium`) or a system Chrome via `CHROME_PATH` | only for the e2e suites |
| Docker | optional | only for the court server's image (not built here, see §8) |

```bash
git clone https://github.com/alronova/cringe-court && cd cringe-court
npm ci                          # the whole workspace (apps/*, packages/*)
npm --prefix contracts ci       # contracts are a separate Hardhat package, not a workspace
npx playwright install chromium # only for the e2e suites (honours PLAYWRIGHT_BROWSERS_PATH)
```

Layout: `apps/web` (Vite + React app), `apps/server` (court server for
cross-device play), `packages/*` (core domain and ports, the three modes, the
AI adapters, chain client, World ID, the scene/roam renderer, audio, net),
`contracts` (Solidity on Arc testnet), `cc-art` (art pipeline), `docs`.

## 2. Run it

| Command | What you get |
|---|---|
| `npm run dev` | **Local default mode.** Vite on http://localhost:5173. All three modes run in this browser against mock adapters. Versus and Grand Jury "other people" are personas you switch between in one browser. |
| `npm run dev:full` | **Backend mode.** Court server on :8787 plus Vite on :5173 with `VITE_BACKEND_URL` set. Open two browsers (or a normal and a private window) to play Versus or Grand Jury across devices. |
| `npm run server` | The court server alone (JSON-lines store in `.data/court-server`). Then `VITE_BACKEND_URL=http://127.0.0.1:8787 npm run dev`. |
| `npm run build && npm run preview` | Production build of the web app, served on :4173. |

Routes worth knowing: `/` landing, `/court` lobby, `/solo`, `/versus`,
`/grand-jury`, `/walk` (the first-person courtroom on its own), `/settings`
(sound, motion, language, court connections, demo-data reset), `/gallery`
(design system).

**Phones on your network (backend mode):** run the server with `HOST=0.0.0.0`,
start Vite with `--host 0.0.0.0`, set `VITE_BACKEND_URL` to the machine's LAN
address and add the app's origin to `CC_CORS_ORIGINS`.

## 3. Mocks vs real services

Every external service sits behind a port in `packages/core`. The default is a
mock that keeps the real rules. A deploy opts into the real service with env
vars. A half-configured service falls back to its mock, and *Settings → Court
connections* shows a warning naming the missing variables.

| Concern | Default (what runs in tests, e2e and the demo) | Real adapter | Status of the real adapter |
|---|---|---|---|
| AI prosecution / defense (0G Compute) | Scripted fixture counsel (`packages/ai/src/fixture.ts`, per-mode demo counsel) | `OgComputeChatClient` in `packages/ai/src/og-compute.ts`, given an injected 0G serving broker | **Built and unit-tested against a fake broker. Not wired into the app or the server, and never run against live 0G.** The broker method names follow 0G's public docs and are unverified against the live SDK. |
| Money, bonds, commit-reveal, payouts (Arc) | `ArcLedger` over chain-client's memory chain: the contract's state machine, check order, error names and settlement | `ArcLedger` over viem on Arc testnet (chain 5042002): `VITE_LEDGER=arc-testnet` + addresses | **Contracts are written and tested (250 Hardhat tests). Nothing is deployed to Arc testnet.** There is no relayer for the ASSIGNER/OPERATOR roles, so a live jury cannot be seated (see §8). |
| Juror gating (World ID) | Mock personas under world-id's real eligibility rules (Orb for jurors, Device for parties, parties excluded, one seat per human) | IDKit in the browser plus a verifier backend running `IdkitVerifier`: `VITE_IDENTITY=world-idkit` | **No verifier backend is deployed, and no real proof has been verified.** The court server checks proof shape and one seat per human, not IDKit cryptography. |
| Cross-device play | None: courts live in this browser (local default mode) | `apps/server` via `VITE_BACKEND_URL` (docs/BACKEND.md) | Built and e2e-tested on one machine (Versus on 3 browser contexts, Grand Jury on 7). Single node, demo-grade auth. |
| Mode flows | Solo runs on `SoloSession`; Versus on an event-sourced case room; Grand Jury on the demo court | Solo is proven on `ArcLedger(memory)` in `soloSession.test.ts` | The live pages do not yet run on `ArcLedger`; see docs/INTEGRATION.md. |

## 4. Configuration

### Web app (`apps/web/.env.local`, from `apps/web/.env.example`)

Every value is optional. Nothing set means the local in-browser demo.

| Variable | Values | Meaning |
|---|---|---|
| `VITE_BACKEND_URL` | origin, e.g. `http://127.0.0.1:8787` | Shared court server for Versus and Grand Jury. Unset: this browser only. If the server is unreachable the app says so and offers the local demo as an explicit, remembered, reversible choice. It never falls back silently. |
| `VITE_LEDGER` | `demo` \| `arc-testnet` | Ledger adapter |
| `VITE_ARC_RPC_URL` | URL | Arc testnet RPC (default: the public endpoint) |
| `VITE_ARC_COURT`, `VITE_ARC_USDC`, `VITE_ARC_REGISTRY` | addresses | Required for `arc-testnet` |
| `VITE_IDENTITY` | `mock` \| `world-idkit` | Identity adapter |
| `VITE_WORLD_APP_ID`, `VITE_WORLD_BACKEND_URL` | `app_…`, URL | Required for `world-idkit` (verifier exposes `/rp-context` and `/verify`) |

Vite inlines these at **build** time, so rebuild after changing them.

### Court server (`apps/server/.env.example`; full table in docs/BACKEND.md §8)

| Variable | Default | Notes |
|---|---|---|
| `PORT`, `HOST` | `8787`, `127.0.0.1` | `0.0.0.0` to accept other devices |
| `CC_STORE`, `CC_DATA_DIR` | `file`, `.data/court-server` | `memory` keeps nothing (the e2e uses it) |
| `CC_CORS_ORIGINS` | local Vite dev + preview origins | comma list or `*` |
| `CC_SECRET` | generated once into `CC_DATA_DIR/secret.key` | HMAC key for signed invite links. Set it explicitly in any deploy and keep it out of git. |
| **`CC_DEMO_CLOCK`** | **`on`** | **Demo-only. Any visitor can move the shared clock. Set `off` for anything public.** |
| `CC_GJ_NPC_JURORS` | `late` | `late` / `fill` / `off`: simulated Grand Jury fill-in jurors |
| `CC_MAX_SESSIONS` / `CC_MAX_VERSUS_CASES` / `CC_MAX_FACTS` | 5000 / 500 / 50 000 | hard caps |
| `CC_TRUST_PROXY` | `off` | trust `X-Forwarded-For` (only behind your own proxy) |

## 5. Tests and checks

| Command | What it runs |
|---|---|
| `npm run check` | build libs, tokens/cutouts/atlas/cast generators in `--check` mode, lint, typecheck, Vitest (all workspaces incl. apps/server), production build |
| `npm run test:packages` | chain-client (memory + EVM) and world-id |
| `npm run test:contracts` | Hardhat: 250 contract tests (needs `npm --prefix contracts ci` first) |
| `npm run check:full` | all three above |
| `npm run e2e` | Playwright suite, local default mode (§6.1) |
| `npm run e2e:backend` | court server + 3/7-device browser runs (§6.2) |
| `npm run playtest -w @cringe-court/web` | the recorded UX playthroughs (screenshots + timings, not pass/fail gates) |

Results from the final verification run are in docs/V3-FINAL-REVIEW.md.

A root test fails the build on raw hex/rgb colours in
CSS: use the palette tokens (docs/STYLE-GUIDE.md).

## 6. End-to-end suites

Both suites drive a **production build** in headless Chromium. WebGL runs on
SwiftShader, so the first-person courtroom renders without a GPU. Neither suite
is part of `npm run check`, because they take minutes and need a browser.

### 6.1 Local default mode: `npm run e2e`

Playwright Test (`apps/web/playwright.config.ts`, specs in `apps/web/e2e/specs`).
It builds the app with `VITE_BACKEND_URL` empty into `apps/web/e2e/.dist`,
serves it with `vite preview`, and runs three projects:

| Project | Viewport | Covers |
|---|---|---|
| `desktop` | 1280×800, SwiftShader WebGL | smoke over every route; Solo, Versus and Grand Jury end to end with mock adapters; first-person room: walking, interacting, hearing beats, line skip, classic-stage toggle, Tab leaves the room |
| `mobile` | 390×844, touch, DPR 2 | the same flows, plus on-screen touch controls and the docked dialogue |
| `no-webgl` | 1280×800, WebGL disabled | `@fallback` specs: the app picks the classic stage by itself and a trial still completes |

Useful env: `E2E_SKIP_BUILD=1` (reuse `e2e/.dist`), `CHROME_PATH` (use a system
Chrome instead of Playwright's Chromium), `PLAYWRIGHT_BROWSERS_PATH` (where
`playwright install` put Chromium). Reports go to `apps/web/e2e/.report`
(`npx playwright show-report apps/web/e2e/.report`). See `apps/web/e2e/README.md`.

### 6.2 Backend mode: `npm run e2e:backend`

`apps/web/e2e/backend/run.mjs` starts a fresh court server (`CC_STORE=memory`,
`CC_DEMO_CLOCK=on`), builds the web app against it into a temp dir, serves
it, then runs three scenarios. Each browser context is one device, with its own
storage, cookies and session token:

| Scenario | Devices | Proves |
|---|---|---|
| `versus` | 3 (Side A desktop, Side B phone-sized, juror) | signed invite link opened on another device, the information wall (neither side's private notes reach the other's device), reload resumes the session, live updates, server clerk drafts, funding, jury, verdict on both sides, **claims per role (asserted)** |
| `grand-jury` | 7 jurors | seat, seal, reveal, permissionless settle, 4 of 7, verdict on every device, seven claims |
| `offline` | 1–2 | server down: lost-connection banner, refused action ("Nothing was sent"), unreachable gate with *Try again* / *Play the local demo instead*, server back with a fresh store, fresh-session notice, reconnect |

Run one scenario with `node apps/web/e2e/backend/run.mjs versus` (or
`grand-jury`, `offline`). Screenshots and `results.json` go to
`~/cringe-court-v3/screenshots/backend/` (override with `BACKEND_E2E_OUT`).
Exit code 0 means every scenario passed.

**Who may claim after a Versus case.** In the Versus run only the juror's device
is offered a claim, and neither side's is. That is correct for a verdict. Per
docs/ECONOMICS.md §2, a verdict gives the sides bragging rights only: each
side's 0.70 paid half the jury pool, half the protocol fee and that side's own
AI agent, so nothing comes back. Each side's receipt itemises that and says
*Nothing to claim on this case*. The juror pulls bond 0.40 plus reward 0.30.
After **NO VERDICT**, each side is offered its own 0.70 back and the timely
juror gets bond plus 0.20. `apps/server/src/__tests__/versus.claims.test.ts`
pins both outcomes across three server devices, and the browser run now
asserts the verdict case rather than only logging it.

### Host notes

- If WebGL fails to start under SwiftShader on a Linux box with an X display,
  run with `env -u DISPLAY` (seen on the build host).
- The build host's wall clock jumped by minutes mid-run more than once. The app's
  demo clocks are monotonic, but browser timers still see such jumps. If a timed
  window (commit/reveal) expires unexpectedly in a run, check the host clock first.

## 7. Fresh-clone verification

What the final track ran from a brand-new clone of `v3/e2e` (results are in
docs/V3-FINAL-REVIEW.md):

```bash
git clone -b v3/e2e https://github.com/alronova/cringe-court fresh && cd fresh
npm ci
npm --prefix contracts ci
npm run check                 # generators, lint, typecheck, unit tests, build
npm run test:packages
npm run test:contracts
npx playwright install chromium
npm run e2e                   # local default mode, all three projects
npm run e2e:backend           # backend mode: versus, grand-jury, offline
npm run server &              # server start: curl http://127.0.0.1:8787/api/v1/health, then stop it
```

## 8. Deploying

### Web app (static)

`npm run build` writes `apps/web/dist`: a static SPA. Serve it from any static
host with a fallback to `index.html` for client routes. Set the `VITE_*`
variables in the build environment, not at runtime.

### Court server

- Node: `npm ci && npm run server` with the env from §4. Put a TLS proxy in
  front. Set `CC_SECRET`, `CC_CORS_ORIGINS` to the app's origin, **`CC_DEMO_CLOCK=off`**
  for anything public, and a persistent `CC_DATA_DIR`.
- Docker: `docker build -f apps/server/Dockerfile -t cringe-court-server .` then
  `docker run -p 8787:8787 -v court-data:/data -e CC_CORS_ORIGINS=https://your.app -e CC_DEMO_CLOCK=off cringe-court-server`.
  **The image has never been built** (no Docker on the build host). Treat the
  Dockerfile as a starting point.
- Single node only: one process holds every court in memory and replays its
  log on boot (docs/BACKEND.md §9).

### Contracts on Arc testnet

Status: **not deployed.** On purpose, the repo's deploy script only deploys to the
in-process Hardhat network and refuses to broadcast elsewhere (D14: a public
deployment is a separate, reviewed step).

```bash
cd contracts
npm ci && npm test                                   # 250 tests
npm run deploy:local                                 # in-process deploy + manifest
TIMING=demo PRICING=hackathon npm run deploy:dry-run # gas plan for an Arc rollout
```

A real Arc testnet rollout needs, outside this repo:

1. A funded deployer key (Arc testnet gas), held in a wallet or secret store,
   never in `hardhat.config.ts` (its `arcTestnet` entry deliberately has no accounts).
2. Arc testnet's USDC ERC-20 address. `MockUSDC` is for local runs only.
3. A broadcast script mirroring `scripts/deploy.ts`: HumanRegistry, then
   CringeCourt(usdc, registry, admin, treasury, aiTreasury), grant
   OPERATOR/ASSIGNER/CURATOR roles, `setTerms` per mode (use `TIMING=demo` for a
   demo deployment so the UI labels the short windows), `setMarketingCap`.
4. Backend roles: an ASSIGNER/OPERATOR relayer that signs seat offers and
   calls `openCourt`, and an ATTESTER that writes World ID attestations into
   HumanRegistry after verifying IDKit proofs. **Neither exists yet.** Without
   them a live jury cannot be seated (`acceptSeat` fails with `not-allowed`).
5. Build the web app with `VITE_LEDGER=arc-testnet`, `VITE_ARC_COURT`,
   `VITE_ARC_USDC`, `VITE_ARC_REGISTRY` (and optionally `VITE_ARC_RPC_URL`).
   Check *Settings → Court connections*: it reads every mode's terms from the
   chain and compares them with what the app shows players.

### World ID and 0G

- World ID: register an app in the World Developer Portal, run a verifier
  backend exposing `/rp-context` and `/verify` with `IdkitVerifier` from
  `@cringe-court/world-id`, and build with `VITE_IDENTITY=world-idkit`,
  `VITE_WORLD_APP_ID`, `VITE_WORLD_BACKEND_URL`. Not done or verified here.
- 0G Compute: `OgComputeChatClient` needs an injected serving broker. Wiring it
  into a mode's counsel (or into the court server's clerk) is not done in this
  build. The scripted fixture counsel runs everywhere.

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "No case with that code here" on another device | Local default mode keeps cases in one browser. Use `npm run dev:full` (backend mode). |
| *The court server is not answering* | `VITE_BACKEND_URL` points at a server that is down, or CORS refuses the origin: check `CC_CORS_ORIGINS`. |
| *Fresh seat on the court server* | The server was reset (memory store or wiped data dir). Older cases are gone. |
| Classic stage instead of the 3D room | No WebGL (or it failed). That is the designed fallback. Toggle back in the trial if WebGL is available. |
| A juror's window closed while watching | Demo windows are minutes long. Use the hearing's *Skip to the verdict*, or the demo clock controls. |
| `npm run check` fails on a colour | New CSS used raw hex/rgb. Use the palette tokens. |
| e2e: browser not found | `npx playwright install chromium`, or set `CHROME_PATH`. |
