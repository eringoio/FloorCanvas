import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Smoke test for the PACKAGED Windows app (electron:pack output):
 * dist-electron/win-unpacked/FloorCanvas.exe.
 *
 * Launches the built executable with the same test-only workspace/userData
 * override as the source-mode E2E suite and validates that saving still works
 * end-to-end through the packaged asar.
 *
 * Skips automatically when the unpacked build has not been produced yet.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const packagedExe = path.join(repoRoot, 'dist-electron', 'win-unpacked', 'FloorCanvas.exe');

const env: { root: string; workspace: string; userData: string } = {
  root: '',
  workspace: '',
  userData: '',
};

test.beforeAll(() => {
  test.skip(!fs.existsSync(packagedExe), `packaged app not built yet: ${packagedExe}`);
  env.root = fs.mkdtempSync(path.join(os.tmpdir(), 'floorcanvas-pack-'));
  env.workspace = path.join(env.root, 'workspace');
  env.userData = path.join(env.root, 'userData');
  fs.mkdirSync(env.workspace, { recursive: true });
  fs.mkdirSync(env.userData, { recursive: true });
});

test.afterAll(() => {
  if (env.root) fs.rmSync(env.root, { recursive: true, force: true });
});

async function launchPackaged(): Promise<{ app: ElectronApplication; page: Page }> {
  const { FLOORCANVAS_E2E: _e, FLOORCANVAS_E2E_WORKSPACE: _w, FLOORCANVAS_E2E_USER_DATA: _u, ELECTRON_DEV: _d, NODE_ENV: _n, ...rest } = process.env as Record<string, string | undefined>;
  const app = await electron.launch({
    executablePath: packagedExe,
    args: ['--lang=en-US'],
    env: {
      ...rest,
      FLOORCANVAS_E2E: '1',
      FLOORCANVAS_E2E_WORKSPACE: env.workspace,
      FLOORCANVAS_E2E_USER_DATA: env.userData,
    },
  });
  const page = await app.firstWindow();
  await expect(page.locator('header.desktop-only button[title="Save"]')).toBeVisible();
  return { app, page };
}

async function waitForFile(filePath: string, timeout = 20_000) {
  const start = Date.now();
  while (!fs.existsSync(filePath)) {
    if (Date.now() - start > timeout) throw new Error(`File never appeared: ${filePath}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

test('packaged app: starts, saves a new project to disk, and reopens it on relaunch', async () => {
  const { app, page } = await launchPackaged();

  await page.evaluate(() => {
    (window as unknown as { __store: { getState: () => { addObject: (o: object) => void } } }).__store.getState().addObject({
      id: 'packaged_smoke_marker',
      type: 'text',
      layerId: 'layer_labels',
      x: 12000,
      y: 4000,
      text: 'PACKAGED-SMOKE-MARKER',
      fontSize: 240,
      rotation: 0,
      visible: true,
      locked: false,
      color: '#0f172a',
    });
  });

  await page.locator('header.desktop-only button[title="Save"]').click();
  const projectFile = path.join(env.workspace, 'New Floor Plan', 'project.floormap.json');
  await waitForFile(projectFile);
  const saved = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  expect(saved.title).toBe('New Floor Plan');
  expect(saved.objects.some((o: { id: string }) => o.id === 'packaged_smoke_marker')).toBe(true);

  await app.close();

  // Relaunch: last project should reopen automatically.
  const relaunched = await launchPackaged();
  await expect
    .poll(() => relaunched.page.evaluate(() => (window as unknown as { __store: { getState: () => { project: { title: string } } } }).__store.getState().project.title))
    .toBe('New Floor Plan');
  await relaunched.app.close();
});

test('packaged app: loads built-in samples', async () => {
  const { app, page } = await launchPackaged();
  await page.selectOption('select.sample-select', 'builtin:sample-small-office');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __store: { getState: () => { project: { title: string } } } }).__store.getState().project.title))
    .toContain('Small Office');
  await expect(page.locator('.paper-boundary svg').first()).toBeVisible();
  await app.close();
});
