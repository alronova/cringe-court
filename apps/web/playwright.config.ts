import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

// SwiftShader (software WebGL) fails to initialise on hosts where DISPLAY points
// at an X server that is not there. Headless Chromium needs no display, so drop
// it here: the test workers inherit this environment.
delete process.env.DISPLAY;

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 4317;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DIST = 'e2e/.dist';

/** Software WebGL: no GPU on CI or on this shared host. */
const WEBGL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
/** WebGL off: the trial must fall back to the classic stage by itself. */
const NO_WEBGL_ARGS = ['--no-sandbox', '--disable-webgl', '--disable-webgl2', '--disable-3d-apis', '--autoplay-policy=no-user-gesture-required'];

const executablePath = process.env.CHROME_PATH || undefined;
const launch = (args: string[]) => ({ args, ...(executablePath ? { executablePath } : {}) });

// Build the app in LOCAL mode (VITE_BACKEND_URL empty: fixture AI, in-memory chain,
// mock World ID) into e2e/.dist, then serve it. E2E_SKIP_BUILD=1 reuses an existing build.
// build:libs compiles workspace libs (chain-client, world-id) that the app imports from dist.
const build = `npm run build:libs --prefix ../.. && VITE_BACKEND_URL= npx vite build --outDir ${DIST} --emptyOutDir`;
const serve = `npx vite preview --outDir ${DIST} --host 127.0.0.1 --port ${PORT} --strictPort`;
const command = process.env.E2E_SKIP_BUILD === '1' && existsSync(join(here, DIST, 'index.html')) ? serve : `${build} && ${serve}`;

export default defineConfig({
  testDir: 'e2e/specs',
  outputDir: 'e2e/.results',
  // One worker: the host is shared and software WebGL is slow.
  workers: 1,
  fullyParallel: false,
  retries: 1,
  timeout: 5 * 60_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/.report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  webServer: {
    command,
    cwd: here,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 15 * 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 }, launchOptions: launch(WEBGL_ARGS) },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, launchOptions: launch(WEBGL_ARGS) },
    },
    {
      name: 'no-webgl',
      grep: /@fallback/,
      use: { viewport: { width: 1280, height: 800 }, launchOptions: launch(NO_WEBGL_ARGS) },
    },
  ],
});
