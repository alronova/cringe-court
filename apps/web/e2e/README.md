# Playwright Test e2e suite

Specs live in `e2e/specs`. They run against a LOCAL-mode production build (fixture AI,
in-memory chain, mock World ID; `VITE_BACKEND_URL` is forced empty).

```sh
npx playwright install chromium      # once (set PLAYWRIGHT_BROWSERS_PATH to share a cache)
npm run e2e                          # from the repo root (or `npm run e2e -w @cringe-court/web`)
npx playwright test -c apps/web/playwright.config.ts --project=desktop solo
```

The config builds the workspace libs and the app into `e2e/.dist`, then serves it with
`vite preview` on 127.0.0.1:4317. Reports go to `e2e/.report`, traces/screenshots to `e2e/.results`
(all git-ignored). Type-check the specs with `npx tsc -p apps/web/e2e/tsconfig.json`.

## Projects

| Project | Viewport | WebGL | Runs |
| --- | --- | --- | --- |
| `desktop` | 1280x800 | SwiftShader | everything except `@fallback` tests |
| `mobile` | 390x844, touch, DPR 2 | SwiftShader | everything except `@fallback` tests |
| `no-webgl` | 1280x800 | disabled | only tests tagged `@fallback` |

Workers is 1 (software WebGL on a shared host), one retry, long per-test timeouts.
Hearings are driven with the room's own controls (Skip to the verdict, Fast-forward) and the
demo-clock buttons ("Skip to the deadline"), not fixed sleeps.

## Environment

- `E2E_SKIP_BUILD=1`: reuse `e2e/.dist` if it exists.
- `CHROME_PATH`: use this Chrome/Chromium instead of Playwright's (for example `/usr/bin/google-chrome`).
- `PLAYWRIGHT_BROWSERS_PATH`: where Playwright's browsers are installed.
- `DISPLAY`: SwiftShader fails on hosts where `DISPLAY` points at a missing X server. The config deletes it
  from its own environment; if you launch other tooling by hand, use `env -u DISPLAY`.

## Relation to other scripts

`e2e/playtest/*.mjs` are exploratory scripted scenarios that produce screenshots and timings;
`e2e/backend/*.mjs` drive backend mode. This suite ports their proven flows into asserting tests
and is not part of `npm run check`.

## Known app bugs recorded as `test.fail`

- Mobile `/court/walk`: `.ccr-look-zone` covers the top-bar "Controls" and "Skip to menu view"
  buttons, so they cannot be tapped (roam.spec.ts, "menu view").
