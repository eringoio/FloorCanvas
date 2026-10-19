import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * REAL Electron persistence regression tests (Windows/local).
 *
 * These launch the actual FloorCanvas Electron application with a temporary
 * isolated workspace + userData directory (never a real user workspace) and
 * exercise Save / Save As / Open / last-project restore / close dialog /
 * startup failure states through the real IPC bridge and disk.
 *
 * The test-only hooks (FLOORCANVAS_E2E*) are inert in production: without
 * FLOORCANVAS_E2E=1 they do nothing and workspace selection is unchanged.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface E2EEnv {
  root: string;
  workspace: string;
  userData: string;
}

function makeE2EEnv(prefix = 'floorcanvas-e2e-'): E2EEnv {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const workspace = path.join(root, 'workspace');
  const userData = path.join(root, 'userData');
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(userData, { recursive: true });
  return { root, workspace, userData };
}

async function launchApp(
  env: E2EEnv,
  opts: { expectEditor?: boolean; noWorkspace?: boolean } = {},
): Promise<{ app: ElectronApplication; page: Page }> {
  const { ELECTRON_DEV: _ignoredDev, NODE_ENV: _ignoredNodeEnv, ...restEnv } = process.env as Record<string, string | undefined>;
  const app = await electron.launch({
    args: ['.', '--lang=en-US'],
    cwd: repoRoot,
    env: {
      ...restEnv,
      FLOORCANVAS_E2E: '1',
      // Omitting the workspace override keeps the app on the settings-file
      // path (used for corrupt-settings tests). userData stays isolated.
      ...(opts.noWorkspace ? {} : { FLOORCANVAS_E2E_WORKSPACE: env.workspace }),
      FLOORCANVAS_E2E_USER_DATA: env.userData,
    },
  });
  liveApps.push(app);
  const page = await app.firstWindow();
  if (opts.expectEditor !== false) {
    await waitForEditor(page);
  }
  return { app, page };
}

const saveButton = 'header.desktop-only button[title="Save"], header.desktop-only button[title="保存"]';
const saveAsButton = 'header.desktop-only button[title="Save As"]';

// Locale-proof dialog button names: the app follows the OS/browser locale
// (en or ja); selectors must match either.
const savePromptButton = /^Save$|^保存$/;
const cancelPromptButton = /^Cancel$|^キャンセル$/;
const dontSavePromptButton = /^Don['’]t Save$|^保存しない$/;
const missingWorkspaceTitle = /Workspace Folder Unavailable|利用できません/;

const liveApps: ElectronApplication[] = [];
test.afterEach(async () => {
  // Safety net: never leave an Electron process behind if a test failed
  // before closing its app.
  while (liveApps.length) {
    await ensureAppExit(liveApps.pop()!);
  }
});

async function waitForEditor(page: Page) {
  await expect(page.locator(saveButton).first()).toBeVisible();
}

/** Make an identifiable edit through the real renderer store (dirty → true). */
async function addMarker(page: Page, id: string, text: string) {
  const ok = await page.evaluate(
    ([markerId, markerTxt]) => {
      const store = (window as unknown as { __store?: { getState: () => { addObject: (o: object) => void } } }).__store;
      if (!store) return false;
      store.getState().addObject({
        id: markerId,
        type: 'text',
        layerId: 'layer_labels',
        x: 12000,
        y: 4000,
        text: markerTxt,
        fontSize: 240,
        fontFamily: '"Meiryo", sans-serif',
        fontWeight: '600',
        align: 'center',
        rotation: 0,
        visible: true,
        locked: false,
        color: '#0f172a',
      });
      return true;
    },
    [id, text],
  );
  if (!ok) throw new Error('window.__store is not available in the Electron renderer');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __store?: { getState: () => { isDirty: boolean } } }).__store!.getState().isDirty))
    .toBe(true);
}

async function isDirty(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { __store?: { getState: () => { isDirty: boolean } } }).__store!.getState().isDirty);
}

async function projectTitle(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = (window as unknown as { __store?: { getState: () => { project: { title: string } } } }).__store!.getState();
    return s.project.title;
  });
}

