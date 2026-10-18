import { expect, test } from '@playwright/test';
import { installMockDesktopProjects } from './helpers/mockDesktopProjects';

test.describe('QoL Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Auto accept confirm dialogs
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    await installMockDesktopProjects(page);
  });

  test('dropdown exists and samples can be loaded', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Dropdown exists
    const select = page.locator('select.sample-select');
    await expect(select).toBeVisible();

    // 2. Select the first mock project and verify SVG appears
    await select.selectOption('mock-office');
    await expect(page.locator('.paper-boundary svg').first()).toBeVisible();

    // 3. Select the second mock project and verify SVG appears
    await select.selectOption('mock-large');
    await expect(page.locator('.paper-boundary svg').first()).toBeVisible();
  });

  test('export modal opens', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click export button
    const exportBtn = page.locator('button:has-text("Export"), button[title="Export"], button:has-text("エクスポート")').first();
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    // Verify export modal is visible
    await expect(page.getByText('Export Floor Plan')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export File' })).toBeVisible();
  });
});
