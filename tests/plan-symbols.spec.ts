import { expect, test } from '@playwright/test';
import { PLAN_SYMBOLS } from '../src/symbols/symbolMetadata';

test.describe('plan symbol gallery', () => {
  test('renders every known symbol and the fallback symbol', async ({ page }) => {
    await page.goto('/?dev=symbols');
    await expect(page.getByTestId('symbol-gallery')).toBeVisible();

    for (const id of Object.keys(PLAN_SYMBOLS)) {
      await expect(page.getByTestId(`symbol-${id}`)).toBeVisible();
      const symbolNodeCount = await page.locator(`[data-symbol-id="${id}"] .plan-symbol-${id}, [data-symbol-id="${id}"] .symbol-${id}`).count();
      expect(symbolNodeCount).toBeGreaterThan(0);
    }
  });

  test('important symbols have distinct SVG structures', async ({ page }) => {
    await page.goto('/?dev=symbols');
    const structure = async (id: string) => page.getByTestId(`symbol-${id}`).evaluate((el) => el.innerHTML);

    const chair = await structure('chair');
    expect(chair).toContain('symbol-chair');
    expect(chair).not.toMatch(/<circle[^>]+r=/);

    const sofa = await structure('sofa');
    const table = await structure('table');
    expect(sofa).toContain('symbol-sofa');
    expect(table).toContain('symbol-table');
    expect(sofa).not.toBe(table);

    const cabinet = await structure('cabinet');
    const closet = await structure('closet');
    const shelf = await structure('shelf');
    expect(cabinet).toContain('symbol-cabinet');
    expect(closet).toContain('symbol-closet');
    expect(shelf).toContain('symbol-shelf');
    expect(new Set([cabinet, closet, shelf]).size).toBe(3);

    const toilet = await structure('toilet');
    const urinal = await structure('urinal');
    expect(toilet).toContain('symbol-toilet');
    expect(urinal).toContain('symbol-urinal');
    expect(toilet).not.toBe(urinal);
  });

  test('classroom layout array has its own toolbar-style preview', async ({ page }) => {
    await page.goto('/?dev=symbols');
    await expect(page.getByTestId('symbol-classroom_array')).toBeVisible();
    // The icon renders a 3x2 grid of desk+chair pairs -> 12 rects.
    const count = await page.locator('[data-symbol-id="classroom_array"] .classroom-array-icon rect').count();
    expect(count).toBeGreaterThanOrEqual(6 * 2);
  });

  test('legacy male_toilet furnitureType still renders safely as urinal', async ({ page }) => {
    await page.goto('/?dev=symbols');
    const tile = page.getByTestId('symbol-legacy-male_toilet');
    await expect(tile).toBeVisible();
    const html = await tile.evaluate((el) => el.innerHTML);
    expect(html).toContain('symbol-urinal');
    expect(html).not.toContain('symbol-fallback');
  });

  test('captures a full gallery screenshot for manual visual QA', async ({ page }) => {
    await page.goto('/?dev=symbols');
    await expect(page.getByTestId('symbol-gallery')).toBeVisible();
    await page.screenshot({ path: 'test-results/symbol-gallery/current/plan-symbol-gallery.png', fullPage: true });
  });
});
