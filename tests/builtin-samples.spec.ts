import { expect, test, type Page } from '@playwright/test';

/**
 * Built-in fictional sample regression tests (Small Office / Apartment /
 * Café-Small Retail). These samples are static frontend resources and must
 * load with no Electron APIs present.
 */

const BUILTIN_IDS = ['sample-small-office', 'sample-apartment', 'sample-cafe-shop'];

async function openEditor(page: Page) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

test.describe('Built-in fictional samples', () => {
  test.setTimeout(60_000);

  for (const sampleId of BUILTIN_IDS) {
    test(`${sampleId}: loads via dropdown in plain browser mode`, async ({ page }) => {
      await openEditor(page);
      const select = page.locator('select.sample-select');
      await select.selectOption(`builtin:${sampleId}`);
      await expect(page.locator('.paper-boundary svg').first()).toBeVisible();
      // Objects render (rooms + walls)
      await expect(page.locator('.room-element').first()).toBeAttached();
    });

    test(`${sampleId}: loaded project passes validation`, async ({ page }) => {
      await openEditor(page);
      await page.locator('select.sample-select').selectOption(`builtin:${sampleId}`);
      const result = await page.evaluate(async () => {
        const project = (window as any).__store.getState().project;
        const parsed = JSON.parse(JSON.stringify(project));
        const validation = (window as any).__projectValidation.validateProject(parsed);
        return { validation, objectCount: project.objects.length, hasRooms: project.objects.some((o: any) => o.type === 'room') };
      });
      expect(result.validation.valid, result.validation.error).toBe(true);
      expect(result.hasRooms).toBe(true);
      expect(result.objectCount).toBeGreaterThan(5);
    });

    test(`${sampleId}: editing works and produces valid saved JSON`, async ({ page }) => {
      await openEditor(page);
      await page.locator('select.sample-select').selectOption(`builtin:${sampleId}`);

      // Edit: add a wall via the store (same code path the Wall tool uses)
      const edited = await page.evaluate(() => {
        const store = (window as any).__store.getState();
        const before = store.project.objects.length;
        store.pushToHistory();
        store.setObjects([
          ...store.project.objects,
          { id: 'e2e_wall_edit_1', type: 'wall', layerId: 'layer_structural_walls', x1: 1000, y1: 1000, x2: 3000, y2: 1000, thickness: 100, rotation: 0, visible: true, locked: false, style: 'interior' },
        ]);
        store.setDirty(true);
        const project = (window as any).__store.getState().project;
        return { before, after: project.objects.length, json: JSON.stringify(project) };
      });

      expect(edited.after).toBe(edited.before + 1);
      const parsed = JSON.parse(edited.json);
      const wall = parsed.objects.find((o: any) => o.id === 'e2e_wall_edit_1');
      expect(wall).toBeTruthy();
      expect(wall.type).toBe('wall');

      // Saved JSON must pass validation (what Save writes is this project)
      const validation = await page.evaluate((json) => {
        return (window as any).__projectValidation.validateProject(JSON.parse(json));
      }, edited.json);
      expect(validation.valid).toBe(true);
    });
  }

  test('built-in samples load without any Electron bridge', async ({ page }) => {
    await page.addInitScript(() => {
      // Simulate a plain browser: no Electron preload must be present.
      Object.defineProperty(window, 'floorcanvasDesktop', { get: () => undefined });
    });
    await openEditor(page);
    for (const sampleId of BUILTIN_IDS) {
      await page.locator('select.sample-select').selectOption(`builtin:${sampleId}`);
      await expect(page.locator('.paper-boundary svg').first()).toBeVisible();
    }
    expect(await page.evaluate(() => (window as any).floorcanvasDesktop)).toBeUndefined();
  });

  test('sample templates do not point at a bundled writable file', async ({ page }) => {
    await openEditor(page);
    await page.locator('select.sample-select').selectOption('builtin:sample-small-office');
    const handle = await page.evaluate(() => (window as any).__store.getState().currentProjectHandle);
    expect(handle.isSample).toBe(true);
    expect(handle.projectPath).toBe('');
    expect(handle.folderPath).toBe('');
  });
});
