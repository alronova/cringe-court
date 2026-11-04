# cringe-court

**CringeCourt: Your Honor, Bro Is Cooked.** A comedy courtroom where AI lawyers
argue and a verified human jury decides. You walk the trial in a first-person,
papercraft pixel-art courtroom. Testnet only: every amount is test USDC.

| Mode | Who | How it works | Revenue |
|---|---|---|---|
| **Solo** | you + your AI lawyer vs an NPC AI | File a grievance, watch the hearing, a 3-juror panel decides | 1.20 USDC per case (1.00 with a Pass) |
| **Versus** | two real people, one AI agent each | Side A files and sends an invite; each side briefs its agent in private; 3 jurors decide | 0.70 USDC per side; winner gets bragging rights |
| **Grand Jury** | anyone | A public question on a famous issue, crowdfunded; 7 World-ID-gated jurors with bonds and commit-reveal | crowdfund target 7.30 USDC per case + sponsors |

Money (bonds, commit-reveal, deadlines, payouts, refunds, fee splits) follows
Arc testnet contracts in `contracts/`. AI counsel sits behind a port with a
0G Compute adapter. Juror gating uses World ID rules. **By default every one of
these runs as a mock with the real rules**, entirely in your browser. See
[docs/RUNBOOK.md §3](docs/RUNBOOK.md#3-mocks-vs-real-services) for what is real.

## Quick start

Requires Node ≥ 20.19.

```bash
npm ci
npm run dev        # local default mode: http://localhost:5173, all three modes in this browser
npm run dev:full   # backend mode: court server :8787 + app, Versus and Grand Jury across devices
```

> **Demo-only:** the court server's `CC_DEMO_CLOCK` defaults to `on`, so any
> visitor can move the shared court clock. Set `CC_DEMO_CLOCK=off` for anything
> public ([runbook](docs/RUNBOOK.md)).

## Checks

| Script | What it does |
|---|---|
| `npm run check` | generators in `--check` mode, lint, typecheck, every Vitest workspace, production build |
| `npm run check:full` | `check` + chain-client/world-id packages + 250 contract tests (`npm --prefix contracts ci` first) |
| `npm run e2e` | Playwright, local default mode: desktop, mobile (touch) and no-WebGL projects across all three modes and the first-person room |
| `npm run e2e:backend` | court server + Versus on 3 browser contexts, Grand Jury on 7, server-down path |
| `npm run playtest -w @cringe-court/web` | recorded UX playthroughs (screenshots, timings) |

E2E needs Chromium: `npx playwright install chromium`, or set `CHROME_PATH`.

## Layout

- `apps/web`: Vite + React 19 app (shell, modes, design system, `/gallery`, `/walk`), plus `e2e/`.
- `apps/server`: the court server for cross-device Versus and Grand Jury ([docs/BACKEND.md](docs/BACKEND.md)).
- `packages/core`: domain types, constants from `docs/DECISIONS.md`, and the adapter ports.
- `packages/modes-solo`, `modes-versus`, `modes-grand-jury`: each mode's rules, flows and economics.
- `packages/ai` (fixture + 0G Compute), `chain-client` (memory + viem), `world-id`, `net`, `scene` (roam renderer), `engine`, `audio`.
- `contracts`: Solidity for Arc testnet (separate Hardhat package).
- `cc-art`: the art pipeline and generated assets.

## Docs

[Runbook](docs/RUNBOOK.md) · [Final review](docs/V3-FINAL-REVIEW.md) ·
[Architecture](docs/ARCHITECTURE.md) · [Game modes](docs/GAME-MODES.md) ·
[Economics](docs/ECONOMICS.md) · [Decisions](docs/DECISIONS.md) ·
[Style guide](docs/STYLE-GUIDE.md) (canonical palette and papercraft direction) ·
[First-person courtroom](docs/ROAM.md) · [Backend](docs/BACKEND.md) ·
[Integration](docs/INTEGRATION.md) · [Accessibility audit](docs/A11Y-AUDIT.md) ·
[i18n](docs/I18N.md) · [Audio](docs/AUDIO.md) · [UX evaluation](docs/UX-EVALUATION.md)
