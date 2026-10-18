import { test, expect } from '@playwright/test';
import { installMockDesktopProjects } from './helpers/mockDesktopProjects';

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
  hasTouch: true,
  isMobile: true,
});

test.describe('Mobile Touch QA', () => {
  test('opens drawers, selects tools, draws with touch/pointer, and verifies status bar', async ({ page }) => {
    page.on('console', msg => {
      console.log('BROWSER LOG:', msg.text());
    });

    // Auto accept confirm dialogs
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await page.goto('/');

    // 1. Verify mobile action bar is rendered
    const actionBar = page.locator('.mobile-action-bar');
    await expect(actionBar).toBeVisible();

    // 2. Open Parts library drawer
    const partsBtn = actionBar.locator('button').first();
    await partsBtn.click();

    const drawer = page.locator('.mobile-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.mobile-drawer-header h3')).toContainText(/Parts Library|パーツ/);

    // 3. Choose the "Wall" tool inside the visible mobile drawer
    const wallPartBtn = drawer.locator('button:has-text("Wall"), button:has-text("壁")').first();
    await expect(wallPartBtn).toBeVisible();
    await wallPartBtn.click();

    // 4. Close the drawer
    await page.locator('.mobile-drawer-close').click();
    await expect(drawer).not.toBeVisible();

    // 5. Verify the active tool mode in the status bar is "Wall"
    const statusbar = page.locator('.statusbar');
    await expect(statusbar).toBeVisible();
    await expect(statusbar).toContainText(/Mode: Wall|壁/);

    // 6. Draw a wall on the viewport by simulating pointer drag
    const viewport = page.locator('.canvas-viewport');
    const viewportBox = await viewport.boundingBox();
    expect(viewportBox).not.toBeNull();

    if (viewportBox) {
      const startX = Math.round(viewportBox.x + viewportBox.width / 2);
      const startY = Math.round(viewportBox.y + viewportBox.height / 2);
      const endX = startX + 150;
      const endY = startY + 150;

      // Simulate pointer drag using playwright's page.mouse.move (maps to touch when hasTouch: true)
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 10 });
      await page.mouse.up();

      // 7. Verify that the wall SVG element was created
      const svg = page.locator('.paper-boundary svg').last();
      await expect(svg).toBeVisible();
      // Walls are drawn as g tags containing lines or paths
      const svgContent = await svg.innerHTML();
      expect(svgContent).toContain('line');
    }
  });

  test('mobile project loading and verification', async ({ page }) => {
    // Auto accept confirm dialogs
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    await installMockDesktopProjects(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Open the mobile menu by clicking the "More" button
    const moreBtn = page.locator('header.mobile-only button:has-text("More")');
    await expect(moreBtn).toBeVisible();
    await moreBtn.click();

    // 2. Select and click "Mock Floor Plan"
    const mockProjectBtn = page.locator('button:has-text("Mock Floor Plan")').first();
    await expect(mockProjectBtn).toBeVisible();
    await mockProjectBtn.click();

    // 3. Verify that the menu overlay closes
    await expect(mockProjectBtn).toBeHidden();

    // 4. Assert that the loaded plan is rendered
    const svg = page.locator('.paper-boundary svg').first();
    await expect(svg).toBeVisible();

    // 5. Verify the loaded content contains key strings from the mock fixture
    const paperText = await page.locator('.paper-boundary').first().textContent();
    expect(paperText).toContain('Room A');
  });
});
