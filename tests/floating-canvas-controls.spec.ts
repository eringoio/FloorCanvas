import { expect, test, type Page } from '@playwright/test';
import { installMockDesktopProjects } from './helpers/mockDesktopProjects';

async function gotoApp(page: Page) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1400, height: 1000 });

  await installMockDesktopProjects(page);

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message, err.stack));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

test.describe('Viewport-Stable Floating Canvas Controls', () => {
  test.setTimeout(60_000);

  test('floating wall controls are stable in size across zoom levels and upright', async ({ page }) => {
    await gotoApp(page);

    // Load the mock project
    const select = page.locator('select.sample-select');
    await select.selectOption('mock-office');
    await expect(page.locator('.paper-boundary svg').first()).toBeVisible();

    // Wait for walls to render (SVG <line> elements have zero-height bounding
    // boxes, so "attached" is the right state here)
    await page.waitForSelector('.canvas-wall-object line', { state: 'attached', timeout: 5000 });

    // Select the standalone wall via the store (deterministic; a synthetic
    // click on a thin SVG line is unreliable across zoom levels)
    await page.evaluate(() => {
      const store = (window as any).__store;
      store.getState().setActiveTool('select');
      store.getState().setSelectedIds(['mock_wall_top']);
    });

    // Floating controls overlay should become visible
    const toolbar = page.locator('.floating-canvas-controls');
    await expect(toolbar).toBeVisible();

    // Measure bounding box at initial zoom
    const box1 = await toolbar.boundingBox();
    expect(box1).not.toBeNull();

    // Zoom in
    await page.locator('header.desktop-only button[title="Zoom In"]').first().click();
    await page.waitForTimeout(200);

    // Measure bounding box again
    const box2 = await toolbar.boundingBox();
    expect(box2).not.toBeNull();

    // Width and height should be viewport-stable (essentially unchanged)
    expect(Math.abs(box1!.width - box2!.width)).toBeLessThan(2);
    expect(Math.abs(box1!.height - box2!.height)).toBeLessThan(2);

    // Confirm it remains horizontal (upright) by checking it doesn't have rotation transform style
    const styleAttr = await toolbar.getAttribute('style') || '';
    expect(styleAttr).not.toContain('rotate');
    expect(styleAttr).toContain('translate(-50%, -50%)');

    // Count initial openings
    const initialOpenings = await page.locator('.opening-element').count();

    // Add Door
    const addDoorBtn = page.locator('.floating-canvas-controls button[title="Add Door"]');
    await expect(addDoorBtn).toBeVisible();
    await addDoorBtn.click();
    await expect(page.locator('.opening-element')).toHaveCount(initialOpenings + 1);

    // Add Window
    const addWindowBtn = page.locator('.floating-canvas-controls button[title="Add Window"]');
    await expect(addWindowBtn).toBeVisible();
    await addWindowBtn.click();
    await expect(page.locator('.opening-element')).toHaveCount(initialOpenings + 2);
  });
});
