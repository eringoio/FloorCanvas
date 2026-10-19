import { expect, test, type Page } from '@playwright/test';

/**
 * Representative editor feature regression tests: layers, grid toggles,
 * scale/paper settings, dimensions and Unicode (Japanese) text rendering.
 */

type Store = {
  __store: {
    getState: () => Record<string, any>;
  };
};

async function openEditor(page: Page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.canvas-viewport')).toBeVisible();
  await expect(page.locator('.paper-boundary svg').first()).toBeVisible();
}

/** In-page store snapshot (must be called from within page.evaluate). */

test.describe('Editor feature regressions', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
  });

  test('layer visibility toggle hides and restores layer objects', async ({ page }) => {
    await openEditor(page);
    const before = await page.evaluate(() => {
      const s = (window as unknown as Store).__store.getState();
      return { visible: s.project.layers.find((l: any) => l.id === 'layer_structural_walls').visible, items: document.querySelectorAll('.layer-item').length };
    });
    expect(before.visible).toBe(true);

    const row = page.locator('.layer-item', { hasText: 'Structural Walls' });
    await row.locator('input[type="checkbox"]').uncheck();
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as Store).__store.getState().project.layers.find((l: any) => l.id === 'layer_structural_walls').visible),
      )
      .toBe(false);
    expect(await page.evaluate(() => (window as unknown as Store).__store.getState().isDirty)).toBe(true);

    await row.locator('input[type="checkbox"]').check();
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as Store).__store.getState().project.layers.find((l: any) => l.id === 'layer_structural_walls').visible),
      )
      .toBe(true);
  });

  test('layer lock and reorder work through the panel', async ({ page }) => {
    await openEditor(page);

    // Lock/unlock the first real layer row (index 1 = first layer after ✨ Auto).
    const firstLayerRow = page.locator('.layer-item').nth(1);
    await firstLayerRow.locator('button[title="Lock layer"]').click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as Store).__store.getState().project.layers[0].locked),
      )
      .toBe(true);
    // Unlock again through the same button.
    await firstLayerRow.locator('button[title="Unlock layer"]').click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as Store).__store.getState().project.layers[0].locked))
      .toBe(false);

    // Reorder: move the top layer down.
    const ordersBefore = await page.evaluate(() =>
      (window as unknown as Store).__store.getState().project.layers.map((l: any) => ({ id: l.id, order: l.order })),
    );
    await firstLayerRow.locator('button[title="Move layer down (draw later)"]').click();
    const ordersAfter = await page.evaluate(() =>
      (window as unknown as Store).__store.getState().project.layers.map((l: any) => ({ id: l.id, order: l.order })),
    );
    expect(JSON.stringify(ordersAfter)).not.toBe(JSON.stringify(ordersBefore));
    expect(ordersAfter[0].id).toBe(ordersBefore[1].id);
    expect(ordersAfter[1].id).toBe(ordersBefore[0].id);
  });

  test('new layer added via the store appears in the panel', async ({ page }) => {
    await openEditor(page);
    await page.evaluate(() => {
      (window as unknown as Store).__store.getState().addLayer({ id: 'layer_test_created', name: 'E2E Test Layer', visible: true, locked: false, order: 99 });
    });
    await expect(page.locator('.layer-item', { hasText: 'E2E Test Layer' })).toBeVisible();
    await page.locator('.layer-item', { hasText: 'E2E Test Layer' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as Store).__store.getState().activeLayerId))
      .toBe('layer_test_created');
  });

  test('grid and snap toggles update the store through the toolbar', async ({ page }) => {
    await openEditor(page);
    const initial = await page.evaluate(() => {
      const g = (window as unknown as Store).__store.getState().project.grid;
      return { visible: g.visible, snap: g.snap };
    });

    await page.locator('button[title="Toggle alignment grid"]').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as Store).__store.getState().project.grid.visible)).toBe(!initial.visible);
    await page.locator('button[title="Toggle alignment grid"]').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as Store).__store.getState().project.grid.visible)).toBe(initial.visible);

    await page.locator('button[title="Toggle snap to grid/elements"]').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as Store).__store.getState().project.grid.snap)).toBe(!initial.snap);
    await page.locator('button[title="Toggle snap to grid/elements"]').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as Store).__store.getState().project.grid.snap)).toBe(initial.snap);
  });

  test('paper size and orientation changes apply to the sheet', async ({ page }) => {
    await openEditor(page);
    const paperSelect = page.locator('.sidebar-right select').first();
    await expect(paperSelect).toBeVisible();
    await paperSelect.selectOption('A3');
    await expect
      .poll(() => page.evaluate(() => (window as unknown as Store).__store.getState().project.canvas.paperSize))
      .toBe('A3');

    const orientationSelect = page.locator('.sidebar-right select').nth(1);
    await orientationSelect.selectOption('portrait');
    await expect
      .poll(() => page.evaluate(() => (window as unknown as Store).__store.getState().project.canvas.orientation))
      .toBe('portrait');
  });

  test('unit switch applies to the project document', async ({ page }) => {
    await openEditor(page);
    await page.evaluate(() => (window as unknown as Store).__store.getState().setUnit('m'));
    await expect.poll(() => page.evaluate(() => (window as unknown as Store).__store.getState().project.unit)).toBe('m');
    await page.evaluate(() => (window as unknown as Store).__store.getState().setUnit('mm'));
    await expect.poll(() => page.evaluate(() => (window as unknown as Store).__store.getState().project.unit)).toBe('mm');
  });

  test('dimension objects render with computed display text', async ({ page }) => {
    await openEditor(page);
    await page.evaluate(() => {
      (window as unknown as Store).__store.getState().addObject({
        id: 'e2e_dim_1',
        type: 'dimension',
        layerId: 'layer_dimensions',
        x1: 2000,
        y1: 6000,
        x2: 9000,
        y2: 6000,
        offset: -800,
        unit: 'mm',
        autoValue: 7000,
        displayText: '7,000',
        textOverride: false,
        rotation: 0,
        visible: true,
        locked: false,
      });
    });
    await expect(page.getByText('7,000', { exact: true })).toBeVisible();
    const obj = await page.evaluate(() => (window as unknown as Store).__store.getState().project.objects.find((o: any) => o.id === 'e2e_dim_1'));
    expect(obj?.autoValue).toBe(7000);
  });

  test('Unicode text renders, including Japanese labels', async ({ page }) => {
    await openEditor(page);
    await page.evaluate(() => {
      (window as unknown as Store).__store.getState().addObject({
        id: 'e2e_text_ja',
        type: 'text',
        layerId: 'layer_labels',
        x: 5000,
        y: 4000,
        text: 'リビング\n会議室\n入口',
        fontSize: 240,
        fontFamily: '"Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif',
        fontWeight: '600',
        align: 'center',
        rotation: 0,
        visible: true,
        locked: false,
        color: '#0f172a',
      });
    });
    const tspan = await page.locator('.paper-boundary svg text:has-text("リビング")').first().textContent();
    expect(tspan).toContain('リビング');
  });

  test('duplicate / delete through the store creates unique ids and removes the object', async ({ page }) => {
    await openEditor(page);
    await page.evaluate(() => {
      const s = (window as unknown as Store).__store.getState();
      s.setSelectedIds(['label_1']);
      s.duplicateObjects(['label_1']);
    });
    const cloned = await page.evaluate(() =>
      (window as unknown as Store).__store.getState().project.objects
        .filter((o: any) => o.type === 'text' && String(o.text).includes('Room 101'))
        .map((o: any) => o.id),
    );
    expect(cloned.length, 'duplicate creates a second Room 101 label').toBe(2);
    expect(new Set(cloned).size, 'duplicate receives a unique id').toBe(2);

    await page.evaluate(() => {
      const s = (window as unknown as Store).__store.getState();
      const dup = s.project.objects.find((o: any) => o.id !== 'label_1' && String(o.text).includes('Room 101'));
      s.deleteObject(dup.id);
    });
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as Store).__store.getState().project.objects.filter((o: any) => String(o.text).includes('Room 101')).length),
      )
      .toBe(1);
  });
});
