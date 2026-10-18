import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Plain-browser mode regression tests. `window.floorcanvasDesktop` must be
 * absent; File System Access APIs are disabled to force the universal
 * upload/download fallback that must work everywhere.
 */

const PROJECT_JSON_PATH = path.resolve('tests/fixtures/valid-project.floormap.json');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function openBrowserEditor(page: Page) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.addInitScript(() => {
    // Simulate the plainest browser: no desktop bridge, no FS Access API.
    Object.defineProperty(window, 'floorcanvasDesktop', { get: () => undefined });
    Object.defineProperty(window, 'showOpenFilePicker', { get: () => undefined });
    Object.defineProperty(window, 'showSaveFilePicker', { get: () => undefined });
  });
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.canvas-viewport')).toBeVisible();
}

test.describe('Web mode (no Electron bridge)', () => {
  test.setTimeout(60_000);

  test('starts and supports drawing with Electron APIs absent', async ({ page }) => {
    await openBrowserEditor(page);
    expect(await page.evaluate(() => (window as any).floorcanvasDesktop)).toBeUndefined();

    // representative drawing: wall tool drag creates a wall line
    const wallBtn = page.locator('button[title="Wall"], button:has-text("Wall"), button:has-text("壁")').first();
    await wallBtn.click();
    const box = await page.locator('.canvas-viewport').boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const startX = Math.round(box.x + box.width / 2);
      const startY = Math.round(box.y + box.height / 2);
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 150, startY, { steps: 5 });
      await page.mouse.up();
      const svg = page.locator('.paper-boundary svg').last();
      const wallLine = svg.locator('line:not(.selection-highlight):not(.selection-outline):not(.snap-guide)').last();
      await expect(wallLine).toBeAttached();
    }
  });

  test('undo/redo works in browser mode', async ({ page }) => {
    await openBrowserEditor(page);
    await page.evaluate(() => {
      const store = (window as any).__store.getState();
      store.pushToHistory();
      store.addObjects([
        { id: 'web_test_shape', type: 'shape', shapeType: 'rect', layerId: 'layer_notes', x: 4000, y: 4000, width: 2000, height: 1000, rotation: 0, visible: true, locked: false, stroke: '#334155' },
      ]);
      store.setActiveTool('select');
    });
    let count = await page.evaluate(() => (window as any).__store.getState().project.objects.filter((o: any) => o.id === 'web_test_shape').length);
    expect(count).toBe(1);
    await page.evaluate(() => (window as any).__store.getState().undo());
    count = await page.evaluate(() => (window as any).__store.getState().project.objects.filter((o: any) => o.id === 'web_test_shape').length);
    expect(count).toBe(0);
    await page.evaluate(() => (window as any).__store.getState().redo());
    count = await page.evaluate(() => (window as any).__store.getState().project.objects.filter((o: any) => o.id === 'web_test_shape').length);
    expect(count).toBe(1);
  });

  test('loads a .floormap.json via the file picker', async ({ page }) => {
    await openBrowserEditor(page);
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('header.desktop-only button:has-text("Open"), header.desktop-only button:has-text("開く")').first().click();
    const chooser = await chooserPromise;
    await chooser.setFiles(PROJECT_JSON_PATH);
    await page.waitForFunction(() => (window as any).__store.getState().project.title === 'Web Fixture Project', undefined, { timeout: 10_000 });
  });

  test('saves edits as a downloadable .floormap.json that reloads with the edits', async ({ page }) => {
    await openBrowserEditor(page);

    // make an edit
    await page.evaluate(() => {
      const store = (window as any).__store.getState();
      store.pushToHistory();
      store.addObjects([
        { id: 'web_save_edit_1', type: 'shape', shapeType: 'circle', layerId: 'layer_notes', x: 6000, y: 6000, radius: 800, rotation: 0, visible: true, locked: false, stroke: '#334155' },
      ]);
    });

    const downloadPromise = page.waitForEvent('download');
    await page.locator('header.desktop-only button:has-text("Save"), header.desktop-only button:has-text("保存")').first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.floormap\.json$/);

    const savedPath = path.join(os.tmpdir(), `web-save-${Date.now()}.floormap.json`);
    await download.saveAs(savedPath);
    const savedJson = JSON.parse(fs.readFileSync(savedPath, 'utf8'));

    // edit persisted
    expect(savedJson.objects.some((o: any) => o.id === 'web_save_edit_1')).toBe(true);
    // saved JSON passes validation
    const validationValid = await page.evaluate((json) => (window as any).__projectValidation.validateProject(json).valid, savedJson);
    expect(validationValid).toBe(true);

    // reload saved JSON
    const chooserPromise = page.waitForEvent('filechooser');
    await page.evaluate(() => (window as any).__store.getState().createNewProject('Reset'));
    await page.locator('header.desktop-only button:has-text("Open"), header.desktop-only button:has-text("開く")').first().click();
    const chooser = await chooserPromise;
    await chooser.setFiles(savedPath);
    await page.waitForFunction(() => (window as any).__store.getState().project.objects.some((o: any) => o.id === 'web_save_edit_1'), undefined, { timeout: 10_000 });
  });

  for (const sampleId of ['sample-small-office', 'sample-apartment', 'sample-cafe-shop']) {
    test(`${sampleId}: loads in pure browser mode`, async ({ page }) => {
      await openBrowserEditor(page);
      await page.locator('select.sample-select').selectOption(`builtin:${sampleId}`);
      await expect(page.locator('.room-element').first()).toBeAttached();
    });
  }

  test('background image import works in browser mode and survives save/reload', async ({ page }) => {
    await openBrowserEditor(page);

    const tmpPng = path.join(os.tmpdir(), `bg-${Date.now()}.png`);
    fs.writeFileSync(tmpPng, TINY_PNG);

    // Open the background panel (right sidebar) and click import
    const bgPanel = page.locator('.sidebar-right');
    await expect(bgPanel).toBeVisible();

    const chooserPromise = page.waitForEvent('filechooser');
    // The import button only exists when a background object does NOT exist (default state)
    const importBtn = page.locator('.sidebar-right button:has-text("Import"), .sidebar-right button:has-text("インポート"), .sidebar-right button:has-text("背景")').first();
    await importBtn.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(tmpPng);

    await page.waitForFunction(
      () => (window as any).__store.getState().project.objects.some((o: any) => o.type === 'background' && String(o.imageUrl || '').startsWith('data:image/')),
      undefined,
      { timeout: 10_000 },
    );

    // Save → download → JSON contains the embedded data URL
    const downloadPromise = page.waitForEvent('download');
    await page.locator('header.desktop-only button:has-text("Save"), header.desktop-only button:has-text("保存")').first().click();
    const download = await downloadPromise;
    const savedPath = path.join(os.tmpdir(), `bg-save-${Date.now()}.floormap.json`);
    await download.saveAs(savedPath);
    const savedJson = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
    const bg = savedJson.objects.find((o: any) => o.type === 'background');
    expect(bg).toBeTruthy();
    expect(String(bg.imageUrl)).toMatch(/^data:image\/png;base64,/);

    // reload → background intact
    await page.evaluate(() => (window as any).__store.getState().createNewProject('Reset'));
    const chooserPromise2 = page.waitForEvent('filechooser');
    await page.locator('header.desktop-only button:has-text("Open"), header.desktop-only button:has-text("開く")').first().click();
    const chooser2 = await chooserPromise2;
    await chooser2.setFiles(savedPath);
    await page.waitForFunction(
      () => (window as any).__store.getState().project.objects.some((o: any) => o.type === 'background' && String(o.imageUrl || '').startsWith('data:image/')),
      undefined,
      { timeout: 10_000 },
    );
  });
});
