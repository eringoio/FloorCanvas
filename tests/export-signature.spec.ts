import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Export regression tests (browser mode): PNG / SVG / PDF must complete
 * without error and produce a non-empty download with the correct file
 * signature. Files are written to a disposable temp directory only.
 */

let outDir: string;
test.beforeEach(async () => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'floorcanvas-export-'));
});
test.afterEach(async () => {
  fs.rmSync(outDir, { recursive: true, force: true });
});

async function openExportModal(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const exportBtn = page.locator('header.desktop-only button:has-text("Export")').first();
  await expect(exportBtn).toBeVisible();
  await exportBtn.click();
  await expect(page.getByText('Export Floor Plan')).toBeVisible();
  await expect(page.locator('.paper-boundary svg').first()).toBeVisible();
}

async function exportAs(page: import('@playwright/test').Page, format: 'SVG' | 'PNG' | 'PDF'): Promise<string> {
  await page.locator('.toolbar-btn', { hasText: new RegExp(`^${format}$`) }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('button', { name: 'Export File' }).click(),
  ]);
  const target = path.join(outDir, download.suggestedFilename());
  await download.saveAs(target);
  return target;
}

test.describe('Export file generation', () => {
  test('SVG export produces a non-empty file with an SVG signature', async ({ page }) => {
    await openExportModal(page);
    const target = await exportAs(page, 'SVG');
    const stat = fs.statSync(target);
    expect(stat.size, 'SVG file is non-empty').toBeGreaterThan(100);
    const head = fs.readFileSync(target, 'utf8').slice(0, 200);
    expect(head).toMatch(/<svg|<\?xml/i);
    expect(target.endsWith('.svg')).toBe(true);
  });

  test('PNG export produces a non-empty file with the PNG signature', async ({ page }) => {
    await openExportModal(page);
    const target = await exportAs(page, 'PNG');
    const stat = fs.statSync(target);
    expect(stat.size, 'PNG file is non-empty').toBeGreaterThan(1000);
    const sig = fs.readFileSync(target).subarray(0, 8);
    expect([...sig]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  test('PDF export produces a non-empty file with the PDF signature', async ({ page }) => {
    await openExportModal(page);
    const target = await exportAs(page, 'PDF');
    const stat = fs.statSync(target);
    expect(stat.size, 'PDF file is non-empty').toBeGreaterThan(1000);
    const head = fs.readFileSync(target, 'utf8').slice(0, 8);
    expect(head.startsWith('%PDF')).toBe(true);
  });
});