/** Wait until a file exists on the REAL filesystem. */
async function waitForFile(filePath: string, timeout = 15_000) {
  const start = Date.now();
  while (!fs.existsSync(filePath)) {
    if (Date.now() - start > timeout) throw new Error(`File never appeared: ${filePath}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function readSettings(env: E2EEnv): Promise<{ workspacePath: string | null; lastProjectPath: string | null }> {
  const file = path.join(env.userData, 'floorcanvas-settings.json');
  if (!fs.existsSync(file)) return { workspacePath: null, lastProjectPath: null };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function workspaceFolders(workspace: string): string[] {
  return fs
    .readdirSync(workspace, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(workspace, d.name, 'project.floormap.json')))
    .map((d) => d.name)
    .sort();
}

/** Kick off a window close without waiting (the renderer may show the dialog). */
async function requestClose(app: ElectronApplication) {
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().forEach((w) => w.close());
  });
}

/** Force-exit the Electron main process; idempotent and safe when already dead. */
async function ensureAppExit(app: ElectronApplication) {
  await app.evaluate(({ app }) => app.exit()).catch(() => {
    /* process already gone */
  });
}

/** Close the app and wait for its process to exit; only safe when not dirty. */
async function closeWhenClean(app: ElectronApplication) {
  const closed = new Promise<void>((resolve) => app.on('close', resolve));
  await requestClose(app);
  await Promise.race([
    closed,
    new Promise((resolve) => setTimeout(resolve, 10_000)),
  ]);
  await ensureAppExit(app);
}

/** Wait for the Electron app process to exit (after a lifecycle action). */
function waitForAppExit(app: ElectronApplication, timeout = 20_000) {
  return Promise.race([
    new Promise<void>((resolve) => app.on('close', resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('app did not close')), timeout)),
  ]);
}

async function clearDirty(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __store?: { getState: () => { setDirty: (v: boolean) => void } } }).__store!.getState().setDirty(false);
  });
}

// ---------------------------------------------------------------------------
// Save → restart → last-project restore (the most important regression)
// ---------------------------------------------------------------------------

test('new project: first Save creates one folder on disk, repeated Saves overwrite, restart restores it', async () => {
  const env = makeE2EEnv('floorcanvas-e2e-reopen-');
  const { app, page } = await launchApp(env);

  // Sanity: no folders before saving.
  expect(workspaceFolders(env.workspace)).toEqual([]);

  await addMarker(page, 'e2e_marker_reopen', 'E2E-RESTART-MARKER-1');
  await page.click(saveButton);
  await expect.poll(() => isDirty(page), { timeout: 20_000 }).toBe(false);

  const projectDir = path.join(env.workspace, 'New Floor Plan');
  const projectFile = path.join(projectDir, 'project.floormap.json');
  await waitForFile(projectFile);
  expect(workspaceFolders(env.workspace)).toEqual(['New Floor Plan']);

  const saved = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  expect(saved.title).toBe('New Floor Plan');
  expect(saved.objects.some((o: { id: string }) => o.id === 'e2e_marker_reopen')).toBe(true);

  // Second edit + Save must overwrite, NOT create Project_1/2 folders.
  await addMarker(page, 'e2e_marker_second', 'E2E-RESTART-MARKER-2');
  await page.click(saveButton);
  await expect.poll(() => isDirty(page)).toBe(false);
  await expect.poll(() => fs.readFileSync(projectFile, 'utf8')).toContain('e2e_marker_second');
  expect(workspaceFolders(env.workspace)).toEqual(['New Floor Plan']);
  expect(JSON.parse(fs.readFileSync(projectFile, 'utf8')).objects.some((o: { id: string }) => o.id === 'e2e_marker_reopen')).toBe(true);

  // Restart with the same isolated workspace/userData → last project reopens.
  await closeWhenClean(app);
  const relaunched = await launchApp(env);
  const page2 = relaunched.page;
  await expect.poll(() => projectTitle(page2), { timeout: 20_000 }).toBe('New Floor Plan');
  const handle = await page2.evaluate(() => (window as unknown as { __store?: { getState: () => { currentProjectHandle: { folderPath: string; projectPath: string } | null } } }).__store!.getState().currentProjectHandle);
  expect(handle?.folderPath?.toLowerCase()).toBe(projectDir.toLowerCase());
  await expect
    .poll(() =>
      page2.evaluate(() => {
        const s = (window as unknown as { __store?: { getState: () => { project: { objects: { id: string }[] } } } }).__store!.getState();
        return s.project.objects.some((o) => o.id === 'e2e_marker_second');
      }),
    )
    .toBe(true);
  const settings = await readSettings(env);
  expect(settings.lastProjectPath).toBe(path.join(path.join(env.workspace, 'New Floor Plan'), 'project.floormap.json'));
  await closeWhenClean(relaunched.app);
});

// ---------------------------------------------------------------------------
// Built-in sample first Save
// ---------------------------------------------------------------------------

test('built-in sample: first Save promotes the synthetic handle to a real workspace project', async () => {
  const env = makeE2EEnv('floorcanvas-e2e-sample-');
  const { app, page } = await launchApp(env);

  await page.selectOption('select.sample-select', 'builtin:sample-small-office');
  await expect.poll(() => projectTitle(page), { timeout: 20_000 }).toContain('Small Office');

  let handle = await page.evaluate(() => (window as unknown as { __store?: { getState: () => { currentProjectHandle: { isSample?: boolean; folderPath: string; projectPath: string } | null } } }).__store!.getState().currentProjectHandle);
  expect(handle?.isSample).toBe(true);
  expect(handle?.folderPath).toBe('');
  expect(handle?.projectPath).toBe('');

  await addMarker(page, 'e2e_sample_marker_1', 'E2E-SAMPLE-MARKER-1');
  await page.click(saveButton);
  await expect.poll(() => isDirty(page), { timeout: 20_000 }).toBe(false);

  const savedTitle = await projectTitle(page);
  const projectDir = path.join(env.workspace, savedTitle);
  const projectFile = path.join(projectDir, 'project.floormap.json');
  await waitForFile(projectFile);
  const saved = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  expect(saved.title).toBe(savedTitle);
  expect(saved.objects.some((o: { id: string }) => o.id === 'e2e_sample_marker_1')).toBe(true);

  // Synthetic handle replaced by a real one.
  handle = await page.evaluate(() => (window as unknown as { __store?: { getState: () => { currentProjectHandle: { isSample?: boolean; folderPath: string } | null } } }).__store!.getState().currentProjectHandle);
  expect(handle?.isSample).toBeFalsy();
  expect(handle?.folderPath?.toLowerCase()).toBe(projectDir.toLowerCase());

  // Second Save must overwrite the same project, not create a second folder.
  await addMarker(page, 'e2e_sample_marker_2', 'E2E-SAMPLE-MARKER-2');
  await page.click(saveButton);
  await expect.poll(() => isDirty(page)).toBe(false);
  expect(workspaceFolders(env.workspace)).toEqual([savedTitle]);
  await expect.poll(() => fs.readFileSync(projectFile, 'utf8')).toContain('e2e_sample_marker_2');
  await closeWhenClean(app);
});

// ---------------------------------------------------------------------------
// Save As
// ---------------------------------------------------------------------------

test('Save As creates a second project folder and later Saves target only the new project', async () => {
  const env = makeE2EEnv('floorcanvas-e2e-saveas-');
  const { app, page } = await launchApp(env);

  await addMarker(page, 'e2e_as_base_marker', 'E2E-SAVEAS-BASE');
  await page.click(saveButton);
  await expect.poll(() => isDirty(page), { timeout: 20_000 }).toBe(false);
  const dirA = path.join(env.workspace, 'New Floor Plan');
  const fileA = path.join(dirA, 'project.floormap.json');
  await waitForFile(fileA);
  const contentA = fs.readFileSync(fileA, 'utf8');

  // Save As → collision-safe suffix, active handle switches to the new folder.
  await page.click(saveAsButton);
  await expect.poll(() => isDirty(page), { timeout: 20_000 }).toBe(false);
  const dirB = path.join(env.workspace, 'New Floor Plan_1');
  const fileB = path.join(dirB, 'project.floormap.json');
  await waitForFile(fileB);
  expect(workspaceFolders(env.workspace)).toEqual(['New Floor Plan', 'New Floor Plan_1']);

  const handle = await page.evaluate(() => (window as unknown as { __store?: { getState: () => { currentProjectHandle: { folderPath: string } | null } } }).__store!.getState().currentProjectHandle);
  expect(handle?.folderPath?.toLowerCase()).toBe(dirB.toLowerCase());

  // Source folder untouched.
  await expect.poll(() => fs.readFileSync(fileA, 'utf8')).toBe(contentA);

  // Subsequent Saves write B, not A.
  await addMarker(page, 'e2e_as_b_marker', 'E2E-SAVEAS-ONLY-B');
  await page.click(saveButton);
  await expect.poll(() => isDirty(page)).toBe(false);
  const jsonB = JSON.parse(fs.readFileSync(fileB, 'utf8'));
  expect(jsonB.objects.some((o: { id: string }) => o.id === 'e2e_as_b_marker')).toBe(true);
  expect(JSON.parse(fs.readFileSync(fileA, 'utf8')).objects.some((o: { id: string }) => o.id === 'e2e_as_b_marker')).toBe(false);
  await closeWhenClean(app);
});

// ---------------------------------------------------------------------------
// Assets: browser-style embedded data URL → Electron asset extraction
// ---------------------------------------------------------------------------

test('saving a project with an embedded data-URL background extracts it into assets/', async () => {
  const env = makeE2EEnv('floorcanvas-e2e-asset-');
  const { app, page } = await launchApp(env);

  // Emulate a project coming from browser mode: background with an embedded
  // data URL (tiny 1x1 PNG) and no assetPath.
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await page.evaluate((b64) => {
    const store = (window as unknown as { __store?: { getState: () => { addObject: (o: object) => void } } }).__store!;
    store.getState().addObject({
      id: 'background_browser_1',
      type: 'background',
      layerId: 'layer_background',
      x: 6000,
      y: 6000,
      width: 5000,
      height: 5000,
      rotation: 0,
      visible: true,
      locked: true,
      imageUrl: `data:image/png;base64,${b64}`,
      opacity: 0.4,
      lockAspectRatio: true,
      allowStretch: false,
    });
  }, pngBase64);
  await expect.poll(() => isDirty(page)).toBe(true);

  await page.click(saveButton);
  await expect.poll(() => isDirty(page), { timeout: 20_000 }).toBe(false);

  const projectDir = path.join(env.workspace, 'New Floor Plan');
  const projectFile = path.join(projectDir, 'project.floormap.json');
  await waitForFile(projectFile);
  // Give the save pipeline a moment to finish asset migration, then reload
  // the saved JSON from disk.
  const saved = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  const bg = saved.objects.find((o: { id: string }) => o.id === 'background_browser_1');
  expect(bg, 'background object persisted').toBeTruthy();
  expect(typeof bg.assetPath).toBe('string');
  expect(bg.assetPath).toMatch(/^assets\//);
  expect(bg.imageUrl).toBeUndefined();
  const assetFile = path.join(projectDir, ...bg.assetPath.split('/'));
  expect(fs.existsSync(assetFile), `asset file exists: ${assetFile}`).toBe(true);
  expect(fs.statSync(assetFile).size).toBeGreaterThan(0);

  // Round trip: reopening resolves the asset through the real bridge.
  await closeWhenClean(app);
  const relaunched = await launchApp(env);
  const page2 = relaunched.page;
  await expect.poll(() => projectTitle(page2), { timeout: 20_000 }).toBe('New Floor Plan');
  const resolved = await page2.evaluate(async () => {
    const desktop = (window as unknown as { floorcanvasDesktop?: { resolveAssetUrl: (h: object, p: string) => Promise<string | null> } }).floorcanvasDesktop!;
    const s = (window as unknown as { __store?: { getState: () => { project: { objects: { id: string; assetPath: string }[] }; currentProjectHandle: object } } }).__store!.getState();
    const bgObj = s.project.objects.find((o) => o.id === 'background_browser_1');
    return desktop.resolveAssetUrl(s.currentProjectHandle, bgObj.assetPath);
  });
  expect(typeof resolved).toBe('string');
  expect(resolved).toMatch(/^floorcanvas-asset:/);
  await closeWhenClean(relaunched.app);
});

// ---------------------------------------------------------------------------
// Close dialog with REAL save outcome
// ---------------------------------------------------------------------------

test('close dialog: dirty close → Save writes the file and the app closes', async () => {
  const env = makeE2EEnv('floorcanvas-e2e-close-save-');
  const { app, page } = await launchApp(env);
  await addMarker(page, 'e2e_close_save_marker', 'E2E-CLOSE-SAVE');

  await requestClose(app);
  const prompt = page.locator('.close-prompt');
  await expect(prompt).toBeVisible();
  // Save inside the dialog (exact match to avoid "Don't Save").
  await prompt.getByRole('button', { name: savePromptButton }).click();
  await waitForFile(path.join(env.workspace, 'New Floor Plan', 'project.floormap.json'));
  const data = JSON.parse(fs.readFileSync(path.join(env.workspace, 'New Floor Plan', 'project.floormap.json'), 'utf8'));
  expect(data.objects.some((o: { id: string }) => o.id === 'e2e_close_save_marker')).toBe(true);
  await waitForAppExit(app);
});

test('close dialog: dirty close → Cancel keeps the app open without saving', async () => {
  const env = makeE2EEnv('floorcanvas-e2e-close-cancel-');
  const { app, page } = await launchApp(env);
  await addMarker(page, 'e2e_close_cancel_marker', 'E2E-CLOSE-CANCEL');

  await requestClose(app);
  const prompt = page.locator('.close-prompt');
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: cancelPromptButton }).click();
  await expect(prompt).not.toBeVisible();

  // App must still be running with the project untouched.
  expect(await isDirty(page)).toBe(true);
  expect(workspaceFolders(env.workspace)).toEqual([]);
  await clearDirty(page);
  await closeWhenClean(app);
});

test('close dialog: dirty close → Don\u2019t Save closes without writing new changes', async () => {
  const env = makeE2EEnv('floorcanvas-e2e-close-dontsave-');
  const { app, page } = await launchApp(env);
  await addMarker(page, 'e2e_close_discard_marker', 'E2E-CLOSE-DISCARD');

  await requestClose(app);
  const prompt = page.locator('.close-prompt');
  await expect(prompt).toBeVisible();
  await clickAllowingPageClose(page, prompt.getByRole('button', { name: dontSavePromptButton }));
  await waitForAppExit(app);
  await relaunchedNothingSaved(env);
});

/**
 * Click a close-dialog choice that will destroy the page. Playwright's click
 * can legitimately throw "Target page ... has been closed" when the app exits
 * immediately after the click (Don't Save path); that outcome is expected and
 * verified separately via waitForAppExit.
 */
async function clickAllowingPageClose(page: Page, button: ReturnType<Page['getByRole']>) {
  try {
    await button.click();
  } catch (err) {
    if (!/has been closed/i.test(String(err))) throw err;
    if (!page.isClosed()) throw err;
  }
}

async function relaunchedNothingSaved(env: E2EEnv) {
  // No project folder or settings lastProjectPath should exist.
  expect(workspaceFolders(env.workspace)).toEqual([]);
  const settings = await readSettings(env);
  expect(settings.lastProjectPath).toBe(null);
  // A relaunch starts normally (editor directly, no stale project).
  const relaunched = await launchApp(env, { expectEditor: false });
  await waitForEditor(relaunched.page);
  await closeWhenClean(relaunched.app);
}

// ---------------------------------------------------------------------------
// Save failure keeps changes safe
// ---------------------------------------------------------------------------

test('Save with a removed workspace fails safely: dirty stays true, project stays open', async () => {
  const env = makeE2EEnv('floorcanvas-e2e-savefail-');
  const { app, page } = await launchApp(env);
  await addMarker(page, 'e2e_fail_marker', 'E2E-FAIL-MARKER');

  // Remove the workspace out from under the running app.
  fs.rmdirSync(env.workspace);
  expect(workspaceDirsBeforeFailure(env)).toEqual([]);

  await page.click(saveButton);
  // Failed save: dirty remains true, no handle stored, no crash.
  await expect
    .poll(async () => {
      const s = await page.evaluate(() => {
        const state = (window as unknown as { __store?: { getState: () => { isDirty: boolean; currentProjectHandle: object | null } } }).__store!.getState();
        return { dirty: state.isDirty, handle: state.currentProjectHandle };
      });
      return s;
    }, { timeout: 20_000 })
    .toEqual({ dirty: true, handle: null });

  // Close flow with the failing Save: dialog stays open, then Don't Save closes.
  await requestClose(app);
  const prompt = page.locator('.close-prompt');
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: savePromptButton }).click();
  await expect(prompt).toBeVisible({ timeout: 20_000 });
  expect(await isDirty(page)).toBe(true);
  await clearDirty(page);
  await closeWhenClean(app);
});

function workspaceDirsBeforeFailure(env: E2EEnv): string[] {
  try {
    return fs.readdirSync(env.workspace);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Startup edge cases against the REAL app
// ---------------------------------------------------------------------------

test('lastProjectPath pointing to a deleted project: app recovers, clears the stale reference, shows the start screen', async () => {
  const env = makeE2EEnv('floorcanvas-e2e-stale-');
  // Pre-seed settings: valid workspace, last project that will not exist.
  const goneProject = path.join(env.workspace, 'Gone');
  fs.writeFileSync(
    path.join(env.userData, 'floorcanvas-settings.json'),
    JSON.stringify({ version: 1, workspacePath: env.workspace, lastProjectPath: path.join(goneProject, 'project.floormap.json') }, null, 2),
    'utf8',
  );

  const { app, page } = await launchApp(env, { expectEditor: false });
  await expect(page.locator('.start-screen'), 'start screen appears for the stale project').toBeVisible({ timeout: 20_000 });
  // Stale reference cleared.
  await expect
    .poll(async () => (await readSettings(env)).lastProjectPath, { timeout: 15_000 })
    .toBe(null);
  await closeWhenClean(app);
});

test('workspace directory removed while remembered: app does not crash, shows unavailable state and keeps the remembered path', async () => {
  const env = makeE2EEnv('floorcanvas-e2e-wsmissing-');
  fs.writeFileSync(
    path.join(env.userData, 'floorcanvas-settings.json'),
    JSON.stringify({ version: 1, workspacePath: env.workspace, lastProjectPath: null }, null, 2),
    'utf8',
  );
  fs.rmdirSync(env.workspace);

  const { app, page } = await launchApp(env, { expectEditor: false });
  await expect(page.locator('.workspace-gate'), 'missing workspace gate appears').toBeVisible({ timeout: 20_000 });
  const gateText = await page.locator('.workspace-gate').textContent();
  expect(gateText, 'unavailable-state title shown (en or ja)').toMatch(missingWorkspaceTitle);
  // Remembered path preserved for retry.
  expect(gateText).toContain('workspace');
  const settings = await readSettings(env);
  expect(settings.workspacePath).toBe(env.workspace);
  await app.close();
});

test('corrupt settings JSON: app starts fresh without crashing', async () => {
  const env = makeE2EEnv('floorcanvas-e2e-corrupt-');
  fs.writeFileSync(path.join(env.userData, 'floorcanvas-settings.json'), '{not json', 'utf8');

  // No workspace override: corrupt settings must degrade to the first-run
  // welcome gate (defaults), not a crash.
  const { app, page } = await launchApp(env, { expectEditor: false, noWorkspace: true });
  await expect(page.locator('.workspace-gate'), 'welcome gate appears without a workspace').toBeVisible({ timeout: 20_000 });
  await app.close();
});
